import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, ShieldCheck, Check, X, Clock } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({ meta: [{ title: "KYC — Nimbus" }] }),
  component: KycPage,
});

function KycPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [docType, setDocType] = useState("passport");
  const [files, setFiles] = useState<{ id_front?: File; id_back?: File; selfie?: File; address?: File }>({});

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("kyc_status").eq("id", user!.id).single()).data,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["kyc-mine", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("kyc_submissions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!files.id_front || !files.selfie) throw new Error("ID front and selfie are required");
      const uploads: Record<string, string> = {};
      for (const key of ["id_front", "id_back", "selfie", "address"] as const) {
        const f = files[key];
        if (!f) continue;
        const path = `${user!.id}/${Date.now()}-${key}-${f.name}`;
        const { error } = await supabase.storage.from("kyc").upload(path, f, { upsert: true });
        if (error) throw error;
        uploads[key] = path;
      }
      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: user!.id,
        doc_type: docType,
        id_front_url: uploads.id_front,
        id_back_url: uploads.id_back,
        selfie_url: uploads.selfie,
        address_url: uploads.address,
      });
      if (error) throw error;
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user!.id);
    },
    onSuccess: () => {
      toast.success("KYC submitted", { description: "We'll review your documents shortly." });
      setFiles({});
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["kyc-mine"] });
    },
    onError: (e) => toast.error("Submit failed", { description: (e as Error).message }),
  });

  const status = profile?.kyc_status ?? "unverified";
  const badge: Record<string, any> = {
    unverified: { c: "bg-muted", i: <ShieldCheck className="w-4 h-4" /> },
    pending: { c: "bg-gold/40 text-gold-foreground", i: <Clock className="w-4 h-4" /> },
    approved: { c: "bg-mint/40 text-mint-foreground", i: <Check className="w-4 h-4" /> },
    rejected: { c: "bg-destructive/10 text-destructive", i: <X className="w-4 h-4" /> },
  };

  return (
    <AppShell>
      <PageHeader title="Identity verification" subtitle="Unlock higher withdrawal limits by verifying your identity." />
      <GlassCard className="!p-4 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${badge[status].c}`}>{badge[status].i}</div>
          <div>
            <div className="text-xs text-muted-foreground">Current status</div>
            <div className="font-semibold capitalize">{status}</div>
          </div>
        </div>
      </GlassCard>

      {status !== "approved" && (
        <GlassCard>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {["passport", "national_id", "drivers_license"].map((t) => (
              <button key={t} onClick={() => setDocType(t)} className={`rounded-full py-2 text-xs font-semibold border ${docType === t ? "bg-gradient-primary text-primary-foreground border-transparent shadow-soft" : "bg-white border-border"}`}>
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Uploader label="ID document (front)" file={files.id_front} onChange={(f) => setFiles((s) => ({ ...s, id_front: f }))} />
            {docType !== "passport" && (
              <Uploader label="ID document (back)" file={files.id_back} onChange={(f) => setFiles((s) => ({ ...s, id_back: f }))} />
            )}
            <Uploader label="Selfie with ID" file={files.selfie} onChange={(f) => setFiles((s) => ({ ...s, selfie: f }))} />
            <Uploader label="Proof of address (optional)" file={files.address} onChange={(f) => setFiles((s) => ({ ...s, address: f }))} />
          </div>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="mt-4 w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50"
          >Submit for review</button>
        </GlassCard>
      )}

      {submissions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display font-bold mb-2">History</h3>
          {submissions.map((s: any) => (
            <GlassCard key={s.id} className="!p-4 mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold capitalize">{s.doc_type.replace("_", " ")}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-1 ${badge[s.status].c}`}>{s.status}</span>
            </GlassCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Uploader({ label, file, onChange }: { label: string; file?: File; onChange: (f: File) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-white/70 border border-dashed border-border p-4 cursor-pointer hover:bg-white transition-colors">
      <div className="w-10 h-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-soft"><Upload className="w-4 h-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{file?.name ?? "PNG or JPG, up to 10MB"}</div>
      </div>
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
    </label>
  );
}
