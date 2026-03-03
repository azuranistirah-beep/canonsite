-- Migration: Definitive fix for user_profiles RLS policies
-- Drops ALL known policy names (from every previous migration) and recreates cleanly
-- Timestamp: 20260301020000

-- Step 1: Ensure is_admin_from_metadata function exists (SECURITY DEFINER, reads auth metadata - no circular dependency)
CREATE OR REPLACE FUNCTION public.is_admin_from_metadata()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_app_meta_data->>'role' = 'admin'
      OR au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'is_admin' = 'true'
    )
  )
$$;

-- Step 2: Enable RLS (idempotent)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL known policy names from every previous migration (exhaustive list)
DROP POLICY IF EXISTS "Users can select own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_read_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_update_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_delete_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "allow_own_select" ON public.user_profiles;
DROP POLICY IF EXISTS "allow_own_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "allow_own_update" ON public.user_profiles;
DROP POLICY IF EXISTS "allow_own_delete" ON public.user_profiles;

-- Step 4: Recreate clean policies
-- SELECT: user can read own row; admin (via auth metadata) can read all rows
CREATE POLICY "user_profiles_select"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin_from_metadata()
  );

-- INSERT: user can only insert their own row (auth.uid() must match id)
CREATE POLICY "user_profiles_insert"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: user can update own row; admin can update all
CREATE POLICY "user_profiles_update"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin_from_metadata())
  WITH CHECK (id = auth.uid() OR public.is_admin_from_metadata());

-- DELETE: only admins can delete profiles
CREATE POLICY "user_profiles_delete"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin_from_metadata());

-- Step 5: Ensure upsert_own_profile function exists (SECURITY DEFINER - bypasses RLS for safe profile creation)
CREATE OR REPLACE FUNCTION public.upsert_own_profile(
    p_full_name TEXT DEFAULT '',
    p_email TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    email TEXT,
    full_name TEXT,
    is_admin BOOLEAN,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_user_id UUID;
    v_email TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_email IS NOT NULL AND p_email <> '' THEN
        v_email := p_email;
    ELSE
        SELECT au.email INTO v_email
        FROM auth.users au
        WHERE au.id = v_user_id
        LIMIT 1;
    END IF;

    BEGIN
        INSERT INTO public.user_profiles (id, email, full_name, is_admin, role, created_at, updated_at)
        VALUES (
            v_user_id,
            v_email,
            COALESCE(NULLIF(p_full_name, ''), split_part(v_email, '@', 1)),
            false,
            'member'::public.user_role,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            updated_at = NOW();
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    RETURN QUERY
    SELECT
        up.id,
        up.email,
        up.full_name,
        up.is_admin,
        up.role::TEXT
    FROM public.user_profiles up
    WHERE up.id = v_user_id
    LIMIT 1;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.upsert_own_profile(TEXT, TEXT) TO authenticated;

-- Step 6: Ensure admin user has correct profile and auth metadata
DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'support@investoft.com' LIMIT 1;

    IF v_admin_id IS NOT NULL THEN
        -- Upsert admin profile
        INSERT INTO public.user_profiles (id, email, full_name, is_admin, role, created_at, updated_at)
        VALUES (
            v_admin_id,
            'support@investoft.com',
            'Admin',
            true,
            'admin'::public.user_role,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            is_admin = true,
            role = 'admin'::public.user_role,
            updated_at = NOW();

        -- Set auth metadata so is_admin_from_metadata() returns true
        UPDATE auth.users
        SET
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                || jsonb_build_object('role', 'admin', 'is_admin', 'true'),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                || jsonb_build_object('role', 'admin')
        WHERE id = v_admin_id;

        RAISE NOTICE 'Admin user updated: %', v_admin_id;
    ELSE
        RAISE NOTICE 'Admin user support@investoft.com not found in auth.users';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in admin setup: %', SQLERRM;
END $$;

-- Step 7: Backfill any auth.users missing a user_profiles row
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
        INSERT INTO public.user_profiles (id, email, full_name, is_admin, role, created_at, updated_at)
        VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'full_name', split_part(auth_user.email, '@', 1)),
            false,
            'member'::public.user_role,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
    RAISE NOTICE 'Backfill complete';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill error: %', SQLERRM;
END $$;
