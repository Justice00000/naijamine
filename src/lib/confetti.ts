import confetti from "canvas-confetti";

export function celebrate() {
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 } as const;
  const shoot = (particleRatio: number, opts: confetti.Options) =>
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(200 * particleRatio),
      colors: ["#a78bfa", "#f0abfc", "#67e8f9", "#fde68a", "#fca5a5"],
    });
  shoot(0.25, { spread: 26, startVelocity: 55, origin: { x: 0.5, y: 0.7 } });
  shoot(0.2, { spread: 60, origin: { x: 0.5, y: 0.7 } });
  shoot(0.35, { spread: 100, decay: 0.91, scalar: 0.9, origin: { x: 0.5, y: 0.7 } });
  shoot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, origin: { x: 0.5, y: 0.7 } });
  shoot(0.1, { spread: 120, startVelocity: 45, origin: { x: 0.5, y: 0.7 } });
}
