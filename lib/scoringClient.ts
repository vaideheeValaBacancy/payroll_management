/**
 * Scoring client — calls the ML microservice via the Next.js API route.
 * Falls back to the local rule engine if the service is unavailable or
 * exceeds the 220ms latency target from the spec.
 */
import { calculateAnomalyScore } from "./scoringEngine";
import type { Employee, Transaction, ScoringResult } from "@/types";

interface ScoreInput {
  employeeId: string;
  grossInr: number;
  avgMonthlyPay: number;
  deptMeanPay?: number;
  routingChangedWithin48h: boolean;
  isBankAccountNew: boolean;
  sharedRoutingHashCount: number;
  department: string;
  routingHash?: string;
  thresholds: { quarantine: number; review: number };
}

export interface ModelScores {
  iforest: number | null;
  autoencoder: number | null;
  xgboost: number | null;
}

export interface ScoringResultWithMeta extends ScoringResult {
  modelVersion: string;
  inferenceMs: number;
  usedFallback: boolean;
  modelScores?: ModelScores;
}

export async function scoreTransaction(input: ScoreInput): Promise<ScoringResultWithMeta> {
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        anomalyScore:      data.anomalyScore,
        riskLevel:         data.riskLevel,
        status:            data.status,
        flagReasons:       data.flagReasons,
        shapContributions: data.shapContributions,
        validationToken:   data.status !== "QUARANTINED" ? crypto.randomUUID() : null,
        modelVersion:      data.modelVersion ?? "ml-service",
        inferenceMs:       data.inferenceMs ?? 0,
        usedFallback:      false,
        modelScores:       data.modelScores,
      };
    }
  } catch {
    // Network error — fall through to fallback
  }

  // Fallback: local rule engine
  const fallback = calculateAnomalyScore(
    {
      grossEarningsInr:        input.grossInr,
      routingChangedWithin48h: input.routingChangedWithin48h,
      isBankAccountNew:        input.isBankAccountNew,
      sharedRoutingHashCount:  input.sharedRoutingHashCount,
    },
    { avgMonthlyPay: input.avgMonthlyPay },
    input.thresholds
  );

  return {
    ...fallback,
    modelVersion: "rule-fallback",
    inferenceMs:  0,
    usedFallback: true,
  };
}
