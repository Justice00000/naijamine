import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Nimbus" },
      { name: "description", content: "Sign in to your Nimbus cloud mining account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { mode: initialMode, ref } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [refCode, setRefCode] = useState(ref ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, referral_code: refCode || undefined },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Nimbus", { description: "Check your inbox to verify your email." });
        setMode("signin");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        nav({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset email sent");
        setMode("signin");
      }
    } catch (err) {
      toast.error("Auth failed", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) throw new Error(res.error.message ?? "Google sign-in failed");
      if (res.redirected) return;
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error("Google sign-in failed", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <header className="p-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground text-sm font-bold">N</div>
          <span className="font-display font-bold text-lg">Nimbus</span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md glass rounded-3xl p-8 shadow-glow"
        >
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Start mining in 60 seconds." : mode === "forgot" ? "We'll email you a reset link." : "Sign in to your mining dashboard."}
          </p>

          {mode !== "forgot" && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-white border border-border shadow-soft py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/70 transition-colors"
            >
              <GoogleIcon /> Continue with Google
            </button>
          )}

          {mode !== "forgot" && (
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or with email</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field icon={UserIcon} type="text" placeholder="Full name" value={fullName} onChange={setFullName} required />
            )}
            <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} required />
            {mode !== "forgot" && (
              <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} required minLength={6} />
            )}
            {mode === "signup" && (
              <Field icon={UserIcon} type="text" placeholder="Referral code (optional)" value={refCode} onChange={setRefCode} />
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
                <ArrowRight className="w-4 h-4" />
              </>}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                <button onClick={() => setMode("forgot")} className="hover:text-primary">Forgot password?</button>
                <button onClick={() => setMode("signup")} className="hover:text-primary font-semibold">Create account →</button>
              </>
            ) : (
              <button onClick={() => setMode("signin")} className="mx-auto hover:text-primary">← Back to sign in</button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, value, onChange, ...rest
}: {
  icon: any;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl bg-white/70 border border-border px-11 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/></svg>
  );
}
