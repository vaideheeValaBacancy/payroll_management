import type { Employee, Transaction, ScoringResult } from "@/types";

export function calculateAnomalyScore(
  tx: Pick<Transaction, "grossEarningsInr" | "routingChangedWithin48h" | "isBankAccountNew" | "sharedRoutingHashCount">,
  employee: Pick<Employee, "avgMonthlyPay">,
  thresholds: { quarantine: number; review: number } = { quarantine: 0.75, review: 0.50 }
): ScoringResult {
  let score = 0;
  const reasons: string[] = [];
  const shap = { routingChange: 0, amountDeviation: 0, velocitySpike: 0, newBankAccount: 0 };

  if (tx.routingChangedWithin48h) {
    score += 0.35; shap.routingChange = 0.35;
    reasons.push("routing_number_changed_48h");
  }

  const ratio = tx.grossEarningsInr / employee.avgMonthlyPay;
  if (ratio > 2.5) {
    const dev = Math.min((ratio - 2.5) / 2.5, 1) * 0.25;
    score += dev; shap.amountDeviation = dev;
    reasons.push("amount_exceeds_2.5x_median");
  }

  if (tx.isBankAccountNew) {
    score += 0.20; shap.newBankAccount = 0.20;
    reasons.push("new_bank_account_detected");
  }

  if (tx.sharedRoutingHashCount > 1) {
    const ring = Math.min(tx.sharedRoutingHashCount * 0.10, 0.30);
    score += ring; shap.velocitySpike = ring;
    reasons.push(`shared_routing_hash_${tx.sharedRoutingHashCount}_employees`);
  }

  score = Math.min(score, 1.0);

  return {
    anomalyScore: parseFloat(score.toFixed(4)),
    riskLevel: score >= thresholds.quarantine ? "CRITICAL" : score >= thresholds.review ? "HIGH" : score >= 0.25 ? "MEDIUM" : "LOW",
    status: score >= thresholds.quarantine ? "QUARANTINED" : score >= thresholds.review ? "MANUAL_REVIEW" : "CLEARED",
    flagReasons: reasons,
    shapContributions: shap,
    validationToken: score < thresholds.quarantine ? crypto.randomUUID() : null,
  };
}
