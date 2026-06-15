"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import type { Transaction } from "@/types";

const COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
};

export function RiskDonut({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();
  const counts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  transactions.forEach(t => { counts[t.riskLevel] = (counts[t.riskLevel] || 0) + 1; });
  const data = Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <Card className="bg-slate-800 border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-300 text-sm font-medium">Risk Distribution</h3>
        <Link href="/transactions" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          View all →
        </Link>
      </div>
      {data.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No transaction data</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                cursor="pointer"
                onClick={(entry) => router.push(`/transactions?risk=${entry.name}`)}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#f1f5f9" }}
                itemStyle={{ color: "#94a3b8" }}
                formatter={(value, name) => [`${value} transactions`, name]}
              />
              <Legend
                formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 12 }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Clickable legend chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {data.map(({ name, value }) => (
              <button
                key={name}
                onClick={() => router.push(`/transactions?risk=${name}`)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900/60 border border-slate-700 hover:border-slate-500 transition-colors"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[name] }} />
                <span className="text-slate-300">{name}</span>
                <span className="text-slate-500">{value}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
