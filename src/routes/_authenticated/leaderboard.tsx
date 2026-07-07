import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Nimbus" }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data: topMiners = [] } = useQuery({
    queryKey: ["top-miners"],
    queryFn: async () => (await supabase.from("wallets").select("user_id,total_earned,hash_rate,profiles:profiles!inner(full_name,avatar_url,referral_code)").order("total_earned", { ascending: false }).limit(20)).data ?? [],
  });

  return (
    <AppShell>
      <PageHeader title="Leaderboard" subtitle="The top miners on Nimbus this month." />

      <GlassCard className="!p-0 overflow-hidden">
        <div className="bg-gradient-primary text-primary-foreground p-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          <span className="font-display font-bold">Top earners</span>
        </div>
        <div className="divide-y divide-border">
          {topMiners.map((m: any, i: number) => (
            <div key={m.user_id} className="p-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                i === 0 ? "bg-gradient-gold text-gold-foreground" :
                i === 1 ? "bg-gradient-sky text-foreground/80" :
                i === 2 ? "bg-gradient-mint text-mint-foreground" :
                "bg-muted"
              }`}>
                {i === 0 ? <Crown className="w-4 h-4" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{m.profiles?.full_name ?? m.profiles?.referral_code ?? "Anonymous miner"}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{Number(m.hash_rate).toFixed(2)} TH/s</div>
              </div>
              <div className="font-mono font-bold text-gradient">${Number(m.total_earned).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </AppShell>
  );
}
