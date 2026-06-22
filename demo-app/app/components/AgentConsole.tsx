"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface Msg {
  role: "you" | "da";
  html: string;
  trace?: string[];
}

const SCENARIOS = [
  { key: "structuring", label: "Structuring", desc: "smurfing — sub-threshold splits" },
  { key: "sanctions", label: "Sanctions", desc: "denylisted counterparty" },
  { key: "mixed", label: "Mixed", desc: "trips several rules at once" },
  { key: "clean", label: "Clean", desc: "nothing flagged" },
];

const PROMPTS = [
  "Is the cryptography real, or a stub?",
  "How does the auditor key work?",
  "Would transfers of 4000, 4000, 4000 be flagged?",
];

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function render(text: string): string {
  const fences: string[] = [];
  text = text.replace(/```[\w]*\n([\s\S]*?)```/g, (_, c) => {
    fences.push(c);
    return `  ${fences.length - 1}  `;
  });
  text = esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  text = text.replace(/ (\d+) /g, (_, i) => `<pre>${esc(fences[+i]!)}</pre>`);
  return text;
}

export default function AgentConsole() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stat, setStat] = useState<{ html: string }>({ html: "checking…" });
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<Turn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const scrollThread = () =>
    requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => {
        if (j.keySet) setStat({ html: `<span class="dot"></span>ready · ${esc(j.model)}` });
        else setStat({ html: `<span class="dot off"></span><span class="warn">no api key set</span>` });
      })
      .catch(() => setStat({ html: `<span class="dot off"></span><span class="warn">offline</span>` }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setBusy(true);
      historyRef.current.push({ role: "user", content: text });
      setMessages((m) => [...m, { role: "you", html: render(text) }, { role: "da", html: "…" }]);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.style.height = "auto";
      }
      scrollThread();

      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ history: historyRef.current }),
        });
        const j = await r.json();
        setMessages((m) => {
          const next = [...m];
          if (j.error) next[next.length - 1] = { role: "da", html: render("⚠️ " + j.error) };
          else {
            next[next.length - 1] = { role: "da", html: render(j.reply), trace: j.trace };
            historyRef.current.push({ role: "assistant", content: j.reply });
          }
          return next;
        });
      } catch (e) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "da", html: render("⚠️ " + (e as Error).message) };
          return next;
        });
      } finally {
        setBusy(false);
        scrollThread();
      }
    },
    [busy],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(inputRef.current?.value ?? "");
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(inputRef.current?.value ?? "");
    }
  };
  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  return (
    <div className="console">
      {/* left rail */}
      <aside className="rail">
        <div className="rail-block">
          <h3 className="lab">Run a scenario</h3>
          <div className="scns">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                className="scn"
                disabled={busy}
                onClick={() => void send(`Run the compliance demo on the ${s.key} scenario`)}
              >
                <span className="scn-label">{s.label}</span>
                <span className="scn-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rail-block">
          <h3 className="lab">Ask</h3>
          <div className="qlist">
            {PROMPTS.map((p, i) => (
              <button key={i} className="qrow" disabled={busy} onClick={() => void send(p)}>
                <span>{p}</span>
                <span className="arrow">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rail-block">
          <h3 className="lab">Engine</h3>
          <dl className="facts">
            <div><dt>Crypto</dt><dd>twisted-ElGamal · Ristretto255</dd></div>
            <div><dt>Decrypt</dt><dd>baby-step-giant-step DLOG</dd></div>
            <div><dt>Tests</dt><dd>30 passing</dd></div>
            <div><dt>Reports</dt><dd>SHA-256 · append-only</dd></div>
          </dl>
        </div>
      </aside>

      {/* main */}
      <section className="stage">
        <div className="stage-top">
          <span className="lab">Live agent</span>
          <span className="lab stat" dangerouslySetInnerHTML={{ __html: stat.html }} />
        </div>

        <div className="thread" ref={threadRef}>
          {messages.length === 0 && (
            <motion.div
              className="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <p className="empty-head">The agent&apos;s tools are the skill.</p>
              <p className="empty-sub">
                Run a scenario from the left, or ask anything. The agent generates a real auditor
                ElGamal key, encrypts a transfer stream, decrypts it, scores it through the AML
                engine, and returns flags + a hashed report.
              </p>
            </motion.div>
          )}
          {messages.map((m, i) => (
            <motion.div
              className="msg"
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <div className={"who " + (m.role === "you" ? "you" : "da")}>
                {m.role === "you" ? "You" : "Agent"}
              </div>
              <div className="body">
                <div dangerouslySetInnerHTML={{ __html: m.html }} />
                {m.trace && m.trace.length > 0 && (
                  <div className="trace">
                    {m.trace.map((line, j) => (
                      <div className="t" key={j}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <form onSubmit={onSubmit}>
          <div className="inbar">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask the agent to run the skill…"
              onKeyDown={onKeyDown}
              onInput={onInput}
            />
            <button className="send" type="submit" disabled={busy}>
              Send →
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
