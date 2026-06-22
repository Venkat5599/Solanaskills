"use client";

import { motion, useScroll, useSpring } from "motion/react";

/** Thin Voltage scroll-progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return <motion.div className="scrollbar" style={{ scaleX: x }} aria-hidden />;
}

/** Infinite broadsheet ticker — financial-press signature. */
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {row.map((t, i) => (
          <span className="marquee-item" key={i}>
            {t}
            <span className="marquee-tick" />
          </span>
        ))}
      </div>
    </div>
  );
}
