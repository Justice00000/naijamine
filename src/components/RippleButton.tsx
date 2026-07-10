import { motion } from "framer-motion";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Ripple = { id: number; x: number; y: number };

export function RippleButton({
  children,
  className,
  onClick,
  variant = "primary",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: "primary" | "glass" | "ghost";
}) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const variants: Record<string, string> = {
    primary: "bg-gradient-primary text-primary-foreground shadow-glow hover:brightness-105",
    glass: "glass text-foreground hover:bg-white/60",
    ghost: "bg-white/25 backdrop-blur text-primary-foreground hover:bg-white/35",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const id = Date.now();
        setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
        setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 700);
        onClick?.(e);
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-[filter]",
        variants[variant],
        className,
      )}
      {...(rest as any)}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ opacity: 0.5, scale: 0 }}
          animate={{ opacity: 0, scale: 8 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="pointer-events-none absolute rounded-full bg-white/40"
          style={{ left: r.x - 6, top: r.y - 6, width: 12, height: 12 }}
        />
      ))}
    </motion.button>
  );
}
