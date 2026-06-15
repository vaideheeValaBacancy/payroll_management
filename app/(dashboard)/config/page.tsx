"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getRiskConfig, saveRiskConfig } from "@/lib/firestore";
import type { RiskConfig } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const DEFAULT_CONFIG: RiskConfig = {
  anomalyScoreQuarantine: 0.75,
  anomalyScoreReview: 0.5,
  maxFprPercent: 0.05,
  inferenceLatencyTargetMs: 220,
  modelDriftDaysInterval: 30,
  adaptiveScalingEnabled: false,
};

export default function ConfigPage() {
  const [config, setConfig] = useState<RiskConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, []);

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
