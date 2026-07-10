import { motion } from "framer-motion";

/** Semi-circular gauge for the Crypto Fear & Greed Index (0-100). */
export function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const angle = -90 + (v / 100) * 180; // -90 (left) → +90 (right)
  const R = 60;
  const CX = 80;
  const CY = 80;
  // arc path
  const start = polar(CX, CY, R, -90);
  const end = polar(CX, CY, R, 90);
  const bg = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;

  const color =
    v < 25 ? "oklch(0.62 0.22 25)" :
    v < 45 ? "oklch(0.78 0.16 55)" :
    v < 55 ? "oklch(0.72 0.15 100)" :
    v < 75 ? "oklch(0.72 0.18 155)" :
             "oklch(0.62 0.19 155)";

  return (
    <div className="relative w-full flex flex-col items-center">
      <svg viewBox="0 0 160 100" className="w-full max-w-[220px]">
        <defs>
          <linearGradient id="fg-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.62 0.22 25)" />
            <stop offset="25%" stopColor="oklch(0.78 0.16 55)" />
            <stop offset="50%" stopColor="oklch(0.85 0.14 95)" />
            <stop offset="75%" stopColor="oklch(0.78 0.14 155)" />
            <stop offset="100%" stopColor="oklch(0.62 0.19 155)" />
          </linearGradient>
        </defs>
        <path d={bg} fill="none" stroke="url(#fg-grad)" strokeWidth="14" strokeLinecap="round" opacity="0.85" />
        {/* Needle */}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 60, damping: 14 }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
        >
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx={CX} cy={CY} r="6" fill={color} />
        </motion.g>
      </svg>
      <div className="-mt-6 text-center">
        <div className="font-display text-3xl font-black" style={{ color }}>{v}</div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
