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
 browser chat  ──►  Bun server (server.ts)  ──►  Claude (claude-opus-4-8, tool-use loop)
                          │                              │ tool calls
                          │                              ▼
                          │                       tools.ts ──► ../lib  (real compliance engine)
                          │                                └─► rag.ts  (retrieval over ../skill/*.md)
                          ▼
                   public/index.html  (self-contained UI)
```

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
ANTHROPIC_API_KEY=sk-ant-... bun run server.ts
# open http://localhost:8787
```

The UI loads and `/api/health` works without a key; the chat loop needs `ANTHROPIC_API_KEY`
(uses the official `@anthropic-ai/sdk`, model `claude-opus-4-8`). Set `PORT` to override 8787.

## Try

- "Run the compliance demo on the structuring scenario"
- "Is the cryptography real, or a stub?"
- "How does the auditor key work?"
- "Would transfers of 4000, 4000, 4000 be flagged?"

## Deploy (optional, for a public judge link)

Any Bun-capable host (Railway, Fly, Render, a small VM). Set `ANTHROPIC_API_KEY` as a secret and expose
`PORT`. Because the chat consumes your key, rate-limit or front it with a usage cap before sharing a public
URL. MIT, same as the skill.
