import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Wallet, TrendingUp, Cpu, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Nimbus" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [users, deposits, withdrawals, contracts, tx] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("deposits").select("usd_value").eq("status", "completed"),
        supabase.from("withdrawals").select("amount").eq("status", "completed"),
        supabase.from("mining_contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      return {
        users: users.count ?? 0,
        deposits: (deposits.data ?? []).reduce((s, d: any) => s + Number(d.usd_value ?? 0), 0),
        withdrawals: (withdrawals.data ?? []).reduce((s, d: any) => s + Number(d.amount ?? 0), 0),
        contracts: contracts.count ?? 0,
        recent: tx.data ?? [],
      };
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Users" value={stats?.users ?? 0} tint="bg-gradient-primary" />
        <StatCard icon={Wallet} label="Total deposits" value={stats?.deposits ?? 0} money tint="bg-gradient-mint" />
        <StatCard icon={ArrowUpRight} label="Total withdrawals" value={stats?.withdrawals ?? 0} money tint="bg-gradient-gold" />
        <StatCard icon={Cpu} label="Active contracts" value={stats?.contracts ?? 0} tint="bg-gradient-sky" />
      </div>

      <div className="mt-6">
        <GlassCard>
          <h3 className="font-display font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Recent transactions</h3>
          <div className="divide-y divide-border">
            {(stats?.recent ?? []).map((t: any) => (
              <div key={t.id} className="py-2 flex items-center gap-3 text-sm">
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
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, money, tint }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl ${tint} text-primary-foreground flex items-center justify-center shadow-soft`}><Icon className="w-4 h-4" /></div>
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold">
        <AnimatedCounter value={Number(value)} prefix={money ? "$" : ""} decimals={money ? 2 : 0} />
      </div>
    </motion.div>
  );
}
