import { useEffect, useRef } from "react";

/**
 * Premium ambient background:
 * - Three parallax aurora blobs (CSS-driven, GPU-accelerated)
 * - Floating particle field (canvas, DPR-aware, capped)
 * - Mouse-follow radial glow + subtle parallax offset
 * - Fine grain noise texture, masked grid overlay
 * Fixed, pointer-events-none, sits behind everything.
 */
export function AuroraBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let tx = 0.5, ty = 0.5;
    let cx = 0.5, cy = 0.5;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth;
      ty = e.clientY / window.innerHeight;
    };
    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      root.style.setProperty("--mx", `${cx * 100}%`);
      root.style.setProperty("--my", `${cy * 100}%`);
      root.style.setProperty("--px", `${(cx - 0.5) * 20}px`);
      root.style.setProperty("--py", `${(cy - 0.5) * 20}px`);
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type P = { x: number; y: number; r: number; vx: number; vy: number; h: number; a: number; tw: number };
    const particles: P[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const count = reduce ? 0 : Math.min(46, Math.floor((window.innerWidth * window.innerHeight) / 38000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.05 - Math.random() * 0.25,
        h: 275 + Math.random() * 90,
        a: 0.15 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;
    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.03;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        const twinkle = 0.6 + Math.sin(p.tw) * 0.4;
        const alpha = p.a * twinkle;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        grd.addColorStop(0, `hsla(${p.h}, 92%, 78%, ${alpha})`);
        grd.addColorStop(1, `hsla(${p.h}, 92%, 78%, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ ["--mx" as any]: "50%", ["--my" as any]: "50%", ["--px" as any]: "0px", ["--py" as any]: "0px" }}
    >
      {/* Parallax aurora blobs */}
      <div className="aurora-parallax">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
        <div className="aurora-blob aurora-4" />
      </div>
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-80" />
      {/* Mouse-follow radial glow */}
      <div className="mouse-glow" />
      {/* Subtle grid */}
      <div className="grid-overlay" />
      {/* Noise texture */}
      <div className="noise-overlay" />
    </div>
  );
}
