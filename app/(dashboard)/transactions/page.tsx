"use client";
import { useSearchParams } from "next/navigation";
import { useTransactions } from "@/hooks/useTransactions";
import { TxTable } from "@/components/transactions/TxTable";

export default function TransactionsPage() {
  const { transactions, loading } = useTransactions(500);
  const searchParams = useSearchParams();

  const initialStatus = searchParams.get("status") ?? "ALL";
  const initialRisk = searchParams.get("risk") ?? "ALL";
  const initialEmployee = searchParams.get("employee") ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-100 text-2xl font-bold">Transaction Monitor</h1>
        <p className="text-slate-400 text-sm mt-1">{transactions.length} transactions · Click a row to inspect</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <TxTable
          transactions={transactions}
          initialStatus={initialStatus}
          initialRisk={initialRisk}
          initialEmployee={initialEmployee}
        />
      )}
    </div>
  );
}
