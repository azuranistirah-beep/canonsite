-- Migration: Fix enum mismatch - ensure all user_profiles have valid user_role values
-- Also backfill any auth.users missing a profile row
-- Timestamp: 20260301010000

-- Step 1: Backfill any auth.users who still don't have a user_profiles row
-- (handles users who signed up before trigger, or where trigger failed)
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

-- Step 2: Ensure admin user support@investoft.com has correct is_admin=true and role='admin'
UPDATE public.user_profiles
SET
  is_admin = true,
  role = 'admin'::public.user_role,
  updated_at = NOW()
WHERE email = 'support@investoft.com';

-- Step 3: Ensure auth metadata has role=admin for middleware check
UPDATE auth.users
SET
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'is_admin', 'true'),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
WHERE email = 'support@investoft.com';
