import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, CheckCircle2, XCircle, AlertTriangle, Copy } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { adminApproveWithdrawal, adminRejectWithdrawal } from "@/lib/mining.functions";
import { adminCompleteNgnWithdrawal } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Admin Withdrawals — Nimbus" }] }),
  component: AdminWithdrawals,
});

type Tab = "pending" | "completed" | "rejected" | "all";
type MethodFilter = "all" | "ngn_bank" | "crypto";

function AdminWithdrawals() {
  const qc = useQueryClient();
  const approve = useServerFn(adminApproveWithdrawal);
  const completeNgn = useServerFn(adminCompleteNgnWithdrawal);
  const reject = useServerFn(adminRejectWithdrawal);
  const [tab, setTab] = useState<Tab>("pending");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-wd", tab, method],
    refetchInterval: 20_000,
    queryFn: async () => {
      let query = supabase
        .from("withdrawals")
        .select("*, profile:profiles!inner(email,full_name)")
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
      [r.profile?.email, r.profile?.full_name, r.wallet_address, r.bank_account_number, r.bank_name]
        .filter(Boolean).some((f: string) => f.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const doApprove = async (r: any) => {
    try {
      if (r.method === "ngn_bank") await completeNgn({ data: { withdrawalId: r.id } });
      else await approve({ data: { withdrawalId: r.id } });
      toast.success("Withdrawal marked paid");
      qc.invalidateQueries({ queryKey: ["admin-wd"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const doReject = async (id: string) => {
    const notes = prompt("Reason for rejection?") ?? "";
    try { await reject({ data: { withdrawalId: id, notes } }); toast.success("Rejected & refunded"); qc.invalidateQueries({ queryKey: ["admin-wd"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Withdrawals</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} record{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, address, bank…"
            className="pl-8 pr-3 py-2 text-sm rounded-full bg-white/70 backdrop-blur border border-border w-64 focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "completed", "rejected", "all"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${tab === t ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-white/60 hover:bg-white/80"}`}>{t}</button>
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
                  <th>USD</th>
                  <th>Payout</th>
                  <th>Destination</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((r: any) => {
                    const risky = Number(r.amount) > 500 && r.status === "pending";
                    return (
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
                        <td className="font-mono">${Number(r.amount).toFixed(2)}</td>
                        <td className="font-mono">{r.method === "ngn_bank" ? `₦${Number(r.ngn_amount ?? 0).toLocaleString()}` : `${Number(r.amount).toFixed(4)} ${r.currency}`}</td>
                        <td className="text-[11px] max-w-[220px]">
                          {r.method === "ngn_bank" ? (
                            <>
                              <div className="font-medium truncate">{r.bank_account_name}</div>
                              <div className="text-muted-foreground flex items-center gap-1">
                                <span className="font-mono">{r.bank_account_number}</span>
                                <button onClick={() => { navigator.clipboard.writeText(r.bank_account_number); toast.success("Copied"); }}>
                                  <Copy className="w-3 h-3" />
                                </button>
                                · {r.bank_name}
                              </div>
                            </>
                          ) : (
                            <span className="font-mono text-[10px] truncate block">{r.wallet_address}</span>
                          )}
                        </td>
                        <td className="font-mono text-[11px]">${Number(r.fee).toFixed(2)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                              r.status === "completed" ? "bg-mint/40 text-mint-foreground" :
                              r.status === "pending" ? "bg-gold/40 text-gold-foreground" :
                              "bg-destructive/10 text-destructive"
                            }`}>{r.status}</span>
                            {risky && <AlertTriangle className="w-3 h-3 text-gold-foreground" aria-label="Large withdrawal — review" />}
                          </div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {r.status === "pending" && (
                            <div className="inline-flex gap-1">
                              <button onClick={() => doApprove(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-mint-foreground bg-mint/20 hover:bg-mint/30 rounded-full px-2 py-1">
                                <CheckCircle2 className="w-3 h-3" /> Mark paid
                              </button>
                              <button onClick={() => doReject(r.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-full px-2 py-1">
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No withdrawals match this view.</p>}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
