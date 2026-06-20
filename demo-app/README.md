# Live demo — a Claude agent that runs the skill

A chatbox where a Claude agent **consumes `solana-confidential-skill` and executes its real engine.**
Not a chatbot about docs — when you ask it to run the compliance pipeline, it generates an auditor
ElGamal keypair, encrypts a synthetic transfer stream, **actually decrypts it** with the auditor key,
runs the AML rule engine, and returns the flags + a SHA-256 report hash. Judges test it live, no install
of the skill and no localnet.

## What it shows

- **The skill, consumed by an agent** — exactly the kit's pitch ("turn any coding agent into an expert
  Solana builder"). The agent's tools *are* the skill's engine.
- **Real cryptography, on demand** — `run_compliance_demo` calls `../lib` (twisted-ElGamal over
  Ristretto255 + baby-step-giant-step discrete log). Every flagged amount was genuinely decrypted.
- **Grounded answers** — `search_skill_docs` is BM25 retrieval over the skill's own 9 modules, so
  "how does the auditor key work?" is answered from the actual skill text, with citations.

## Architecture

```
 browser chat  ──►  Bun server (server.ts)  ──►  DeepSeek V4 Flash
                          │                       (AICredits OpenAI-compatible gateway, tool-calling loop)
                          │                              │ tool calls
                          │                              ▼
                          │                       tools.ts ──► ../lib  (real compliance engine)
                          │                                └─► rag.ts  (retrieval over ../skill/*.md)
                          ▼
                   public/index.html  (self-contained UI, ART+TECH editorial style)
```

Model-agnostic by design: the agent talks OpenAI-compatible chat-completions, so any
gateway works. Default is **DeepSeek V4 Flash via AICredits**; swap with env vars.

Agent tools:
| Tool | Runs |
|---|---|
| `run_compliance_demo` | the full encrypt → decrypt → AML → hashed-report pipeline on a chosen scenario |
| `assess_amounts` | the AML engine over explicit amounts |
| `search_skill_docs` | BM25 retrieval over `../skill/*.md` to ground explanations |

## Run it

```bash
cd demo-app
bun install
echo 'AICREDITS_API_KEY=sk-live-...' > .env   # gitignored
echo 'MODEL=deepseek/deepseek-v4-flash'      >> .env
bun run server.ts
# open http://localhost:8787
```

The UI loads and `/api/health` works without a key; the chat loop needs `AICREDITS_API_KEY`.
Uses the `openai` SDK pointed at the AICredits gateway (`https://api.aicredits.in/v1`).

| Env var | Default | Purpose |
|---|---|---|
| `AICREDITS_API_KEY` | — | gateway key (`sk-live-…`). **Keep it in `.env` (gitignored) — never commit.** |
| `MODEL` | `deepseek/deepseek-v4-flash` | any model the gateway serves |
| `MODEL_FALLBACK` | `deepseek/deepseek-chat` | auto-retry id if the primary is rejected (`none` to disable) |
| `AICREDITS_BASE_URL` | `https://api.aicredits.in/v1` | any OpenAI-compatible gateway |
| `PORT` | `8787` | server port |

## Try

- "Run the compliance demo on the structuring scenario"
- "Is the cryptography real, or a stub?"
- "How does the auditor key work?"
- "Would transfers of 4000, 4000, 4000 be flagged?"

## Deploy (optional, for a public judge link)

Any Bun-capable host (Railway, Fly, Render, a small VM). Set `ANTHROPIC_API_KEY` as a secret and expose
`PORT`. Because the chat consumes your key, rate-limit or front it with a usage cap before sharing a public
URL. MIT, same as the skill.
