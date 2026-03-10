-- ============================================================
-- Fix Trades RLS INSERT 42501 — Definitive Final
-- Timestamp: 20260309163757
--
-- ROOT CAUSE:
--   Conflicting/overlapping RLS policies on trades table from
--   multiple prior migrations leave the INSERT policy in an
--   inconsistent state, causing 42501 on trade insert.
--
-- FIX:
--   Drop ALL existing trades policies and recreate them cleanly.
--   Authenticated users can INSERT/SELECT/UPDATE their own rows.
--   Admins retain full SELECT and UPDATE access.
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- ─── Drop ALL existing trades policies ───────────────────────────────────────
DROP POLICY IF EXISTS "users_manage_own_trades"        ON public.trades;
DROP POLICY IF EXISTS "trades_select_policy"           ON public.trades;
DROP POLICY IF EXISTS "trades_insert_policy"           ON public.trades;
DROP POLICY IF EXISTS "trades_update_policy"           ON public.trades;
DROP POLICY IF EXISTS "trades_delete_policy"           ON public.trades;
DROP POLICY IF EXISTS "trades_all_policy"              ON public.trades;
DROP POLICY IF EXISTS "admins_read_all_trades"         ON public.trades;
DROP POLICY IF EXISTS "admins_update_trades"           ON public.trades;
DROP POLICY IF EXISTS "Users can insert own trades"    ON public.trades;
DROP POLICY IF EXISTS "Users can read own trades"      ON public.trades;
DROP POLICY IF EXISTS "Users can update own trades"    ON public.trades;
DROP POLICY IF EXISTS "Allow authenticated insert"     ON public.trades;
DROP POLICY IF EXISTS "insert_own_trades"              ON public.trades;

-- ─── SELECT: user sees own trades; admin sees all ────────────────────────────
CREATE POLICY "trades_select_policy"
ON public.trades
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_admin_user()
);

-- ─── INSERT: authenticated user inserts only their own row ───────────────────
CREATE POLICY "trades_insert_policy"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ─── UPDATE: user updates own trades; admin updates any trade ────────────────
CREATE POLICY "trades_update_policy"
ON public.trades
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_admin_user()
)
WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin_user()
);

-- ─── DELETE: user deletes own trades only ────────────────────────────────────
CREATE POLICY "trades_delete_policy"
ON public.trades
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
