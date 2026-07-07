import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, LogOut, Trophy, LifeBuoy, IdCard, Settings, ChevronRight, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Nimbus" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
  });
  const [full_name, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    setCountry(profile.country ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ full_name, username, country, phone }).eq("id", user!.id);
    if (error) toast.error("Save failed", { description: error.message });
    else { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  return (
    <AppShell>
      <PageHeader title="Profile" subtitle="Manage your account." />

      <GlassCard className="text-center">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-display text-2xl font-bold shadow-glow">
          {(profile?.full_name ?? profile?.email ?? "N")[0]?.toUpperCase()}
        </div>
        <h2 className="mt-3 font-display font-bold text-xl">{profile?.full_name ?? "Miner"}</h2>
        <div className="text-xs text-muted-foreground">{profile?.email}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-1 bg-gradient-primary text-primary-foreground">
          <Sparkles className="w-3 h-3" /> Referral code: {profile?.referral_code}
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <h3 className="font-display font-bold mb-3 text-sm">Personal information</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="Full name" value={full_name} onChange={setFullName} />
          <FormField label="Username" value={username} onChange={setUsername} />
          <FormField label="Country" value={country} onChange={setCountry} />
          <FormField label="Phone" value={phone} onChange={setPhone} />
        </div>
        <button onClick={save} className="mt-3 rounded-full bg-gradient-primary text-primary-foreground px-6 py-2 text-sm font-semibold shadow-soft">Save changes</button>
      </GlassCard>

      <div className="mt-4 grid gap-2">
        <LinkRow to="/kyc" icon={IdCard} label="Identity verification" note={profile?.kyc_status} />
        <LinkRow to="/leaderboard" icon={Trophy} label="Leaderboard" />
        <LinkRow to="/support" icon={LifeBuoy} label="Support & FAQ" />
        <LinkRow to="/settings" icon={Settings} label="Settings & security" />
      </div>

      <button onClick={signOut} className="mt-6 w-full rounded-full bg-white border border-border py-3 text-sm font-semibold flex items-center justify-center gap-2 text-destructive">
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </AppShell>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
    </div>
  );
}
function LinkRow({ to, icon: Icon, label, note }: any) {
  return (
    <Link to={to} className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/60 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-soft"><Icon className="w-4 h-4" /></div>
      <span className="flex-1 font-semibold text-sm">{label}</span>
      {note && <span className="text-[10px] font-bold uppercase text-muted-foreground">{note}</span>}
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}
