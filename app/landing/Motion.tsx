"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

// Adapted from Vengeance UI AnimatedButton (MIT). See THIRD_PARTY_NOTICES.md.
export function AnimatedButton({
  children,
  className = "",
  ...props
}: Omit<HTMLMotionProps<"button">, "children"> & { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      {...props}
      className={`lp-button ${className}`}
      whileHover={reduced ? undefined : { scale: 1.01 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
    >
      <span>{children}</span>
      {!reduced && (
        <motion.span
          aria-hidden
          className="lp-button-shine"
          initial={{ backgroundPosition: "100% 0", opacity: 0 }}
          animate={{
            backgroundPosition: ["100% 0", "0% 0"],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.6,
            repeat: 2,
            ease: "linear",
            repeatDelay: 2,
          }}
        />
      )}
    </motion.button>
  );
}

// Skiper40 Link000 adaptation. Free-version attribution is visible in the footer.
export function AnimatedLink({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a href={href} className={`lp-animated-link ${className}`}>
      {children}
    </a>
  );
}

// Original in-view reveal, inspired by Animmaster's public scroll demos.
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reduced ? undefined : { opacity: [0, 1], y: [24, 0] }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
