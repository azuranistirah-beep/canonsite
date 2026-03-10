-- ============================================================
-- Fix Trades RLS — Simple Stable Model
-- Timestamp: 20260309170000
--
-- MODEL:
--   authenticated users SELECT only their own rows (user_id = auth.uid())
--   authenticated users INSERT only their own rows (user_id = auth.uid())
--   no extra conditions, no admin functions
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- ─── Drop ALL known trades policies ──────────────────────────────────────────
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

-- ─── SELECT: authenticated user sees only their own rows ─────────────────────
CREATE POLICY "trades_select_policy"
ON public.trades
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ─── INSERT: authenticated user inserts only their own row ───────────────────
CREATE POLICY "trades_insert_policy"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ─── UPDATE: authenticated user updates only their own rows ──────────────────
CREATE POLICY "trades_update_policy"
ON public.trades
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ─── DELETE: authenticated user deletes only their own rows ──────────────────
CREATE POLICY "trades_delete_policy"
ON public.trades
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
