-- Migration: Final cleanup - remove conflicting RLS policy and ensure admin profile is correct
-- Timestamp: 20260301000000

-- Remove the old FOR ALL policy that conflicts with the newer split policies
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;

-- Ensure the correct split policies exist (idempotent)
-- These were created in 20260228270000 but we re-create them here to be safe
DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles'
    AND policyname = 'user_profiles_select'
  ) THEN
    CREATE POLICY "user_profiles_select"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (
        id = auth.uid()
        OR public.is_admin_from_metadata()
      );
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles'
    AND policyname = 'user_profiles_insert'
  ) THEN
    CREATE POLICY "user_profiles_insert"
      ON public.user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles'
    AND policyname = 'user_profiles_update'
  ) THEN
    CREATE POLICY "user_profiles_update"
      ON public.user_profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid() OR public.is_admin_from_metadata())
      WITH CHECK (id = auth.uid() OR public.is_admin_from_metadata());
  END IF;
END $$;

-- Ensure admin user has correct is_admin=true and role='admin'
UPDATE public.user_profiles
SET
  is_admin = true,
  role = 'admin'::public.user_role,
  updated_at = NOW()
WHERE email = 'support@investoft.com';

-- Ensure auth metadata has role=admin for middleware check
UPDATE auth.users
SET
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'is_admin', 'true')
WHERE email = 'support@investoft.com';
