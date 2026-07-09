import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadSettings(supabase: any) {
  const { data } = await supabase.from("platform_settings").select("*");
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const v = typeof row.value === "number" ? row.value : Number(row.value);
    if (!Number.isNaN(v)) map[row.key] = v;
  }
  return {
    depositFeePct: map.deposit_fee_pct ?? 0.02,
    withdrawalFeePct: map.withdrawal_fee_pct ?? 0.03,
    fxSpreadPct: map.fx_spread_pct ?? 0.015,
    minNgnDeposit: map.min_ngn_deposit ?? 1000,
    minNgnWithdrawal: map.min_ngn_withdrawal ?? 5000,
  };
}

async function refreshFxIfStale(admin: any, currency = "NGN") {
  const { data: row } = await admin
    .from("fx_rates").select("*").eq("currency", currency).maybeSingle();
  const stale = !row || Date.now() - new Date(row.updated_at).getTime() > FX_TTL_MS;
  if (!stale) return Number(row.rate_per_usd);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const json: any = await res.json();
    const rate = Number(json?.rates?.[currency]);
    if (rate && rate > 0) {
      await admin.from("fx_rates").upsert({
        currency, rate_per_usd: rate, source: "open.er-api.com", updated_at: new Date().toISOString(),
      });
      return rate;
    }
  } catch {}
  return row ? Number(row.rate_per_usd) : 1650;
}

/** Public read: get live NGN quote (rate + fees). Authenticated to avoid abuse. */
export const getNgnQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rate = await refreshFxIfStale(supabaseAdmin, "NGN");
    const s = await loadSettings(context.supabase);
    return {
      ratePerUsd: rate,
      depositFeePct: s.depositFeePct,
      withdrawalFeePct: s.withdrawalFeePct,
      fxSpreadPct: s.fxSpreadPct,
      minNgnDeposit: s.minNgnDeposit,
      minNgnWithdrawal: s.minNgnWithdrawal,
    };
  });

/** User submits a Nigerian bank transfer deposit for admin approval. */
export const submitNgnDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      ngnAmount: z.number().positive().max(1_000_000_000),
      bankAccountId: z.string().uuid(),
      senderName: z.string().trim().min(2).max(120),
      proofUrl: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rate = await refreshFxIfStale(supabaseAdmin, "NGN");
    const s = await loadSettings(context.supabase);
    if (data.ngnAmount < s.minNgnDeposit) {
      throw new Error(`Minimum deposit is ₦${s.minNgnDeposit.toLocaleString()}`);
    }
    // Buy rate = rate + spread (user gets less USD per naira)
    const buyRate = rate * (1 + s.fxSpreadPct);
    const grossUsd = data.ngnAmount / buyRate;
    const feeUsd = grossUsd * s.depositFeePct;

    const { data: row, error } = await supabaseAdmin.from("deposits").insert({
      user_id: userId,
      method: "ngn_bank",
      currency: "NGN",
      ngn_amount: data.ngnAmount,
      fx_rate: buyRate,
      amount: data.ngnAmount,
      usd_value: Number((grossUsd - feeUsd).toFixed(2)),
      platform_fee_usd: Number(feeUsd.toFixed(2)),
      bank_account_id: data.bankAccountId,
      sender_name: data.senderName,
      proof_url: data.proofUrl ?? null,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);
    return { success: true, id: row.id, estimatedUsd: Number((grossUsd - feeUsd).toFixed(2)) };
  });

/** ADMIN: approve NGN deposit — credits USD wallet, records platform revenue. */
export const adminApproveNgnDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ depositId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dep, error } = await supabaseAdmin
      .from("deposits").update({ status: "completed", processed_at: new Date().toISOString() })
      .eq("id", data.depositId).select().single();
    if (error || !dep) throw new Error(error?.message ?? "Deposit not found");

    const creditUsd = Number(dep.usd_value ?? 0);
    const feeUsd = Number(dep.platform_fee_usd ?? 0);

    const { data: wallet } = await supabaseAdmin
      .from("wallets").select("*").eq("user_id", dep.user_id).single();
    if (wallet) {
      await supabaseAdmin.from("wallets").update({
        balance: Number(wallet.balance) + creditUsd,
        total_deposited: Number(wallet.total_deposited) + creditUsd,
        updated_at: new Date().toISOString(),
      }).eq("user_id", dep.user_id);
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: dep.user_id,
      type: "deposit",
      status: "completed",
      amount: creditUsd,
      currency: "USD",
      description: `NGN deposit ₦${Number(dep.ngn_amount).toLocaleString()} credited`,
      reference_id: dep.id,
      metadata: { ngn_amount: dep.ngn_amount, fx_rate: dep.fx_rate, fee_usd: feeUsd },
    });

    if (feeUsd > 0) {
      await supabaseAdmin.from("platform_revenue").insert({
        user_id: dep.user_id,
        source: "deposit_fee",
        amount_usd: feeUsd,
        reference_id: dep.id,
      });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: dep.user_id,
      title: "Deposit credited",
      body: `Your ₦${Number(dep.ngn_amount).toLocaleString()} deposit was credited as $${creditUsd.toFixed(2)}.`,
      category: "deposit",
    });

    return { success: true };
  });

/** User requests a Nigerian bank withdrawal. Amount is in USD, converted to NGN payout. */
export const requestNgnWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      usdAmount: z.number().positive().max(1_000_000),
      bankName: z.string().trim().min(2).max(120),
      accountNumber: z.string().trim().regex(/^\d{10}$/, "10-digit NUBAN required"),
      accountName: z.string().trim().min(2).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rate = await refreshFxIfStale(supabaseAdmin, "NGN");
    const s = await loadSettings(supabase);

    // Sell rate = rate - spread (user gets fewer naira per USD)
    const sellRate = rate * (1 - s.fxSpreadPct);
    const feeUsd = data.usdAmount * s.withdrawalFeePct;
    const netUsd = data.usdAmount - feeUsd;
    const ngnPayout = netUsd * sellRate;

    if (ngnPayout < s.minNgnWithdrawal) {
      throw new Error(`Minimum payout is ₦${s.minNgnWithdrawal.toLocaleString()} — try a larger amount.`);
    }

    const { data: wallet } = await supabase
      .from("wallets").select("*").eq("user_id", userId).single();
    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.balance) < data.usdAmount) {
      throw new Error(`Insufficient balance (need $${data.usdAmount.toFixed(2)})`);
    }

    const { data: wd, error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId,
      method: "ngn_bank",
      currency: "NGN",
      amount: data.usdAmount,
      fee: Number(feeUsd.toFixed(2)),
      platform_fee_usd: Number(feeUsd.toFixed(2)),
      ngn_amount: Number(ngnPayout.toFixed(2)),
      fx_rate: sellRate,
      bank_name: data.bankName,
      bank_account_number: data.accountNumber,
      bank_account_name: data.accountName,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);

    // Reserve full USD amount
    await supabaseAdmin.from("wallets").update({
      balance: Number(wallet.balance) - data.usdAmount,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "withdrawal",
      status: "pending",
      amount: -data.usdAmount,
      currency: "USD",
      description: `NGN withdrawal ₦${Number(ngnPayout).toLocaleString()} requested`,
      reference_id: wd.id,
      metadata: { ngn_amount: ngnPayout, fx_rate: sellRate, fee_usd: feeUsd },
    });

    return { success: true, id: wd.id, ngnPayout };
  });

/** ADMIN: mark NGN withdrawal as paid — records revenue. */
export const adminCompleteNgnWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ withdrawalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wd, error } = await supabaseAdmin.from("withdrawals")
      .update({ status: "completed", processed_at: new Date().toISOString() })
      .eq("id", data.withdrawalId).select().single();
    if (error || !wd) throw new Error(error?.message ?? "Not found");

    const feeUsd = Number(wd.platform_fee_usd ?? wd.fee ?? 0);

    const { data: wallet } = await supabaseAdmin.from("wallets").select("*").eq("user_id", wd.user_id).single();
    if (wallet) {
      await supabaseAdmin.from("wallets").update({
        total_withdrawn: Number(wallet.total_withdrawn) + Number(wd.amount),
        updated_at: new Date().toISOString(),
      }).eq("user_id", wd.user_id);
    }
    await supabaseAdmin.from("transactions")
      .update({ status: "completed" })
      .eq("reference_id", wd.id).eq("type", "withdrawal");

    if (feeUsd > 0) {
      await supabaseAdmin.from("platform_revenue").insert({
        user_id: wd.user_id,
        source: "withdrawal_fee",
        amount_usd: feeUsd,
        reference_id: wd.id,
      });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: wd.user_id,
      title: "Withdrawal paid",
      body: `Your ₦${Number(wd.ngn_amount).toLocaleString()} payout was sent to ${wd.bank_name}.`,
      category: "withdrawal",
    });

    return { success: true };
  });

/** ADMIN: manage bank accounts (create/update/toggle). */
export const adminUpsertBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      bank_name: z.string().trim().min(2).max(80),
      account_name: z.string().trim().min(2).max(120),
      account_number: z.string().trim().regex(/^\d{10}$/),
      instructions: z.string().trim().max(500).optional(),
      is_active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      await supabaseAdmin.from("bank_accounts").update({
        bank_name: data.bank_name,
        account_name: data.account_name,
        account_number: data.account_number,
        instructions: data.instructions ?? null,
        is_active: data.is_active ?? true,
      }).eq("id", data.id);
      return { success: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("bank_accounts").insert({
      bank_name: data.bank_name,
      account_name: data.account_name,
      account_number: data.account_number,
      instructions: data.instructions ?? null,
      is_active: data.is_active ?? true,
    }).select().single();
    if (error) throw new Error(error.message);
    return { success: true, id: row.id };
  });

/** ADMIN: update platform settings (fee %, spread, minimums). */
export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      key: z.enum(["deposit_fee_pct", "withdrawal_fee_pct", "fx_spread_pct", "min_ngn_deposit", "min_ngn_withdrawal"]),
      value: z.number().min(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("platform_settings").upsert({
      key: data.key,
      value: data.value as any,
      updated_at: new Date().toISOString(),
    });
    return { success: true };
  });
