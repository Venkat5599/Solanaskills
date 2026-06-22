import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.MODEL ?? "deepseek/deepseek-v4-flash";

export async function GET() {
  return NextResponse.json({
    ok: true,
    model: MODEL,
    provider: "aicredits",
    keySet: Boolean(process.env.AICREDITS_API_KEY ?? process.env.OPENAI_API_KEY),
  });
}
