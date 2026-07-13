import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, ExternalLink, X, CheckCircle2, XCircle, FileImage } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { adminApproveDeposit, adminRejectDeposit } from "@/lib/mining.functions";
import { adminApproveNgnDeposit } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin/deposits")({
  head: () => ({ meta: [{ title: "Admin Deposits — Nimbus" }] }),
  component: AdminDeposits,
});

type Tab = "pending" | "completed" | "rejected" | "all";
type MethodFilter = "all" | "ngn_bank" | "crypto";

function AdminDeposits() {
  const qc = useQueryClient();
  const approveCrypto = useServerFn(adminApproveDeposit);
  const approveNgn = useServerFn(adminApproveNgnDeposit);
  const reject = useServerFn(adminRejectDeposit);
  const [tab, setTab] = useState<Tab>("pending");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [q, setQ] = useState("");
  const [proof, setProof] = useState<{ url: string; name: string } | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-deposits", tab, method],
    refetchInterval: 20_000,
    queryFn: async () => {
      let query = supabase
        .from("deposits")
        .select("*, profile:profiles!inner(email,full_name,country)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab !== "all") query = query.eq("status", tab);
      if (method === "ngn_bank") query = query.eq("method", "ngn_bank");
      if (method === "crypto") query = query.or("method.is.null,method.neq.ngn_bank");
      return (await query).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r: any) =>
      [r.profile?.email, r.profile?.full_name, r.tx_hash, r.sender_name, r.currency]
        .filter(Boolean).some((f: string) => f.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const totals = useMemo(() => {
    const t = { count: filtered.length, usd: 0, ngn: 0 };
    for (const r of filtered as any[]) {
      t.usd += Number(r.usd_value ?? 0);
      t.ngn += Number(r.ngn_amount ?? 0);
    }
    return t;
  }, [filtered]);

  const openProof = async (path: string | null) => {
    if (!path) return toast.error("No proof uploaded");
    const { data, error } = await supabase.storage.from("deposit-proofs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open proof");
    setProof({ url: data.signedUrl, name: path.split("/").pop() ?? "proof" });
  };

  const doApprove = async (r: any) => {
    try {
      if (r.method === "ngn_bank") {
        await approveNgn({ data: { depositId: r.id } });
      } else {
        const usd = parseFloat(prompt(`Credit USD value for ${r.amount} ${r.currency}?`, String(r.usd_value ?? r.amount)) ?? "0");
        if (!usd) return;
        await approveCrypto({ data: { depositId: r.id, usdValue: usd } });
      }
      toast.success("Deposit approved");
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const doReject = async (id: string) => {
    if (!confirm("Reject deposit?")) return;
    try { await reject({ data: { depositId: id } }); toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["admin-deposits"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Deposits</h1>
          <p className="text-sm text-muted-foreground">{totals.count} record{totals.count === 1 ? "" : "s"} · ${totals.usd.toFixed(2)} USD · ₦{totals.ngn.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, sender, tx hash…"
              className="pl-8 pr-3 py-2 text-sm rounded-full bg-white/70 backdrop-blur border border-border w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "completed", "rejected", "all"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${tab === t ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-white/60 hover:bg-white/80"}`}>
            {t}
          </button>
        ))}
        <div className="w-px h-6 bg-border mx-1" />
        {(["all", "ngn_bank", "crypto"] as MethodFilter[]).map((m) => (
          <button key={m} onClick={() => setMethod(m)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${method === m ? "bg-foreground/90 text-background" : "bg-white/60 hover:bg-white/80"}`}>
            {m === "ngn_bank" ? "NGN bank" : m === "crypto" ? "Crypto" : "All methods"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2">User</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>USD</th>
                  <th>Ref / Sender</th>
                  <th>Status</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((r: any) => (
                    <motion.tr key={r.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="border-b border-border/60 hover:bg-white/40">
                      <td className="py-2">
                        <div className="truncate max-w-[200px] font-medium">{r.profile?.full_name || "—"}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.profile?.email}</div>
                      </td>
                      <td>
                        <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${r.method === "ngn_bank" ? "bg-mint/30 text-mint-foreground" : "bg-primary/10 text-primary"}`}>
                          {r.method === "ngn_bank" ? "NGN" : (r.currency ?? "CRYPTO")}
                        </span>
                      </td>
                      <td className="font-mono">
                        {r.method === "ngn_bank" ? `₦${Number(r.ngn_amount).toLocaleString()}` : `${Number(r.amount)} ${r.currency ?? ""}`}
                      </td>
                      <td className="font-mono">${Number(r.usd_value ?? 0).toFixed(2)}</td>
                      <td className="text-[11px]">
                        {r.method === "ngn_bank" ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[140px]">{r.sender_name}</span>
                            {r.proof_url && (
                              <button onClick={() => openProof(r.proof_url)} className="inline-flex items-center gap-1 text-primary font-semibold">
                                <FileImage className="w-3 h-3" /> proof
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono truncate block max-w-[140px]">{r.tx_hash ?? "—"}</span>
                        )}
                      </td>
                      <td>
                        <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                          r.status === "completed" ? "bg-mint/40 text-mint-foreground" :
                          r.status === "pending" ? "bg-gold/40 text-gold-foreground" :
                          "bg-destructive/10 text-destructive"
                        }`}>{r.status}</span>
                      </td>
                      <td className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="text-right whitespace-nowrap">
                        {r.status === "pending" && (
                          <div className="inline-flex gap-1">
                            <button onClick={() => doApprove(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-mint-foreground bg-mint/20 hover:bg-mint/30 rounded-full px-2 py-1">
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => doReject(r.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-full px-2 py-1">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No deposits match this view.</p>}
          </div>
        </GlassCard>
      )}

      <AnimatePresence>
        {proof && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setProof(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-3xl p-4 max-w-2xl w-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-bold truncate">{proof.name}</div>
                <div className="flex items-center gap-2">
                  <a href={proof.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><ExternalLink className="w-3 h-3" /> open</a>
                  <button onClick={() => setProof(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <img src={proof.url} alt="proof" className="w-full rounded-2xl bg-white/40 max-h-[70vh] object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
