-- FINAL FIX: Drop all conflicting RLS policies on user_profiles and create simple ones
-- Also ensure support@investoft.com has is_admin=true and role='admin'

-- Step 1: Drop ALL existing policies on user_profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create simple, non-conflicting policies
CREATE POLICY "user_profiles_select_own"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "user_profiles_insert_own"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_update_own"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Step 4: Ensure support@investoft.com exists in auth.users with correct metadata
-- and has a user_profiles row with is_admin=true
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get the user ID for support@investoft.com
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'support@investoft.com'
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'User support@investoft.com not found in auth.users — skipping profile upsert';
    RETURN;
  END IF;

  RAISE NOTICE 'Found admin user ID: %', admin_user_id;

  -- Update raw_app_meta_data to include role=admin
  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'is_admin', true),
    updated_at = now()
  WHERE id = admin_user_id;

  RAISE NOTICE 'Updated auth.users metadata for support@investoft.com';

  -- Upsert user_profiles row with is_admin=true
  INSERT INTO public.user_profiles (id, email, is_admin, role)
  VALUES (
    admin_user_id,
    'support@investoft.com',
    true,
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      is_admin = true,
      role = 'admin',
      email = 'support@investoft.com';

  RAISE NOTICE 'Upserted user_profiles for support@investoft.com with is_admin=true';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in admin setup: %', SQLERRM;
END $$;
