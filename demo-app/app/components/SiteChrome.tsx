"use client";

/**
 * Premium site chrome — the awwwards finishing layer, all additive and
 * reduced-motion safe:
 *   1. Lenis inertial smooth scroll (the single biggest "feel" upgrade).
 *   2. A fixed film-grain overlay for analog texture.
 *   3. A one-time intro curtain that counts 0→100 then lifts — the classic
 *      awwwards page-load. Shown once per tab (sessionStorage).
 *
 * Uses the system cursor. Nothing here changes layout or the existing design
 * system; it only overlays.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Lenis from "lenis";

function useLenis(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);
}

function Grain() {
  return (
    <div className="grain" aria-hidden>
      <svg width="100%" height="100%">
        <filter id="grain-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-noise)" />
      </svg>
    </div>
  );
}

function Intro({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 280);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <motion.div
      className="intro"
      initial={{ y: 0 }}
      exit={{ y: "-100%" }}
      transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="intro-inner mono">
        <span className="intro-label">
          <span className="tri" aria-hidden>▶</span> Confidential<span className="teal">Audit</span>
        </span>
        <span className="intro-num">{String(n).padStart(3, "0")}</span>
      </div>
      <div className="intro-bar" style={{ transform: `scaleX(${n / 100})` }} />
    </motion.div>
  );
}

export default function SiteChrome() {
  const reduce = useReducedMotion();
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    if (!reduce && typeof window !== "undefined" && !sessionStorage.getItem("intro-seen")) {
      setIntro(true);
    }
  }, [reduce]);

  useLenis(!reduce);

  const done = () => {
    sessionStorage.setItem("intro-seen", "1");
    setIntro(false);
  };

  return (
    <>
      <Grain />
      <AnimatePresence>{intro && <Intro key="intro" onDone={done} />}</AnimatePresence>
    </>
  );
}
