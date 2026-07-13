import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, Wallet, TrendingUp, Cpu, ArrowUpRight, ArrowDownRight,
  DollarSign, Activity, ShieldCheck, Sparkles, Clock, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  LineChart, Line, BarChart, Bar, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Skeleton } from "@/components/Skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Nimbus" }] }),
  component: AdminHome,
});

type Point = { d: string; v: number };

function daysBack(n: number) {
  const arr: string[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

function bucket(rows: Array<{ created_at: string; v: number }>, days: number): Point[] {
  const keys = daysBack(days);
  const map = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const k = r.created_at.slice(0, 10);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + r.v);
  }
  return keys.map((d) => ({ d: d.slice(5), v: Number((map.get(d) ?? 0).toFixed(2)) }));
}

function AdminHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const since24 = new Date(Date.now() - 86400000).toISOString();

      const [
        usersCount, contractsActive, contractsExpired,
        rev30, rev7, rev24,
        newUsers30, deposits30, withdrawals30,
        pendingDep, pendingWd, pendingKyc,
        recent,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("mining_contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("mining_contracts").select("id", { count: "exact", head: true }).eq("status", "expired"),
        supabase.from("platform_revenue").select("amount_usd, source, created_at").gte("created_at", since30),
        supabase.from("platform_revenue").select("amount_usd").gte("created_at", since7),
        supabase.from("platform_revenue").select("amount_usd").gte("created_at", since24),
        supabase.from("profiles").select("id, created_at").gte("created_at", since30),
        supabase.from("deposits").select("usd_value, created_at, status").gte("created_at", since30),
        supabase.from("withdrawals").select("amount, created_at, status").gte("created_at", since30),
        supabase.from("deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(8),
      ]);

      const revRows = (rev30.data ?? []).map((r: any) => ({ created_at: r.created_at, v: Number(r.amount_usd) }));
      const revSeries = bucket(revRows, 30);
      const userSeries = bucket((newUsers30.data ?? []).map((r: any) => ({ created_at: r.created_at, v: 1 })), 30);
      const depSeries = bucket(
        (deposits30.data ?? []).filter((r: any) => r.status === "completed").map((r: any) => ({ created_at: r.created_at, v: Number(r.usd_value ?? 0) })),
        14,
      );
      const wdSeries = bucket(
        (withdrawals30.data ?? []).filter((r: any) => r.status === "completed").map((r: any) => ({ created_at: r.created_at, v: Number(r.amount ?? 0) })),
        14,
      );
      const flow = depSeries.map((p, i) => ({ d: p.d, in: p.v, out: wdSeries[i]?.v ?? 0 }));

      const bySource: Record<string, number> = {};
      for (const r of rev30.data ?? []) bySource[r.source] = (bySource[r.source] ?? 0) + Number(r.amount_usd);

      return {
        users: usersCount.count ?? 0,
        activeContracts: contractsActive.count ?? 0,
        expiredContracts: contractsExpired.count ?? 0,
        rev24: (rev24.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_usd), 0),
        rev7: (rev7.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_usd), 0),
        rev30: revRows.reduce((s, r) => s + r.v, 0),
        newUsers7: (newUsers30.data ?? []).filter((u: any) => new Date(u.created_at).getTime() > Date.now() - 7 * 86400000).length,
        revSeries,
        userSeries,
        flow,
        bySource,
        pendingDep: pendingDep.count ?? 0,
        pendingWd: pendingWd.count ?? 0,
        pendingKyc: pendingKyc.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const growthPct = data.userSeries.length >= 14
    ? (() => {
        const a = data.userSeries.slice(-7).reduce((s, p) => s + p.v, 0);
        const b = data.userSeries.slice(-14, -7).reduce((s, p) => s + p.v, 0);
        return b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;
      })()
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Command center</h1>
          <p className="text-sm text-muted-foreground">Live platform pulse · refreshes every 30s</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-mint-foreground">
          <span className="w-2 h-2 rounded-full bg-mint-foreground animate-pulse" /> Live
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={DollarSign} tint="bg-gradient-primary" label="Revenue · 24h" value={data.rev24} money delta={null} />
        <Kpi icon={TrendingUp} tint="bg-gradient-mint" label="Revenue · 7d" value={data.rev7} money delta={null} />
        <Kpi icon={Sparkles} tint="bg-gradient-gold" label="Revenue · 30d" value={data.rev30} money delta={null} />
        <Kpi icon={Users} tint="bg-gradient-sky" label="Users" value={data.users} delta={growthPct} />
      </div>

      {/* Queues */}
      <div className="grid grid-cols-3 gap-3">
        <QueueCard to="/admin/deposits" tone="primary" label="Deposits pending" value={data.pendingDep} icon={ArrowDownRight} />
        <QueueCard to="/admin/withdrawals" tone="destructive" label="Withdrawals pending" value={data.pendingWd} icon={ArrowUpRight} />
        <QueueCard to="/admin/kyc" tone="gold" label="KYC pending" value={data.pendingKyc} icon={ShieldCheck} />
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-3">
        <GlassCard className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold flex items-center gap-2"><Activity className="w-4 h-4" /> Revenue · 30 days</h3>
            <div className="font-mono text-sm font-bold">${data.rev30.toFixed(2)}</div>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={data.revSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rev-a" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.16 305)" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="oklch(0.72 0.16 305)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  cursor={{ stroke: "oklch(0.72 0.16 305)", strokeOpacity: 0.3 }}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", fontSize: 12 }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "revenue"]}
                />
                <Area type="monotone" dataKey="v" stroke="oklch(0.72 0.16 305)" strokeWidth={2} fill="url(#rev-a)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> New users · 30d</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={data.userSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", fontSize: 12 }}
                  formatter={(v: any) => [`${v}`, "signups"]}
                />
                <Line type="monotone" dataKey="v" stroke="oklch(0.68 0.16 155)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Flow + sources */}
      <div className="grid md:grid-cols-3 gap-3">
        <GlassCard className="md:col-span-2">
          <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Wallet className="w-4 h-4" /> Cash flow · 14d (approved)</h3>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={data.flow} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", fontSize: 12 }}
                  formatter={(v: any, k: any) => [`$${Number(v).toFixed(2)}`, k === "in" ? "deposits" : "withdrawals"]}
                />
                <Bar dataKey="in" fill="oklch(0.68 0.16 155)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="out" fill="oklch(0.72 0.16 305)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Revenue sources</h3>
          {Object.keys(data.bySource).length === 0 && <p className="text-xs text-muted-foreground">No revenue in the last 30 days yet.</p>}
          <div className="space-y-3">
            {Object.entries(data.bySource).map(([k, v]) => {
              const total = Object.values(data.bySource).reduce((s, n) => s + n, 0) || 1;
              const pct = (v / total) * 100;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono font-bold">${v.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* System + activity */}
      <div className="grid md:grid-cols-3 gap-3">
        <GlassCard>
          <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Cpu className="w-4 h-4" /> Mining fleet</h3>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-mint/30 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Active</div>
              <div className="font-display text-2xl font-black text-mint-foreground"><AnimatedCounter value={data.activeContracts} /></div>
            </div>
            <div className="rounded-2xl bg-white/50 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Expired</div>
              <div className="font-display text-2xl font-black"><AnimatedCounter value={data.expiredContracts} /></div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Expired contracts auto-halted; no new payouts issued.
          </div>
        </GlassCard>

        <GlassCard className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Recent activity</h3>
            <Link to="/admin/deposits" className="text-xs font-semibold text-primary">Open queues →</Link>
          </div>
          <div className="divide-y divide-border/60">
            {data.recent.map((t: any) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="py-2 flex items-center gap-3 text-sm">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${Number(t.amount) >= 0 ? "bg-mint/40" : "bg-destructive/10"}`}>
                  {Number(t.amount) >= 0 ? <ArrowDownRight className="w-4 h-4 text-mint-foreground" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{t.description ?? t.type}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{t.type} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={`font-mono font-bold ${Number(t.amount) >= 0 ? "text-mint-foreground" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                </div>
              </motion.div>
            ))}
            {data.recent.length === 0 && <p className="text-xs text-muted-foreground py-4">No recent activity.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, money, tint, delta }: {
  icon: any; label: string; value: number; money?: boolean; tint: string; delta: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="glass rounded-2xl p-4 relative overflow-hidden"
    >
      <div className={`w-9 h-9 rounded-xl ${tint} text-primary-foreground flex items-center justify-center shadow-soft`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-2xl md:text-3xl font-black">
        <AnimatedCounter value={Number(value)} prefix={money ? "$" : ""} decimals={money ? 2 : 0} />
      </div>
      {delta !== null && (
        <div className={`mt-1 text-[11px] font-bold ${delta >= 0 ? "text-mint-foreground" : "text-destructive"} inline-flex items-center gap-1`}>
          {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(delta).toFixed(1)}% vs prev 7d
        </div>
      )}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/40 blur-2xl" />
    </motion.div>
  );
}

function QueueCard({ to, tone, label, value, icon: Icon }: { to: string; tone: "primary" | "destructive" | "gold"; label: string; value: number; icon: any }) {
  const tones: Record<string, string> = {
    primary: "bg-gradient-primary text-primary-foreground",
    destructive: "bg-destructive/90 text-destructive-foreground",
    gold: "bg-gradient-gold text-gold-foreground",
  };
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -2 }}
        className="glass rounded-2xl p-3 flex items-center gap-3"
      >
        <div className={`w-10 h-10 rounded-xl ${tones[tone]} flex items-center justify-center shadow-soft`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
          <div className="font-display text-xl font-black">
            <AnimatedCounter value={value} />
            {value > 0 && <span className="ml-1 text-[10px] font-semibold text-primary">review →</span>}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
