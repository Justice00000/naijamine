import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { adminAdjustBalance, adminGrantRole, adminBroadcast } from "@/lib/mining.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Admin Users — Nimbus" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const adjust = useServerFn(adminAdjustBalance);
  const grant = useServerFn(adminGrantRole);
  const broadcast = useServerFn(adminBroadcast);
  const [q, setQ] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*, wallets:wallets(balance,total_earned,hash_rate), roles:user_roles(role)").limit(50).order("created_at", { ascending: false });
      if (q) query = query.ilike("email", `%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const doAdjust = async (id: string) => {
    const amt = parseFloat(prompt("Adjust amount (use negative to deduct):") ?? "0");
    if (!amt) return;
    const note = prompt("Reason:") ?? "adjustment";
    try {
      await adjust({ data: { targetUserId: id, amount: amt, note } });
      toast.success("Balance adjusted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const toggleAdmin = async (id: string, current: boolean) => {
    try {
      await grant({ data: { targetUserId: id, role: "admin", revoke: current } });
      toast.success(current ? "Admin revoked" : "Admin granted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const sendBroadcast = async () => {
    if (!bcTitle) return;
    await broadcast({ data: { title: bcTitle, body: bcBody, category: "general" } });
    toast.success("Broadcast sent"); setBcTitle(""); setBcBody("");
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Users</h1>
      <GlassCard className="mb-4">
        <h3 className="font-display font-bold text-sm mb-2">Broadcast notification</h3>
        <div className="flex flex-wrap gap-2">
          <input value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} placeholder="Title" className="flex-1 min-w-[180px] rounded-full bg-white border border-border px-3 py-2 text-sm" />
          <input value={bcBody} onChange={(e) => setBcBody(e.target.value)} placeholder="Body" className="flex-[2] min-w-[240px] rounded-full bg-white border border-border px-3 py-2 text-sm" />
          <button onClick={sendBroadcast} className="rounded-full bg-gradient-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft">Send</button>
        </div>
      </GlassCard>

      <GlassCard>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email…" className="w-full mb-3 rounded-full bg-white border border-border px-4 py-2 text-sm" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr><th className="py-2">Email</th><th>Name</th><th>KYC</th><th>Balance</th><th>Earned</th><th>Role</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const isAdm = u.roles?.some((r: any) => r.role === "admin");
                return (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="py-2 truncate max-w-[220px]">{u.email}</td>
                    <td>{u.full_name ?? "-"}</td>
                    <td><span className="text-[10px] font-bold uppercase">{u.kyc_status}</span></td>
                    <td className="font-mono">${Number(u.wallets?.[0]?.balance ?? 0).toFixed(2)}</td>
                    <td className="font-mono">${Number(u.wallets?.[0]?.total_earned ?? 0).toFixed(2)}</td>
                    <td>{isAdm ? <span className="text-[10px] font-bold uppercase text-gold-foreground">Admin</span> : "user"}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => doAdjust(u.id)} className="text-xs font-semibold text-primary mr-2">Adjust</button>
                      <button onClick={() => toggleAdmin(u.id, isAdm)} className="text-xs font-semibold">{isAdm ? "Revoke admin" : "Make admin"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
