"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface Msg {
  role: "you" | "da";
  html: string;
  trace?: string[];
}

const CHIPS = [
  "Run the compliance demo on the structuring scenario",
  "Is the cryptography real, or a stub?",
  "How does the auditor key work?",
  "Would transfers of 4000, 4000, 4000 be flagged?",
];

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

/** Markdown-lite → HTML, identical to the original static page. */
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

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stat, setStat] = useState<{ html: string }>({ html: "checking…" });
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<Turn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Smooth scroll (lenis loaded in layout) + health check, once.
  useEffect(() => {
    try {
      const Lenis = (window as any).Lenis;
      if (Lenis) {
        const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.9, smoothTouch: false });
        const raf = (t: number) => {
          lenis.raf(t);
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
      }
    } catch {}

    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => {
        if (j.keySet) setStat({ html: `<span class="dot"></span>ready · ${esc(j.model)}` });
        else setStat({ html: `<span class="dot off"></span><span class="warn">no api key set</span>` });
      })
      .catch(() => {});
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    historyRef.current.push({ role: "user", content: text });
    setMessages((m) => [...m, { role: "you", html: render(text) }, { role: "da", html: "…" }]);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));

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
      requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
    }
  }, [busy]);

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
    <div className="wrap">
      <div className="top">
        <div className="brand">
          ART+TECH · <b>SOLANA</b>
        </div>
        <a className="gh br" href="https://github.com/Venkat5599/Solanaskills" target="_blank" rel="noreferrer">
          view on github
        </a>
      </div>

      <header className="mast">
        <div className="meta">
          <span className="lab">2026 Edition</span>
          <span className="lab">solana-confidential-skill · live agent</span>
        </div>
        <div className="head">
          <span className="row">Confidential</span>
          <span className="row ghost">
            Compli<span className="three">3</span>nce
          </span>
        </div>
        <div className="strap">
          <span className="lab" style={{ maxWidth: 420 }}>
            Token-2022 · auditor-side AML · twisted-ElGamal over Ristretto255
          </span>
          <span className="edition">The Agent That Runs It</span>
        </div>
      </header>

      <section className="intro">
        <div>
          <span className="lab">Introduction</span>
        </div>
        <div className="body">
          This is a Claude agent that <b>consumes the skill and runs its real engine</b>. Ask it to run the
          compliance pipeline and it generates an auditor <span className="k">ElGamal</span> keypair, encrypts a
          confidential-transfer stream, <b>actually decrypts it</b>, scores it through the AML rule engine, and
          returns the flags plus a hashed compliance report. Not a chatbot about docs — the agent&apos;s tools{" "}
          <b>are</b> the skill. No install, no localnet.
        </div>
      </section>

      <section className="sec">
        <div className="shead">
          <span className="no">00</span>
          <h2>Ask The Agent</h2>
          <span className="stat lab" dangerouslySetInnerHTML={{ __html: stat.html }} />
        </div>

        <main id="thread">
          {messages.map((m, i) => (
            <div className="msg" key={i}>
              <div className={"who " + (m.role === "you" ? "you" : "da")}>{m.role === "you" ? "You" : "Agent"}</div>
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
            </div>
          ))}
        </main>

        <div className="prompts">
          <div className="plab lab">Suggested queries</div>
          <div className="pgrid">
            {CHIPS.map((c, i) => (
              <div className="p" key={i} onClick={() => void send(c)}>
                <span className="pno">{String(i + 1).padStart(2, "0")}</span>
                <span className="ptxt">{c}</span>
                <span className="arrow">↘</span>
              </div>
            ))}
          </div>
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
              Send
            </button>
          </div>
        </form>
      </section>

      <footer>
        <div className="cols">
          <div className="c">
            <h4>Engine</h4>
            <p>twisted-ElGamal · Ristretto255 · baby-step-giant-step DLOG · 30 tests passing</p>
          </div>
          <div className="c">
            <h4>Model</h4>
            <p>claude-opus-4-8 · tool-use loop · BM25 retrieval over the skill&apos;s own modules</p>
          </div>
          <div className="c">
            <h4>License</h4>
            <p>MIT · built for the Solana AI Kit</p>
          </div>
        </div>
        <div className="cc">COPYRIGHT © 2026 · SOLANA-CONFIDENTIAL-SKILL · #WEARESTILLEARLY</div>
      </footer>
    </div>
  );
}
