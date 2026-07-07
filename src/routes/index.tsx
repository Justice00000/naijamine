import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, ShieldCheck, TrendingUp, Wallet, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nimbus — Premium Cloud Crypto Mining" },
      { name: "description", content: "Buy hash-rate contracts, track earnings in real time, and withdraw to any wallet. Nimbus is a premium cloud crypto mining platform for everyone." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero overflow-x-hidden">
      {/* Nav */}
      <header className="glass border-b border-white/40 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground text-sm font-bold">N</div>
            <span className="font-display font-bold text-lg tracking-tight">Nimbus</span>
          </div>
          <Link to="/auth" className="text-sm font-semibold rounded-full px-4 py-2 bg-gradient-primary text-primary-foreground shadow-glow">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-24 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Now mining with 700 EH/s of cloud capacity
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.05]"
        >
          Cloud mining,<br />
          <span className="text-gradient">refined for humans.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Rent hash-rate from institutional-grade data centers. Watch your earnings tick in real time.
          Withdraw to any wallet, any network. No hardware, no noise, no headaches.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-wrap gap-3 justify-center"
        >
          <Link to="/auth" className="group inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
            Start mining <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-semibold">
            Create free account
          </Link>
        </motion.div>

        {/* Floating cards preview */}
        <div className="mt-20 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { icon: Cpu, title: "0.5 – 90 TH/s", sub: "Contracts for every budget", gradient: "bg-gradient-sky" },
            { icon: TrendingUp, title: "Daily payouts", sub: "Auto-credited to your wallet", gradient: "bg-gradient-mint" },
            { icon: ShieldCheck, title: "Enterprise-grade", sub: "KYC + 2FA + audit logs", gradient: "bg-gradient-gold" },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
              className="glass rounded-3xl p-6 text-left animate-float"
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              <div className={`w-10 h-10 rounded-2xl ${f.gradient} flex items-center justify-center shadow-soft`}>
                <f.icon className="w-5 h-5 text-foreground/70" />
              </div>
              <div className="mt-4 font-display font-bold text-lg">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.sub}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="glass rounded-3xl p-8 md:p-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ["148K+", "Miners"], ["$42M", "Paid out"], ["99.98%", "Uptime"], ["24/7", "Support"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="font-display text-3xl md:text-4xl font-bold text-gradient">{n}</div>
              <div className="text-sm text-muted-foreground mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/40 py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 justify-center">
          <Wallet className="w-3 h-3" /> Nimbus does not mine on your device. Contracts are cloud-managed.
        </div>
      </footer>
    </div>
  );
}
