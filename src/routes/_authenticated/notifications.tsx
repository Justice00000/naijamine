import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Nimbus" }] }),
  component: NotifPage,
});

function NotifPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({
    queryKey: ["notifs", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const markAll = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifs"] });
    qc.invalidateQueries({ queryKey: ["unread-notif"] });
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        subtitle="Deposits, withdrawals, mining, referrals — all in one place."
        action={<button onClick={markAll} className="rounded-full bg-gradient-primary text-primary-foreground px-4 py-2 text-xs font-semibold shadow-soft">Mark all read</button>}
      />

      <div className="space-y-2">
        {notifs.length === 0 && (
          <GlassCard className="text-center py-10">
            <Bell className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-2 font-semibold">You're all caught up</p>
          </GlassCard>
        )}
        {notifs.map((n: any) => (
          <GlassCard key={n.id} className={`!p-4 flex items-start gap-3 ${!n.is_read ? "ring-1 ring-primary/40" : ""}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${categoryTint(n.category)}`}>
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1 uppercase">{n.category} · {new Date(n.created_at).toLocaleString()}</div>
            </div>
            {!n.is_read && <Check className="w-4 h-4 text-primary" />}
          </GlassCard>
        ))}
      </div>
    </AppShell>
  );
}

function categoryTint(c: string) {
  switch (c) {
    case "deposit": return "bg-mint/40 text-mint-foreground";
    case "withdrawal": return "bg-primary/20 text-primary";
    case "mining": return "bg-gradient-sky text-foreground/70";
    case "referral": return "bg-gradient-gold text-gold-foreground";
    case "kyc": return "bg-accent text-accent-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}
