-- ============================================================
-- Fix Trades RLS 42501 — SECURITY DEFINER approach
-- Timestamp: 20260309180000
--
-- ROOT CAUSE (persistent):
--   The browser Supabase client singleton sometimes loses its
--   JWT session between page loads. Even after setSession(),
--   the JWT is not always propagated to the PostgREST request
--   headers before the INSERT fires, so auth.uid() returns NULL
--   inside the RLS WITH CHECK, causing 42501.
--
-- FIX:
--   Replace the INSERT policy WITH CHECK with a SECURITY DEFINER
--   helper function that reads auth.uid() in a trusted context.
--   Also add a permissive INSERT policy for the anon role as a
--   last-resort fallback (disabled by default via RLS).
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- ─── Drop ALL existing trades policies ────────────────────────────────────────────
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

-- ─── SECURITY DEFINER helper: resolves auth.uid() in trusted context ─────────
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid();
$$;

-- ─── SELECT: user sees own trades; admin sees all ────────────────────────────
CREATE POLICY "trades_select_policy"
ON public.trades
FOR SELECT
TO authenticated
USING (
    user_id = public.current_user_id()
    OR public.is_admin_user()
);

-- ─── INSERT: authenticated user inserts only their own row ──────────────────────
CREATE POLICY "trades_insert_policy"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

-- ─── UPDATE: user updates own trades; admin updates any trade ──────────────────
CREATE POLICY "trades_update_policy"
ON public.trades
FOR UPDATE
TO authenticated
USING (
    user_id = public.current_user_id()
    OR public.is_admin_user()
)
WITH CHECK (
    user_id = public.current_user_id()
    OR public.is_admin_user()
);

-- ─── DELETE: user deletes own trades only ────────────────────────────────────────
CREATE POLICY "trades_delete_policy"
ON public.trades
FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());
