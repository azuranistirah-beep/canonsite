-- Migration: Admin RLS for trades and real_accounts
-- Timestamp: 20260301040000

-- Allow admins to read all trades
DROP POLICY IF EXISTS "admins_read_all_trades" ON public.trades;
CREATE POLICY "admins_read_all_trades"
ON public.trades
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- Allow admins to update trades
DROP POLICY IF EXISTS "admins_update_trades" ON public.trades;
CREATE POLICY "admins_update_trades"
ON public.trades
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Allow admins to read all real_accounts
DROP POLICY IF EXISTS "admins_read_all_real_accounts" ON public.real_accounts;
CREATE POLICY "admins_read_all_real_accounts"
ON public.real_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- Allow admins to update real_accounts (for deposit approval balance update)
DROP POLICY IF EXISTS "admins_update_real_accounts" ON public.real_accounts;
CREATE POLICY "admins_update_real_accounts"
ON public.real_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user())
WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

-- Allow admins to insert real_accounts (in case account doesn't exist yet)
DROP POLICY IF EXISTS "admins_insert_real_accounts" ON public.real_accounts;
CREATE POLICY "admins_insert_real_accounts"
ON public.real_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin_user());
