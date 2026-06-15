"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ShapContributions } from "@/types";

const LABELS: Record<keyof ShapContributions, string> = {
  routingChange: "Routing Change",
  amountDeviation: "Amount Deviation",
  velocitySpike: "Velocity Spike",
  newBankAccount: "New Bank Acct",
};

export function ShapChart({ shap }: { shap: ShapContributions }) {
  const data = (Object.keys(shap) as (keyof ShapContributions)[])
    .map(k => ({ name: LABELS[k], value: parseFloat(shap[k].toFixed(4)) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const colors = ["#dc2626", "#f97316", "#f59e0b", "#6366f1"];

  return (
    <div>
      <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">SHAP Feature Contributions</p>
      {data.length === 0 ? (
        <p className="text-slate-500 text-xs">No contributing factors</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
            <XAxis type="number" domain={[0, 0.4]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} width={105} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 11 }}
              formatter={(v) => [typeof v === "number" ? v.toFixed(4) : v, "Weight"]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
