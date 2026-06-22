"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + rise on scroll-into-view. The workhorse reveal. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Masked line reveal — each line rises from behind a clip on mount. The classic
 * awwwards display-type entrance. Pass an array of lines.
 */
export function MaskLines({
  lines,
  className,
  lineClassName,
  start = 0.05,
  step = 0.11,
}: {
  lines: string[];
  className?: string;
  lineClassName?: string;
  start?: number;
  step?: number;
}) {
  return (
    <span className={className}>
      {lines.map((l, i) => (
        <span key={i} className={lineClassName} style={{ display: "block", overflow: "hidden" }}>
          <motion.span
            style={{ display: "block", willChange: "transform" }}
            initial={{ y: "115%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.95, delay: start + i * step, ease: EASE }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Simple staggered group — children rise in sequence as the group enters view. */
export function Stagger({
  children,
  className,
  step = 0.08,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{ show: { transition: { staggerChildren: step } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}
