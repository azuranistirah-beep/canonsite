-- Fix Admin RLS Policies
-- Timestamp: 20260228220000
-- Purpose: Ensure admin users can properly access their own profile in middleware context

-- Drop potentially conflicting policies on user_profiles
DROP POLICY IF EXISTS "admins_read_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_update_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admins_delete_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;

-- Recreate base policy: users can manage their own profile
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can read ALL user profiles (uses is_admin_user() which is SECURITY DEFINER)
CREATE POLICY "admins_read_all_user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

-- Admins can update ALL user profiles
CREATE POLICY "admins_update_all_user_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin_user())
WITH CHECK (id = auth.uid() OR public.is_admin_user());

-- Admins can delete user profiles
CREATE POLICY "admins_delete_user_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- Ensure is_admin_user function exists and is correct (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin'::public.user_role OR is_admin = true)
  )
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
