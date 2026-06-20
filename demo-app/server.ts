/**
 * Bun server: a Claude agent that consumes solana-confidential-skill.
 *
 * The agent's system prompt is the skill's SKILL.md routing. Its tools execute
 * the skill's real engine (encrypt → decrypt → AML → hashed report) and retrieve
 * the skill's own docs (RAG). Judges chat with it and watch the skill actually
 * run — no install, no localnet.
 *
 *   ANTHROPIC_API_KEY=sk-... bun run server.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toolDefs, runTool } from "./tools.ts";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = "claude-opus-4-8";
const SKILL_MD = readFileSync(join(import.meta.dir, "..", "skill", "SKILL.md"), "utf8");
const INDEX = readFileSync(join(import.meta.dir, "public", "index.html"), "utf8");

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

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

interface Turn {
  role: "user" | "assistant";
  content: any;
}

async function chat(history: Turn[]): Promise<{ reply: string; trace: string[] }> {
  const anthropic = getClient();
  const messages = history.map((t) => ({ role: t.role, content: t.content }));
  const trace: string[] = [];

  for (let i = 0; i < 6; i++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: toolDefs as any,
      messages,
    });

    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const results: any[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          trace.push(`🔧 ${block.name}(${JSON.stringify(block.input)})`);
          let out: string;
          try {
            out = await runTool(block.name, block.input);
          } catch (e) {
            out = `Tool error: ${(e as Error).message}`;
          }
          results.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return { reply: text || "(no text)", trace };
  }
  return { reply: "Stopped after too many tool iterations.", trace };
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(INDEX, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, model: MODEL, keySet: Boolean(process.env.ANTHROPIC_API_KEY) });
    }
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body = (await req.json()) as { history: Turn[] };
        const { reply, trace } = await chat(body.history ?? []);
        return Response.json({ reply, trace });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 500 });
      }
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`\n  solana-confidential-skill — live demo`);
console.log(`  http://localhost:${server.port}`);
console.log(`  model: ${MODEL}  |  key set: ${Boolean(process.env.ANTHROPIC_API_KEY)}\n`);
