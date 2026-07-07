
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.kyc_status AS ENUM ('unverified','pending','approved','rejected');
CREATE TYPE public.tx_type AS ENUM ('deposit','withdrawal','mining_reward','referral_reward','plan_purchase','adjustment','transfer');
CREATE TYPE public.tx_status AS ENUM ('pending','processing','completed','rejected','cancelled');
CREATE TYPE public.ticket_status AS ENUM ('open','pending','resolved','closed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  referral_code TEXT UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text),1,8)),
  referred_by UUID REFERENCES auth.users(id),
  kyc_status public.kyc_status NOT NULL DEFAULT 'unverified',
  two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
  language TEXT NOT NULL DEFAULT 'en',
  currency TEXT NOT NULL DEFAULT 'USD',
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Profile policies
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- User role policies (only admins manage; user can read own)
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_earned NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(20,8) NOT NULL DEFAULT 0,
  referral_earned NUMERIC(20,8) NOT NULL DEFAULT 0,
  hash_rate NUMERIC(20,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_select_own_or_admin" ON public.wallets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ MINING PLANS ============
CREATE TABLE public.mining_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  price NUMERIC(20,2) NOT NULL,
  duration_days INT NOT NULL,
  hash_rate NUMERIC(20,4) NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  power_watts INT NOT NULL DEFAULT 0,
  maintenance_fee_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  daily_earnings NUMERIC(20,4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  badge TEXT,
  color TEXT DEFAULT 'primary',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mining_plans TO authenticated, anon;
GRANT ALL ON public.mining_plans TO service_role;
ALTER TABLE public.mining_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_all" ON public.mining_plans FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "plans_admin_write" ON public.mining_plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ MINING CONTRACTS ============
CREATE TABLE public.mining_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.mining_plans(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  price_paid NUMERIC(20,2) NOT NULL,
  hash_rate NUMERIC(20,4) NOT NULL,
  daily_earnings NUMERIC(20,4) NOT NULL,
  accrued NUMERIC(20,8) NOT NULL DEFAULT 0,
  last_accrued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX ON public.mining_contracts(user_id);
GRANT SELECT ON public.mining_contracts TO authenticated;
GRANT ALL ON public.mining_contracts TO service_role;
ALTER TABLE public.mining_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_select_own_or_admin" ON public.mining_contracts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'completed',
  amount NUMERIC(20,8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  reference_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transactions(user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select_own_or_admin" ON public.transactions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ DEPOSITS ============
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  network TEXT,
  amount NUMERIC(20,8) NOT NULL,
  usd_value NUMERIC(20,2),
  tx_hash TEXT,
  wallet_address TEXT NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX ON public.deposits(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_select_own_or_admin" ON public.deposits FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "deposits_insert_own" ON public.deposits FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_admin_update" ON public.deposits FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ WITHDRAWALS ============
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  network TEXT,
  amount NUMERIC(20,8) NOT NULL,
  fee NUMERIC(20,8) NOT NULL DEFAULT 0,
  wallet_address TEXT NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX ON public.withdrawals(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_select_own_or_admin" ON public.withdrawals FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wd_insert_own" ON public.withdrawals FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "wd_admin_update" ON public.withdrawals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SAVED WALLETS (withdrawal addresses) ============
CREATE TABLE public.saved_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  currency TEXT NOT NULL,
  network TEXT,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.saved_wallets TO authenticated;
GRANT ALL ON public.saved_wallets TO service_role;
ALTER TABLE public.saved_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sw_own" ON public.saved_wallets FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ REFERRALS ============
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1,
  total_commission NUMERIC(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);
CREATE INDEX ON public.referrals(referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_select_own_or_admin" ON public.referrals FOR SELECT TO authenticated
USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ KYC SUBMISSIONS ============
CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  id_front_url TEXT,
  id_back_url TEXT,
  selfie_url TEXT,
  address_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_select_own_or_admin" ON public.kyc_submissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_admin_update" ON public.kyc_submissions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_select_own_or_admin" ON public.support_tickets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ticket_insert_own" ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "ticket_update_own_or_admin" ON public.support_tickets FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ticket_messages(ticket_id, created_at);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm_select_own_or_admin" ON public.ticket_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "tm_insert_participant" ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_read BOOLEAN NOT NULL DEFAULT false,
  broadcast BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own_or_broadcast" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR broadcast = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ NEWS ============
CREATE TABLE public.news_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_feed TO authenticated, anon;
GRANT ALL ON public.news_feed TO service_role;
ALTER TABLE public.news_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_read_all" ON public.news_feed FOR SELECT TO authenticated, anon USING (true);

-- ============ CRYPTO PRICES ============
CREATE TABLE public.crypto_prices (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_usd NUMERIC(20,4) NOT NULL,
  change_24h NUMERIC(10,4) NOT NULL DEFAULT 0,
  market_cap NUMERIC(30,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crypto_prices TO authenticated, anon;
GRANT ALL ON public.crypto_prices TO service_role;
ALTER TABLE public.crypto_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prices_read_all" ON public.crypto_prices FOR SELECT TO authenticated, anon USING (true);

-- ============ PLATFORM DEPOSIT ADDRESSES (admin managed) ============
CREATE TABLE public.deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  min_deposit NUMERIC(20,8) NOT NULL DEFAULT 0,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(currency, network)
);
GRANT SELECT ON public.deposit_addresses TO authenticated;
GRANT ALL ON public.deposit_addresses TO service_role;
ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "da_read_auth" ON public.deposit_addresses FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "da_admin_write" ON public.deposit_addresses FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + wallet + default role on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ref_code TEXT; ref_user UUID;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL THEN
    SELECT id INTO ref_user FROM public.profiles WHERE referral_code = upper(ref_code) LIMIT 1;
  END IF;
  INSERT INTO public.profiles(id, email, full_name, avatar_url, referred_by)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', ref_user);
  INSERT INTO public.wallets(user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  IF ref_user IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id) VALUES (ref_user, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
