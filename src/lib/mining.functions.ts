import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Buy a mining plan. Deducts plan.price from wallet balance, creates a contract,
 * records a plan_purchase transaction, and pays a 5% referral commission if applicable.
 */
export const buyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error: planErr } = await supabase
      .from("mining_plans").select("*").eq("id", data.planId).single();
    if (planErr || !plan) throw new Error("Plan not found");
    if (!plan.is_active) throw new Error("Plan is not active");

    const { data: wallet, error: wErr } = await supabase
      .from("wallets").select("*").eq("user_id", userId).single();
    if (wErr || !wallet) throw new Error("Wallet not found");

    if (Number(wallet.balance) < Number(plan.price)) {
      throw new Error("Insufficient balance. Deposit funds first.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const expiresAt = new Date(Date.now() + plan.duration_days * 86400000).toISOString();

    const { data: contract, error: cErr } = await supabaseAdmin
      .from("mining_contracts")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        expires_at: expiresAt,
        price_paid: plan.price,
        hash_rate: plan.hash_rate,
        daily_earnings: plan.daily_earnings,
      })
      .select().single();
    if (cErr) throw new Error(cErr.message);

    await supabaseAdmin.from("wallets").update({
      balance: Number(wallet.balance) - Number(plan.price),
      hash_rate: Number(wallet.hash_rate) + Number(plan.hash_rate),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "plan_purchase",
      status: "completed",
      amount: -Number(plan.price),
      description: `Purchased ${plan.name}`,
      reference_id: contract.id,
    });

    // Referral commission (5%)
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("referred_by").eq("id", userId).single();
    if (profile?.referred_by) {
      const commission = Number(plan.price) * 0.05;
      await supabaseAdmin.rpc; // no-op line for readability
      const { data: refWallet } = await supabaseAdmin
        .from("wallets").select("*").eq("user_id", profile.referred_by).single();
      if (refWallet) {
        await supabaseAdmin.from("wallets").update({
          balance: Number(refWallet.balance) + commission,
          referral_earned: Number(refWallet.referral_earned) + commission,
          updated_at: new Date().toISOString(),
        }).eq("user_id", profile.referred_by);
        await supabaseAdmin.from("transactions").insert({
          user_id: profile.referred_by,
          type: "referral_reward",
          status: "completed",
          amount: commission,
          description: `Referral commission (5%)`,
          reference_id: userId,
        });
        await supabaseAdmin.from("referrals").update({
          total_commission: commission,
        }).eq("referrer_id", profile.referred_by).eq("referred_id", userId);
        await supabaseAdmin.from("notifications").insert({
          user_id: profile.referred_by,
          title: "Referral reward received",
          body: `You earned $${commission.toFixed(2)} from a referral purchase.`,
          category: "referral",
        });
      }
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Mining contract activated",
      body: `${plan.name} is now mining at ${plan.hash_rate} TH/s.`,
      category: "mining",
    });

    return { success: true, contractId: contract.id };
  });

/** Compute and claim mining earnings across active contracts. Credits wallet. */
export const claimEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const { data: contracts } = await supabase
      .from("mining_contracts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active");

    let totalPending = 0;
    const now = Date.now();
    const updates: { id: string; accrued: number; last: string }[] = [];

    for (const c of contracts ?? []) {
      const last = new Date(c.last_accrued_at).getTime();
      const end = new Date(c.expires_at).getTime();
      const cap = Math.min(now, end);
      if (cap <= last) continue;
      const elapsedDays = (cap - last) / 86400000;
      const daily = Number(c.daily_earnings);
      const feePct = 0; // maintenance already netted in daily_earnings for simplicity
      const pending = elapsedDays * daily * (1 - feePct);
      if (pending > 0) {
        totalPending += pending;
        updates.push({ id: c.id, accrued: Number(c.accrued) + pending, last: new Date(cap).toISOString() });
      }
    }

    if (totalPending <= 0) return { credited: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const u of updates) {
      await supabaseAdmin.from("mining_contracts").update({
        accrued: u.accrued,
        last_accrued_at: u.last,
      }).eq("id", u.id);
    }

    const { data: wallet } = await supabaseAdmin
      .from("wallets").select("*").eq("user_id", userId).single();
    if (wallet) {
      await supabaseAdmin.from("wallets").update({
        balance: Number(wallet.balance) + totalPending,
        total_earned: Number(wallet.total_earned) + totalPending,
        updated_at: nowIso,
      }).eq("user_id", userId);
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "mining_reward",
      status: "completed",
      amount: totalPending,
      description: `Claimed mining earnings`,
    });

    // Expire contracts past their end date
    await supabaseAdmin.from("mining_contracts")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .lt("expires_at", nowIso)
      .eq("status", "active");

    return { credited: totalPending };
  });

/** Request a withdrawal — inserts pending row and reserves the amount. */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    currency: z.string().min(2).max(10),
    network: z.string().min(2).max(20),
    address: z.string().min(6).max(120),
    amount: z.number().positive().max(1_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wallet } = await supabase
      .from("wallets").select("*").eq("user_id", userId).single();
    if (!wallet) throw new Error("Wallet not found");
    const fee = Math.max(1, data.amount * 0.01);
    const total = data.amount + fee;
    if (Number(wallet.balance) < total) throw new Error(`Insufficient balance (need $${total.toFixed(2)} inc. fee)`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wd, error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId,
      currency: data.currency,
      network: data.network,
      wallet_address: data.address,
      amount: data.amount,
      fee,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("wallets").update({
      balance: Number(wallet.balance) - total,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "withdrawal",
      status: "pending",
      amount: -data.amount,
      currency: data.currency,
      description: `Withdrawal request (${data.currency} ${data.network})`,
      reference_id: wd.id,
    });

    return { success: true, id: wd.id };
  });

/** Submit a deposit claim (user reports they sent funds). */
export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    currency: z.string(),
    network: z.string(),
    address: z.string(),
    amount: z.number().positive(),
    txHash: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("deposits").insert({
      user_id: userId,
      currency: data.currency,
      network: data.network,
      wallet_address: data.address,
      amount: data.amount,
      tx_hash: data.txHash,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);
    return { success: true, id: row.id };
  });

/** ADMIN: approve deposit. Credits wallet and creates completed transaction. */
export const adminApproveDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    depositId: z.string().uuid(),
    usdValue: z.number().positive(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dep, error } = await supabaseAdmin.from("deposits")
      .update({ status: "completed", usd_value: data.usdValue, processed_at: new Date().toISOString() })
      .eq("id", data.depositId).select().single();
    if (error || !dep) throw new Error(error?.message ?? "Deposit not found");

    const { data: wallet } = await supabaseAdmin.from("wallets").select("*").eq("user_id", dep.user_id).single();
    if (wallet) {
      await supabaseAdmin.from("wallets").update({
        balance: Number(wallet.balance) + data.usdValue,
        total_deposited: Number(wallet.total_deposited) + data.usdValue,
        updated_at: new Date().toISOString(),
      }).eq("user_id", dep.user_id);
    }
    await supabaseAdmin.from("transactions").insert({
      user_id: dep.user_id,
      type: "deposit",
      status: "completed",
      amount: data.usdValue,
      currency: dep.currency ?? "USD",
      description: `Deposit approved (${dep.currency})`,
      reference_id: dep.id,
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: dep.user_id,
      title: "Deposit credited",
      body: `Your ${dep.currency} deposit worth $${data.usdValue.toFixed(2)} has been credited.`,
      category: "deposit",
    });
    return { success: true };
  });

export const adminRejectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ depositId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("deposits").update({ status: "rejected", processed_at: new Date().toISOString() }).eq("id", data.depositId);
    return { success: true };
  });

/** ADMIN: approve withdrawal — funds already reserved on request. */
export const adminApproveWithdrawal = createServerFn({ method: "POST" })
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
    await supabaseAdmin.from("notifications").insert({
      user_id: wd.user_id,
      title: "Withdrawal completed",
      body: `Your withdrawal of $${Number(wd.amount).toFixed(2)} ${wd.currency} was sent.`,
      category: "withdrawal",
    });
    return { success: true };
  });

export const adminRejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ withdrawalId: z.string().uuid(), notes: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wd, error } = await supabaseAdmin.from("withdrawals")
      .update({ status: "rejected", admin_notes: data.notes, processed_at: new Date().toISOString() })
      .eq("id", data.withdrawalId).select().single();
    if (error || !wd) throw new Error(error?.message ?? "Not found");
    // Refund reserved amount
    const total = Number(wd.amount) + Number(wd.fee);
    const { data: wallet } = await supabaseAdmin.from("wallets").select("*").eq("user_id", wd.user_id).single();
    if (wallet) {
      await supabaseAdmin.from("wallets").update({
        balance: Number(wallet.balance) + total,
        updated_at: new Date().toISOString(),
      }).eq("user_id", wd.user_id);
    }
    await supabaseAdmin.from("transactions")
      .update({ status: "rejected" })
      .eq("reference_id", wd.id).eq("type", "withdrawal");
    await supabaseAdmin.from("notifications").insert({
      user_id: wd.user_id,
      title: "Withdrawal rejected",
      body: data.notes ?? "Your withdrawal request was rejected. Funds have been returned.",
      category: "withdrawal",
    });
    return { success: true };
  });

/** ADMIN: KYC decision */
export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    submissionId: z.string().uuid(),
    approve: z.boolean(),
    notes: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.approve ? "approved" : "rejected";
    const { data: sub } = await supabaseAdmin.from("kyc_submissions")
      .update({ status, admin_notes: data.notes, reviewed_at: new Date().toISOString() })
      .eq("id", data.submissionId).select().single();
    if (sub) {
      await supabaseAdmin.from("profiles").update({ kyc_status: status }).eq("id", sub.user_id);
      await supabaseAdmin.from("notifications").insert({
        user_id: sub.user_id,
        title: data.approve ? "KYC approved" : "KYC rejected",
        body: data.approve ? "Your identity has been verified." : (data.notes ?? "Your KYC was rejected. Please try again."),
        category: "kyc",
      });
    }
    return { success: true };
  });

/** ADMIN: grant admin role */
export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetUserId: z.string().uuid(),
    role: z.enum(["admin", "user"]),
    revoke: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.revoke) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId).eq("role", data.role);
    } else {
      await supabaseAdmin.from("user_roles").insert({ user_id: data.targetUserId, role: data.role }).select();
    }
    return { success: true };
  });

/** ADMIN: adjust wallet balance manually */
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetUserId: z.string().uuid(),
    amount: z.number(),
    note: z.string().max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: w } = await supabaseAdmin.from("wallets").select("*").eq("user_id", data.targetUserId).single();
    if (!w) throw new Error("Wallet not found");
    await supabaseAdmin.from("wallets").update({
      balance: Number(w.balance) + data.amount,
      updated_at: new Date().toISOString(),
    }).eq("user_id", data.targetUserId);
    await supabaseAdmin.from("transactions").insert({
      user_id: data.targetUserId,
      type: "adjustment",
      status: "completed",
      amount: data.amount,
      description: `Admin adjustment: ${data.note}`,
    });
    return { success: true };
  });

/** ADMIN: broadcast notification */
export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(120),
    body: z.string().max(500).optional(),
    category: z.string().max(30).default("general"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      title: data.title,
      body: data.body,
      category: data.category,
      broadcast: true,
    });
    return { success: true };
  });
