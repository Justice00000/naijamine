import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Nimbus" }] }),
  component: ResetPage,
});

function ResetPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setReady(true);
    else supabase.auth.getSession().then(({ data }) => { if (!data.session) nav({ to: "/auth" }); else setReady(true); });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); nav({ to: "/dashboard" }); }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md glass rounded-3xl p-8 shadow-glow">
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose something secure — at least 6 characters.</p>
        <div className="mt-6 relative">
          <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input required type="password" minLength={6} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-white/70 border border-border px-11 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <button disabled={!ready} className="mt-4 w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50">
          Update password
        </button>
      </form>
    </div>
  );
}
