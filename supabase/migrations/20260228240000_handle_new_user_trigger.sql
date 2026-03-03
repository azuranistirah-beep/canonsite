-- Migration: Add handle_new_user trigger to auto-create user_profiles
-- Fixes: INSERT RLS error (42501) caused by missing email field in manual insert
-- Solution: Trigger runs as SECURITY DEFINER (bypasses RLS), client never needs to INSERT

-- Step 1: Create trigger function (SECURITY DEFINER bypasses RLS)
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

-- Step 3: Backfill existing auth.users who don't have a user_profiles row
-- This fixes users who signed up before the trigger existed
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
    RAISE NOTICE 'Backfill complete: all auth.users now have user_profiles rows';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill error: %', SQLERRM;
END $$;

-- Step 4: Ensure RLS is enabled and policies are correct
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "Users can select own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;

-- Single comprehensive policy: authenticated users manage their own profile
CREATE POLICY "users_manage_own_user_profiles"
    ON public.user_profiles
    FOR ALL
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
