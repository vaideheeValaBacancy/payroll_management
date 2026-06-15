"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { RiskBadge } from "@/components/shared/RiskBadge";
import type { Transaction } from "@/types";
import { formatDistanceToNow } from "date-fns";

export function LiveFeed({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();
  const recent = transactions.slice(0, 10);

  return (
    <Card className="bg-slate-800 border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="text-slate-300 text-sm font-medium">Live Transaction Feed</h3>
        </div>
        <Link href="/transactions" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {recent.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Waiting for transactions...</p>
        ) : (
          recent.map(tx => (
            <button
              key={tx.id}
              onClick={() => router.push(`/transactions?employee=${encodeURIComponent(tx.employeeName)}`)}
              className="w-full flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-500 hover:bg-slate-700/40 transition-all cursor-pointer text-left group"
            >
              <div>
                <p className="text-slate-200 text-sm font-medium group-hover:text-white transition-colors">{tx.employeeName}</p>
                <p className="text-slate-500 text-xs">
                  ₹{tx.netDisbursableInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ·{" "}
                  {tx.createdAt?.toDate ? formatDistanceToNow(tx.createdAt.toDate(), { addSuffix: true }) : "just now"}
                </p>
              </div>
              <RiskBadge level={tx.riskLevel} />
            </button>
          ))
        )}
      </div>
    </Card>
  );
}
