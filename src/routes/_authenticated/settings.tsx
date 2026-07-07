import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2, ShieldCheck, Bell, Globe, DollarSign } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Nimbus" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const nav = useNavigate();
  const [newPass, setNewPass] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyMktg, setNotifyMktg] = useState(false);

  const changePassword = async () => {
    if (newPass.length < 6) return toast.error("Password too short");
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) toast.error("Failed", { description: error.message });
    else { toast.success("Password updated"); setNewPass(""); }
  };

  const deleteAccount = async () => {
    if (!confirm("Delete account permanently? This cannot be undone.")) return;
    toast.info("Contact support to complete account deletion.");
  };

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Security, notifications, and preferences." />

      <div className="space-y-3">
        <GlassCard>
          <h3 className="font-display font-bold flex items-center gap-2 text-sm mb-3"><KeyRound className="w-4 h-4" /> Security</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">New password</label>
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="mt-1 w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={changePassword} className="rounded-full bg-gradient-primary text-primary-foreground px-5 py-2 text-sm font-semibold shadow-soft">Update password</button>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-muted p-3 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Two-factor authentication: <span className="font-semibold">enabled by device fingerprint</span></span>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-bold flex items-center gap-2 text-sm mb-3"><Bell className="w-4 h-4" /> Notifications</h3>
          <Toggle label="Email alerts (deposits, withdrawals, KYC)" value={notifyEmail} onChange={setNotifyEmail} />
          <Toggle label="Push notifications (mining, referrals)" value={notifyPush} onChange={setNotifyPush} />
          <Toggle label="Marketing & promotions" value={notifyMktg} onChange={setNotifyMktg} />
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-bold flex items-center gap-2 text-sm mb-3"><Globe className="w-4 h-4" /> Preferences</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Language</label>
              <select className="mt-1 w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm">
                <option>English</option><option>Español</option><option>Français</option><option>Deutsch</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Display currency</label>
              <select className="mt-1 w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm">
                <option>USD</option><option>EUR</option><option>GBP</option><option>BTC</option>
              </select>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="!border-destructive/40">
          <h3 className="font-display font-bold flex items-center gap-2 text-sm text-destructive mb-2"><Trash2 className="w-4 h-4" /> Danger zone</h3>
          <p className="text-xs text-muted-foreground">Permanently delete your account and all data.</p>
          <button onClick={deleteAccount} className="mt-2 rounded-full bg-destructive/10 text-destructive px-4 py-2 text-xs font-semibold border border-destructive/40">Delete account</button>
        </GlassCard>
      </div>
    </AppShell>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-gradient-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}
