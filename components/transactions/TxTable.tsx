"use client";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TxDrawer } from "./TxDrawer";
import type { Transaction } from "@/types";

interface Props {
  transactions: Transaction[];
  initialStatus?: string;
  initialRisk?: string;
  initialEmployee?: string;
}

export function TxTable({ transactions, initialStatus = "ALL", initialRisk = "ALL", initialEmployee = "" }: Props) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [riskFilter, setRiskFilter] = useState<string>(initialRisk);
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [employeeSearch, setEmployeeSearch] = useState<string>(initialEmployee);

  const departments = Array.from(new Set(transactions.map(t => t.department)));

  const filtered = transactions.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (riskFilter !== "ALL" && t.riskLevel !== riskFilter) return false;
    if (deptFilter !== "ALL" && t.department !== deptFilter) return false;
    if (employeeSearch && !t.employeeName.toLowerCase().includes(employeeSearch.toLowerCase())) return false;
    return true;
  });

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          value={employeeSearch}
          onChange={e => setEmployeeSearch(e.target.value)}
          placeholder="Search employee…"
          className="w-48 bg-slate-800 border-slate-600 text-slate-300 text-sm h-8 placeholder:text-slate-500"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-slate-300 text-sm h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {["ALL", "PENDING", "CLEARED", "QUARANTINED", "MANUAL_REVIEW"].map(s => (
              <SelectItem key={s} value={s} className="text-slate-300 text-sm">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v ?? "ALL")}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-slate-300 text-sm h-8">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map(r => (
              <SelectItem key={r} value={r} className="text-slate-300 text-sm">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? "ALL")}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-600 text-slate-300 text-sm h-8">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            <SelectItem value="ALL" className="text-slate-300 text-sm">All Depts</SelectItem>
            {departments.map(d => (
              <SelectItem key={d} value={d} className="text-slate-300 text-sm">{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">Employee</TableHead>
              <TableHead className="text-slate-400">Dept</TableHead>
              <TableHead className="text-slate-400">Gross</TableHead>
              <TableHead className="text-slate-400">Net</TableHead>
              <TableHead className="text-slate-400">Risk</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(tx => (
              <TableRow
                key={tx.id}
                className="border-slate-700 hover:bg-slate-800/50 cursor-pointer"
                onClick={() => setSelectedTx(tx)}
              >
                <TableCell className="text-slate-200 font-medium">{tx.employeeName}</TableCell>
                <TableCell className="text-slate-400 text-sm">{tx.department}</TableCell>
                <TableCell className="text-slate-300 text-sm">{fmt(tx.grossEarningsInr)}</TableCell>
                <TableCell className="text-green-400 text-sm font-medium">{fmt(tx.netDisbursableInr)}</TableCell>
                <TableCell><RiskBadge level={tx.riskLevel} /></TableCell>
                <TableCell><StatusBadge status={tx.status} /></TableCell>
                <TableCell className="text-slate-400 text-sm">{(tx.anomalyScore * 100).toFixed(0)}%</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-slate-500 text-sm text-center py-8">
                  No transactions match the current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TxDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </>
  );
}
