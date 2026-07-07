import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { Home, Pickaxe, Wallet, Users, User, Bell, ShieldCheck, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: ReactNode;
}

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/mining", label: "Mining", icon: Pickaxe },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/referrals", label: "Refer", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: Props) {
  const location = useLocation();
  const router = useRouter();
  const { user } = useAuth();

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread-notif", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications").select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-hero pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-40 glass border-b border-white/40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground text-sm font-bold">
              N
            </div>
            <span className="font-display font-bold text-lg tracking-tight">Nimbus</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-gradient-gold text-gold-foreground shadow-soft"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
            <Link to="/notifications" className="relative w-9 h-9 rounded-full glass flex items-center justify-center">
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav (mobile-first, floating) */}
      <nav className="fixed bottom-3 left-0 right-0 z-40 px-3">
        <div className="mx-auto max-w-md glass rounded-full px-2 py-2 flex items-center justify-between shadow-glow">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                onClick={() => router.navigate({ to: item.to })}
                className={cn(
                  "relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-full transition-colors",
                  active ? "text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-gradient-primary rounded-full shadow-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className={cn("w-4 h-4 relative", active ? "text-primary-foreground" : "")} strokeWidth={2.2} />
                <span className="text-[10px] font-semibold relative">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 py-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function AdminLayout({ children }: Props) {
  const location = useLocation();
  const items = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/deposits", label: "Deposits", icon: Wallet },
    { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
    { to: "/admin/kyc", label: "KYC", icon: ShieldCheck },
    { to: "/admin/plans", label: "Plans", icon: Pickaxe },
  ] as const;
  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="glass border-b border-white/40 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-gold shadow-soft flex items-center justify-center text-gold-foreground text-sm font-bold">A</div>
            <span className="font-display font-bold">Nimbus Admin</span>
          </Link>
          <Link to="/dashboard" className="text-xs font-semibold text-primary">← Exit admin</Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-3 py-4 grid md:grid-cols-[220px_1fr] gap-4">
        <aside className="md:sticky md:top-16 h-max glass rounded-2xl p-2 flex md:flex-col overflow-x-auto scrollbar-none">
          {items.map((it) => {
            const active = location.pathname === it.to || (it.to !== "/admin" && location.pathname.startsWith(it.to));
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap md:w-full transition-colors",
                  active ? "bg-gradient-primary text-primary-foreground shadow-soft" : "hover:bg-white/50"
                )}
              >
                <Icon className="w-4 h-4" /> {it.label}
              </Link>
            );
          })}
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
