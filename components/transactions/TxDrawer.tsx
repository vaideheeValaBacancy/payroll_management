"use client";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnomalyGauge } from "./AnomalyGauge";
import { ShapChart } from "./ShapChart";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { updateTransaction, addAuditLog } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import type { Transaction } from "@/types";
import toast from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";

interface FraudAnalysis {
  headline: string;
  riskNarrative: string;
  topSignal: string;
  recommendation: string;
  fraudPattern: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  falsePositiveReason: string | null;
}

interface Props {
  tx: Transaction | null;
  onClose: () => void;
}

const confidenceColors = {
  HIGH:   "text-red-400 bg-red-500/10 border-red-500/30",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  LOW:    "text-green-400 bg-green-500/10 border-green-500/30",
};

export function TxDrawer({ tx, onClose }: Props) {
  const { user } = useAppStore();
  const [analysis, setAnalysis]   = useState<FraudAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Run LLM analysis whenever a new transaction is opened
  useEffect(() => {
    if (!tx) {
      setAnalysis(null);
      setAnalysisError(null);
      return;
    }

    async function runAnalysis() {
      setAnalyzing(true);
      setAnalysis(null);
      setAnalysisError(null);
      try {
        const res = await fetch("/api/analyze-fraud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tx),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");
        setAnalysis(data.analysis);
      } catch (err) {
        setAnalysisError(err instanceof Error ? err.message : "LLM analysis unavailable");
      } finally {
        setAnalyzing(false);
      }
    }

    runAnalysis();
  }, [tx?.id]); // re-run only when a different transaction is opened

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
          llmFraudPattern: analysis?.fraudPattern ?? null,
          llmConfidence:   analysis?.confidence ?? null,
        },
      });
      toast.success(action === "clear" ? "Transaction cleared" : "Transaction escalated");
      onClose();
    } catch {
      toast.error("Action failed");
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <Sheet open={!!tx} onOpenChange={o => !o && onClose()}>
      <SheetContent className="bg-slate-800 border-l border-slate-700 w-[480px] max-w-full overflow-y-auto">
        {tx && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-slate-100 text-lg">{tx.employeeName}</SheetTitle>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={tx.status} />
                <RiskBadge level={tx.riskLevel} />
                {(tx as Transaction & { modelVersion?: string }).modelVersion && (
                  <span className="text-xs text-slate-500 border border-slate-600 rounded px-2 py-0.5">
                    {(tx as Transaction & { modelVersion?: string }).modelVersion}
                  </span>
                )}
              </div>
            </SheetHeader>

            {/* Anomaly Gauge */}
            <div className="flex justify-center mb-5">
              <AnomalyGauge score={tx.anomalyScore} />
            </div>

            <div className="space-y-4">

              {/* ── LLM Fraud Analysis ──────────────────────────────────────── */}
              <div className="rounded-xl border border-slate-600 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 border-b border-slate-700">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    AI Fraud Analysis
                  </span>
                  <span className="text-xs text-slate-500">claude-sonnet-4-6</span>
                  {analyzing && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      Analysing…
                    </span>
                  )}
                </div>

                <div className="p-3 space-y-3">
                  {analyzing && !analysis && (
                    <div className="space-y-2">
                      {[80, 60, 70].map((w, i) => (
                        <div key={i} className={`h-3 rounded bg-slate-700 animate-pulse`} style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )}

                  {analysisError && (
                    <p className="text-xs text-slate-500 italic">{analysisError}</p>
                  )}

                  {analysis && (
                    <>
                      {/* Headline */}
                      <p className="text-sm font-semibold text-white leading-snug">
                        {analysis.headline}
                      </p>

                      {/* Confidence + Pattern badges */}
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${confidenceColors[analysis.confidence]}`}>
                          {analysis.confidence} confidence
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 bg-slate-700/50">
                          {analysis.fraudPattern}
                        </span>
                      </div>

                      {/* Narrative */}
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {analysis.riskNarrative}
                      </p>

                      {/* Top signal */}
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs font-medium text-amber-400 mb-0.5">Primary Signal</p>
                        <p className="text-xs text-slate-300">{analysis.topSignal}</p>
                      </div>

                      {/* Recommendation */}
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs font-medium text-indigo-400 mb-0.5">Recommended Action</p>
                        <p className="text-xs text-slate-300">{analysis.recommendation}</p>
                      </div>

                      {/* False positive note */}
                      {analysis.falsePositiveReason && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-green-400 mb-0.5">False Positive Note</p>
                          <p className="text-xs text-slate-300">{analysis.falsePositiveReason}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── SHAP Feature Contributions ──────────────────────────────── */}
              <ShapChart shap={tx.shapContributions} />

              {/* ── Raw Flag Reasons ────────────────────────────────────────── */}
              {tx.flagReasons.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Triggered Signals</p>
                  {tx.flagReasons.map(r => (
                    <div key={r} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded">
                      ⚠ {r.replace(/_/g, " ")}
                    </div>
                  ))}
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
