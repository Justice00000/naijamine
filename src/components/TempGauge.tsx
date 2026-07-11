import { motion } from "framer-motion";

/** Radial temperature dial (°C). Green→amber→red bands. */
export function TempGauge({ value, max = 90 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = -135 + pct * 270;
  const color =
    value < 55 ? "oklch(0.68 0.16 155)" :
    value < 72 ? "oklch(0.78 0.16 55)" :
                 "oklch(0.62 0.22 25)";
  const R = 52;
  const CX = 70;
  const CY = 70;
  const arc = (from: number, to: number) => {
    const a = (from * Math.PI) / 180;
    const b = (to * Math.PI) / 180;
    const x1 = CX + R * Math.cos(a);
    const y1 = CY + R * Math.sin(a);
    const x2 = CX + R * Math.cos(b);
    const y2 = CY + R * Math.sin(b);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg viewBox="0 0 140 140" className="w-full max-w-[160px]">
      <path d={arc(135, 405)} fill="none" stroke="oklch(0.92 0.02 300)" strokeWidth="10" strokeLinecap="round" />
      <path d={arc(135, 135 + pct * 270)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
      <motion.g
        initial={{ rotate: -135 }}
        animate={{ rotate: angle }}
        transition={{ type: "spring", stiffness: 60, damping: 12 }}
        style={{ originX: `${CX}px`, originY: `${CY}px` }}
      >
        <line x1={CX} y1={CY} x2={CX + R - 8} y2={CY} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="6" fill={color} />
      </motion.g>
      <text x={CX} y={CY + 28} textAnchor="middle" className="fill-current" style={{ fontSize: 18, fontWeight: 700 }}>
        {value.toFixed(1)}°C
      </text>
    </svg>
  );
}
