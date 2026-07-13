import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, X, ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { adminReviewKyc } from "@/lib/mining.functions";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  head: () => ({ meta: [{ title: "Admin KYC — Nimbus" }] }),
  component: AdminKyc,
});

type Tab = "pending" | "approved" | "rejected" | "all";

function AdminKyc() {
  const qc = useQueryClient();
  const review = useServerFn(adminReviewKyc);
  const [tab, setTab] = useState<Tab>("pending");
  const [viewer, setViewer] = useState<{ url: string; label: string } | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-kyc", tab],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase.from("kyc_submissions")
        .select("*, profile:profiles!inner(email,full_name,country)")
        .order("created_at", { ascending: false }).limit(100);
      if (tab !== "all") q = q.eq("status", tab);
      return (await q).data ?? [];
    },
  });

  const openFile = async (path: string | null, label: string) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("kyc").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open file");
    setViewer({ url: data.signedUrl, label });
  };

  const decide = async (id: string, approve: boolean) => {
    const notes = approve ? undefined : (prompt("Reason?") ?? "Rejected");
    try {
      await review({ data: { submissionId: id, approve, notes } });
      toast.success(approve ? "KYC approved" : "KYC rejected");
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">KYC review</h1>
          <p className="text-sm text-muted-foreground">{rows.length} submission{rows.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${tab === t ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-white/60 hover:bg-white/80"}`}>{t}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <AnimatePresence>
          {rows.map((r: any) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GlassCard>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-bold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> {r.profile?.full_name ?? "Unnamed"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.profile?.email}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">
                      {r.doc_type} · {r.profile?.country ?? "—"} · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                    r.status === "approved" ? "bg-mint/40 text-mint-foreground" :
                    r.status === "pending" ? "bg-gold/40 text-gold-foreground" :
                    "bg-destructive/10 text-destructive"
                  }`}>{r.status}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <FileTile label="ID Front" path={r.id_front_url} onOpen={openFile} />
                  <FileTile label="ID Back" path={r.id_back_url} onOpen={openFile} />
                  <FileTile label="Selfie" path={r.selfie_url} onOpen={openFile} />
                  <FileTile label="Address" path={r.address_url} onOpen={openFile} />
                </div>

                {r.admin_notes && (
                  <div className="mt-3 text-[11px] bg-white/50 rounded-xl px-3 py-2">
                    <span className="font-semibold">Admin note:</span> {r.admin_notes}
                  </div>
                )}

                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => decide(r.id, true)} className="flex-1 rounded-full bg-gradient-mint text-mint-foreground py-2 text-xs font-semibold hover:brightness-105 transition">Approve</button>
                    <button onClick={() => decide(r.id, false)} className="flex-1 rounded-full bg-destructive/10 text-destructive py-2 text-xs font-semibold hover:bg-destructive/20 transition">Reject</button>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No submissions in this view.</p>}
      </div>

      <AnimatePresence>
        {viewer && <Viewer viewer={viewer} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </div>
  );
}

function FileTile({ label, path, onOpen }: { label: string; path: string | null; onOpen: (p: string | null, l: string) => void }) {
  const has = !!path;
  return (
    <button
      onClick={() => has && onOpen(path, label)}
      disabled={!has}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-semibold transition ${has ? "bg-primary/10 hover:bg-primary/20 text-primary" : "bg-white/40 text-muted-foreground/60 cursor-not-allowed"}`}
    >
      <div className="text-lg">{has ? "📄" : "—"}</div>
      <div className="mt-1 uppercase tracking-widest">{label}</div>
    </button>
  );
}

function Viewer({ viewer, onClose }: { viewer: { url: string; label: string }; onClose: () => void }) {
  const [isPdf, setIsPdf] = useState(false);
  useEffect(() => { setIsPdf(/\.pdf(\?|$)/i.test(viewer.url)); }, [viewer.url]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()} className="glass rounded-3xl p-4 max-w-3xl w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-bold">{viewer.label}</div>
          <div className="flex items-center gap-2">
            <a href={viewer.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><ExternalLink className="w-3 h-3" /> open</a>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {isPdf
          ? <iframe src={viewer.url} className="w-full h-[70vh] rounded-2xl bg-white" title={viewer.label} />
          : <img src={viewer.url} alt={viewer.label} className="w-full rounded-2xl bg-white/40 max-h-[70vh] object-contain" />}
      </motion.div>
    </motion.div>
  );
}
