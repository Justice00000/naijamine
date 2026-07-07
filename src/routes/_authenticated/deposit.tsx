import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ArrowDownRight } from "lucide-react";
import QRCode from "qrcode";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { submitDeposit } from "@/lib/mining.functions";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({ meta: [{ title: "Deposit — Nimbus" }] }),
  component: DepositPage,
});

function DepositPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const submit = useServerFn(submitDeposit);
  const [selected, setSelected] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: addresses = [] } = useQuery({
    queryKey: ["deposit-addresses"],
    queryFn: async () => (await supabase.from("deposit_addresses").select("*").eq("is_active", true)).data ?? [],
  });

  const { data: history = [] } = useQuery({
    queryKey: ["deposit-history", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("deposits").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const current = addresses.find((a: any) => a.id === selected) ?? addresses[0];

  useEffect(() => {
    if (current?.address) QRCode.toDataURL(current.address, { margin: 1, width: 200 }).then(setQr);
  }, [current?.address]);

  const copy = () => {
    if (!current) return;
    navigator.clipboard.writeText(current.address);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("Address copied");
  };

  const claim = useMutation({
    mutationFn: () => submit({ data: {
      currency: current.currency, network: current.network, address: current.address,
      amount: parseFloat(amount), txHash: txHash || undefined,
    }}),
    onSuccess: () => {
      toast.success("Deposit submitted", { description: "We'll credit your wallet after confirmation." });
      setAmount(""); setTxHash("");
      qc.invalidateQueries({ queryKey: ["deposit-history"] });
    },
    onError: (e) => toast.error("Submit failed", { description: (e as Error).message }),
  });

  return (
    <AppShell>
      <PageHeader title="Deposit" subtitle="Fund your wallet in seconds." />
      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard>
          <div className="flex flex-wrap gap-2 mb-4">
            {addresses.map((a: any) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  (current?.id === a.id) ? "bg-gradient-primary text-primary-foreground border-transparent shadow-soft" : "bg-white border-border"
                }`}
              >{a.currency} · {a.network}</button>
            ))}
          </div>

          {current && (
            <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              {qr && <img src={qr} alt="QR" className="mx-auto rounded-2xl border border-border p-2 bg-white" />}
              <div className="mt-3 text-xs text-muted-foreground uppercase tracking-wider">{current.currency} · {current.network}</div>
              <div className="mt-2 rounded-2xl bg-muted p-3 font-mono text-xs break-all">{current.address}</div>
              <button onClick={copy} className="mt-2 rounded-full bg-gradient-primary text-primary-foreground px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy address"}
              </button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Min deposit: <span className="font-mono">{Number(current.min_deposit)} {current.currency}</span><br />
                {current.instructions}
              </p>
            </motion.div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="font-display font-bold">Confirm your deposit</h3>
          <p className="text-xs text-muted-foreground mt-1">After you send funds, submit the details so we can credit your wallet.</p>
          <div className="mt-4 space-y-2">
            <input type="number" step="any" placeholder={`Amount in ${current?.currency ?? ""}`} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="text" placeholder="Transaction hash (optional)" value={txHash} onChange={(e) => setTxHash(e.target.value)}
              className="w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
            <button
              onClick={() => claim.mutate()}
              disabled={!current || !amount || claim.isPending}
              className="w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50"
            >Submit deposit</button>
          </div>

          <h4 className="mt-6 font-semibold text-sm">Recent deposits</h4>
          <div className="mt-2 space-y-2">
            {history.length === 0 && <p className="text-xs text-muted-foreground">No deposits yet.</p>}
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-sm py-1 border-b border-border/60 last:border-0">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-mint-foreground" />
                  <span className="font-mono text-xs">{Number(h.amount)} {h.currency}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${h.status === "completed" ? "bg-mint/40 text-mint-foreground" : h.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{h.status}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
