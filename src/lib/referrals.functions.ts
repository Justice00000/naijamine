import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fallback referral claim: when a user signed up via Google OAuth (no metadata),
 * the client submits the ref code stored in sessionStorage. We link only if
 * the user has no referrer yet and the code belongs to another user.
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.trim().toUpperCase();

    const { data: me } = await supabase
      .from("profiles").select("id, referred_by, referral_code")
      .eq("id", userId).single();
    if (!me) throw new Error("Profile not found");
    if (me.referred_by) return { ok: true, alreadyLinked: true };
    if (me.referral_code?.toUpperCase() === code) {
      return { ok: false, reason: "self" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: refProfile } = await supabaseAdmin
      .from("profiles").select("id")
      .ilike("referral_code", code)
      .neq("id", userId)
      .maybeSingle();
    if (!refProfile) return { ok: false, reason: "not_found" };

    await supabaseAdmin.from("profiles")
      .update({ referred_by: refProfile.id })
      .eq("id", userId)
      .is("referred_by", null);

    await supabaseAdmin.from("referrals")
      .insert({ referrer_id: refProfile.id, referred_id: userId });

    await supabaseAdmin.from("notifications").insert({
      user_id: refProfile.id,
      title: "New referral joined",
      body: "Someone signed up using your referral link. You'll earn 5% on their plan purchases.",
      category: "referral",
    });

    return { ok: true, referrerId: refProfile.id };
  });
