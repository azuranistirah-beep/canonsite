-- Fix: Add auth.identities record for test@canonsite.com
-- Root cause: auth.users row exists but auth.identities is empty,
-- Supabase requires an identity record to authenticate with email/password
-- Timestamp: 20260226183000

DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Get the existing test user ID
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = 'test@canonsite.com'
    LIMIT 1;

    IF test_user_id IS NULL THEN
        RAISE NOTICE 'Test user test@canonsite.com not found in auth.users. Skipping.';
    ELSE
        -- Add identity record if it does not exist
        -- This is required for Supabase email/password authentication
        IF NOT EXISTS (
            SELECT 1 FROM auth.identities
            WHERE user_id = test_user_id
            AND provider = 'email'
        ) THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                provider_id,
                provider,
                identity_data,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                test_user_id,
                'test@canonsite.com',
                'email',
                jsonb_build_object(
                    'sub', test_user_id::TEXT,
                    'email', 'test@canonsite.com',
                    'email_verified', true,
                    'provider', 'email'
                ),
                now(),
                now(),
                now()
            );
            RAISE NOTICE 'Identity record created for test@canonsite.com (user_id: %)', test_user_id;
        ELSE
            RAISE NOTICE 'Identity record already exists for test@canonsite.com. Skipping.';
        END IF;

        -- Also ensure email_confirmed_at is set (required for login without email verification)
        UPDATE auth.users
        SET
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now()
        WHERE id = test_user_id
        AND email_confirmed_at IS NULL;

        RAISE NOTICE 'Fix complete for test@canonsite.com';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Fix failed: %', SQLERRM;
END $$;
