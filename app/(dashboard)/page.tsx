"use client";
import { useTransactions } from "@/hooks/useTransactions";
import { useEmployees } from "@/hooks/useEmployees";
import { usePayrollRuns } from "@/hooks/usePayrollRuns";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RiskDonut } from "@/components/dashboard/RiskDonut";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { transactions, loading: txLoading } = useTransactions(200);
  const { employees, loading: empLoading } = useEmployees();
  const { runs, loading: runsLoading } = usePayrollRuns();

  const loading = txLoading || empLoading || runsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100 text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">AI Transaction Monitoring Overview</p>
        </div>
        <Link href="/payroll">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
            Start New Payroll Run
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <StatsCards employees={employees} transactions={transactions} lastRun={runs[0] ?? null} />
          <div className="grid lg:grid-cols-2 gap-6">
            <RiskDonut transactions={transactions} />
            <LiveFeed transactions={transactions} />
          </div>
        </>
      )}
    </div>
  );
}
