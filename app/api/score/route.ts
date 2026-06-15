import { NextRequest, NextResponse } from "next/server";

const ML_SERVICE = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
const TIMEOUT_MS = 220; // spec: ≤220ms inference latency

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${ML_SERVICE}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`ML service returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    // ML service down or timed out — fall back to rule engine in the client
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: "ml_unavailable", reason: isTimeout ? "timeout" : "unreachable" },
      { status: 503 }
    );
  }
}
