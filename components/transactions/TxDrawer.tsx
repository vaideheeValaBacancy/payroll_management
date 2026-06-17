"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnomalyGauge } from "./AnomalyGauge";
import { ShapChart } from "./ShapChart";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { updateTransaction, addAuditLog } from "@/lib/firestore";
import { humanizeFlag } from "@/lib/flagLabels";
import { Timestamp } from "firebase/firestore";
import type { Transaction } from "@/types";
import toast from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  tx: Transaction | null;
  onClose: () => void;
}

const MODELS = [
  { key: "iforest", label: "Isolation Forest", sub: "unsupervised · path-length", color: "bg-indigo-500" },
  { key: "autoencoder", label: "Autoencoder", sub: "unsupervised · reconstruction", color: "bg-violet-500" },
  { key: "xgboost", label: "XGBoost", sub: "supervised · classifier", color: "bg-fuchsia-500" },
] as const;

export function TxDrawer({ tx, onClose }: Props) {
  const { user } = useAppStore();

  const handleAction = async (action: "clear" | "escalate") => {
    if (!tx) return;
    const newStatus   = action === "clear" ? "CLEARED" : "QUARANTINED";
    const auditAction = action === "clear" ? "MANUAL_CLEARED" : "TRANSACTION_ESCALATED";
    try {
      await updateTransaction(tx.id, { status: newStatus, reviewedBy: user?.email ?? "admin" });
      await addAuditLog({
        timestamp:  Timestamp.now(),
        action:     auditAction,
        entityType: "transaction",
        entityId:   tx.id,
        performedBy: user?.email ?? "SYSTEM",
        details: {
          previousStatus: tx.status,
          employeeName:   tx.employeeName,
          anomalyScore:   tx.anomalyScore,
          modelVersion:   tx.modelVersion ?? null,
        },
      });
      toast.success(action === "clear" ? "Transaction cleared" : "Transaction escalated");
      onClose();
    } catch {
      toast.error("Action failed");
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const pct = (n: number | null | undefined) =>
    n == null ? "—" : `${(n * 100).toFixed(0)}%`;

  return (
    <Sheet open={!!tx} onOpenChange={o => !o && onClose()}>
      <SheetContent className="bg-slate-800 border-l border-slate-700 w-[480px] max-w-full overflow-y-auto">
        {tx && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-slate-100 text-lg">{tx.employeeName}</SheetTitle>
              <div className="flex gap-2 flex-wrap items-center">
                <StatusBadge status={tx.status} />
                <RiskBadge level={tx.riskLevel} />
                {tx.modelVersion && (
                  <span className="text-xs text-slate-500 border border-slate-600 rounded px-2 py-0.5 font-mono">
                    {tx.modelVersion}
                  </span>
                )}
                {tx.inferenceMs != null && (
                  <span className={`text-xs rounded px-2 py-0.5 ${tx.inferenceMs <= 220 ? "text-green-400 bg-green-500/10" : "text-amber-400 bg-amber-500/10"}`}>
                    {tx.inferenceMs}ms
                  </span>
                )}
              </div>
            </SheetHeader>

            {/* Anomaly Gauge — ensemble score */}
            <div className="flex justify-center mb-2">
              <AnomalyGauge score={tx.anomalyScore} />
            </div>
            <p className="text-center text-xs text-slate-500 mb-5">Ensemble anomaly score</p>

            <div className="space-y-4">

              {/* ── Dual-Model Breakdown ────────────────────────────────────── */}
              <div className="rounded-xl border border-slate-600 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 border-b border-slate-700">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    AI Engine — Model Breakdown
                  </span>
                </div>
                <div className="p-3 space-y-3">
                  {tx.modelScores ? (
                    MODELS.map(({ key, label, sub, color }) => {
                      const val = tx.modelScores?.[key];
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-sm text-slate-200">{label}</span>
                              <span className="text-xs text-slate-500 ml-2">{sub}</span>
                            </div>
                            <span className="text-sm font-mono text-slate-300">{pct(val)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            {val != null && (
                              <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.round(val * 100)}%` }} />
                            )}
                          </div>
                          {val == null && (
                            <p className="text-xs text-slate-600 mt-0.5">not trained (no labeled fraud data)</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Scored by rule-based fallback engine — train the model in Config to enable the dual-model breakdown.
                    </p>
                  )}
                </div>
              </div>

              {/* ── SHAP Feature Contributions (Phase 8 XAI) ────────────────── */}
              <ShapChart shap={tx.shapContributions} />

              {/* ── Why this was flagged ────────────────────────────────────── */}
              {tx.flagReasons.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Why this was flagged</p>
                  {tx.flagReasons.map(r => {
                    const { title, detail } = humanizeFlag(r);
                    return (
                      <div key={r} className="flex gap-2 text-amber-300 bg-amber-500/10 px-3 py-2 rounded">
                        <span className="leading-5">⚠</span>
                        <div>
                          <p className="text-sm font-medium text-amber-200">{title}</p>
                          {detail && <p className="text-xs text-amber-300/70 mt-0.5">{detail}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Financials ──────────────────────────────────────────────── */}
              <div className="bg-slate-900/60 rounded-lg p-3 space-y-2">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Financials</p>
                {Object.entries(tx.deductions).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-400">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span className="text-slate-200">{fmt(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                  <span className="text-slate-300 font-medium">Gross</span>
                  <span className="text-slate-200">{fmt(tx.grossEarningsInr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400 font-medium">Net Disbursable</span>
                  <span className="text-green-400 font-bold">{fmt(tx.netDisbursableInr)}</span>
                </div>
              </div>

              {/* ── Actions ─────────────────────────────────────────────────── */}
              <div className="flex gap-2 pt-1 pb-2">
                <Button
                  onClick={() => handleAction("clear")}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm"
                >
                  Clear & Approve
                </Button>
                <Button
                  onClick={() => handleAction("escalate")}
                  variant="destructive"
                  className="flex-1 text-sm"
                >
                  Escalate
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
