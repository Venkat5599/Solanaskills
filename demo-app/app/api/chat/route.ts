/**
 * Chat endpoint — an agent that consumes solana-confidential-skill, powered by
 * DeepSeek V4 Flash via the AICredits OpenAI-compatible gateway.
 *
 * The agent's system prompt is the skill's SKILL.md routing. Its tools execute
 * the skill's real engine (encrypt → decrypt → AML → hashed report) and retrieve
 * the skill's own docs (RAG). Judges chat with it and watch the skill actually
 * run — no install, no localnet.
 */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toolDefs, runTool } from "@/tools";

// node:fs + the skill engine require the Node.js runtime; never static.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = process.env.AICREDITS_BASE_URL ?? "https://api.aicredits.in/v1";
const MODEL = process.env.MODEL ?? "deepseek/deepseek-v4-flash";
// Fallback if the gateway doesn't recognize the V4 Flash id (it confirms
// deepseek/deepseek-chat in its docs). Override with MODEL_FALLBACK=none to disable.
const MODEL_FALLBACK = process.env.MODEL_FALLBACK ?? "deepseek/deepseek-chat";
const SKILL_MD = readFileSync(join(process.cwd(), "..", "skill", "SKILL.md"), "utf8");

const SYSTEM = `You are the live assistant for **solana-confidential-skill** — the auditor-side compliance & AML layer for Solana Token-2022 Confidential Transfers. You are demonstrating the skill to hackathon judges.

You have three tools, and you USE them rather than describing them:
- run_compliance_demo: runs the skill's real pipeline (generates an auditor ElGamal key, encrypts a synthetic transfer stream, REALLY decrypts it, runs the AML engine, returns flags + a hashed report). Call this whenever the user wants to see it work.
- assess_amounts: scores explicit amounts through the AML engine.
- search_skill_docs: retrieves the skill's own modules to ground how/why answers.

Rules:
- When a user asks to "show me", "run the demo", "is this real", or names a pattern (structuring, sanctions), CALL run_compliance_demo and report the actual flags + report hash it returns. Never invent numbers.
- For conceptual questions, call search_skill_docs first and answer from the retrieved passages, citing the module name.
- Be concise and concrete. Lead with the result. This is a real, tested engine (twisted-ElGamal over Ristretto255 + baby-step-giant-step discrete log); say so plainly when asked "is the crypto real".
- Privacy framing matters: the auditor key decrypts only its own mint, inside the auditor's trust boundary.

The skill's entry point (SKILL.md) for reference:
---
${SKILL_MD.slice(0, 6000)}
---`;

// Convert the skill's tool defs (Anthropic-style input_schema) to OpenAI
// function-calling format that DeepSeek understands.
const OPENAI_TOOLS = toolDefs.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema as any },
}));

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.AICREDITS_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("AICREDITS_API_KEY not set");
    client = new OpenAI({ apiKey, baseURL: BASE_URL });
  }
  return client;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

async function chat(history: Turn[]): Promise<{ reply: string; trace: string[] }> {
  const ai = getClient();
  const messages: any[] = [
    { role: "system", content: SYSTEM },
    ...history.map((t) => ({ role: t.role, content: t.content })),
  ];
  const trace: string[] = [];
  let model = MODEL;

  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await ai.chat.completions.create({ model, max_tokens: 1500, messages, tools: OPENAI_TOOLS });
    } catch (e) {
      const m = (e as Error).message ?? "";
      // Unknown-model error → retry once on the fallback id.
      if (model === MODEL && MODEL_FALLBACK !== "none" && /model|not found|404|does not exist/i.test(m)) {
        trace.push(`⚠️ model "${model}" rejected — retrying as "${MODEL_FALLBACK}"`);
        model = MODEL_FALLBACK;
        res = await ai.chat.completions.create({ model, max_tokens: 1500, messages, tools: OPENAI_TOOLS });
      } else {
        throw e;
      }
    }
    const msg = res.choices[0]?.message;
    if (!msg) return { reply: "(empty response)", trace };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        const name = call.function.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}
        trace.push(`🔧 ${name}(${JSON.stringify(args)})`);
        let out: string;
        try {
          out = await runTool(name, args);
        } catch (e) {
          out = `Tool error: ${(e as Error).message}`;
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: out });
      }
      continue;
    }

    return { reply: msg.content ?? "(no text)", trace };
  }
  return { reply: "Stopped after too many tool iterations.", trace };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { history: Turn[] };
    const { reply, trace } = await chat(body.history ?? []);
    return NextResponse.json({ reply, trace });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
