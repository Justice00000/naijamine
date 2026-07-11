import { motion } from "framer-motion";
import { Cpu } from "lucide-react";

/**
 * Faux-3D mining rig: rotating rings, orbiting nodes, pulsing core.
 * Pure SVG/CSS — no WebGL, fast on mobile.
 */
export function RigVisual({ active, size = 220 }: { active: boolean; size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size, perspective: 800 }}>
      {/* orbiting rings */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white/50"
        style={{ transform: "rotateX(65deg)" }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full border-2 border-white/40 border-dashed"
        style={{ transform: "rotateX(65deg)" }}
        animate={{ rotateZ: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-10 rounded-full border border-white/50"
        style={{ transform: "rotateX(65deg)" }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* orbiting nodes */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 6 + i * 2, repeat: Infinity, ease: "linear" }}
          style={{ transform: `rotateX(65deg) rotate(${i * 90}deg)` }}
        >
          <div
            className="absolute w-3 h-3 rounded-full bg-white shadow-glow"
            style={{ left: "50%", top: 0, transform: "translate(-50%, -50%)" }}
          />
        </motion.div>
      ))}

      {/* core */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={active ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-white/40 blur-2xl animate-pulse-glow" />
          <div className="relative w-20 h-20 rounded-3xl bg-white/90 shadow-glow flex items-center justify-center">
            <motion.div
              animate={{ rotate: active ? 360 : 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Cpu className="w-10 h-10 text-primary" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ambient glow */}
      <div className="absolute inset-0 rounded-full bg-white/10 blur-3xl" />
    </div>
  );
}
