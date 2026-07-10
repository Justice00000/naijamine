import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight, ArrowDownRight, Coins, Cpu, Zap, TrendingUp, Sparkles,
  Gift, ArrowRight, Plus, Flame, Activity, Users, Wallet as WalletIcon,
  ShieldCheck, Rocket, Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from "recharts";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Sparkline } from "@/components/Sparkline";
import { FearGreedGauge } from "@/components/FearGreedGauge";
import { RippleButton } from "@/components/RippleButton";
import { Skeleton, StatSkeleton } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { claimEarnings } from "@/lib/mining.functions";
import { claimReferral } from "@/lib/referrals.functions";
import { getMarketSnapshot } from "@/lib/market.functions";
import { usd } from "@/lib/format";
import { celebrate } from "@/lib/confetti";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NaijaMine" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const claimFn = useServerFn(claimEarnings);
  const claimRefFn = useServerFn(claimReferral);
  const marketFn = useServerFn(getMarketSnapshot);

  // Referral fallback claim after OAuth
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const pending = sessionStorage.getItem("nimbus_pending_ref");
    if (!pending) return;
    claimRefFn({ data: { code: pending } })
      .then((res) => {
        sessionStorage.removeItem("nimbus_pending_ref");
        if (res?.ok && !res.alreadyLinked) {
          toast.success("Referral applied", { description: "You joined via a referral link." });
          qc.invalidateQueries({ queryKey: ["profile", user.id] });
        }
      })
      .catch(() => sessionStorage.removeItem("nimbus_pending_ref"));
  }, [user, claimRefFn, qc]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["active-contracts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("mining_contracts")
        .select("*, plan:mining_plans(name,color,badge,algorithm)")
        .eq("user_id", user!.id).eq("status", "active").order("purchased_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["recent-tx-30d", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("transactions").select("*")
        .eq("user_id", user!.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: referralCount = 0 } = useQuery({
    queryKey: ["referral-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user!.id);
      return count ?? 0;
    },
  });

  const { data: announcement } = useQuery({
    queryKey: ["latest-broadcast"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications")
        .select("*").is("user_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: market, isLoading: marketLoading } = useQuery({
    queryKey: ["market-snapshot"],
    refetchInterval: 60000,
    staleTime: 55000,
    queryFn: () => marketFn(),
  });

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (res) => {
      if (res.credited > 0) {
        toast.success(`Claimed ${usd(res.credited, 4)}`, { description: "Credited to your wallet." });
        celebrate();
      } else {
        toast.info("Nothing to claim yet", { description: "Earnings accrue every second." });
      }
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["active-contracts"] });
      qc.invalidateQueries({ queryKey: ["recent-tx-30d"] });
    },
    onError: (e) => toast.error("Claim failed", { description: (e as Error).message }),
  });

  // Live accrual estimates
  const perSecond = contracts.reduce((s: number, c: any) => s + Number(c.daily_earnings) / 86400, 0);
  const pending = contracts.reduce((s: number, c: any) => {
    const dt = (Date.now() - new Date(c.last_accrued_at).getTime()) / 86400000;
    return s + Math.max(0, dt) * Number(c.daily_earnings);
  }, 0);
  const totalHash = contracts.reduce((s: number, c: any) => s + Number(c.hash_rate), 0);
  const dailyForecast = contracts.reduce((s: number, c: any) => s + Number(c.daily_earnings), 0);
  const monthlyForecast = dailyForecast * 30;

  // Build 7-day earnings series from mining_earning transactions
  const earningsSeries = useMemo(() => {
    const days: { day: string; label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        day: key,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        total: 0,
      });
    }
    for (const t of txs as any[]) {
      const amount = Number(t.amount);
      if (amount <= 0) continue;
      const key = new Date(t.created_at).toISOString().slice(0, 10);
      const bucket = days.find((d) => d.day === key);
      if (bucket) bucket.total += amount;
    }
    return days;
  }, [txs]);

  const todayEarned = earningsSeries[earningsSeries.length - 1]?.total ?? 0;
  const monthEarned = (txs as any[]).reduce((s, t) => s + Math.max(0, Number(t.amount)), 0);

  // Portfolio allocation from contracts
  const allocation = useMemo(() => {
    const byPlan = new Map<string, number>();
    for (const c of contracts as any[]) {
      const name = c.plan?.name ?? "Contract";
      byPlan.set(name, (byPlan.get(name) ?? 0) + Number(c.daily_earnings));
    }
    const arr = Array.from(byPlan.entries()).map(([name, value]) => ({ name, value }));
    const balance = Number(wallet?.balance ?? 0);
    if (balance > 0) arr.unshift({ name: "Cash", value: balance / 30 }); // normalize into "per-day" scale
    return arr;
  }, [contracts, wallet]);

  const allocationColors = [
    "oklch(0.72 0.18 300)",
    "oklch(0.72 0.15 175)",
    "oklch(0.78 0.16 55)",
    "oklch(0.68 0.18 340)",
    "oklch(0.65 0.17 235)",
  ];

  const firstName = (profile?.full_name ?? (user?.user_metadata as any)?.full_name ?? (user?.user_metadata as any)?.name ?? user?.email?.split("@")[0] ?? "there")?.split(" ")[0];

  const efficiency = contracts.length
    ? Math.min(100, Math.round(70 + (totalHash / Math.max(1, contracts.length)) * 3))
    : 0;

  return (
    <AppShell>
      <PageHeader title={`Hi, ${firstName} 👋`} subtitle="Your cloud rigs are humming." />

      {/* Announcement */}
      {announcement && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur px-3 py-2.5 text-sm"
        >
          <Megaphone className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold truncate">{announcement.title}</div>
            {announcement.body && <div className="text-xs text-muted-foreground line-clamp-2">{announcement.body}</div>}
          </div>
        </motion.div>
      )}

      {/* Balance Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-5 sm:p-6 text-primary-foreground shadow-glow"
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/25 blur-3xl animate-float" />
        <div className="absolute -left-10 bottom-0 w-40 h-40 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest opacity-80">Total balance</div>
              <div className="mt-1 font-display text-4xl sm:text-5xl font-black tracking-tight">
                <AnimatedCounter value={Number(wallet?.balance ?? 0)} prefix="$" decimals={2} />
              </div>
              <div className="mt-1.5 text-xs opacity-90 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur px-2 py-0.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
                  +${pending.toFixed(6)} pending
                </span>
                <span className="opacity-80 font-mono">≈ ${(perSecond * 3600).toFixed(4)}/hr</span>
              </div>
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              className="hidden sm:grid place-items-center w-16 h-16 rounded-full border-2 border-white/30 border-t-white/90 shrink-0"
            >
              <Cpu className="w-6 h-6" />
            </motion.div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <RippleButton variant="ghost" className="!py-2.5" onClick={() => nav({ to: "/deposit" })}>
              <ArrowDownRight className="w-4 h-4" /> Deposit
            </RippleButton>
            <RippleButton variant="ghost" className="!py-2.5" onClick={() => nav({ to: "/withdraw" })}>
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </RippleButton>
            <RippleButton
              className="!bg-white !text-primary !shadow-soft"
              onClick={() => claim.mutate()}
              disabled={claim.isPending}
            >
              <Sparkles className="w-4 h-4" /> {claim.isPending ? "Claiming…" : "Claim"}
            </RippleButton>
          </div>
        </div>
      </motion.div>

      {/* Stat pills */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill icon={Coins} label="Today" value={usd(todayEarned, 2)} tint="mint" delay={0} />
        <StatPill icon={TrendingUp} label="30-day" value={usd(monthEarned, 2)} tint="primary" delay={0.05} />
        <StatPill icon={Cpu} label="Hash rate" value={`${totalHash.toFixed(2)} TH/s`} tint="sky" delay={0.1} />
        <StatPill icon={Gift} label="Referrals" value={String(referralCount)} tint="gold" delay={0.15} />
      </div>

      {/* Chart + Fear&Greed */}
      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-display font-bold">Earnings</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · projected ${dailyForecast.toFixed(2)}/day</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Monthly forecast</div>
              <div className="font-display font-bold text-xl text-gradient">${monthlyForecast.toFixed(2)}</div>
            </div>
          </div>
          <div className="h-52 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="earn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 300)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 300)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="oklch(0.55 0.03 285)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.03 285)" fontSize={11} tickLine={false} axisLine={false} width={28}
                  tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(1 0 0 / 0.9)", border: "1px solid oklch(0.92 0.01 285)",
                    borderRadius: 12, backdropFilter: "blur(10px)", fontSize: 12,
                  }}
                  formatter={(v: any) => [`$${Number(v).toFixed(4)}`, "Earned"]}
                />
                <Area type="monotone" dataKey="total" stroke="oklch(0.62 0.19 295)" strokeWidth={2.5} fill="url(#earn)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-display font-bold flex items-center gap-1.5"><Flame className="w-4 h-4 text-warning" /> Sentiment</h3>
              <p className="text-xs text-muted-foreground">Fear & Greed · daily</p>
            </div>
          </div>
          {market?.fearGreed ? (
            <FearGreedGauge value={market.fearGreed.value} label={market.fearGreed.classification} />
          ) : marketLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="text-xs text-muted-foreground text-center py-6">Sentiment unavailable</div>
          )}
        </GlassCard>
      </div>

      {/* Mining health + Portfolio allocation */}
      <div className="mt-4 grid lg:grid-cols-3 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary" /> Mining health</h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Live</span>
          </div>
          <div className="flex items-center gap-4">
            <CircularProgress value={efficiency} />
            <div className="flex-1 space-y-2 text-xs">
              <HealthRow label="Uptime" value="99.98%" positive />
              <HealthRow label="Pool latency" value="42 ms" positive />
              <HealthRow label="Rejected shares" value="0.01%" positive />
              <HealthRow label="Rigs online" value={`${contracts.length}/${contracts.length}`} positive={contracts.length > 0} />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold">Portfolio allocation</h3>
              <p className="text-xs text-muted-foreground">Weight by daily earnings + cash reserve</p>
            </div>
          </div>
          {allocation.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              Buy a plan to see your portfolio breakdown.
            </div>
          ) : (
            <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      dataKey="value"
                      innerRadius={38}
                      outerRadius={60}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {allocation.map((_, i) => (
                        <Cell key={i} fill={allocationColors[i % allocationColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(1 0 0 / 0.9)", border: "1px solid oklch(0.92 0.01 285)",
                        borderRadius: 12, fontSize: 12,
                      }}
                      formatter={(v: any, n: any) => [`$${Number(v).toFixed(4)}`, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {allocation.slice(0, 5).map((a, i) => {
                  const total = allocation.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? (a.value / total) * 100 : 0;
                  return (
                    <div key={a.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: allocationColors[i % allocationColors.length] }} />
                      <span className="flex-1 truncate font-medium">{a.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick actions */}
      <div className="mt-6">
        <h2 className="font-display font-bold mb-2">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction icon={Rocket} label="Buy plan" desc="Add a rig" tint="primary" onClick={() => nav({ to: "/plans" })} />
          <QuickAction icon={WalletIcon} label="Wallet" desc="History & assets" tint="mint" onClick={() => nav({ to: "/wallet" })} />
          <QuickAction icon={Users} label="Refer" desc="Earn 5%" tint="gold" onClick={() => nav({ to: "/referrals" })} />
          <QuickAction icon={ShieldCheck} label="Verify KYC" desc="Unlock limits" tint="sky" onClick={() => nav({ to: "/kyc" })} />
        </div>
      </div>

      {/* Active contracts */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Active contracts</h2>
          <button onClick={() => nav({ to: "/plans" })} className="text-xs font-semibold text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
            Browse plans <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {contracts.length === 0 && (
            <GlassCard className="text-center py-8">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse-glow">
                <Zap className="w-7 h-7 text-primary-foreground" />
              </div>
              <p className="mt-3 font-semibold">No active rigs</p>
              <p className="text-xs text-muted-foreground">Buy your first mining contract in seconds.</p>
              <RippleButton className="mt-4" onClick={() => nav({ to: "/plans" })}>
                <Plus className="w-3.5 h-3.5" /> Add contract
              </RippleButton>
            </GlassCard>
          )}
          {contracts.map((c: any, idx: number) => {
            const total = new Date(c.expires_at).getTime() - new Date(c.purchased_at).getTime();
            const elapsed = Date.now() - new Date(c.purchased_at).getTime();
            const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <GlassCard className="!p-4" hover>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                        <Cpu className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{c.plan?.name ?? "Plan"}</span>
                        {c.plan?.badge && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-gradient-gold text-gold-foreground">{c.plan.badge}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {Number(c.hash_rate).toFixed(2)} TH/s · ${Number(c.daily_earnings).toFixed(2)}/day
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full bg-gradient-mint"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-mint-foreground">+${Number(c.accrued).toFixed(4)}</div>
                      <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Markets + Trending */}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold">Live markets</h3>
            <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> live
            </span>
          </div>
          <div className="space-y-1">
            {marketLoading && !market && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
            ))}
            {(market?.top ?? []).slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-white/40 px-1.5 -mx-1.5 transition-colors">
                <img src={p.image} alt={p.name} width={22} height={22} className="rounded-full" loading="lazy" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{p.symbol}</div>
                  <div className="text-[10px] text-muted-foreground truncate leading-tight">{p.name}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-16 h-6 opacity-80">
                    <Sparkline data={p.sparkline} positive={p.change24h >= 0} className="w-full h-full" />
                  </div>
                  <div className="text-right min-w-[70px]">
                    <div className="font-mono font-semibold text-sm">${fmtPrice(p.price)}</div>
                    <div className={`text-[10px] font-semibold ${p.change24h >= 0 ? "text-success" : "text-destructive"}`}>
                      {p.change24h >= 0 ? "▲" : "▼"} {Math.abs(p.change24h).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold flex items-center gap-1.5"><Flame className="w-4 h-4 text-warning" /> Trending</h3>
            <span className="text-[10px] font-mono text-muted-foreground">24h</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {marketLoading && !market && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            {(market?.trending ?? []).slice(0, 6).map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2 rounded-xl bg-white/45 border border-white/60 px-2.5 py-2"
              >
                <img src={t.thumb} alt={t.name} width={26} height={26} className="rounded-full" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate leading-tight">{t.symbol}</div>
                  <div className="text-[10px] text-muted-foreground truncate leading-tight">#{t.rank || "—"} · {t.name}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Recent activity */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Recent activity</h2>
          <button onClick={() => nav({ to: "/wallet" })} className="text-xs font-semibold text-primary flex items-center gap-1 hover:gap-1.5 transition-all">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <GlassCard className="mt-2">
          {txs.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No transactions yet.</p>}
          <div className="space-y-1">
            {(txs as any[]).slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${Number(t.amount) >= 0 ? "bg-mint/40" : "bg-destructive/10"}`}>
                  {Number(t.amount) >= 0 ? <ArrowDownRight className="w-4 h-4 text-mint-foreground" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.description ?? t.type}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={`font-mono text-sm font-semibold ${Number(t.amount) >= 0 ? "text-mint-foreground" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function StatPill({ icon: Icon, label, value, tint, delay = 0 }: any) {
  const tintCls: Record<string, string> = {
    mint: "bg-gradient-mint text-mint-foreground",
    primary: "bg-gradient-primary text-primary-foreground",
    sky: "bg-gradient-sky text-foreground/80",
    gold: "bg-gradient-gold text-gold-foreground",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2 }}
      className="glass rounded-2xl p-3 cursor-default"
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-soft ${tintCls[tint]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1.5 font-display font-bold text-lg tabular-nums">{value}</div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, desc, tint, onClick }: any) {
  const tintCls: Record<string, string> = {
    mint: "bg-gradient-mint text-mint-foreground",
    primary: "bg-gradient-primary text-primary-foreground",
    sky: "bg-gradient-sky text-foreground/80",
    gold: "bg-gradient-gold text-gold-foreground",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      onClick={onClick}
      className="glass rounded-2xl p-3 text-left"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-soft ${tintCls[tint]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="mt-2 font-semibold text-sm">{label}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
    </motion.button>
  );
}

function CircularProgress({ value }: { value: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - value / 100);
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} stroke="oklch(0.92 0.01 285)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="40" cy="40" r={R}
          stroke="url(#circ-grad)" strokeWidth="7" strokeLinecap="round" fill="none"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="circ-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.18 300)" />
            <stop offset="100%" stopColor="oklch(0.72 0.15 175)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display font-black text-xl">{value}<span className="text-xs">%</span></div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Efficient</div>
      </div>
    </div>
  );
}

function HealthRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${positive ? "text-success" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _statSkeleton = StatSkeleton;
