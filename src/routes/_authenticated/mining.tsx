import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Cpu, Thermometer, Zap, Server, Activity, Clock } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/mining")({
  head: () => ({ meta: [{ title: "Mining — Nimbus" }] }),
  component: MiningPage,
});

function MiningPage() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(i); }, []);

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
  const temp = 42 + Math.sin(tick / 12) * 3;
  const nextRewardIn = 3600 - (Math.floor(Date.now() / 1000) % 3600);

  return (
    <AppShell>
      <PageHeader title="Mining floor" subtitle={active.length ? `${active.length} rigs online` : "No active rigs"} />

      {/* Big rig */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute w-40 h-40 rounded-full bg-white/40 blur-3xl -top-10 -right-10 animate-pulse-glow" />
          <div className="absolute w-32 h-32 rounded-full bg-white/30 blur-3xl bottom-0 left-1/3 animate-float" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Network hash rate</div>
            <div className="mt-1 font-display text-4xl font-extrabold font-mono">
              <AnimatedCounter value={totalHash} suffix=" TH/s" decimals={2} />
            </div>
            <div className="mt-3 flex gap-4 text-xs opacity-90">
              <div><span className="opacity-70">Pool</span> <span className="font-mono">nimbus-pool-us</span></div>
              <div className="flex items-center gap-1"><Activity className="w-3 h-3" /> {active.length ? "Mining" : "Idle"}</div>
            </div>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border-4 border-white/40 border-t-white flex items-center justify-center"
          >
            <Cpu className="w-10 h-10" />
          </motion.div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <RigStat icon={Thermometer} label="Temp" value={`${temp.toFixed(1)}°C`} />
          <RigStat icon={Zap} label="Daily" value={`$${dailyIncome.toFixed(2)}`} />
          <RigStat icon={Clock} label="Next reward" value={`${Math.floor(nextRewardIn / 60)}m ${nextRewardIn % 60}s`} />
        </div>
      </motion.div>

      {/* Pending accrual */}
      <GlassCard className="mt-4" delay={0.1}>
        <div className="text-xs text-muted-foreground">Pending earnings (accruing live)</div>
        <div className="mt-1 font-display text-3xl font-bold font-mono text-gradient">
          ${pending.toFixed(6)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Auto-credits when you claim from the dashboard.</div>
      </GlassCard>

      {/* Contracts */}
      <h2 className="mt-6 font-display font-bold flex items-center gap-2"><Server className="w-4 h-4" /> Your rigs</h2>
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
          return (
            <GlassCard key={c.id} delay={i * 0.04}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Cpu className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.plan?.name}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${c.status === "active" ? "bg-mint/40 text-mint-foreground" : "bg-muted text-muted-foreground"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {c.plan?.algorithm} · {Number(c.hash_rate).toFixed(2)} TH/s · {daysLeft}d left
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-mint" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Accrued</div>
                  <div className="font-mono text-sm font-bold text-mint-foreground">${Number(c.accrued).toFixed(4)}</div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </AppShell>
  );
}

function RigStat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase opacity-80"><Icon className="w-3 h-3" /> {label}</div>
      <div className="font-mono font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}
