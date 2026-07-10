import { useMemo } from "react";

export function Sparkline({
  data,
  positive,
  className,
  strokeWidth = 1.5,
}: {
  data: number[];
  positive?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  const { path, area, id } = useMemo(() => {
    const w = 100;
    const h = 30;
    if (!data.length) return { path: "", area: "", id: "sl" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return [x, y] as const;
    });
    const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area = `${path} L${w},${h} L0,${h} Z`;
    const id = `sl-${Math.random().toString(36).slice(2, 8)}`;
    return { path, area, id };
  }, [data]);

  const stroke = positive ? "oklch(0.68 0.16 155)" : "oklch(0.62 0.22 25)";

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
