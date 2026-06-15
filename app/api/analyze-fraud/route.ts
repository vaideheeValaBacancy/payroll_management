import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const tx = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const prompt = `You are a senior payroll fraud analyst at a financial compliance firm specializing in Indian corporate payroll.

Analyze the following transaction and produce a concise, authoritative fraud risk assessment. Be specific about what triggered each signal and what it means operationally.

TRANSACTION DATA:
- Employee: ${tx.employeeName} (${tx.department})
- Gross Earnings: ₹${tx.grossEarningsInr?.toLocaleString("en-IN")}
- Net Disbursable: ₹${tx.netDisbursableInr?.toLocaleString("en-IN")}
- Anomaly Score: ${(tx.anomalyScore * 100).toFixed(1)}% (${tx.riskLevel})
- Status: ${tx.status}

RISK SIGNALS DETECTED:
${tx.flagReasons?.length > 0
  ? tx.flagReasons.map((r: string) => `• ${r.replace(/_/g, " ")}`).join("\n")
  : "• No specific signals triggered (pattern-based anomaly)"}

SHAP FEATURE CONTRIBUTIONS (what drove the score):
• Routing number change weight: ${((tx.shapContributions?.routingChange ?? 0) * 100).toFixed(1)}%
• Amount deviation weight: ${((tx.shapContributions?.amountDeviation ?? 0) * 100).toFixed(1)}%
• Shared routing hash weight: ${((tx.shapContributions?.velocitySpike ?? 0) * 100).toFixed(1)}%
• New bank account weight: ${((tx.shapContributions?.newBankAccount ?? 0) * 100).toFixed(1)}%

SCORING ENGINE: ${tx.modelVersion?.includes("rule") ? "Rule-based engine (Isolation Forest model not yet trained)" : `Isolation Forest ML model v${tx.modelVersion}`}

Provide your analysis in this exact JSON structure:
{
  "headline": "One sentence verdict (max 15 words)",
  "riskNarrative": "2-3 sentences explaining exactly WHY this was flagged, referencing the specific signals and what they indicate in an Indian payroll context",
  "topSignal": "The single most suspicious signal and why",
  "recommendation": "One specific action the compliance officer should take",
  "fraudPattern": "Name the fraud pattern this matches (e.g. Ghost Employee, Payroll Diversion, Salary Inflation, Benign Anomaly)",
  "confidence": "HIGH | MEDIUM | LOW — your confidence this is genuine fraud vs a false positive",
  "falsePositiveReason": "If this might be a false positive, explain why. Otherwise null."
}

Return ONLY the JSON, no markdown, no explanation outside the JSON.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json({ analysis, model: message.model, usage: message.usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
