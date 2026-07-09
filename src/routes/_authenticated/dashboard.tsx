import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ArrowDownRight, Coins, Cpu, Zap, TrendingUp, Sparkles, Newspaper, Gift, ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { claimEarnings } from "@/lib/mining.functions";
import { claimReferral } from "@/lib/referrals.functions";
import { usd } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nimbus" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const claimFn = useServerFn(claimEarnings);
  const claimRefFn = useServerFn(claimReferral);

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
      .catch(() => { sessionStorage.removeItem("nimbus_pending_ref"); });
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
        .select("*, plan:mining_plans(name,color,badge)")
        .eq("user_id", user!.id).eq("status", "active").order("purchased_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["recent-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["prices"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data } = await supabase.from("crypto_prices").select("*").order("market_cap", { ascending: false });
      return data ?? [];
    },
  });

  const { data: news = [] } = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data } = await supabase.from("news_feed").select("*").order("published_at", { ascending: false }).limit(3);
      return data ?? [];
    },
  });

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (res) => {
      if (res.credited > 0) {
        toast.success(`Claimed ${usd(res.credited, 4)}`, { description: "Credited to your wallet." });
      } else {
        toast.info("Nothing to claim yet", { description: "Earnings accrue every second." });
      }
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["active-contracts"] });
      qc.invalidateQueries({ queryKey: ["recent-tx"] });
    },
    onError: (e) => toast.error("Claim failed", { description: (e as Error).message }),
  });

  // Live-ish accrual estimate
  const perSecond = contracts.reduce((s: number, c: any) => s + Number(c.daily_earnings) / 86400, 0);
  const pending = contracts.reduce((s: number, c: any) => {
    const dt = (Date.now() - new Date(c.last_accrued_at).getTime()) / 86400000;
    return s + Math.max(0, dt) * Number(c.daily_earnings);
  }, 0);
  const totalHash = contracts.reduce((s: number, c: any) => s + Number(c.hash_rate), 0);

  return (
    <AppShell>
      <PageHeader
        title={`Hi, ${(profile?.full_name ?? (user?.user_metadata as any)?.full_name ?? (user?.user_metadata as any)?.name ?? user?.email?.split("@")[0] ?? "there")?.split(" ")[0]} 👋`}
        subtitle="Your cloud rigs are humming."
      />


      {/* Balance Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow"
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/20 blur-3xl animate-float" />
        <div className="absolute -left-10 bottom-0 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider opacity-80">Wallet balance</div>
          <div className="mt-1 font-display text-4xl font-extrabold">
            <AnimatedCounter value={Number(wallet?.balance ?? 0)} prefix="$" decimals={2} />
          </div>
          <div className="mt-1 text-xs opacity-80">
            Pending earnings <span className="font-mono">+${pending.toFixed(4)}</span> ·
            <span className="ml-1">≈ ${(perSecond * 3600).toFixed(4)}/hr</span>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={() => nav({ to: "/deposit" })} className="flex-1 rounded-2xl bg-white/25 backdrop-blur py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-white/35 transition-colors">
              <ArrowDownRight className="w-4 h-4" /> Deposit
            </button>
            <button onClick={() => nav({ to: "/withdraw" })} className="flex-1 rounded-2xl bg-white/25 backdrop-blur py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-white/35 transition-colors">
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </button>
            <button
              onClick={() => claim.mutate()}
              disabled={claim.isPending}
              className="rounded-2xl bg-white text-primary px-4 py-2.5 text-sm font-semibold shadow-soft flex items-center gap-1.5 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" /> Claim
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stat pills */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill icon={Coins} label="Today" value={usd(Number(wallet?.total_earned ?? 0) * 0.02, 2)} tint="mint" />
        <StatPill icon={TrendingUp} label="Total earned" value={usd(wallet?.total_earned ?? 0, 2)} tint="primary" />
        <StatPill icon={Cpu} label="Hash rate" value={`${totalHash.toFixed(2)} TH/s`} tint="sky" />
        <StatPill icon={Gift} label="Referrals" value={usd(wallet?.referral_earned ?? 0, 2)} tint="gold" />
      </div>

      {/* Active contracts */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Active contracts</h2>
          <button onClick={() => nav({ to: "/plans" })} className="text-xs font-semibold text-primary flex items-center gap-1">
            Browse plans <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {contracts.length === 0 && (
            <GlassCard className="text-center py-8">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Zap className="w-7 h-7 text-primary-foreground" />
              </div>
              <p className="mt-3 font-semibold">No active rigs</p>
              <p className="text-xs text-muted-foreground">Buy your first mining contract in seconds.</p>
              <button onClick={() => nav({ to: "/plans" })} className="mt-4 rounded-full bg-gradient-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow-glow inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add contract
              </button>
            </GlassCard>
          )}
          {contracts.map((c: any) => {
            const total = new Date(c.expires_at).getTime() - new Date(c.purchased_at).getTime();
            const elapsed = Date.now() - new Date(c.purchased_at).getTime();
            const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
            return (
              <GlassCard key={c.id} className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Cpu className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
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
                        transition={{ duration: 1 }}
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
            );
          })}
        </div>
      </div>

      {/* Market + Recent Tx */}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold">Markets</h3>
            <span className="text-[10px] font-mono text-muted-foreground">live</span>
          </div>
          <div className="space-y-2">
            {prices.slice(0, 5).map((p: any) => (
              <div key={p.symbol} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold">{p.symbol}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">${Number(p.price_usd).toLocaleString()}</div>
                  <div className={`text-[10px] font-semibold ${Number(p.change_24h) >= 0 ? "text-success" : "text-destructive"}`}>
                    {Number(p.change_24h) >= 0 ? "▲" : "▼"} {Math.abs(Number(p.change_24h)).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-bold mb-3">Recent activity</h3>
          {txs.length === 0 && <p className="text-xs text-muted-foreground">No transactions yet.</p>}
          <div className="space-y-2">
            {txs.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 text-sm">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${Number(t.amount) >= 0 ? "bg-mint/40" : "bg-destructive/10"}`}>
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

      {/* News */}
      <div className="mt-6">
        <h2 className="font-display font-bold mb-2 flex items-center gap-2"><Newspaper className="w-4 h-4" /> News</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {news.map((n: any, i: number) => (
            <GlassCard key={n.id} delay={i * 0.05} hover>
              <div className="text-xs text-muted-foreground">{n.source}</div>
              <div className="mt-1 font-semibold leading-snug">{n.title}</div>
              <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{n.summary}</div>
            </GlassCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function StatPill({ icon: Icon, label, value, tint }: any) {
  const tintCls: Record<string, string> = {
    mint: "bg-gradient-mint text-mint-foreground",
    primary: "bg-gradient-primary text-primary-foreground",
    sky: "bg-gradient-sky text-foreground/80",
    gold: "bg-gradient-gold text-gold-foreground",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-soft ${tintCls[tint]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1.5 font-display font-bold text-lg">{value}</div>
    </motion.div>
  );
}
