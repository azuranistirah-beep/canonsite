-- Migration: Fix admin user profile for correct user ID
-- The user support@investoft.com has a different auth.uid() than previously recorded
-- This migration ensures the correct user has is_admin=true and role='admin'
-- It handles both: updating existing profile if it exists, or inserting a new one

-- Step 1: Upsert the profile for the correct user ID
-- Using ON CONFLICT to handle both insert and update cases
INSERT INTO public.user_profiles (id, email, full_name, is_admin, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Admin'),
  true,
  'admin'::public.user_role,
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email = 'support@investoft.com'
ON CONFLICT (id) DO UPDATE SET
  is_admin = true,
  role = 'admin'::public.user_role,
  updated_at = NOW();

-- Step 2: Also ensure any old profile rows for this email are updated
-- (in case there are multiple rows with different IDs for the same email)
UPDATE public.user_profiles
SET 
  is_admin = true,
  role = 'admin'::public.user_role,
  updated_at = NOW()
WHERE email = 'support@investoft.com';

-- Verify the result
-- SELECT id, email, is_admin, role FROM public.user_profiles WHERE email = 'support@investoft.com';
