import { NextRequest, NextResponse } from "next/server";

const ML_SERVICE = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const res = await fetch(`${ML_SERVICE}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "ml_unavailable" }, { status: 503 });
  }
}
