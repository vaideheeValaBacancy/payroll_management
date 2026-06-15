"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployees } from "@/hooks/useEmployees";
import { usePayrollRuns } from "@/hooks/usePayrollRuns";
import {
  addAuditLog,
  createPayrollRun,
  getEmployees,
  getRiskConfig,
  updatePayrollRun,
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { calculateAnomalyScore } from "@/lib/scoringEngine";
import { useAppStore } from "@/store/useAppStore";
import type {
  Employee,
  IndianDeductions,
  IndianEarnings,
  PayrollRun,
  RunStatus,
} from "@/types";
import { writeBatch, doc, collection, Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";

// ─── Status badge ────────────────────────────────────────────────────────────

const statusConfig: Record<RunStatus, { label: string; className: string }> = {
  COMPLETED: {
    label: "COMPLETED",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  PROCESSING: {
    label: "PROCESSING",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  PENDING: {
    label: "PENDING",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  FAILED: {
    label: "FAILED",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

function RunStatusBadge({ status }: { status: RunStatus }) {
  const { label, className } = statusConfig[status];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function formatMoney(value: number) {
  return (
    "₹" +
    value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ─── Default run label ───────────────────────────────────────────────────────

function defaultRunLabel() {
  return (
    new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }) +
    " Payroll"
  );
}

// ─── Run Payroll Dialog ──────────────────────────────────────────────────────

interface RunPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RunPayrollDialog({ open, onOpenChange }: RunPayrollDialogProps) {
  const [runLabel, setRunLabel] = useState(defaultRunLabel);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const { employees: activeEmployees, loading: empLoading } = useEmployees(true);
  const user = useAppStore((s) => s.user);

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleStartRun() {
    if (running) return;
    setRunning(true);
    setLog([]);

    const runId = `run_${Date.now()}`;
    const now = Timestamp.now();

    try {
      // 1. Create payroll run in PROCESSING state
      appendLog("Creating payroll run…");
      const initialRun: PayrollRun = {
        id: runId,
        runLabel: runLabel.trim() || defaultRunLabel(),
        createdAt: now,
        status: "PROCESSING",
        totalEmployees: 0,
        totalGrossInr: 0,
        totalNetInr: 0,
        flaggedCount: 0,
        clearedCount: 0,
        quarantinedCount: 0,
      };
      await createPayrollRun(initialRun);

      // 2. Fetch employees
      appendLog("Fetching employees…");
      const allEmployees = await getEmployees();
      const employees = allEmployees.filter((e) => e.isActive);
      appendLog(`Found ${employees.length} active employees.`);

      // 3. Fetch risk config
      appendLog("Loading risk configuration…");
      const config = await getRiskConfig();
      const thresholds = {
        quarantine: config.anomalyScoreQuarantine,
        review: config.anomalyScoreReview,
      };

      // 4. Build routing-hash frequency map for shared routing detection
      const routingHashFreq = new Map<string, number>();
      for (const emp of employees) {
        routingHashFreq.set(
          emp.bankRoutingHash,
          (routingHashFreq.get(emp.bankRoutingHash) ?? 0) + 1
        );
      }

      // 5. Score and compute payslips
      appendLog("Scoring transactions…");

      let totalGross = 0;
      let totalNet = 0;
      let flaggedCount = 0;
      let clearedCount = 0;
      let quarantinedCount = 0;

      const batch = writeBatch(db);
      const auditPromises: Promise<void>[] = [];

      for (const emp of employees) {
        const monthly = emp.baseSalaryInr; // baseSalaryInr is already the monthly figure

        // Earnings breakdown
        const earnings: IndianEarnings = {
          basic: parseFloat((monthly * 0.4).toFixed(2)),
          hra: parseFloat((monthly * 0.2).toFixed(2)),
          specialAllowance: parseFloat((monthly * 0.1).toFixed(2)),
          foodAllowance: parseFloat((monthly * 0.08).toFixed(2)),
          flexiPay: parseFloat((monthly * 0.15).toFixed(2)),
          fuelAllowance: parseFloat((monthly * 0.07).toFixed(2)),
        };

        const totalEarnings = parseFloat(
          Object.values(earnings)
            .reduce((a, b) => a + b, 0)
            .toFixed(2)
        );

        // Deductions
        const pfEmployee = parseFloat(
          Math.min(earnings.basic * 0.12, 1800).toFixed(2)
        );
        const pfEmployer = pfEmployee;
        const deductions: IndianDeductions = {
          pfEmployee,
          pfEmployer,
          professionalTax: 200,
          incomeTax: parseFloat((totalEarnings * 0.1).toFixed(2)),
          foodAllowanceDeduction: earnings.foodAllowance,
          fuelAllowanceDeduction: earnings.fuelAllowance,
        };

        const totalContributions = parseFloat(
          (pfEmployee + pfEmployer).toFixed(2)
        );
        const totalDeductions = parseFloat(
          (
            deductions.professionalTax +
            deductions.incomeTax +
            deductions.foodAllowanceDeduction +
            deductions.fuelAllowanceDeduction
          ).toFixed(2)
        );
        const netPayable = parseFloat(
          (totalEarnings - pfEmployee - totalDeductions).toFixed(2)
        );

        // Routing-change detection (changed within last 48 h)
        const routingChangedWithin48h =
          emp.routingChangedAt != null &&
          now.toMillis() - emp.routingChangedAt.toMillis() <
            48 * 60 * 60 * 1000;

        // Bank account freshness (created within last 30 days)
        const isBankAccountNew =
          now.toMillis() - emp.createdAt.toMillis() < 30 * 24 * 60 * 60 * 1000;

        const sharedRoutingHashCount =
          routingHashFreq.get(emp.bankRoutingHash) ?? 1;

        // Anomaly scoring
        const scoring = calculateAnomalyScore(
          {
            grossEarningsInr: totalEarnings,
            routingChangedWithin48h,
            isBankAccountNew,
            sharedRoutingHashCount,
          },
          { avgMonthlyPay: emp.avgMonthlyPay },
          thresholds
        );

        // Accumulate totals
        totalGross += totalEarnings;
        totalNet += netPayable;
        if (scoring.status === "CLEARED") clearedCount++;
        else {
          flaggedCount++;
          if (scoring.status === "QUARANTINED") quarantinedCount++;
        }

        // Transaction doc
        const txId = `tx_${runId}_${emp.id}`;
        const txRef = doc(db, "transactions", txId);
        batch.set(txRef, {
          id: txId,
          payrollRunId: runId,
          employeeId: emp.id,
          employeeName: emp.name,
          department: emp.department,
          grossEarningsInr: totalEarnings,
          deductions,
          netDisbursableInr: netPayable,
          destinationRoutingHash: emp.bankRoutingHash,
          createdAt: now,
          status: scoring.status,
          anomalyScore: scoring.anomalyScore,
          riskLevel: scoring.riskLevel,
          flagReasons: scoring.flagReasons,
          shapContributions: scoring.shapContributions,
          validationToken: scoring.validationToken,
          reviewedBy: null,
          reviewNote: null,
          routingChangedWithin48h,
          isBankAccountNew,
          sharedRoutingHashCount,
        });

        // Payslip doc
        const psId = `ps_${runId}_${emp.id}`;
        const psRef = doc(db, "payslips", psId);
        batch.set(psRef, {
          id: psId,
          employeeId: emp.id,
          employeeName: emp.name,
          month: new Date().toLocaleString("en-IN", {
            month: "long",
            year: "numeric",
          }),
          payrollRunId: runId,
          earnings,
          deductions,
          totalEarnings,
          totalContributions,
          totalDeductions,
          netPayable,
          paidOn: now,
          department: emp.department,
          role: emp.role,
          panNumber: emp.panNumber,
          pfAccountNumber: emp.pfAccountNumber,
          location: emp.location,
          workingDays: 22,
          lopDays: 0,
        });

        // Queue audit log for flagged / quarantined transactions
        if (scoring.status !== "CLEARED") {
          auditPromises.push(
            addAuditLog({
              timestamp: now,
              action:
                scoring.status === "QUARANTINED"
                  ? "transaction_quarantined"
                  : "transaction_flagged_for_review",
              entityType: "transaction",
              entityId: txId,
              performedBy: user?.email ?? "system",
              details: {
                employeeId: emp.id,
                employeeName: emp.name,
                anomalyScore: scoring.anomalyScore,
                riskLevel: scoring.riskLevel,
                flagReasons: scoring.flagReasons,
              },
            })
          );
        }
      }

      // 6. Commit batch
      appendLog("Writing to Firestore…");
      await batch.commit();

      // 7. Write audit logs (non-blocking parallel)
      if (auditPromises.length > 0) {
        appendLog(`Writing ${auditPromises.length} audit log entries…`);
        await Promise.all(auditPromises);
      }

      // 8. Mark run COMPLETED
      await updatePayrollRun(runId, {
        status: "COMPLETED",
        totalEmployees: employees.length,
        totalGrossInr: parseFloat(totalGross.toFixed(2)),
        totalNetInr: parseFloat(totalNet.toFixed(2)),
        flaggedCount,
        clearedCount,
        quarantinedCount,
      });

      appendLog("Complete!");
      toast.success(`Payroll run "${runLabel}" completed successfully.`);

      // Small delay so user can read "Complete!" before dialog closes
      await new Promise((r) => setTimeout(r, 800));
      onOpenChange(false);
      setLog([]);
      setRunLabel(defaultRunLabel());
    } catch (err) {
      console.error("Payroll run failed:", err);
      appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
      await updatePayrollRun(runId, { status: "FAILED" }).catch(() => {});
      toast.error("Payroll run failed. Check the log for details.");
    } finally {
      setRunning(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (running) return; // prevent accidental close mid-run
    if (!open) {
      setLog([]);
      setRunLabel(defaultRunLabel());
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100 text-lg font-semibold">
            Start New Payroll Run
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Run Label */}
          <div className="space-y-1.5">
            <Label htmlFor="runLabel" className="text-slate-300 text-sm">
              Run Label
            </Label>
            <Input
              id="runLabel"
              value={runLabel}
              onChange={(e) => setRunLabel(e.target.value)}
              disabled={running}
              placeholder="e.g. July 2026 Payroll"
              className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
          </div>

          {/* Active employee count */}
          <div className="rounded-md bg-slate-700/50 border border-slate-600 px-4 py-3 text-sm text-slate-300">
            {empLoading ? (
              <span className="text-slate-400">Loading employee count…</span>
            ) : (
              <>
                Will process{" "}
                <span className="font-semibold text-indigo-400">
                  {activeEmployees.length}
                </span>{" "}
                active{" "}
                {activeEmployees.length === 1 ? "employee" : "employees"}
              </>
            )}
          </div>

          {/* Progress log */}
          {log.length > 0 && (
            <div className="rounded-md bg-slate-900 border border-slate-700 p-3 max-h-44 overflow-y-auto space-y-1">
              {log.map((line, i) => (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    line.startsWith("Error")
                      ? "text-red-400"
                      : line === "Complete!"
                      ? "text-green-400"
                      : "text-slate-400"
                  }`}
                >
                  {line.startsWith("Error") ? "✗" : line === "Complete!" ? "✓" : "›"}{" "}
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={running}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartRun}
              disabled={running || empLoading || activeEmployees.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[110px]"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Running…
                </span>
              ) : (
                "Start Run"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PayrollRunsPage() {
  const { runs, loading } = usePayrollRuns();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Payroll Runs</h1>
            {!loading && (
              <p className="text-sm text-slate-400 mt-1">
                {runs.length} {runs.length === 1 ? "run" : "runs"} total
              </p>
            )}
          </div>

          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            Run Payroll
          </Button>
        </div>

        {/* Table Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-lg">All Runs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <p className="text-slate-400 text-sm">
                    Loading payroll runs…
                  </p>
                </div>
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-slate-400 text-lg font-medium">
                  No payroll runs found
                </p>
                <p className="text-slate-500 text-sm">
                  Payroll runs will appear here once created.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-medium">
                      Run Label
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium">
                      Date
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium">
                      Status
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">
                      Employees
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">
                      Total Gross
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">
                      Total Net
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">
                      Flagged
                    </TableHead>
                    <TableHead className="text-slate-400 font-medium text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow
                      key={run.id}
                      className="border-slate-700 hover:bg-slate-700/50 transition-colors"
                    >
                      <TableCell className="text-slate-100 font-medium">
                        {run.runLabel}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {run.createdAt?.toDate
                          ? run.createdAt.toDate().toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-slate-300 text-right">
                        {run.totalEmployees.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-300 text-right font-mono">
                        {formatMoney(run.totalGrossInr)}
                      </TableCell>
                      <TableCell className="text-slate-300 text-right font-mono">
                        {formatMoney(run.totalNetInr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {run.flaggedCount > 0 ? (
                          <span className="text-red-400 font-semibold">
                            {run.flaggedCount}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/payroll/${run.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                        >
                          View Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Run Payroll Dialog */}
      <RunPayrollDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
