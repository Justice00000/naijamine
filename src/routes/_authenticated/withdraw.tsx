import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Plus, Trash2, Building2, Bitcoin, Loader2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { requestWithdrawal } from "@/lib/mining.functions";
import { getNgnQuote, requestNgnWithdrawal } from "@/lib/payments.functions";
import { useAuth } from "@/hooks/useAuth";

const CURRENCIES = [
  { code: "BTC", networks: ["Bitcoin"] },
  { code: "ETH", networks: ["ERC20"] },
  { code: "USDT", networks: ["TRC20", "ERC20"] },
  { code: "BNB", networks: ["BEP20"] },
  { code: "LTC", networks: ["Litecoin"] },
  { code: "SOL", networks: ["Solana"] },
];

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({ meta: [{ title: "Withdraw — Nimbus" }] }),
  component: WithdrawPage,
});

function WithdrawPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"ngn" | "crypto">("ngn");

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance").eq("user_id", user!.id).single()).data,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["withdraw-history", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("withdrawals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  return (
    <AppShell>
      <PageHeader title="Withdraw" subtitle="Cash out to your bank or wallet." />

      <div className="rounded-2xl bg-gradient-primary text-primary-foreground p-4 mb-4 shadow-glow">
        <div className="text-xs opacity-80">Available balance</div>
        <div className="font-display text-3xl font-bold">${Number(wallet?.balance ?? 0).toFixed(2)}</div>
      </div>

      <div className="flex gap-2 mb-4">
        <TabBtn active={tab === "ngn"} onClick={() => setTab("ngn")} icon={Building2} label="Nigerian bank" />
        <TabBtn active={tab === "crypto"} onClick={() => setTab("crypto")} icon={Bitcoin} label="Crypto" />
      </div>

      {tab === "ngn" ? <NgnWithdrawCard balance={Number(wallet?.balance ?? 0)} /> : <CryptoWithdrawCard balance={Number(wallet?.balance ?? 0)} />}

      <GlassCard className="mt-4">
        <h3 className="font-display font-bold mb-2 text-sm">Withdrawal history</h3>
        {history.length === 0 && <p className="text-xs text-muted-foreground">No withdrawals yet.</p>}
        {history.map((h: any) => (
          <div key={h.id} className="py-2 border-b border-border/60 last:border-0 flex items-center justify-between text-sm">
            <div className="min-w-0">
              <div className="font-mono text-xs truncate">
                {h.method === "ngn_bank"
                  ? `$${Number(h.amount).toFixed(2)} → ₦${Number(h.ngn_amount ?? 0).toLocaleString()} · ${h.bank_name}`
                  : `$${Number(h.amount).toFixed(2)} ${h.currency}`}
              </div>
              <div className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
            </div>
            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0 ${
              h.status === "completed" ? "bg-mint/40 text-mint-foreground" :
              h.status === "rejected" ? "bg-destructive/10 text-destructive" :
              "bg-muted text-muted-foreground"
            }`}>{h.status}</span>
          </div>
        ))}
      </GlassCard>
    </AppShell>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass text-foreground/70"
      }`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

const NIGERIAN_BANKS = [
  "Access Bank","Citibank","Ecobank","Fidelity Bank","First Bank","First City Monument Bank",
  "Globus Bank","GTBank","Heritage Bank","Jaiz Bank","Keystone Bank","Kuda Bank","Opay","PalmPay",
  "Polaris Bank","Providus Bank","Stanbic IBTC","Standard Chartered","Sterling Bank","SunTrust",
  "Titan Trust Bank","Union Bank","United Bank for Africa","Unity Bank","Wema Bank","Zenith Bank",
];

function NgnWithdrawCard({ balance }: { balance: number }) {
  const qc = useQueryClient();
  const quoteFn = useServerFn(getNgnQuote);
  const requestFn = useServerFn(requestNgnWithdrawal);

  const { data: quote } = useQuery({
    queryKey: ["ngn-quote"],
    queryFn: () => quoteFn(),
    refetchInterval: 60_000,
  });

  const [usdAmount, setUsdAmount] = useState("");
  const [bankName, setBankName] = useState("Opay");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const usd = parseFloat(usdAmount || "0");
  const sellRate = quote ? quote.ratePerUsd * (1 - quote.fxSpreadPct) : 0;
  const feeUsd = usd * (quote?.withdrawalFeePct ?? 0);
  const netUsd = usd - feeUsd;
  const ngnPayout = netUsd * sellRate;

  const submit = useMutation({
    mutationFn: () => requestFn({ data: { usdAmount: usd, bankName, accountNumber, accountName } }),
    onSuccess: () => {
      toast.success("Withdrawal requested", { description: `₦${ngnPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })} on the way.` });
      setUsdAmount(""); setAccountNumber(""); setAccountName("");
      qc.invalidateQueries({ queryKey: ["withdraw-history"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  return (
    <GlassCard>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-gradient-sky p-3">
          <div className="text-muted-foreground">Live rate</div>
          <div className="font-mono font-semibold">₦{Number(quote?.ratePerUsd ?? 0).toLocaleString()} / $1</div>
        </div>
        <div className="rounded-2xl bg-gradient-mint p-3">
          <div className="text-muted-foreground">You get</div>
          <div className="font-mono font-semibold">₦{sellRate.toFixed(2)} / $1</div>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Amount to withdraw (USD)</label>
        <input type="number" step="any" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-primary/40" />
        <div className="mt-1 text-[10px] text-muted-foreground">
          Balance: <button onClick={() => setUsdAmount(String(balance))} className="text-primary font-semibold">${balance.toFixed(2)}</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Bank</label>
          <select value={bankName} onChange={(e) => setBankName(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white/70 border border-border px-3 py-2.5 text-sm">
            {NIGERIAN_BANKS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Account number (NUBAN)</label>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric" placeholder="10 digits"
            className="mt-1 w-full rounded-2xl bg-white/70 border border-border px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
      </div>
      <div className="mt-2">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Account name</label>
        <input value={accountName} onChange={(e) => setAccountName(e.target.value)}
          placeholder="Name on the bank account"
          className="mt-1 w-full rounded-2xl bg-white/70 border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
      </div>

      {usd > 0 && quote && (
        <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Amount</span><span className="font-mono">${usd.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Platform fee ({(quote.withdrawalFeePct * 100).toFixed(1)}%)</span><span className="font-mono">−${feeUsd.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>FX rate</span><span className="font-mono">₦{sellRate.toFixed(2)} / $</span></div>
          <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border/60">
            <span>Payout</span><span className="font-mono">₦{ngnPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      <button onClick={() => submit.mutate()}
        disabled={!usd || accountNumber.length !== 10 || !accountName || usd > balance || submit.isPending}
        className="mt-4 w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50 flex items-center justify-center gap-2">
        {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        <ArrowUpRight className="w-4 h-4" /> Confirm payout
      </button>
    </GlassCard>
  );
}

function CryptoWithdrawCard({ balance }: { balance: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const request = useServerFn(requestWithdrawal);
  const [currency, setCurrency] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const { data: saved = [] } = useQuery({
    queryKey: ["saved-wallets", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("saved_wallets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = useMutation({
    mutationFn: () => request({ data: { currency, network, address, amount: parseFloat(amount) } }),
    onSuccess: () => {
      toast.success("Withdrawal requested");
      setAmount(""); setAddress("");
      qc.invalidateQueries({ queryKey: ["withdraw-history"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  const saveWallet = async () => {
    if (!address || !label) return toast.error("Label + address required");
    await supabase.from("saved_wallets").insert({ user_id: user!.id, label, currency, network, address });
    setLabel("");
    qc.invalidateQueries({ queryKey: ["saved-wallets"] });
    toast.success("Wallet saved");
  };

  const amt = parseFloat(amount || "0");
  const fee = Math.max(1, amt * 0.01);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <GlassCard>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Currency</label>
            <select value={currency} onChange={(e) => { setCurrency(e.target.value); setNetwork(CURRENCIES.find((c) => c.code === e.target.value)!.networks[0]); }}
              className="w-full rounded-2xl bg-white/70 border border-border px-3 py-2.5 text-sm mt-1">
              {CURRENCIES.map((c) => <option key={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Network</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value)}
              className="w-full rounded-2xl bg-white/70 border border-border px-3 py-2.5 text-sm mt-1">
              {CURRENCIES.find((c) => c.code === currency)?.networks.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Destination wallet address"
          className="w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40" />
        <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (USD)"
          className="mt-2 w-full rounded-2xl bg-white/70 border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Network fee (1%, $1 min)</span>
          <span className="font-mono">${fee.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="font-semibold">You receive</span>
          <span className="font-mono font-bold">${Math.max(0, amt - fee).toFixed(2)}</span>
        </div>
        <button onClick={() => submit.mutate()} disabled={!address || !amount || amt > balance || submit.isPending}
          className="mt-4 w-full rounded-2xl bg-gradient-primary text-primary-foreground py-3 text-sm font-semibold shadow-glow disabled:opacity-50 flex items-center justify-center gap-2">
          <ArrowUpRight className="w-4 h-4" /> Confirm withdrawal
        </button>
        <div className="mt-4 flex items-center gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Save as… (e.g. My Ledger)"
            className="flex-1 rounded-full bg-white/70 border border-border px-3 py-2 text-xs outline-none" />
          <button onClick={saveWallet} className="rounded-full bg-white border border-border px-3 py-2 text-xs font-semibold flex items-center gap-1">
            <Plus className="w-3 h-3" /> Save
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display font-bold mb-2 text-sm">Saved wallets</h3>
        {saved.length === 0 && <p className="text-xs text-muted-foreground">No saved wallets yet.</p>}
        {saved.map((w: any) => (
          <div key={w.id} className="py-2 border-b border-border/60 last:border-0 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{w.label} <span className="text-[10px] text-muted-foreground">{w.currency} · {w.network}</span></div>
              <div className="text-[11px] font-mono truncate text-muted-foreground">{w.address}</div>
            </div>
            <button onClick={() => { setCurrency(w.currency); setNetwork(w.network ?? ""); setAddress(w.address); }} className="text-xs text-primary font-semibold">Use</button>
            <button onClick={async () => { await supabase.from("saved_wallets").delete().eq("id", w.id); qc.invalidateQueries({ queryKey: ["saved-wallets"] }); }}
              className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
