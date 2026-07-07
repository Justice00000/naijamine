import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { adminReviewKyc } from "@/lib/mining.functions";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  head: () => ({ meta: [{ title: "Admin KYC — Nimbus" }] }),
  component: AdminKyc,
});

function AdminKyc() {
  const qc = useQueryClient();
  const review = useServerFn(adminReviewKyc);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () => (await supabase.from("kyc_submissions").select("*, profile:profiles!inner(email,full_name,country)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const decide = async (id: string, approve: boolean) => {
    const notes = approve ? undefined : (prompt("Reason?") ?? "Rejected");
    try { await review({ data: { submissionId: id, approve, notes } }); toast.success(approve ? "Approved" : "Rejected"); qc.invalidateQueries({ queryKey: ["admin-kyc"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">KYC submissions</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {rows.map((r: any) => (
          <GlassCard key={r.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{r.profile?.full_name ?? "Unnamed"} <span className="text-xs text-muted-foreground">{r.profile?.email}</span></div>
                <div className="text-[10px] text-muted-foreground uppercase">{r.doc_type} · {r.profile?.country ?? "—"}</div>
              </div>
              <span className="text-[10px] font-bold uppercase">{r.status}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Files: {[r.id_front_url, r.id_back_url, r.selfie_url, r.address_url].filter(Boolean).length} uploaded</div>
            {r.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => decide(r.id, true)} className="flex-1 rounded-full bg-gradient-mint text-mint-foreground py-2 text-xs font-semibold">Approve</button>
                <button onClick={() => decide(r.id, false)} className="flex-1 rounded-full bg-destructive/10 text-destructive py-2 text-xs font-semibold">Reject</button>
              </div>
            )}
          </GlassCard>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No submissions.</p>}
      </div>
    </div>
  );
}
