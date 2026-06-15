"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getEmployee } from "@/lib/firestore";
import type { Employee, Payslip, SalaryRevision } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtInr(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtDate(ts: { toDate: () => Date } | null): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMonthYear(ts: { toDate: () => Date } | null): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

type TabKey = "timeline" | "payslips" | "revisions";

interface PayslipModalProps {
  payslip: Payslip | null;
  open: boolean;
  onClose: () => void;
}

function PayslipModal({ payslip, open, onClose }: PayslipModalProps) {
  if (!payslip) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full bg-slate-900 border-slate-700 text-slate-100 overflow-y-auto max-h-[90vh] !max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white">
            Payslip — {payslip.month}
          </DialogTitle>
        </DialogHeader>

        {/* Company Header */}
        <div className="border-b border-slate-700 pb-4 mb-4">
          <p className="text-indigo-400 font-semibold text-base">
            PayrollMonitor Pvt. Ltd.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Payslip for the month of {payslip.month}
          </p>
        </div>

        {/* Employee Info Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-6">
          <div>
            <span className="text-slate-400">Employee Name: </span>
            <span className="text-slate-100 font-medium">{payslip.employeeName}</span>
          </div>
          <div>
            <span className="text-slate-400">Employee ID: </span>
            <span className="text-slate-100 font-medium">{payslip.employeeId}</span>
          </div>
          <div>
            <span className="text-slate-400">Department: </span>
            <span className="text-slate-100">{payslip.department}</span>
          </div>
          <div>
            <span className="text-slate-400">Designation: </span>
            <span className="text-slate-100">{payslip.role}</span>
          </div>
          <div>
            <span className="text-slate-400">Location: </span>
            <span className="text-slate-100">{payslip.location}</span>
          </div>
          <div>
            <span className="text-slate-400">PAN: </span>
            <span className="text-slate-100 font-mono">{payslip.panNumber}</span>
          </div>
          <div>
            <span className="text-slate-400">PF No.: </span>
            <span className="text-slate-100 font-mono">{payslip.pfAccountNumber}</span>
          </div>
          <div>
            <span className="text-slate-400">Working Days: </span>
            <span className="text-slate-100">{payslip.workingDays}</span>
            <span className="text-slate-400 ml-3">LOP Days: </span>
            <span className="text-slate-100">{payslip.lopDays}</span>
          </div>
        </div>

        {/* Earnings + Deductions two-column */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* LEFT — EARNINGS */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
              Earnings
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Basic</span>
                <span className="text-slate-100">{fmtInr(payslip.earnings.basic)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">HRA</span>
                <span className="text-slate-100">{fmtInr(payslip.earnings.hra)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Special Allowance</span>
                <span className="text-slate-100">{fmtInr(payslip.earnings.specialAllowance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Food Allowance</span>
                <span className="text-slate-100">{fmtInr(payslip.earnings.foodAllowance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Flexi Pay</span>
                <span className="text-slate-100">{fmtInr(payslip.earnings.flexiPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Fuel Allowance</span>
                <span className="text-slate-100">{fmtInr(payslip.earnings.fuelAllowance)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
                <span className="font-bold text-white">Total Earnings (A)</span>
                <span className="font-bold text-white">{fmtInr(payslip.totalEarnings)}</span>
              </div>
            </div>
          </div>

          {/* RIGHT — CONTRIBUTIONS + DEDUCTIONS */}
          <div className="space-y-4">
            {/* Contributions */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Contributions
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">PF Employee</span>
                  <span className="text-slate-100">{fmtInr(payslip.deductions.pfEmployee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">PF Employer</span>
                  <span className="text-slate-100">{fmtInr(payslip.deductions.pfEmployer)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
                  <span className="font-bold text-white">Total Contributions (B)</span>
                  <span className="font-bold text-white">{fmtInr(payslip.totalContributions)}</span>
                </div>
              </div>
            </div>

            {/* Taxes & Deductions */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Taxes &amp; Deductions
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Professional Tax</span>
                  <span className="text-slate-100">{fmtInr(payslip.deductions.professionalTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Deduction — Food Allowance</span>
                  <span className="text-slate-100">{fmtInr(payslip.deductions.foodAllowanceDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Deduction — Fuel Allowance</span>
                  <span className="text-slate-100">{fmtInr(payslip.deductions.fuelAllowanceDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Total Income Tax</span>
                  <span className="text-slate-100">{fmtInr(payslip.deductions.incomeTax)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
                  <span className="font-bold text-white">Total Taxes &amp; Deductions (C)</span>
                  <span className="font-bold text-white">{fmtInr(payslip.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Net Pay Footer */}
        <div className="mt-6 bg-indigo-900/40 border border-indigo-600 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-300 font-medium">Net Pay = A − B − C</p>
            <p className="text-xs text-slate-400 mt-0.5">Paid on {fmtDate(payslip.paidOn)}</p>
          </div>
          <p className="text-2xl font-bold text-white">{fmtInr(payslip.netPayable)}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeeDetailPage({
  params,
}: {
  params: { empId: string };
}) {
  const { empId } = params;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("timeline");
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch employee first — if this fails, show not found
        const emp = await getEmployee(empId);
        setEmployee(emp);

        if (!emp) return;

        // Fetch payslips — try with orderBy, fall back without if index missing
        try {
          const payslipSnap = await getDocs(
            query(
              collection(db, "payslips"),
              where("employeeId", "==", empId),
              orderBy("paidOn", "desc")
            )
          );
          setPayslips(payslipSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Payslip)));
        } catch {
          // Index not ready — fetch without orderBy and sort client-side
          const payslipSnap = await getDocs(
            query(collection(db, "payslips"), where("employeeId", "==", empId))
          );
          const sorted = payslipSnap.docs
            .map((d) => ({ ...d.data(), id: d.id } as Payslip))
            .sort((a, b) => b.paidOn.toMillis() - a.paidOn.toMillis());
          setPayslips(sorted);
        }

        // Fetch salary revisions — same fallback pattern
        try {
          const revisionSnap = await getDocs(
            query(
              collection(db, "salary_revisions"),
              where("employeeId", "==", empId),
              orderBy("effectiveDate", "desc")
            )
          );
          setRevisions(revisionSnap.docs.map((d) => ({ ...d.data(), id: d.id } as SalaryRevision)));
        } catch {
          const revisionSnap = await getDocs(
            query(collection(db, "salary_revisions"), where("employeeId", "==", empId))
          );
          const sorted = revisionSnap.docs
            .map((d) => ({ ...d.data(), id: d.id } as SalaryRevision))
            .sort((a, b) => b.effectiveDate.toMillis() - a.effectiveDate.toMillis());
          setRevisions(sorted);
        }
      } catch (err) {
        console.error("Failed to load employee data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [empId]);

  function openPayslip(ps: Payslip) {
    setSelectedPayslip(ps);
    setModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading employee details…
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-400">Employee not found.</p>
        <Link href="/employees">
          <Button variant="outline" className="border-slate-600 text-slate-300">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
          </Button>
        </Link>
      </div>
    );
  }

  // Derived stats
  const totalPaid = payslips.reduce((sum, ps) => sum + ps.netPayable, 0);
  const avgMonthlyNet =
    payslips.length > 0 ? totalPaid / payslips.length : 0;
  const ctcGrowth =
    revisions.length >= 2
      ? (((revisions[0].revisedCtc - revisions[revisions.length - 1].previousCtc) /
          revisions[revisions.length - 1].previousCtc) *
          100
        ).toFixed(1)
      : null;

  // Avatar initials from name
  const initials = employee.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-1 pb-10">
      {/* Back button */}
      <Link
        href="/employees"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Employees
      </Link>

      {/* Employee Header Card */}
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        {/* Gradient accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />

        <CardContent className="pt-6 pb-6 px-6">
          {/* Avatar + Name + Status row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-xl font-bold tracking-wide">{initials}</span>
            </div>

            {/* Name + role + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
                <Badge
                  className={
                    employee.isActive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs"
                      : "bg-slate-600/40 text-slate-400 border border-slate-600 text-xs"
                  }
                >
                  {employee.isActive ? "● Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span>{employee.role}</span>
                <span className="text-slate-600">·</span>
                <Badge className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-normal">
                  {employee.department}
                </Badge>
                {employee.location && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span>{employee.location}</span>
                  </>
                )}
              </div>
            </div>

            {/* CTC block */}
            <div className="sm:text-right shrink-0">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Annual CTC</p>
              <p className="text-3xl font-bold text-indigo-400 leading-none">
                {fmtInr(employee.baseSalaryInr)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {fmtInr(Math.round(employee.baseSalaryInr / 12))}/mo
              </p>
            </div>
          </div>

          {/* Identity row */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-slate-700/60">
            {[
              { label: "PAN Number", value: employee.panNumber || "—", mono: true },
              { label: "PF Account", value: employee.pfAccountNumber || "—", mono: true },
              { label: "Last Payroll", value: fmtDate(employee.lastPayrollDate) },
              { label: "Bank Hash", value: employee.bankRoutingHash?.slice(0, 12) + "…" || "—", mono: true },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-slate-200 text-sm truncate ${mono ? "font-mono" : ""}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Stats strip */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-700/60">
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4">
              <p className="text-xs text-indigo-400 uppercase tracking-wider mb-1.5">Total Paid Out</p>
              <p className="text-xl font-bold text-white">{fmtInr(totalPaid)}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Avg Monthly Net</p>
              <p className="text-xl font-bold text-slate-200">{fmtInr(avgMonthlyNet)}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Payslips</p>
              <p className="text-xl font-bold text-slate-200">{payslips.length}</p>
            </div>
            <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1.5">CTC Growth</p>
              {ctcGrowth !== null ? (
                <p className="text-xl font-bold text-emerald-400">+{ctcGrowth}%</p>
              ) : (
                <p className="text-xl font-bold text-slate-500">—</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700 rounded-xl p-1.5">
        {(["timeline", "payslips", "revisions"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            {tab === "timeline" ? "Payment Timeline" : tab === "payslips" ? "Payslips" : "Salary Revisions"}
          </button>
        ))}
      </div>

      {/* Tab 1: Payment Timeline */}
      {activeTab === "timeline" && (
        <div>
          {payslips.length === 0 ? (
            <div className="py-20 text-center bg-slate-800/40 rounded-xl border border-slate-700">
              <p className="text-slate-400 text-sm font-medium">No payment history yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Payslips will appear here once the first payroll run is processed.
              </p>
            </div>
          ) : (
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-slate-700 rounded-full" />

              <div className="space-y-4">
                {payslips.map((ps, index) => (
                  <div key={ps.id} className="relative flex items-start gap-5">
                    {/* Dot */}
                    <div
                      className={`absolute -left-5 top-5 z-10 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                        index === 0
                          ? "bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.4)] animate-pulse"
                          : "bg-indigo-500"
                      }`}
                    />

                    {/* Content card */}
                    <div className="flex-1 bg-slate-800 border border-slate-700 hover:border-indigo-500/40 rounded-xl p-5 transition-colors group">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white text-base">{fmtMonthYear(ps.paidOn)}</p>
                            {index === 0 && (
                              <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm">
                            Paid on {fmtDate(ps.paidOn)}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-slate-500">
                            <span>Gross <span className="text-slate-300">{fmtInr(ps.totalEarnings)}</span></span>
                            <span>Deductions <span className="text-slate-300">{fmtInr(ps.totalDeductions + ps.totalContributions)}</span></span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end gap-3">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-indigo-400">{fmtInr(ps.netPayable)}</p>
                            <p className="text-slate-500 text-xs">net pay</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-xs transition-colors"
                            onClick={() => openPayslip(ps)}
                          >
                            View Payslip
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Payslips grid */}
      {activeTab === "payslips" && (
        <div className="pb-4">
          {payslips.length === 0 ? (
            <div className="py-20 text-center bg-slate-800/40 rounded-xl border border-slate-700">
              <p className="text-slate-400 text-sm font-medium">No payslips found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {payslips.map((ps) => (
                <Card
                  key={ps.id}
                  className="bg-slate-800 border-slate-700 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all overflow-hidden"
                >
                  <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-violet-500" />
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-base text-white">{ps.month}</CardTitle>
                    <p className="text-xs text-slate-400">Paid on {fmtDate(ps.paidOn)}</p>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5 pb-5">
                    <div className="flex justify-between items-center bg-indigo-600/10 rounded-lg px-3 py-2.5">
                      <span className="text-slate-400 text-xs uppercase tracking-wider">Net Pay</span>
                      <span className="text-lg font-bold text-indigo-400">
                        {fmtInr(ps.netPayable)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 px-1">
                      <span>Gross: <span className="text-slate-300">{fmtInr(ps.totalEarnings)}</span></span>
                      <span>Deductions: <span className="text-slate-300">{fmtInr(ps.totalContributions + ps.totalDeductions)}</span></span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => openPayslip(ps)}
                    >
                      View Payslip
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Salary Revisions */}
      {activeTab === "revisions" && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-5 px-0 pb-0">
            {revisions.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-400 text-sm font-medium">No revision history</p>
                <p className="text-slate-600 text-xs mt-1">
                  Salary revisions will appear here once recorded.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400 pl-6">Effective Date</TableHead>
                    <TableHead className="text-slate-400 text-right">Previous CTC</TableHead>
                    <TableHead className="text-slate-400 text-right">Revised CTC</TableHead>
                    <TableHead className="text-slate-400 text-right">Increment</TableHead>
                    <TableHead className="text-slate-400">Reason</TableHead>
                    <TableHead className="text-slate-400 pr-6">Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.map((rev) => (
                    <TableRow key={rev.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-slate-300 pl-6">
                        {fmtDate(rev.effectiveDate)}
                      </TableCell>
                      <TableCell className="text-slate-400 text-right">
                        {fmtInr(rev.previousCtc)}
                      </TableCell>
                      <TableCell className="text-slate-200 font-semibold text-right">
                        {fmtInr(rev.revisedCtc)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ↑ {rev.incrementPercent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-300 text-sm max-w-[180px] truncate">
                        {rev.reason}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm pr-6">
                        {rev.approvedBy}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payslip Modal */}
      <PayslipModal
        payslip={selectedPayslip}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
