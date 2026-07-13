import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Banknote, Save, Sliders, Plus } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateSettings, adminUpsertBankAccount } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin Settings — Nimbus" }] }),
  component: AdminSettings,
});

const SETTING_KEYS = [
  { key: "deposit_fee_pct", label: "Deposit fee %", pct: true, help: "Fraction of deposits kept as revenue (e.g. 0.02 = 2%)" },
  { key: "withdrawal_fee_pct", label: "Withdrawal fee %", pct: true, help: "Fraction of withdrawals kept as revenue" },
  { key: "fx_spread_pct", label: "FX spread %", pct: true, help: "Applied to buy/sell rates (adds to buy, subtracts from sell)" },
  { key: "min_ngn_deposit", label: "Min NGN deposit", pct: false, help: "Naira minimum per deposit" },
  { key: "min_ngn_withdrawal", label: "Min NGN payout", pct: false, help: "Minimum payout amount in Naira" },
] as const;

function AdminSettings() {
  const qc = useQueryClient();
  const updateSetting = useServerFn(adminUpdateSettings);
  const upsertBank = useServerFn(adminUpsertBankAccount);

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("*")).data ?? [],
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["admin-banks"],
    queryFn: async () => (await supabase.from("bank_accounts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Platform settings</h1>
        <p className="text-sm text-muted-foreground">Fees, FX spread and Nigerian bank accounts.</p>
      </div>

      <GlassCard>
        <h3 className="font-display font-bold flex items-center gap-2 mb-3"><Sliders className="w-4 h-4" /> Fees & limits</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {SETTING_KEYS.map((s) => {
            const current = (settings as any[]).find((r) => r.key === s.key)?.value;
            const initial = typeof current === "number" ? current : Number(current ?? 0);
            return (
              <SettingRow key={s.key} spec={s} initial={initial}
                onSave={async (v) => {
                  try { await updateSetting({ data: { key: s.key, value: v } }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-settings"] }); }
                  catch (e) { toast.error((e as Error).message); }
                }} />
            );
          })}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold flex items-center gap-2"><Banknote className="w-4 h-4" /> Nigerian bank accounts</h3>
        </div>
        <BankForm onSubmit={async (payload) => {
          try { await upsertBank({ data: payload }); toast.success("Bank saved"); qc.invalidateQueries({ queryKey: ["admin-banks"] }); }
          catch (e) { toast.error((e as Error).message); }
        }} />
        <div className="mt-4 divide-y divide-border/60">
          {(banks as any[]).map((b) => (
            <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{b.account_name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{b.account_number} · {b.bank_name}</div>
                {b.instructions && <div className="text-[11px] text-muted-foreground mt-0.5">{b.instructions}</div>}
              </div>
              <button
                onClick={async () => {
                  try {
                    await upsertBank({ data: { id: b.id, bank_name: b.bank_name, account_name: b.account_name, account_number: b.account_number, instructions: b.instructions ?? undefined, is_active: !b.is_active } });
                    toast.success(b.is_active ? "Disabled" : "Enabled");
                    qc.invalidateQueries({ queryKey: ["admin-banks"] });
                  } catch (e) { toast.error((e as Error).message); }
                }}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 ${b.is_active ? "bg-mint/30 text-mint-foreground" : "bg-white/60"}`}>
                {b.is_active ? "Active" : "Disabled"}
              </button>
            </motion.div>
          ))}
          {banks.length === 0 && <p className="text-xs text-muted-foreground py-3">No bank accounts yet — add one above so users can deposit.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

function SettingRow({ spec, initial, onSave }: { spec: { key: string; label: string; pct: boolean; help: string }; initial: number; onSave: (v: number) => Promise<void> }) {
  const [val, setVal] = useState(spec.pct ? (initial * 100).toString() : initial.toString());
  useEffect(() => { setVal(spec.pct ? (initial * 100).toString() : initial.toString()); }, [initial, spec.pct]);
  return (
    <div className="rounded-2xl bg-white/40 p-3">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{spec.label}</label>
      <div className="flex items-center gap-2 mt-1">
        <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal"
          className="flex-1 rounded-full bg-white border border-border px-3 py-2 text-sm font-mono" />
        {spec.pct && <span className="text-xs text-muted-foreground">%</span>}
        <button
          onClick={() => {
            const n = parseFloat(val);
            if (Number.isNaN(n) || n < 0) return toast.error("Invalid number");
            onSave(spec.pct ? n / 100 : n);
          }}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-primary text-primary-foreground px-3 py-2 text-xs font-semibold shadow-soft">
          <Save className="w-3 h-3" /> Save
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{spec.help}</div>
    </div>
  );
}

function BankForm({ onSubmit }: { onSubmit: (p: { bank_name: string; account_name: string; account_number: string; instructions?: string; is_active: boolean }) => Promise<void> }) {
  const [form, setForm] = useState({ bank_name: "", account_name: "", account_number: "", instructions: "" });
  const submit = async () => {
    if (!/^\d{10}$/.test(form.account_number)) return toast.error("Account number must be 10 digits");
    await onSubmit({ ...form, is_active: true, instructions: form.instructions || undefined });
    setForm({ bank_name: "", account_name: "", account_number: "", instructions: "" });
  };
  return (
    <div className="grid md:grid-cols-4 gap-2">
      <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Bank name"
        className="rounded-full bg-white border border-border px-3 py-2 text-sm" />
      <input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="Account name"
        className="rounded-full bg-white border border-border px-3 py-2 text-sm" />
      <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="10-digit NUBAN"
        className="rounded-full bg-white border border-border px-3 py-2 text-sm font-mono" />
      <div className="flex gap-2">
        <input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Instructions (optional)"
          className="flex-1 rounded-full bg-white border border-border px-3 py-2 text-sm" />
        <button onClick={submit} className="inline-flex items-center gap-1 rounded-full bg-gradient-primary text-primary-foreground px-3 text-xs font-semibold shadow-soft">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}
