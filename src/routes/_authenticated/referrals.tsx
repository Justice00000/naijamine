import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Share2, Users, Trophy, Gift } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({ meta: [{ title: "Referrals — Nimbus" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
  });
  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("referral_earned").eq("user_id", user!.id).single()).data,
  });
  const { data: refs = [] } = useQuery({
    queryKey: ["my-refs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("referrals").select("*, referred:profiles!referrals_referred_id_fkey(full_name,email,created_at,kyc_status)")
        .eq("referrer_id", user!.id);
      return data ?? [];
    },
  });
  const { data: rewards = [] } = useQuery({
    queryKey: ["ref-rewards", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("transactions").select("*").eq("user_id", user!.id).eq("type", "referral_reward").order("created_at", { ascending: false }).limit(15)).data ?? [],
  });

  const link = typeof window !== "undefined" ? `${window.location.origin}/auth?mode=signup&ref=${profile?.referral_code ?? ""}` : "";

  const copy = () => { navigator.clipboard.writeText(link); toast.success("Referral link copied"); };
  const share = () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any).share({ title: "Join Nimbus", text: "Start cloud mining with me on Nimbus", url: link });
    } else copy();
  };

  return (
    <AppShell>
      <PageHeader title="Refer & earn" subtitle="Earn 5% commission on every plan your friends buy." />

      <div className="grid md:grid-cols-3 gap-3">
        <GlassCard className="md:col-span-2 !p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow"><Gift className="w-5 h-5" /></div>
              <div>
                <div className="text-xs text-muted-foreground">Your code</div>
                <div className="font-mono font-bold text-lg">{profile?.referral_code}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total earned</div>
              <div className="font-display font-bold text-lg text-gradient">${Number(wallet?.referral_earned ?? 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-muted p-3 font-mono text-xs break-all">{link}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={copy} className="flex-1 rounded-full bg-gradient-primary text-primary-foreground py-2 text-sm font-semibold flex items-center justify-center gap-1.5"><Copy className="w-4 h-4" /> Copy</button>
            <button onClick={share} className="flex-1 rounded-full bg-white border border-border py-2 text-sm font-semibold flex items-center justify-center gap-1.5"><Share2 className="w-4 h-4" /> Share</button>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-2"><Trophy className="w-4 h-4 text-gold-foreground" /> <span className="font-display font-bold">Tiers</span></div>
          <div className="space-y-1 text-xs">
            <TierRow name="Bronze" min="0" pct="5%" active={refs.length >= 0} />
            <TierRow name="Silver" min="5 refs" pct="7%" active={refs.length >= 5} />
            <TierRow name="Gold" min="15 refs" pct="10%" active={refs.length >= 15} />
            <TierRow name="Diamond" min="50 refs" pct="12%" active={refs.length >= 50} />
          </div>
        </GlassCard>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Your referrals ({refs.length})</h3>
          {refs.length === 0 && <p className="text-xs text-muted-foreground">Share your link to invite friends.</p>}
          {refs.map((r: any) => (
            <div key={r.id} className="py-2 border-b border-border/60 last:border-0 text-sm flex items-center justify-between">
              <div>
                <div className="font-semibold">{r.referred?.full_name ?? "Anonymous"}</div>
                <div className="text-[10px] text-muted-foreground">{r.referred?.email} · joined {new Date(r.referred?.created_at ?? r.created_at).toLocaleDateString()}</div>
              </div>
              <div className="font-mono font-bold text-mint-foreground">+${Number(r.total_commission).toFixed(2)}</div>
            </div>
          ))}
        </GlassCard>
        <GlassCard>
          <h3 className="font-display font-bold mb-2">Commission history</h3>
          {rewards.length === 0 && <p className="text-xs text-muted-foreground">No commissions yet.</p>}
          {rewards.map((t: any) => (
            <div key={t.id} className="py-2 border-b border-border/60 last:border-0 text-sm flex items-center justify-between">
              <div>
                <div>{t.description}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className="font-mono font-bold text-mint-foreground">+${Number(t.amount).toFixed(2)}</div>
            </div>
          ))}
        </GlassCard>
      </div>
    </AppShell>
  );
}

function TierRow({ name, min, pct, active }: any) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${active ? "bg-gradient-mint text-mint-foreground" : "bg-muted"}`}>
      <span className="font-semibold">{name}</span>
      <span className="text-[10px] opacity-80">{min}</span>
      <span className="font-mono font-bold">{pct}</span>
    </div>
  );
}
