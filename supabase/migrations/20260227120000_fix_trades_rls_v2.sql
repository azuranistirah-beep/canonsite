-- Fix trades RLS policy violation (error code 42501)
-- Timestamp: 20260227120000
-- Root cause: RLS policy may not be applied correctly, recreating all policies

-- Ensure RLS is enabled on all trading tables
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_accounts ENABLE ROW LEVEL SECURITY;

-- ─── trades table ────────────────────────────────────────────────────────────
-- Drop ALL existing policies on trades to start clean
DROP POLICY IF EXISTS "users_manage_own_trades" ON public.trades;
DROP POLICY IF EXISTS "trades_select_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_insert_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_update_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_delete_policy" ON public.trades;

-- Recreate with explicit per-operation policies to avoid any ambiguity
CREATE POLICY "trades_select_policy"
ON public.trades
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "trades_insert_policy"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "trades_update_policy"
ON public.trades
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "trades_delete_policy"
ON public.trades
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ─── trade_alerts table ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_manage_own_trade_alerts" ON public.trade_alerts;
DROP POLICY IF EXISTS "trade_alerts_select_policy" ON public.trade_alerts;
DROP POLICY IF EXISTS "trade_alerts_insert_policy" ON public.trade_alerts;
DROP POLICY IF EXISTS "trade_alerts_update_policy" ON public.trade_alerts;
DROP POLICY IF EXISTS "trade_alerts_delete_policy" ON public.trade_alerts;

CREATE POLICY "trade_alerts_select_policy"
ON public.trade_alerts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "trade_alerts_insert_policy"
ON public.trade_alerts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "trade_alerts_update_policy"
ON public.trade_alerts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "trade_alerts_delete_policy"
ON public.trade_alerts
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ─── real_accounts table ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_manage_own_real_accounts" ON public.real_accounts;
DROP POLICY IF EXISTS "real_accounts_select_policy" ON public.real_accounts;
DROP POLICY IF EXISTS "real_accounts_insert_policy" ON public.real_accounts;
DROP POLICY IF EXISTS "real_accounts_update_policy" ON public.real_accounts;

CREATE POLICY "real_accounts_select_policy"
ON public.real_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "real_accounts_insert_policy"
ON public.real_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "real_accounts_update_policy"
ON public.real_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ─── demo_accounts table ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_manage_own_demo_accounts" ON public.demo_accounts;
DROP POLICY IF EXISTS "demo_accounts_select_policy" ON public.demo_accounts;
DROP POLICY IF EXISTS "demo_accounts_insert_policy" ON public.demo_accounts;
DROP POLICY IF EXISTS "demo_accounts_update_policy" ON public.demo_accounts;

CREATE POLICY "demo_accounts_select_policy"
ON public.demo_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "demo_accounts_insert_policy"
ON public.demo_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "demo_accounts_update_policy"
ON public.demo_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
