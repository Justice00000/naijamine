
-- Restrict platform_settings SELECT to admins only
DROP POLICY IF EXISTS settings_read_all_auth ON public.platform_settings;
CREATE POLICY settings_read_admin ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Harden broadcast notifications: readable only when user_id is null (true broadcast)
DROP POLICY IF EXISTS notif_select_own_or_broadcast ON public.notifications;
CREATE POLICY notif_select_own_or_broadcast ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (broadcast = true AND user_id IS NULL)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Add explicit deny-by-default write policies for mining_contracts (documents intent;
-- all legitimate writes go through the service role which bypasses RLS)
CREATE POLICY contracts_no_client_insert ON public.mining_contracts
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY contracts_no_client_update ON public.mining_contracts
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY contracts_no_client_delete ON public.mining_contracts
  FOR DELETE TO authenticated USING (false);
