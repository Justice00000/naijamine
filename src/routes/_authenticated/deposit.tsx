import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ArrowDownRight, Building2, Bitcoin, Upload, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { submitDeposit } from "@/lib/mining.functions";
import { getNgnQuote, submitNgnDeposit } from "@/lib/payments.functions";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({ meta: [{ title: "Deposit — Nimbus" }] }),
  component: DepositPage,
});

function DepositPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"ngn" | "crypto">("ngn");

  const { data: history = [] } = useQuery({
    queryKey: ["deposit-history", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("deposits").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  return (
    <AppShell>
      <PageHeader title="Deposit" subtitle="Fund your wallet in naira or crypto." />

      <div className="flex gap-2 mb-4">
        <TabBtn active={tab === "ngn"} onClick={() => setTab("ngn")} icon={Building2} label="Nigerian bank" />
        <TabBtn active={tab === "crypto"} onClick={() => setTab("crypto")} icon={Bitcoin} label="Crypto" />
      </div>

      {tab === "ngn" ? <NgnDepositCard onSubmitted={() => qc.invalidateQueries({ queryKey: ["deposit-history"] })} /> : <CryptoDepositCard />}

      <GlassCard className="mt-4">
        <h4 className="font-semibold text-sm">Recent deposits</h4>
        <div className="mt-2 space-y-1">
          {history.length === 0 && <p className="text-xs text-muted-foreground">No deposits yet.</p>}
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/60 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <ArrowDownRight className="w-4 h-4 text-mint-foreground shrink-0" />
                <span className="font-mono text-xs truncate">
                  {h.method === "ngn_bank"
                    ? `₦${Number(h.ngn_amount ?? 0).toLocaleString()} → $${Number(h.usd_value ?? 0).toFixed(2)}`
                    : `${Number(h.amount)} ${h.currency}`}
                </span>
              </div>
              <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0 ${h.status === "completed" ? "bg-mint/40 text-mint-foreground" : h.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{h.status}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </AppShell>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass text-foreground/70"
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function NgnDepositCard({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth();
  const quoteFn = useServerFn(getNgnQuote);
  const submitFn = useServerFn(submitNgnDeposit);

  const { data: quote } = useQuery({
    queryKey: ["ngn-quote"],
    queryFn: () => quoteFn(),
    refetchInterval: 60_000,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await supabase.from("bank_accounts").select("*").eq("is_active", true)).data ?? [],
  });

  const [selectedBank, setSelectedBank] = useState<string>("");
  const [ngnAmount, setNgnAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBank && banks.length) setSelectedBank(banks[0].id);
  }, [banks, selectedBank]);

  const bank = banks.find((b: any) => b.id === selectedBank);
  const ngn = parseFloat(ngnAmount || "0");
  const buyRate = quote ? quote.ratePerUsd * (1 + quote.fxSpreadPct) : 0;
  const grossUsd = buyRate ? ngn / buyRate : 0;
  const feeUsd = grossUsd * (quote?.depositFeePct ?? 0);
  const netUsd = grossUsd - feeUsd;

  const copy = (v: string, key: string) => {
    navigator.clipboard.writeText(v);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
    toast.success("Copied");
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!bank) throw new Error("Select a bank");
      let proofUrl: string | undefined;
      if (proofFile) {
        setUploading(true);
        const path = `${user!.id}/${crypto.randomUUID()}-${proofFile.name}`;
        const { error } = await supabase.storage.from("deposit-proofs").upload(path, proofFile);
        setUploading(false);
        if (error) throw new Error(error.message);
        proofUrl = path;
      }
      return submitFn({ data: {
        ngnAmount: ngn, bankAccountId: bank.id, senderName, proofUrl,
      }});
    },
    onSuccess: () => {
      toast.success("Deposit submitted", { description: "We'll credit your wallet after confirming the transfer." });
      setNgnAmount(""); setSenderName(""); setProofFile(null);
      onSubmitted();
    },
    onError: (e) => toast.error("Submit failed", { description: (e as Error).message }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <GlassCard>
        <h3 className="font-display font-bold text-sm">Send NGN to</h3>
        <div className="flex flex-wrap gap-2 mt-3">
          {banks.map((b: any) => (
            <button key={b.id} onClick={() => setSelectedBank(b.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                selectedBank === b.id ? "bg-gradient-primary text-primary-foreground border-transparent shadow-soft" : "bg-white border-border"
              }`}
            >{b.bank_name}</button>
          ))}
        </div>

        {bank && (
          <motion.div key={bank.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-2">
            <Row label="Bank" value={bank.bank_name} onCopy={() => copy(bank.bank_name, "bn")} copied={copied === "bn"} />
            <Row label="Account name" value={bank.account_name} onCopy={() => copy(bank.account_name, "an")} copied={copied === "an"} />
            <Row label="Account number" value={bank.account_number} mono onCopy={() => copy(bank.account_number, "no")} copied={copied === "no"} />
            {bank.instructions && (
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/60">{bank.instructions}</p>
            )}
          </motion.div>
        )}

        {quote && (
          <div className="mt-4 rounded-2xl bg-gradient-sky p-3 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Live rate</span><span className="font-mono font-semibold">₦{Number(quote.ratePerUsd).toLocaleString()} / $1</span></div>
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">Effective (incl. spread)</span><span className="font-mono">₦{buyRate.toFixed(2)} / $1</span></div>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="font-display font-bold text-sm">Confirm your transfer</h3>
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Amount sent (₦)</label>
            <input type="number" min={quote?.minNgnDeposit ?? 1000} step="100" value={ngnAmount} onChange={(e) => setNgnAmount(e.target.value)}
              placeholder={`Min ₦${(quote?.minNgnDeposit ?? 1000).toLocaleString()}`}
              className="mt-1 w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Sender name (as on bank)</label>
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Proof of payment (optional)</label>
            <label className="mt-1 flex items-center gap-2 rounded-2xl bg-white/70 border border-dashed border-border px-4 py-3 text-xs cursor-pointer hover:bg-white/90">
              <Upload className="w-4 h-4" />
              <span className="flex-1 truncate">{proofFile?.name ?? "Upload screenshot / receipt"}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        {ngn > 0 && quote && (
          <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Gross USD</span><span className="font-mono">${grossUsd.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform fee ({(quote.depositFeePct * 100).toFixed(1)}%)</span>
              <span className="font-mono">−${feeUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border/60">
              <span>You receive</span><span className="font-mono">${netUsd.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button onClick={() => submit.mutate()}
          disabled={!bank || !ngn || !senderName || submit.isPending || uploading}
          className="mt-4 w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50 flex items-center justify-center gap-2">
          {(submit.isPending || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit deposit
        </button>
      </GlassCard>
    </div>
  );
}

function Row({ label, value, mono, onCopy, copied }: any) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div className={`text-sm truncate ${mono ? "font-mono font-semibold" : "font-semibold"}`}>{value}</div>
      </div>
      <button onClick={onCopy} className="rounded-full bg-gradient-primary text-primary-foreground px-3 py-1.5 text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function CryptoDepositCard() {
  const { user } = useAuth();
  const submit = useServerFn(submitDeposit);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: addresses = [] } = useQuery({
    queryKey: ["deposit-addresses"],
    queryFn: async () => (await supabase.from("deposit_addresses").select("*").eq("is_active", true)).data ?? [],
  });

  const current = addresses.find((a: any) => a.id === selected) ?? addresses[0];

  useEffect(() => {
    if (current?.address) QRCode.toDataURL(current.address, { margin: 1, width: 200 }).then(setQr);
  }, [current?.address]);

  const claim = useMutation({
    mutationFn: () => submit({ data: {
      currency: current.currency, network: current.network, address: current.address,
      amount: parseFloat(amount), txHash: txHash || undefined,
    }}),
    onSuccess: () => {
      toast.success("Deposit submitted");
      setAmount(""); setTxHash("");
      qc.invalidateQueries({ queryKey: ["deposit-history", user?.id] });
    },
    onError: (e) => toast.error("Submit failed", { description: (e as Error).message }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <GlassCard>
        <div className="flex flex-wrap gap-2 mb-4">
          {addresses.map((a: any) => (
            <button key={a.id} onClick={() => setSelected(a.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                (current?.id === a.id) ? "bg-gradient-primary text-primary-foreground border-transparent shadow-soft" : "bg-white border-border"
              }`}
            >{a.currency} · {a.network}</button>
          ))}
        </div>
        {current && (
          <div className="text-center">
            {qr && <img src={qr} alt="QR" className="mx-auto rounded-2xl border border-border p-2 bg-white" />}
            <div className="mt-3 text-xs text-muted-foreground uppercase tracking-wider">{current.currency} · {current.network}</div>
            <div className="mt-2 rounded-2xl bg-muted p-3 font-mono text-xs break-all">{current.address}</div>
            <button onClick={() => { navigator.clipboard.writeText(current.address); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Address copied"); }}
              className="mt-2 rounded-full bg-gradient-primary text-primary-foreground px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy address"}
            </button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Min deposit: <span className="font-mono">{Number(current.min_deposit)} {current.currency}</span><br />
              {current.instructions}
            </p>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="font-display font-bold text-sm">Confirm your deposit</h3>
        <div className="mt-3 space-y-2">
          <input type="number" step="any" placeholder={`Amount in ${current?.currency ?? ""}`} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="text" placeholder="Transaction hash (optional)" value={txHash} onChange={(e) => setTxHash(e.target.value)}
            className="w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
          <button onClick={() => claim.mutate()} disabled={!current || !amount || claim.isPending}
            className="w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50">
            Submit deposit
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
