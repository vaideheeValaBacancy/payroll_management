"use client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Users, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import type { Transaction, Employee, PayrollRun } from "@/types";

interface Props {
  employees: Employee[];
  transactions: Transaction[];
  lastRun: PayrollRun | null;
}

export function StatsCards({ employees, transactions, lastRun }: Props) {
  const active = employees.filter(e => e.isActive).length;
  const cleared = transactions.filter(t => t.status === "CLEARED").length;
  const quarantined = transactions.filter(t => t.status === "QUARANTINED").length;
  const inReview = transactions.filter(t => t.status === "MANUAL_REVIEW").length;

  const cards = [
    { label: "Active Employees", value: active, icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10", href: "/employees" },
    { label: "Cleared Transactions", value: cleared, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", href: "/transactions?status=CLEARED" },
    { label: "Quarantined", value: quarantined, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", href: "/transactions?status=QUARANTINED" },
    { label: "In Review", value: inReview, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", href: "/transactions?status=MANUAL_REVIEW" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color, bg, href }) => (
        <Link key={label} href={href}>
          <Card className="bg-slate-800 border-slate-700 p-4 hover:border-slate-500 hover:bg-slate-700/50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs group-hover:text-slate-300 transition-colors">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${bg} group-hover:scale-110 transition-transform`}>
                <Icon size={20} className={color} />
              </div>
            </div>
            {label === "Active Employees" && lastRun && (
              <p className="text-slate-500 text-xs mt-2">Last run: {lastRun.runLabel}</p>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
