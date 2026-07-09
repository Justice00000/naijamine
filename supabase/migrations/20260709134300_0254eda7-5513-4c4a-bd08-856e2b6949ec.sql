
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all_auth" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.platform_settings(key, value) VALUES
  ('deposit_fee_pct', '0.02'::jsonb),
  ('withdrawal_fee_pct', '0.03'::jsonb),
  ('fx_spread_pct', '0.015'::jsonb),
  ('min_ngn_deposit', '1000'::jsonb),
  ('min_ngn_withdrawal', '5000'::jsonb);

CREATE TABLE public.fx_rates (
  currency TEXT PRIMARY KEY,
  rate_per_usd NUMERIC(20,6) NOT NULL,
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fx_rates TO anon, authenticated;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_read_public" ON public.fx_rates FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.fx_rates(currency, rate_per_usd, source) VALUES ('NGN', 1650, 'seed');

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_active BOOLEAN NOT NULL DEFAULT true,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_read_active" ON public.bank_accounts
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "bank_admin_write" ON public.bank_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  amount_usd NUMERIC(20,2) NOT NULL,
  reference_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_revenue TO authenticated;
GRANT ALL ON public.platform_revenue TO service_role;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenue_admin_only" ON public.platform_revenue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX platform_revenue_created_at_idx ON public.platform_revenue(created_at DESC);

ALTER TABLE public.deposits
  ADD COLUMN method TEXT NOT NULL DEFAULT 'crypto',
  ADD COLUMN ngn_amount NUMERIC(20,2),
  ADD COLUMN fx_rate NUMERIC(20,6),
  ADD COLUMN platform_fee_usd NUMERIC(20,2) DEFAULT 0,
  ADD COLUMN sender_name TEXT,
  ADD COLUMN proof_url TEXT,
  ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id);

ALTER TABLE public.deposits ALTER COLUMN currency DROP NOT NULL;
ALTER TABLE public.deposits ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE public.deposits ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE public.withdrawals
  ADD COLUMN method TEXT NOT NULL DEFAULT 'crypto',
  ADD COLUMN ngn_amount NUMERIC(20,2),
  ADD COLUMN fx_rate NUMERIC(20,6),
  ADD COLUMN platform_fee_usd NUMERIC(20,2) DEFAULT 0,
  ADD COLUMN bank_name TEXT,
  ADD COLUMN bank_account_number TEXT,
  ADD COLUMN bank_account_name TEXT;

ALTER TABLE public.withdrawals ALTER COLUMN currency DROP NOT NULL;
ALTER TABLE public.withdrawals ALTER COLUMN wallet_address DROP NOT NULL;

INSERT INTO public.bank_accounts (bank_name, account_name, account_number, instructions)
VALUES ('Opay', 'Nimbus Mining Ltd', '0000000000', 'Send the exact NGN amount and include your email in the transfer narration.');
