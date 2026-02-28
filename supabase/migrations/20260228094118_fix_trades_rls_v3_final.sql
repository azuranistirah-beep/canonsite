-- ============================================================
-- Fix Trades RLS 42501 — Definitive Fix (v3 final)
-- Timestamp: 20260228094118
--
-- ROOT CAUSE:
--   trades.user_id → FK → public.user_profiles.id
--   When a user signs up, no user_profiles row is created.
--   The FK constraint fails → Supabase surfaces it as RLS 42501.
--
-- FIX:
--   1. Trigger: auto-create user_profiles on auth.users INSERT
--   2. Trigger: auto-create demo_accounts + real_accounts on user_profiles INSERT
--   3. Backfill: create missing user_profiles for existing auth users
--   4. Backfill: create missing demo/real accounts for existing user_profiles
--   5. Recreate all RLS policies cleanly
-- ============================================================

-- ─── Step 1: Trigger function — create user_profiles on new auth user ─────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, phone, avatar_url, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        'member'::public.user_role,
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'handle_new_user error: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ─── Step 2: Trigger function — create accounts on new user_profiles ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create demo account with default $10,000 balance
    INSERT INTO public.demo_accounts (user_id, balance, currency)
    VALUES (NEW.id, 10000.00, 'USD')
    ON CONFLICT DO NOTHING;

    -- Create real account with $0 balance
    INSERT INTO public.real_accounts (user_id, balance, currency)
    VALUES (NEW.id, 0.00, 'USD')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'handle_new_user_profile error: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Attach trigger to user_profiles
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();

-- ─── Step 3: Backfill — create user_profiles for existing auth users ──────────
DO $$
DECLARE
    auth_user RECORD;
BEGIN
    FOR auth_user IN
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
        )
    LOOP
        INSERT INTO public.user_profiles (id, email, full_name, phone, avatar_url, role, is_active)
        VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'full_name', ''),
            COALESCE(auth_user.raw_user_meta_data->>'phone', ''),
            COALESCE(auth_user.raw_user_meta_data->>'avatar_url', ''),
            'member'::public.user_role,
            true
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
    RAISE NOTICE 'Backfill user_profiles complete';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill user_profiles error: %', SQLERRM;
END $$;

-- ─── Step 4: Backfill — create missing demo/real accounts ────────────────────
DO $$
DECLARE
    profile RECORD;
BEGIN
    -- Backfill demo_accounts
    FOR profile IN
        SELECT up.id
        FROM public.user_profiles up
        WHERE NOT EXISTS (
            SELECT 1 FROM public.demo_accounts da WHERE da.user_id = up.id
        )
    LOOP
        INSERT INTO public.demo_accounts (user_id, balance, currency)
        VALUES (profile.id, 10000.00, 'USD')
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Backfill real_accounts
    FOR profile IN
        SELECT up.id
        FROM public.user_profiles up
        WHERE NOT EXISTS (
            SELECT 1 FROM public.real_accounts ra WHERE ra.user_id = up.id
        )
    LOOP
        INSERT INTO public.real_accounts (user_id, balance, currency)
        VALUES (profile.id, 0.00, 'USD')
        ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Backfill demo/real accounts complete';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill accounts error: %', SQLERRM;
END $$;

-- ─── Step 5: Enable RLS on all tables ────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

-- ─── Step 6: user_profiles RLS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;

CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ─── Step 7: trades RLS — drop ALL old policies, recreate clean ───────────────
DROP POLICY IF EXISTS "users_manage_own_trades" ON public.trades;
DROP POLICY IF EXISTS "trades_select_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_insert_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_update_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_delete_policy" ON public.trades;
DROP POLICY IF EXISTS "trades_all_policy" ON public.trades;

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

-- ─── Step 8: trade_alerts RLS ────────────────────────────────────────────────
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

-- ─── Step 9: demo_accounts RLS ───────────────────────────────────────────────
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

-- ─── Step 10: real_accounts RLS ──────────────────────────────────────────────
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

-- ─── Step 11: deposit_requests RLS ──────────────────────────────────────────
DROP POLICY IF EXISTS "users_manage_own_deposit_requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "deposit_requests_select_policy" ON public.deposit_requests;
DROP POLICY IF EXISTS "deposit_requests_insert_policy" ON public.deposit_requests;

CREATE POLICY "deposit_requests_select_policy"
ON public.deposit_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "deposit_requests_insert_policy"
ON public.deposit_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
