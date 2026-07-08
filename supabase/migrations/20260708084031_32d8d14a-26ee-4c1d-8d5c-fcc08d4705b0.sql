CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ref_code TEXT;
  ref_user UUID;
  full_name_val TEXT;
  avatar_val TEXT;
BEGIN
  full_name_val := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  avatar_val := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  ref_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), '');
  IF ref_code IS NOT NULL THEN
    BEGIN
      SELECT id INTO ref_user
      FROM public.profiles
      WHERE upper(referral_code) = upper(ref_code)
        AND id <> NEW.id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      ref_user := NULL;
    END;
  END IF;

  INSERT INTO public.profiles(id, email, full_name, avatar_url, referred_by)
  VALUES (NEW.id, NEW.email, full_name_val, avatar_val, ref_user)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF ref_user IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id)
    VALUES (ref_user, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

INSERT INTO public.referrals(referrer_id, referred_id)
SELECT p.referred_by, p.id
FROM public.profiles p
WHERE p.referred_by IS NOT NULL
ON CONFLICT DO NOTHING;