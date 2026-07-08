import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id).eq("role", "admin");
    if (!data?.length) throw redirect({ to: "/dashboard" });
  },
  component: () => <AdminLayout><Outlet /></AdminLayout>,
});
