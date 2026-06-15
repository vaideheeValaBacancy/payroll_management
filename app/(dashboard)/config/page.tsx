"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { getRiskConfig, saveRiskConfig } from "@/lib/firestore";
import { getDocs, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RiskConfig, Transaction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEFAULT_CONFIG: RiskConfig = {
  anomalyScoreQuarantine: 0.75,
  anomalyScoreReview: 0.5,
  maxFprPercent: 0.05,
  inferenceLatencyTargetMs: 220,
  modelDriftDaysInterval: 30,
  adaptiveScalingEnabled: false,
};

interface MlHealth {
  online: boolean;
  modelLoaded: boolean;
  modelVersion?: string;
  trainedAt?: string;
  nSamples?: number;
  featureImportance?: Record<string, number>;
  models?: { isolationForest: boolean; autoencoder: boolean; xgboost: boolean };
  ensembleWeights?: { isolationForest: number; autoencoder: number; xgboost: number };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<RiskConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mlHealth, setMlHealth] = useState<MlHealth | null>(null);
  const [training, setTraining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getRiskConfig();
        if (!cancelled) setConfig(data);
      } catch {
        if (!cancelled) toast.error("Failed to load risk config.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchMlHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/ml-health", { cache: "no-store" });
      setMlHealth(await res.json());
    } catch {
      setMlHealth({ online: false, modelLoaded: false });
    }
  }, []);

  useEffect(() => { fetchMlHealth(); }, [fetchMlHealth]);

  async function handleTrain() {
    setTraining(true);
    try {
      // Fetch last 500 transactions as training data
      const snap = await getDocs(
        query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(500))
      );
      const txs = snap.docs.map(d => d.data() as Transaction);

      if (txs.length < 10) {
        toast.error("Not enough transaction data to train. Run payroll first.");
        return;
      }

      // Compute per-department mean gross for the macro baseline feature
      const deptAgg: Record<string, { sum: number; count: number }> = {};
      txs.forEach(tx => {
        const d = deptAgg[tx.department] ?? { sum: 0, count: 0 };
        d.sum += tx.grossEarningsInr;
        d.count += 1;
        deptAgg[tx.department] = d;
      });
      const deptMean = (dept: string) => {
        const d = deptAgg[dept];
        return d && d.count > 0 ? d.sum / d.count : 0;
      };

      const samples = txs.map(tx => ({
        grossInr:                tx.grossEarningsInr,
        avgMonthlyPay:           tx.grossEarningsInr, // best per-employee proxy in tx doc
        deptMeanPay:             deptMean(tx.department),
        routingChangedWithin48h: tx.routingChangedWithin48h,
        isBankAccountNew:        tx.isBankAccountNew,
        sharedRoutingHashCount:  tx.sharedRoutingHashCount,
        department:              tx.department,
        routingHash:             tx.destinationRoutingHash ?? "",
        // Supervised label: derive from final disposition
        isAnomaly:               tx.status === "QUARANTINED" || tx.riskLevel === "CRITICAL",
      }));

      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples, contamination: 0.08 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Training failed");
      }

      const result = await res.json();
      toast.success(`Model trained on ${result.nSamples} samples in ${result.trainingMs}ms. Version: ${result.version}`);
      await fetchMlHealth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Training failed");
    } finally {
      setTraining(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveRiskConfig(config);
      toast.success("Risk configuration saved successfully.");
    } catch {
      toast.error("Failed to save risk configuration.");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof RiskConfig>(key: K, value: RiskConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading configuration…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Risk Configuration</h1>
          <p className="text-slate-400 text-sm mt-1">
            Tune anomaly detection thresholds and model parameters.
          </p>
        </div>

        {/* Anomaly Score Thresholds */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base font-semibold">
              Anomaly Score Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Quarantine threshold */}
              <div className="space-y-2">
                <Label
                  htmlFor="anomalyScoreQuarantine"
                  className="text-slate-300 text-sm font-medium"
                >
                  Anomaly Score → Quarantine
                </Label>
                <Input
                  id="anomalyScoreQuarantine"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.anomalyScoreQuarantine}
                  onChange={(e) =>
                    setField("anomalyScoreQuarantine", parseFloat(e.target.value))
                  }
                  className="bg-slate-700 border-slate-600 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-500"
                />
                <p className="text-slate-500 text-xs">
                  Transactions above this score are quarantined. Range: 0 – 1.
                </p>
              </div>

              {/* Review threshold */}
              <div className="space-y-2">
                <Label
                  htmlFor="anomalyScoreReview"
                  className="text-slate-300 text-sm font-medium"
                >
                  Anomaly Score → Review
                </Label>
                <Input
                  id="anomalyScoreReview"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.anomalyScoreReview}
                  onChange={(e) =>
                    setField("anomalyScoreReview", parseFloat(e.target.value))
                  }
                  className="bg-slate-700 border-slate-600 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-500"
                />
                <p className="text-slate-500 text-xs">
                  Transactions above this score are flagged for review. Range: 0 – 1.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model & Performance */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base font-semibold">
              Model &amp; Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Max FPR */}
              <div className="space-y-2">
                <Label
                  htmlFor="maxFprPercent"
                  className="text-slate-300 text-sm font-medium"
                >
                  Max False Positive Rate %
                </Label>
                <Input
                  id="maxFprPercent"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.maxFprPercent}
                  onChange={(e) =>
                    setField("maxFprPercent", parseFloat(e.target.value))
                  }
                  className="bg-slate-700 border-slate-600 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-500"
                />
                <p className="text-slate-500 text-xs">
                  Acceptable false positive rate ceiling. Range: 0 – 1.
                </p>
              </div>

              {/* Inference latency */}
              <div className="space-y-2">
                <Label
                  htmlFor="inferenceLatencyTargetMs"
                  className="text-slate-300 text-sm font-medium"
                >
                  Inference Latency Target (ms)
                </Label>
                <Input
                  id="inferenceLatencyTargetMs"
                  type="number"
                  min={0}
                  step={1}
                  value={config.inferenceLatencyTargetMs}
                  onChange={(e) =>
                    setField(
                      "inferenceLatencyTargetMs",
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="bg-slate-700 border-slate-600 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-500"
                />
                <p className="text-slate-500 text-xs">
                  Target maximum latency for model inference in milliseconds.
                </p>
              </div>

              {/* Model drift interval */}
              <div className="space-y-2">
                <Label
                  htmlFor="modelDriftDaysInterval"
                  className="text-slate-300 text-sm font-medium"
                >
                  Model Drift Check Interval (days)
                </Label>
                <Input
                  id="modelDriftDaysInterval"
                  type="number"
                  min={1}
                  step={1}
                  value={config.modelDriftDaysInterval}
                  onChange={(e) =>
                    setField(
                      "modelDriftDaysInterval",
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="bg-slate-700 border-slate-600 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-500"
                />
                <p className="text-slate-500 text-xs">
                  How often to check for model drift, in days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adaptive Scaling */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-base font-semibold">
              Adaptive Scaling
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="adaptiveScaling"
              className="flex items-center gap-4 cursor-pointer group"
            >
              {/* Styled toggle */}
              <div className="relative flex-shrink-0">
                <input
                  id="adaptiveScaling"
                  type="checkbox"
                  checked={config.adaptiveScalingEnabled}
                  onChange={(e) =>
                    setField("adaptiveScalingEnabled", e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div
                  className={`w-11 h-6 rounded-full border-2 transition-colors duration-200 ${
                    config.adaptiveScalingEnabled
                      ? "bg-indigo-600 border-indigo-600"
                      : "bg-slate-700 border-slate-600"
                  } group-hover:border-indigo-500`}
                />
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    config.adaptiveScalingEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>

              <div>
                <p className="text-slate-200 text-sm font-medium">
                  Enable Adaptive Scaling
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Automatically adjust detection thresholds based on transaction
                  volume and historical patterns.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* ML Engine Status */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-100 text-base font-semibold">
                AI Engine — Dual-Model Topology
              </CardTitle>
              {mlHealth && (
                <Badge className={mlHealth.online
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
                }>
                  {mlHealth.online ? "● Online" : "● Offline"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!mlHealth ? (
              <p className="text-slate-500 text-sm">Checking ML service…</p>
            ) : !mlHealth.online ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                <p className="text-amber-400 text-sm font-medium">ML service is offline</p>
                <p className="text-slate-400 text-xs mt-1">
                  Run <code className="bg-slate-700 px-1.5 py-0.5 rounded text-indigo-300">cd ml-service &amp;&amp; ./start.sh</code> to start the dual-model engine.
                  The rule-based fallback engine will be used until it&apos;s online.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Status", value: mlHealth.modelLoaded ? "Model Loaded" : "No Model" },
                    { label: "Version", value: mlHealth.modelVersion ?? "—" },
                    { label: "Trained On", value: mlHealth.nSamples ? `${mlHealth.nSamples} samples` : "—" },
                    { label: "Last Trained", value: mlHealth.trainedAt
                        ? new Date(mlHealth.trainedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "Never" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-slate-200 text-sm font-medium truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Model topology */}
                {mlHealth.models && (
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Model Topology</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { key: "isolationForest", name: "Isolation Forest", tag: "unsupervised", w: mlHealth.ensembleWeights?.isolationForest },
                        { key: "autoencoder", name: "Autoencoder", tag: "unsupervised", w: mlHealth.ensembleWeights?.autoencoder },
                        { key: "xgboost", name: "XGBoost", tag: "supervised", w: mlHealth.ensembleWeights?.xgboost },
                      ].map(({ key, name, tag, w }) => {
                        const on = mlHealth.models?.[key as keyof typeof mlHealth.models];
                        return (
                          <div key={key} className={`rounded-lg border p-3 ${on ? "bg-indigo-600/10 border-indigo-500/30" : "bg-slate-900/50 border-slate-700"}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-green-400" : "bg-slate-600"}`} />
                              <p className="text-slate-200 text-sm font-medium">{name}</p>
                            </div>
                            <p className="text-slate-500 text-xs">{tag}{w != null ? ` · ${Math.round(w * 100)}% weight` : ""}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mlHealth.featureImportance && Object.keys(mlHealth.featureImportance).length > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Feature Importance (SHAP)</p>
                    <div className="space-y-1.5">
                      {Object.entries(mlHealth.featureImportance)
                        .sort(([, a], [, b]) => b - a)
                        .map(([feat, val]) => (
                          <div key={feat} className="flex items-center gap-3">
                            <span className="text-slate-400 text-xs w-40 truncate">{feat.replace(/_/g, " ")}</span>
                            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.round(val * 100)}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-xs w-10 text-right">{Math.round(val * 100)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    onClick={handleTrain}
                    disabled={training}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-sm"
                  >
                    {training ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Training…
                      </span>
                    ) : (
                      "Train Model on Transaction History"
                    )}
                  </Button>
                  <p className="text-slate-500 text-xs">
                    Uses last 500 transactions. Retrain every {config.modelDriftDaysInterval} days.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-indigo-400 text-white font-semibold px-6 py-2 transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              "Save Configuration"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
