import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Download, Search, TrendingUp, Wallet as WalletIcon, Copy, Check } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Sparkline } from "@/components/Sparkline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AnimatedCounter } from "@/components/AnimatedCounter";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Nimbus" }] }),
  component: WalletPage,
});

const TX_TYPES: Record<string, { label: string; tone: string }> = {
  deposit: { label: "Deposit", tone: "text-mint-foreground" },
  withdrawal: { label: "Withdrawal", tone: "text-destructive" },
  mining_reward: { label: "Mining reward", tone: "text-mint-foreground" },
  referral_reward: { label: "Referral", tone: "text-mint-foreground" },
  plan_purchase: { label: "Plan purchase", tone: "text-destructive" },
};

function WalletPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user!.id).single()).data,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["all-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  // Balance sparkline: reconstruct running balance backward from current
  const spark = useMemo(() => {
    if (!wallet) return [] as number[];
    const cur = Number(wallet.balance ?? 0);
    const pts: number[] = [cur];
    let running = cur;
    for (const t of txs.slice(0, 40)) {
      running -= Number(t.amount);
      pts.push(running);
    }
    return pts.reverse();
  }, [txs, wallet]);
  const positive = spark.length >= 2 && spark[spark.length - 1] >= spark[0];

  // Monthly bars: last 6 months in vs out
  const monthly = useMemo(() => {
    const now = new Date();
    const months: { label: string; in: number; out: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleString("en", { month: "short" }), in: 0, out: 0 });
    }
    for (const t of txs) {
      const d = new Date(t.created_at);
      const idx = 5 - ((now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth());
      if (idx < 0 || idx > 5) continue;
      const a = Number(t.amount);
      if (a >= 0) months[idx].in += a; else months[idx].out += -a;
    }
    return months;
  }, [txs]);
  const monthMax = Math.max(1, ...monthly.flatMap((m) => [m.in, m.out]));

  // Breakdown donut
  const breakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const t of txs) {
      const amt = Math.abs(Number(t.amount));
      groups[t.type] = (groups[t.type] ?? 0) + amt;
    }
    const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const palette = ["oklch(0.72 0.16 305)", "oklch(0.78 0.14 195)", "oklch(0.78 0.14 155)", "oklch(0.82 0.14 85)", "oklch(0.72 0.18 25)"];
    return entries.map(([k, v], i) => ({ key: k, value: v, pct: (v / total) * 100, color: palette[i] }));
  }, [txs]);

  const filtered = txs.filter((t: any) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (q && !`${t.description ?? t.type}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of filtered) {
      const d = new Date(t.created_at);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const exportCsv = () => {
    const rows = [["Date", "Type", "Amount", "Status", "Description"]];
    filtered.forEach((t: any) => rows.push([new Date(t.created_at).toISOString(), t.type, String(t.amount), t.status, t.description ?? ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nimbus-transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const walletId = user?.id?.slice(0, 8) ?? "";
  const copyId = async () => {
    if (!user?.id) return;
    await navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Donut arithmetic
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <AppShell>
      <PageHeader title="Wallet" subtitle="Every satoshi accounted for." />

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-primary text-primary-foreground p-6 shadow-glow relative overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/25 blur-3xl animate-float" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/15 blur-3xl animate-pulse-glow" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-80 flex items-center gap-1">
                <WalletIcon className="w-3 h-3" /> Available balance
              </div>
              <div className="mt-1 font-display text-4xl sm:text-5xl font-black tabular-nums">
                <AnimatedCounter value={Number(wallet?.balance ?? 0)} prefix="$" />
              </div>
              <button
                onClick={copyId}
                className="mt-1 inline-flex items-center gap-1.5 text-[11px] opacity-80 font-mono hover:opacity-100"
              >
                #{walletId} {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="w-24 -mt-1 opacity-90">
              {spark.length > 1 ? (
                <>
                  <Sparkline data={spark} positive={positive} />
                  <div className="mt-0.5 text-right text-[10px] font-mono">
                    <TrendingUp className="w-3 h-3 inline -mt-0.5" /> 40d
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            <MiniStat label="Deposited" value={`$${Number(wallet?.total_deposited ?? 0).toFixed(2)}`} />
            <MiniStat label="Withdrawn" value={`$${Number(wallet?.total_withdrawn ?? 0).toFixed(2)}`} />
            <MiniStat label="Earned" value={`$${Number(wallet?.total_earned ?? 0).toFixed(2)}`} />
          </div>

          <div className="mt-5 flex gap-2">
            <Link to="/deposit" className="flex-1 rounded-2xl bg-white/25 backdrop-blur py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-white/35 transition-colors">
              <ArrowDownRight className="w-4 h-4" /> Deposit
            </Link>
            <Link to="/withdraw" className="flex-1 rounded-2xl bg-white text-primary py-2.5 text-sm font-semibold shadow-soft flex items-center justify-center gap-1.5 hover:brightness-105">
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Analytics row */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <GlassCard delay={0.05}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold">Cash flow</div>
              <div className="text-[11px] text-muted-foreground">Last 6 months · in vs out</div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-32">
            {monthly.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end h-24">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(m.in / monthMax) * 100}%` }}
                    transition={{ delay: i * 0.05, duration: 0.6, ease: "easeOut" }}
                    className="flex-1 rounded-t-md bg-gradient-mint min-h-[2px]"
                    title={`In: $${m.in.toFixed(2)}`}
                  />
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(m.out / monthMax) * 100}%` }}
                    transition={{ delay: i * 0.05 + 0.05, duration: 0.6, ease: "easeOut" }}
                    className="flex-1 rounded-t-md bg-destructive/60 min-h-[2px]"
                    title={`Out: $${m.out.toFixed(2)}`}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gradient-mint" /> In</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive/60" /> Out</span>
          </div>
        </GlassCard>

        <GlassCard delay={0.1}>
          <div className="font-display font-bold">Breakdown</div>
          <div className="text-[11px] text-muted-foreground mb-2">Where the money moves</div>
          {breakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No activity yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" stroke="oklch(0.94 0.02 300)" strokeWidth="14" />
                {breakdown.map((b, i) => {
                  const len = (b.pct / 100) * C;
                  const el = (
                    <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={b.color}
                      strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
                  );
                  offset += len;
                  return el;
                })}
              </svg>
              <div className="flex-1 space-y-1">
                {breakdown.map((b) => (
                  <div key={b.key} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-sm" style={{ background: b.color }} />
                    <span className="capitalize">{TX_TYPES[b.key]?.label ?? b.key.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-mono">{b.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Transactions */}
      <GlassCard className="mt-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…"
              className="w-full rounded-full bg-white/70 border border-border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full bg-white/70 border border-border px-3 py-2 text-sm">
            <option value="all">All types</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="mining_reward">Mining</option>
            <option value="referral_reward">Referral</option>
            <option value="plan_purchase">Plans</option>
          </select>
          <button onClick={exportCsv} className="rounded-full bg-white border border-border px-3 py-2 text-xs font-semibold flex items-center gap-1 hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>

        {grouped.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No transactions match.</p>}

        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="sticky top-0 z-10 bg-background/70 backdrop-blur -mx-1 px-1 py-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {day}
              </div>
              <div className="divide-y divide-border">
                {items.map((t: any, i: number) => {
                  const meta = TX_TYPES[t.type];
                  const positive = Number(t.amount) >= 0;
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="py-3 flex items-center gap-3"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${positive ? "bg-mint/40" : "bg-destructive/10"}`}>
                        {positive ? <ArrowDownRight className="w-4 h-4 text-mint-foreground" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{t.description ?? meta?.label ?? t.type}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {meta?.label ?? t.type} · {t.status} · {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className={`font-mono text-sm font-bold tabular-nums ${positive ? "text-mint-foreground" : "text-destructive"}`}>
                        {positive ? "+" : ""}{Number(t.amount).toFixed(4)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/20 backdrop-blur px-2.5 py-1.5">
      <div className="opacity-70 text-[10px] uppercase tracking-wide">{label}</div>
      <div className="font-mono font-semibold text-sm tabular-nums">{value}</div>
    </div>
  );
}
