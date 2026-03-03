-- Migration: Fix admin RLS - avoid circular recursion, use auth metadata for admin check
-- Timestamp: 20260228270000

-- Step 1: Create a SAFE is_admin function that reads from auth.users metadata
-- This avoids circular recursion when used on user_profiles table
CREATE OR REPLACE FUNCTION public.is_admin_from_metadata()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- Step 2: Create a SAFE is_admin function that reads from user_profiles
-- Safe to use on NON-user_profiles tables only
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin'::public.user_role OR is_admin = true)
  )
$$;

-- Step 3: Fix user_profiles RLS policies
-- Drop ALL existing policies to start clean
DROP POLICY IF EXISTS "Users can select own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_read_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_update_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_delete_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can read their own profile
-- Admins can read all profiles (using auth metadata to avoid recursion)
CREATE POLICY "user_profiles_select"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin_from_metadata()
  );

-- INSERT: Users can insert their own profile
CREATE POLICY "user_profiles_insert"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can update their own profile, admins can update all
CREATE POLICY "user_profiles_update"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin_from_metadata())
  WITH CHECK (id = auth.uid() OR public.is_admin_from_metadata());

-- DELETE: Only admins can delete profiles
CREATE POLICY "user_profiles_delete"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin_from_metadata());

-- Step 4: Set app_metadata role='admin' for support@investoft.com
-- This allows the is_admin_from_metadata() function to work in middleware
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'support@investoft.com'
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    -- Update raw_app_meta_data to include role=admin
    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'is_admin', 'true'),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
    WHERE id = admin_user_id;

    -- Also ensure user_profiles row has is_admin=true
    INSERT INTO public.user_profiles (id, email, full_name, is_admin, role, created_at, updated_at)
    VALUES (
      admin_user_id,
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

    RAISE NOTICE 'Admin user updated: %', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user support@investoft.com not found in auth.users';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating admin user: %', SQLERRM;
END $$;

-- Step 5: Also update by email in user_profiles (catch-all)
UPDATE public.user_profiles
SET
  is_admin = true,
  role = 'admin'::public.user_role,
  updated_at = NOW()
WHERE email = 'support@investoft.com';
