"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayrollRuns } from "@/hooks/usePayrollRuns";
import { useTransactions } from "@/hooks/useTransactions";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { RunStatus } from "@/types";

const runStatusConfig: Record<RunStatus, { label: string; className: string }> = {
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

function formatMoney(value: number) {
  return "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PageProps {
  params: { runId: string };
}

export default function PayrollRunDetailPage({ params }: PageProps) {
  const { runId } = params;
  const { runs, loading: runsLoading } = usePayrollRuns();
  const { transactions, loading: txLoading } = useTransactions(500);

  const run = runs.find((r) => r.id === runId);
  const runTransactions = transactions.filter((t) => t.payrollRunId === runId);

  const loading = runsLoading || txLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-slate-400 text-sm">Loading run details…</p>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-300 text-lg">Payroll run not found.</p>
          <Link
            href="/payroll"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payroll Runs
          </Link>
        </div>
      </div>
    );
  }

  const { label: statusLabel, className: statusClassName } =
    runStatusConfig[run.status];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back button + Header */}
        <div className="space-y-3">
          <Link
            href="/payroll"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-400 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payroll Runs
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{run.runLabel}</h1>
            <Badge variant="outline" className={statusClassName}>
              {statusLabel}
            </Badge>
          </div>

          {run.createdAt?.toDate && (
            <p className="text-slate-400 text-sm">
              {run.createdAt.toDate().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Total Gross
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-slate-100 font-mono">
                {formatMoney(run.totalGrossInr)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Total Net
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-indigo-400 font-mono">
                {formatMoney(run.totalNetInr)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Employees
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-slate-100">
                {run.totalEmployees.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Flagged
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p
                className={`text-lg font-bold ${
                  run.flaggedCount > 0 ? "text-red-400" : "text-slate-500"
                }`}
              >
                {run.flaggedCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Cleared
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-green-400">
                {run.clearedCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Quarantined
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p
                className={`text-lg font-bold ${
                  run.quarantinedCount > 0 ? "text-amber-400" : "text-slate-500"
                }`}
              >
                {run.quarantinedCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
              Transactions
              <span className="text-sm font-normal text-slate-400">
                ({runTransactions.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {runTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-slate-400 text-base font-medium">
                  No transactions for this run
                </p>
                <p className="text-slate-500 text-sm">
                  Transactions will appear here once the run is processed.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-medium">Employee</TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">Gross</TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">Net</TableHead>
                    <TableHead className="text-slate-400 font-medium">Risk</TableHead>
                    <TableHead className="text-slate-400 font-medium">Status</TableHead>
                    <TableHead className="text-slate-400 font-medium text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runTransactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="border-slate-700 hover:bg-slate-700/50 transition-colors"
                    >
                      <TableCell>
                        <Link
                          href={`/employees/${tx.employeeId}`}
                          className="group flex items-start gap-1 hover:text-indigo-400 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <div>
                            <p className="text-slate-100 font-medium group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                              {tx.employeeName}
                              <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            <p className="text-slate-500 text-xs">{tx.department}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-300 text-right font-mono">
                        {formatMoney(tx.grossEarningsInr)}
                      </TableCell>
                      <TableCell className="text-slate-300 text-right font-mono">
                        {formatMoney(tx.netDisbursableInr)}
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={tx.riskLevel} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-mono text-sm font-semibold ${
                            tx.anomalyScore >= 0.75
                              ? "text-red-400"
                              : tx.anomalyScore >= 0.5
                              ? "text-amber-400"
                              : "text-green-400"
                          }`}
                        >
                          {(tx.anomalyScore * 100).toFixed(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
