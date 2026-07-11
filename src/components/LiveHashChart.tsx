import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Live hash-rate sparkline that streams new samples every second.
 * Simulates realistic jitter around a base hash rate.
 */
export function LiveHashChart({ base, height = 120 }: { base: number; height?: number }) {
  const [points, setPoints] = useState<number[]>(() =>
    Array.from({ length: 60 }, () => base + (Math.random() - 0.5) * base * 0.08),
  );
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    const tick = () => {
      if (Date.now() - lastRef.current > 1000) {
        lastRef.current = Date.now();
        setPoints((prev) => {
          const jitter = (Math.random() - 0.5) * base * 0.12;
          const drift = Math.sin(Date.now() / 8000) * base * 0.04;
          const next = Math.max(0, base + jitter + drift);
          return [...prev.slice(1), next];
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [base]);

  const w = 600;
  const h = height;
  const min = Math.min(...points) * 0.98;
  const max = Math.max(...points) * 1.02;
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const last = points[points.length - 1];

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="hash-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.16 305)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="oklch(0.72 0.16 305)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hash-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.72 0.16 305)" />
            <stop offset="100%" stopColor="oklch(0.78 0.15 195)" />
          </linearGradient>
        </defs>
        {/* grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 5" />
        ))}
        <path d={area} fill="url(#hash-area)" />
        <path d={path} fill="none" stroke="url(#hash-stroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* live dot */}
        <motion.circle
          cx={w}
          cy={h - ((last - min) / range) * h}
          r="4"
          fill="oklch(0.78 0.15 195)"
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      </svg>
      <div className="absolute top-2 right-2 rounded-full bg-white/60 backdrop-blur px-2 py-0.5 text-[10px] font-mono font-semibold flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-mint-foreground animate-pulse" />
        LIVE {last.toFixed(2)} TH/s
      </div>
    </div>
  );
}
