import { NextResponse } from "next/server";

const ML_SERVICE = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${ML_SERVICE}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ online: true, ...data });
  } catch {
    return NextResponse.json({ online: false });
  }
}
