import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AnimatedCounter } from "@/components/AnimatedCounter";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Nimbus" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user!.id).single()).data,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["all-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const filtered = txs.filter((t: any) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (q && !`${t.description ?? t.type}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [["Date", "Type", "Amount", "Status", "Description"]];
    filtered.forEach((t: any) => rows.push([new Date(t.created_at).toISOString(), t.type, String(t.amount), t.status, t.description ?? ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nimbus-transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <PageHeader title="Wallet" subtitle="Track your balance and every transaction." />

      <div className="rounded-3xl bg-gradient-primary text-primary-foreground p-6 shadow-glow relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/20 blur-3xl animate-float" />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider opacity-80">Available balance</div>
          <div className="mt-1 font-display text-4xl font-extrabold">
            <AnimatedCounter value={Number(wallet?.balance ?? 0)} prefix="$" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <MiniStat label="Deposited" value={`$${Number(wallet?.total_deposited ?? 0).toFixed(2)}`} />
            <MiniStat label="Withdrawn" value={`$${Number(wallet?.total_withdrawn ?? 0).toFixed(2)}`} />
            <MiniStat label="Earned" value={`$${Number(wallet?.total_earned ?? 0).toFixed(2)}`} />
          </div>
          <div className="mt-5 flex gap-2">
            <Link to="/deposit" className="flex-1 rounded-2xl bg-white/25 backdrop-blur py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-white/35">
              <ArrowDownRight className="w-4 h-4" /> Deposit
            </Link>
            <Link to="/withdraw" className="flex-1 rounded-2xl bg-white text-primary py-2.5 text-sm font-semibold shadow-soft flex items-center justify-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </Link>
          </div>
        </div>
      </div>

      <GlassCard className="mt-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="w-full rounded-full bg-white/70 border border-border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full bg-white/70 border border-border px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="mining_reward">Mining</option>
            <option value="referral_reward">Referral</option>
            <option value="plan_purchase">Plans</option>
          </select>
          <button onClick={exportCsv} className="rounded-full bg-white border border-border px-3 py-2 text-xs font-semibold flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No transactions.</p>}
          {filtered.map((t: any) => (
            <div key={t.id} className="py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${Number(t.amount) >= 0 ? "bg-mint/40" : "bg-destructive/10"}`}>
                {Number(t.amount) >= 0 ? <ArrowDownRight className="w-4 h-4 text-mint-foreground" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">{t.description ?? t.type}</div>
                <div className="text-[10px] text-muted-foreground uppercase">{t.type} · {t.status} · {new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className={`font-mono text-sm font-bold ${Number(t.amount) >= 0 ? "text-mint-foreground" : "text-destructive"}`}>
                {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(4)}
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
      <div className="opacity-70 text-[10px] uppercase">{label}</div>
      <div className="font-mono font-semibold text-sm">{value}</div>
    </div>
  );
}
