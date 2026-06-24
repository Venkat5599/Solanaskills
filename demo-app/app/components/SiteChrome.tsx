"use client";

/**
 * Premium site chrome — the awwwards finishing layer, all additive and
 * reduced-motion safe:
 *   1. Lenis inertial smooth scroll (the single biggest "feel" upgrade).
 *   2. A custom blended cursor: a precise dot + a lagging ring that swells over
 *      interactive elements. mix-blend-difference so it reads on linen AND on the
 *      obsidian footer with one colour.
 *   3. A fixed film-grain overlay for analog texture.
 *   4. A one-time intro curtain that counts 0→100 then lifts — the classic
 *      awwwards page-load. Shown once per tab (sessionStorage).
 *
 * Nothing here changes layout or the existing design system; it only overlays.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion } from "motion/react";
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

/** Dot tracks the cursor 1:1; the ring follows on a spring and grows on hover. */
function Cursor() {
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { stiffness: 350, damping: 28, mass: 0.4 });
  const ringY = useSpring(dotY, { stiffness: 350, damping: 28, mass: 0.4 });
  const [hot, setHot] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      setHidden(false);
      const t = e.target as HTMLElement;
      setHot(!!t.closest("a,button,.brk,[role='button'],input,textarea,.cap,.tl-row,.scn,.qrow"));
    };
    const leave = () => setHidden(true);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseleave", leave);
    document.body.classList.add("cursor-on");
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", leave);
      document.body.classList.remove("cursor-on");
    };
  }, [dotX, dotY]);

  return (
    <div className="cursor-root" aria-hidden style={{ opacity: hidden ? 0 : 1 }}>
      <motion.div className={"cursor-ring" + (hot ? " hot" : "")} style={{ x: ringX, y: ringY }} />
      <motion.div className="cursor-dot" style={{ x: dotX, y: dotY }} />
    </div>
  );
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
  const [fine, setFine] = useState(false);
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    setFine(typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches);
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
      {!reduce && fine && <Cursor />}
      <AnimatePresence>{intro && <Intro key="intro" onDone={done} />}</AnimatePresence>
    </>
  );
}
