import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, Send, HelpCircle } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const FAQ = [
  { q: "How long until my deposit is credited?", a: "Deposits are credited after network confirmations, usually within 10-30 minutes." },
  { q: "How does daily payout work?", a: "Each active contract accrues its daily rate every second. Claim from your dashboard to move earnings into your wallet." },
  { q: "What are the withdrawal limits?", a: "Verified accounts can withdraw up to $50,000 per day. Unverified accounts up to $500." },
  { q: "Do you actually mine on my phone?", a: "No. Nimbus is a cloud mining service — all mining runs in our data centers on your behalf." },
];

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support — Nimbus" }] }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tickets" | "faq">("tickets");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [first, setFirst] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("support_tickets").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false })).data ?? [],
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["ticket-msgs", selected],
    enabled: !!selected,
    queryFn: async () => (await supabase.from("ticket_messages").select("*").eq("ticket_id", selected).order("created_at")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("support_tickets").insert({ user_id: user!.id, subject, category }).select().single();
      if (error) throw error;
      if (first) {
        await supabase.from("ticket_messages").insert({ ticket_id: data.id, sender_id: user!.id, body: first });
      }
      return data.id as string;
    },
    onSuccess: (id) => {
      setSubject(""); setFirst("");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setSelected(id);
      toast.success("Ticket opened");
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!selected || !reply.trim()) return;
      await supabase.from("ticket_messages").insert({ ticket_id: selected, sender_id: user!.id, body: reply });
    },
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["ticket-msgs", selected] }); },
  });

  return (
    <AppShell>
      <PageHeader title="Support" subtitle="We're here 24/7 across email, chat, and social." />

      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab("tickets")} className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === "tickets" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-white border border-border"}`}>Tickets</button>
        <button onClick={() => setTab("faq")} className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === "faq" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-white border border-border"}`}>FAQ</button>
      </div>

      {tab === "faq" && (
        <div className="grid md:grid-cols-2 gap-3">
          {FAQ.map((f) => (
            <GlassCard key={f.q}>
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <div className="font-semibold text-sm">{f.q}</div>
                  <div className="text-xs text-muted-foreground mt-1">{f.a}</div>
                </div>
              </div>
            </GlassCard>
          ))}
          <GlassCard className="md:col-span-2 text-center py-6">
            <p className="text-sm text-muted-foreground">Still need help?</p>
            <div className="mt-2 flex flex-wrap gap-2 justify-center text-xs">
              <a className="rounded-full bg-white border border-border px-3 py-1.5 font-semibold" href="mailto:support@nimbus.mine">📧 support@nimbus.mine</a>
              <a className="rounded-full bg-white border border-border px-3 py-1.5 font-semibold" href="#">💬 Telegram</a>
              <a className="rounded-full bg-white border border-border px-3 py-1.5 font-semibold" href="#">🟢 WhatsApp</a>
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "tickets" && (
        <div className="grid md:grid-cols-[280px_1fr] gap-4">
          <div>
            <GlassCard>
              <h3 className="font-display font-bold mb-2 flex items-center gap-2 text-sm"><MessageSquarePlus className="w-4 h-4" /> New ticket</h3>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm mb-2" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm mb-2">
                <option value="general">General</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="mining">Mining</option>
                <option value="kyc">KYC</option>
              </select>
              <textarea value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Describe your issue…" rows={3} className="w-full rounded-xl bg-white/70 border border-border px-3 py-2 text-sm mb-2 resize-none" />
              <button onClick={() => create.mutate()} disabled={!subject || create.isPending} className="w-full rounded-full bg-gradient-primary text-primary-foreground py-2 text-xs font-semibold shadow-soft disabled:opacity-50">Open ticket</button>
            </GlassCard>
            <div className="mt-3 space-y-2">
              {tickets.map((t: any) => (
                <button key={t.id} onClick={() => setSelected(t.id)}
                  className={`w-full text-left glass rounded-2xl p-3 ${selected === t.id ? "ring-2 ring-primary" : ""}`}>
                  <div className="font-semibold text-sm truncate">{t.subject}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{t.status} · {t.category}</div>
                </button>
              ))}
            </div>
          </div>

          <GlassCard className="min-h-[400px] flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select or create a ticket</div>
            ) : (
              <>
                <div className="flex-1 space-y-2 overflow-auto max-h-[500px]">
                  {messages.map((m: any) => (
                    <div key={m.id} className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.is_admin ? "bg-muted" : "bg-gradient-primary text-primary-foreground"}`}>
                        {m.body}
                        <div className="text-[9px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply.mutate()} placeholder="Reply…"
                    className="flex-1 rounded-full bg-white/70 border border-border px-4 py-2 text-sm" />
                  <button onClick={() => sendReply.mutate()} className="rounded-full bg-gradient-primary text-primary-foreground w-10 h-10 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </GlassCard>
        </div>
      )}
    </AppShell>
  );
}
