import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  delay = 0,
  hover = false,
}: { children: ReactNode; className?: string; delay?: number; hover?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover ? { y: -3 } : undefined}
      className={cn("glass rounded-3xl p-5", className)}
    >
      {children}
    </motion.div>
  );
}
