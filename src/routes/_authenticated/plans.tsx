import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Check, Cpu, Sparkles, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { buyPlan } from "@/lib/mining.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Mining Plans — Nimbus" }] }),
  component: PlansPage,
});

function PlansPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const buy = useServerFn(buyPlan);

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase.from("mining_plans").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance").eq("user_id", user!.id).single()).data,
  });

  const purchase = useMutation({
    mutationFn: (planId: string) => buy({ data: { planId } }),
    onSuccess: () => {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ["#a78bfa", "#f0abfc", "#fde68a", "#5eead4"] });
      toast.success("Contract activated!", { description: "Your rig is mining." });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["active-contracts"] });
      qc.invalidateQueries({ queryKey: ["all-contracts"] });
    },
    onError: (e) => toast.error("Purchase failed", { description: (e as Error).message }),
  });

  return (
    <AppShell>
      <PageHeader title="Mining plans" subtitle="Cloud contracts backed by real data centers." />
      <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm">
        Wallet balance: <span className="font-mono font-bold text-gradient">${Number(wallet?.balance ?? 0).toFixed(2)}</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p: any, i: number) => {
          const roi = (Number(p.daily_earnings) * p.duration_days / Number(p.price) - 1) * 100;
          const gradients: Record<string, string> = {
            sky: "bg-gradient-sky", violet: "bg-gradient-primary", amber: "bg-gradient-gold",
            rose: "bg-gradient-primary", emerald: "bg-gradient-mint",
          };
          const g = gradients[p.color] ?? "bg-gradient-primary";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="glass rounded-3xl overflow-hidden shadow-soft"
            >
              <div className={`${g} p-5 text-primary-foreground relative`}>
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/25 blur-2xl" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider opacity-90">{p.tier}</div>
                    <div className="mt-1 font-display font-bold text-2xl">{p.name}</div>
                  </div>
                  {p.badge && <span className="text-[10px] font-bold rounded-full bg-white/25 backdrop-blur px-2 py-1">{p.badge}</span>}
                </div>
                <div className="mt-4 font-display text-4xl font-extrabold">
                  ${Number(p.price).toLocaleString()}
                  <span className="text-xs opacity-70 font-normal ml-1">/ {p.duration_days}d</span>
                </div>
              </div>

              <div className="p-5 space-y-2 text-sm">
                <Row icon={Cpu} label="Hash rate" value={`${Number(p.hash_rate).toFixed(2)} TH/s`} />
                <Row icon={Zap} label="Daily earnings" value={`$${Number(p.daily_earnings).toFixed(2)}`} />
                <Row label="Algorithm" value={p.algorithm} />
                <Row label="Power" value={`${p.power_watts} W`} />
                <Row label="Maintenance" value={`${Number(p.maintenance_fee_pct).toFixed(2)}%`} />
                <Row label="Est. ROI" value={`${roi.toFixed(1)}%`} strong />

                <button
                  onClick={() => purchase.mutate(p.id)}
                  disabled={purchase.isPending}
                  className="mt-4 w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow flex items-center justify-center gap-2 disabled:opacity-60 transition-transform active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" /> Activate contract
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, label, value, strong }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 text-mint-foreground" />} {label}
      </span>
      <span className={`font-mono text-sm ${strong ? "font-bold text-gradient" : "font-semibold"}`}>{value}</span>
    </div>
  );
}
