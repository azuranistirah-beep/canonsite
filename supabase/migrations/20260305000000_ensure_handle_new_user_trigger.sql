-- Migration: Ensure handle_new_user trigger is active and admin RLS policy exists
-- This migration is idempotent and safe to run multiple times

-- Step 1: Recreate trigger function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, is_admin)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Step 2: Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Backfill any auth.users who don't have a user_profiles row
DO $$
DECLARE
    auth_user RECORD;
BEGIN
    FOR auth_user IN
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        INSERT INTO public.user_profiles (id, email, full_name, is_admin)
        VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'full_name', split_part(auth_user.email, '@', 1)),
            COALESCE((auth_user.raw_user_meta_data->>'is_admin')::boolean, false)
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
    RAISE NOTICE 'Backfill complete';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill error: %', SQLERRM;
END $$;

-- Step 4: Ensure admin can read ALL user_profiles (not just their own)
-- Drop old restrictive policy first
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "user_update_own_profile" ON public.user_profiles;

-- Allow users to read their own profile
CREATE POLICY "user_read_own_profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND (up.is_admin = true OR up.role = 'admin')
        )
    );

-- Allow users to update their own profile
CREATE POLICY "user_update_own_profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Allow trigger (SECURITY DEFINER) to insert new profiles
-- The trigger function itself bypasses RLS, so no INSERT policy needed for clients
-- But allow users to insert their own profile as fallback
DROP POLICY IF EXISTS "user_insert_own_profile" ON public.user_profiles;
CREATE POLICY "user_insert_own_profile"
    ON public.user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
