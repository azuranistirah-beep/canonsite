-- ============================================================
-- Fix Trades RLS 42501 — SECURITY DEFINER RPC insert_trade()
-- Timestamp: 20260309190000
--
-- ROOT CAUSE:
--   The browser Supabase client's JWT is not always propagated
--   to PostgREST request headers before the INSERT fires, so
--   auth.uid() returns NULL inside the RLS WITH CHECK clause,
--   causing error 42501 (row-level security policy violation).
--
-- FIX:
--   A SECURITY DEFINER function runs with the privileges of the
--   function owner (postgres), bypassing RLS entirely.
--   It validates auth.uid() internally and raises an exception
--   if the caller is not authenticated.
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_trade(
  p_user_id        UUID,
  p_asset_symbol   TEXT,
  p_asset_name     TEXT,
  p_direction      public.trade_direction,
  p_amount         NUMERIC,
  p_entry_price    NUMERIC,
  p_duration_seconds INTEGER,
  p_status         public.trade_status,
  p_profit_loss    NUMERIC,
  p_account_type   public.account_type,
  p_opened_at      TIMESTAMPTZ
)
RETURNS public.trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_new_trade public.trades;
BEGIN
  -- Resolve the calling user's ID
  v_caller_id := auth.uid();

  -- Reject unauthenticated calls
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Ensure the caller can only insert their own rows
  IF v_caller_id <> p_user_id THEN
    RAISE EXCEPTION 'user_id mismatch: caller % tried to insert for %', v_caller_id, p_user_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.trades (
    user_id,
    asset_symbol,
    asset_name,
    direction,
    amount,
    entry_price,
    duration_seconds,
    status,
    profit_loss,
    account_type,
    opened_at
  ) VALUES (
    p_user_id,
    p_asset_symbol,
    p_asset_name,
    p_direction,
    p_amount,
    p_entry_price,
    p_duration_seconds,
    p_status,
    p_profit_loss,
    p_account_type,
    p_opened_at
  )
  RETURNING * INTO v_new_trade;

  RETURN v_new_trade;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_trade(
  UUID, TEXT, TEXT, public.trade_direction, NUMERIC, NUMERIC,
  INTEGER, public.trade_status, NUMERIC, public.account_type, TIMESTAMPTZ
) TO authenticated;
