import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { adminApproveWithdrawal, adminRejectWithdrawal } from "@/lib/mining.functions";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Admin Withdrawals — Nimbus" }] }),
  component: AdminWithdrawals,
});

function AdminWithdrawals() {
  const qc = useQueryClient();
  const approve = useServerFn(adminApproveWithdrawal);
  const reject = useServerFn(adminRejectWithdrawal);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-wd"],
    queryFn: async () => (await supabase.from("withdrawals").select("*, profile:profiles!inner(email)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const doApprove = async (id: string) => {
    try { await approve({ data: { withdrawalId: id } }); toast.success("Approved"); qc.invalidateQueries({ queryKey: ["admin-wd"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  const doReject = async (id: string) => {
    const notes = prompt("Reason for rejection?") ?? "";
    try { await reject({ data: { withdrawalId: id, notes } }); toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["admin-wd"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Withdrawals</h1>
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr><th className="py-2">User</th><th>Amount</th><th>Fee</th><th>Currency</th><th>Address</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 truncate max-w-[200px]">{r.profile?.email}</td>
                  <td className="font-mono">${Number(r.amount).toFixed(2)}</td>
                  <td className="font-mono text-xs">${Number(r.fee).toFixed(2)}</td>
                  <td>{r.currency} · {r.network}</td>
                  <td className="font-mono text-[10px] truncate max-w-[160px]">{r.wallet_address}</td>
                  <td><span className="text-[10px] font-bold uppercase">{r.status}</span></td>
                  <td className="text-right whitespace-nowrap">
                    {r.status === "pending" && <>
                      <button onClick={() => doApprove(r.id)} className="text-xs font-semibold text-mint-foreground mr-2">Approve</button>
                      <button onClick={() => doReject(r.id)} className="text-xs font-semibold text-destructive">Reject</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
