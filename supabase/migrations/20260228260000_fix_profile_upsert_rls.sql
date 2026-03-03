-- Migration: Fix profile upsert RLS error
-- Problem: Client-side upsert into user_profiles fails with RLS violation
--   when the INSERT policy blocks the operation or email unique constraint conflicts.
-- Solution: SECURITY DEFINER function that runs as postgres (bypasses RLS)
--   and safely upserts the calling user's own profile.

-- Function: upsert_own_profile
-- Called by authenticated users to create/update their own profile row.
-- SECURITY DEFINER: runs as the function owner (bypasses RLS).
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
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
BEGIN
    -- Get the calling user's ID from auth context
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Resolve email: use provided email or look up from auth.users
    IF p_email IS NOT NULL AND p_email <> '' THEN
        v_email := p_email;
    ELSE
        SELECT au.email INTO v_email
        FROM auth.users au
        WHERE au.id = v_user_id
        LIMIT 1;
    END IF;

    -- Attempt to insert the profile row for this user
    -- ON CONFLICT (id): row already exists for this user ID, do nothing
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
            -- Email already exists for a different user ID — ignore, we'll return that row below
            NULL;
    END;

    -- Return the profile row (by id first, then by email as fallback)
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

    -- If no row found by id, try by email (handles mismatched UUID scenario)
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            up.id,
            up.email,
            up.full_name,
            up.is_admin,
            up.role::TEXT
        FROM public.user_profiles up
        WHERE up.email = v_email
        LIMIT 1;
    END IF;

END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_own_profile(TEXT, TEXT) TO authenticated;
