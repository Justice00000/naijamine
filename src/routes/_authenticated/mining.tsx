import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Zap, Server, Activity, Clock, Radio, Flame, Snowflake } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { LiveHashChart } from "@/components/LiveHashChart";
import { RigVisual } from "@/components/RigVisual";
import { TempGauge } from "@/components/TempGauge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/mining")({
  head: () => ({ meta: [{ title: "Mining — Nimbus" }] }),
  component: MiningPage,
});

type LogEntry = { id: number; time: string; msg: string; kind: "share" | "block" | "info" };

function MiningPage() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const { data: contracts = [] } = useQuery({
    queryKey: ["all-contracts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("mining_contracts")
        .select("*, plan:mining_plans(name,badge,algorithm)")
        .eq("user_id", user!.id).order("purchased_at", { ascending: false });
      return data ?? [];
    },
  });

  const active = contracts.filter((c: any) => c.status === "active");
  const totalHash = active.reduce((s: number, c: any) => s + Number(c.hash_rate), 0);
  const dailyIncome = active.reduce((s: number, c: any) => s + Number(c.daily_earnings), 0);
  const pending = active.reduce((s: number, c: any) => {
    const dt = (Date.now() - new Date(c.last_accrued_at).getTime()) / 86400000;
    return s + dt * Number(c.daily_earnings);
  }, 0);
  const temp = 42 + Math.sin(tick / 12) * 3 + (active.length ? 6 : -8);
  const nextRewardIn = 3600 - (Math.floor(Date.now() / 1000) % 3600);
  const efficiency = active.length ? 92 + Math.sin(tick / 8) * 3 : 0;
  const power = active.length ? 340 + Math.sin(tick / 6) * 22 : 0;

  // Streaming pool activity log
  useEffect(() => {
    if (!active.length) return;
    const workers = ["nimbus-w01", "nimbus-w02", "nimbus-w03", "atlas-04", "stratus-05"];
    const interval = setInterval(() => {
      const roll = Math.random();
      const time = new Date().toLocaleTimeString("en-GB");
      const w = workers[Math.floor(Math.random() * workers.length)];
      const nonce = Math.random().toString(16).slice(2, 10);
      let entry: LogEntry;
      if (roll < 0.05) {
        entry = { id: Date.now(), time, kind: "block", msg: `Block found · reward split across pool · nonce 0x${nonce}` };
      } else if (roll < 0.9) {
        entry = { id: Date.now(), time, kind: "share", msg: `Accepted share from ${w} · 0x${nonce} · diff ${(Math.random() * 60 + 40).toFixed(0)}` };
      } else {
        entry = { id: Date.now(), time, kind: "info", msg: `Stratum ping ${w} ${(Math.random() * 40 + 20).toFixed(0)}ms` };
      }
      setLog((prev) => [entry, ...prev].slice(0, 14));
    }, 1600);
    return () => clearInterval(interval);
  }, [active.length]);

  const stats = useMemo(() => [
    { icon: Zap, label: "Daily", value: `$${dailyIncome.toFixed(2)}`, tone: "text-mint-foreground" },
    { icon: Activity, label: "Efficiency", value: `${efficiency.toFixed(1)}%`, tone: "text-primary" },
    { icon: Flame, label: "Power", value: `${power.toFixed(0)} W`, tone: "text-primary" },
    { icon: Clock, label: "Next reward", value: `${Math.floor(nextRewardIn / 60)}m ${String(nextRewardIn % 60).padStart(2, "0")}s`, tone: "text-primary" },
  ], [dailyIncome, efficiency, power, nextRewardIn]);

  return (
    <AppShell>
      <PageHeader title="Mining floor" subtitle={active.length ? `${active.length} rig${active.length > 1 ? "s" : ""} online` : "All rigs idle"} />

      {/* Hero rig + live chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow"
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/25 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-white/20 blur-3xl animate-float" />

        <div className="relative grid gap-4 sm:grid-cols-[1fr_1.1fr] items-center">
          <div className="order-2 sm:order-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-90">
              <Radio className="w-3 h-3 animate-pulse" /> Live network hash rate
            </div>
            <div className="mt-1 font-display text-4xl sm:text-5xl font-black font-mono leading-none">
              <AnimatedCounter value={totalHash} suffix="" decimals={2} />
              <span className="text-xl ml-1 opacity-80">TH/s</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
              <span className="font-mono">pool://nimbus-us-east</span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${active.length ? "bg-mint-foreground animate-pulse" : "bg-white/60"}`} />
                {active.length ? "Mining · SHA-256" : "Standby"}
              </span>
            </div>
          </div>
          <div className="order-1 sm:order-2 flex justify-center">
            <RigVisual active={active.length > 0} size={200} />
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl bg-white/15 backdrop-blur p-3">
          <LiveHashChart base={Math.max(totalHash, 0.2)} height={110} />
        </div>

        <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase opacity-85">
                <s.icon className="w-3 h-3" /> {s.label}
              </div>
              <div className="font-mono font-bold text-sm mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Row: pending + temp gauge */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <GlassCard delay={0.05}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Pending earnings</div>
          <div className="mt-1 font-display text-3xl font-black font-mono text-gradient tabular-nums">
            ${pending.toFixed(6)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Streaming per second · auto-credits on claim.</div>
          <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-gradient-mint"
              animate={{ width: ["0%", "100%"] }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </GlassCard>

        <GlassCard delay={0.1}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                {temp > 60 ? <Flame className="w-3 h-3 text-destructive" /> : <Snowflake className="w-3 h-3 text-primary" />}
                Core temperature
              </div>
              <div className="mt-1 font-display text-xl font-bold">
                {temp < 55 ? "Optimal" : temp < 72 ? "Warm" : "Hot"}
              </div>
              <div className="text-xs text-muted-foreground">Immersion cooling active</div>
            </div>
            <TempGauge value={temp} />
          </div>
        </GlassCard>
      </div>

      {/* Live pool activity */}
      <GlassCard className="mt-4" delay={0.15}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-display font-bold">Pool activity</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${active.length ? "bg-mint-foreground animate-pulse" : "bg-muted-foreground/40"}`} />
            {active.length ? "streaming" : "paused"}
          </span>
        </div>
        <div className="relative rounded-2xl bg-black/85 text-emerald-300 font-mono text-[11px] p-3 h-56 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/80" />
          <AnimatePresence initial={false}>
            {log.length === 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} className="text-emerald-300/60">
                {active.length ? "Waiting for first share…" : "Activate a plan to see live pool traffic."}
              </motion.p>
            )}
            {log.map((l) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`flex gap-2 ${l.kind === "block" ? "text-yellow-300" : l.kind === "info" ? "text-emerald-300/60" : ""}`}
              >
                <span className="opacity-60">{l.time}</span>
                <span className="opacity-70">{l.kind === "block" ? "★" : l.kind === "info" ? "·" : "✓"}</span>
                <span className="truncate">{l.msg}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* Contracts */}
      <h2 className="mt-6 font-display font-bold flex items-center gap-2">
        <Server className="w-4 h-4" /> Your rigs
      </h2>
      <div className="mt-2 space-y-2">
        {contracts.length === 0 && (
          <GlassCard className="text-center py-8">
            <p className="font-semibold">No rigs yet</p>
            <p className="text-xs text-muted-foreground">Head to Plans to activate your first contract.</p>
          </GlassCard>
        )}
        {contracts.map((c: any, i: number) => {
          const total = new Date(c.expires_at).getTime() - new Date(c.purchased_at).getTime();
          const elapsed = Math.max(0, Math.min(total, Date.now() - new Date(c.purchased_at).getTime()));
          const pct = (elapsed / total) * 100;
          const daysLeft = Math.max(0, Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000));
          const isActive = c.status === "active";
          return (
            <GlassCard key={c.id} delay={i * 0.04}>
              <div className="flex items-center gap-3">
                <motion.div
                  animate={isActive ? { rotate: 360 } : {}}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0"
                >
                  <Cpu className="w-6 h-6 text-primary-foreground" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{c.plan?.name}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${isActive ? "bg-mint/40 text-mint-foreground" : "bg-muted text-muted-foreground"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {c.plan?.algorithm} · {Number(c.hash_rate).toFixed(2)} TH/s · {daysLeft}d left
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-mint"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Accrued</div>
                  <div className="font-mono text-sm font-bold text-mint-foreground tabular-nums">${Number(c.accrued).toFixed(4)}</div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </AppShell>
  );
}
