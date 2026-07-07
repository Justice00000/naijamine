import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({ meta: [{ title: "Admin Plans — Nimbus" }] }),
  component: AdminPlans,
});

function AdminPlans() {
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await supabase.from("mining_plans").select("*").order("sort_order")).data ?? [],
  });

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("mining_plans").update({ is_active: !current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-plans"] });
    toast.success(current ? "Disabled" : "Enabled");
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">Mining plans</h1>
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr><th className="py-2">Name</th><th>Price</th><th>Duration</th><th>Hash</th><th>Daily $</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {plans.map((p: any) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2">{p.name} {p.badge && <span className="ml-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-gradient-gold text-gold-foreground">{p.badge}</span>}</td>
                  <td className="font-mono">${Number(p.price)}</td>
                  <td>{p.duration_days}d</td>
                  <td className="font-mono">{Number(p.hash_rate)} TH/s</td>
                  <td className="font-mono">${Number(p.daily_earnings)}</td>
                  <td>{p.is_active ? "✓" : "—"}</td>
                  <td className="text-right"><button onClick={() => toggle(p.id, p.is_active)} className="text-xs font-semibold text-primary">{p.is_active ? "Disable" : "Enable"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
