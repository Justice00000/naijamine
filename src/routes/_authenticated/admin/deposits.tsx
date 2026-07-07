import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { adminApproveDeposit, adminRejectDeposit } from "@/lib/mining.functions";

export const Route = createFileRoute("/_authenticated/admin/deposits")({
  head: () => ({ meta: [{ title: "Admin Deposits — Nimbus" }] }),
  component: AdminDeposits,
});

function AdminDeposits() {
  const qc = useQueryClient();
  const approve = useServerFn(adminApproveDeposit);
  const reject = useServerFn(adminRejectDeposit);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => (await supabase.from("deposits").select("*, profile:profiles!inner(email,full_name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const doApprove = async (r: any) => {
    const usd = parseFloat(prompt(`Credit USD value for ${r.amount} ${r.currency}?`, String(r.amount)) ?? "0");
    if (!usd) return;
    try { await approve({ data: { depositId: r.id, usdValue: usd } }); toast.success("Approved"); qc.invalidateQueries({ queryKey: ["admin-deposits"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  const doReject = async (r: any) => {
    if (!confirm("Reject deposit?")) return;
    try { await reject({ data: { depositId: r.id } }); toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["admin-deposits"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Deposits</h1>
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr><th className="py-2">User</th><th>Currency</th><th>Amount</th><th>Tx</th><th>Status</th><th>When</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 truncate max-w-[200px]">{r.profile?.email}</td>
                  <td>{r.currency} · {r.network}</td>
                  <td className="font-mono">{Number(r.amount)}</td>
                  <td className="font-mono text-[10px] truncate max-w-[140px]">{r.tx_hash ?? "-"}</td>
                  <td><span className="text-[10px] font-bold uppercase">{r.status}</span></td>
                  <td className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="text-right whitespace-nowrap">
                    {r.status === "pending" && <>
                      <button onClick={() => doApprove(r)} className="text-xs font-semibold text-mint-foreground mr-2">Approve</button>
                      <button onClick={() => doReject(r)} className="text-xs font-semibold text-destructive">Reject</button>
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
