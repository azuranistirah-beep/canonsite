-- Create test user account for testing purposes
-- Timestamp: 20260226182000

DO $$
DECLARE
    test_user_uuid UUID := gen_random_uuid();
BEGIN
    -- Check if test user already exists
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE email = 'test@canonsite.com'
    ) THEN
        -- Insert test user into auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_user_meta_data,
            raw_app_meta_data,
            is_sso_user,
            is_anonymous,
            confirmation_token,
            confirmation_sent_at,
            recovery_token,
            recovery_sent_at,
            email_change_token_new,
            email_change,
            email_change_sent_at,
            email_change_token_current,
            email_change_confirm_status,
            reauthentication_token,
            reauthentication_sent_at,
            phone,
            phone_change,
            phone_change_token,
            phone_change_sent_at
        ) VALUES (
            test_user_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'test@canonsite.com',
            crypt('TestingPassword123!', gen_salt('bf', 10)),
            now(),
            now(),
            now(),
            jsonb_build_object('full_name', 'Test User', 'phone', '081234567890'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false,
            false,
            '',
            null,
            '',
            null,
            '',
            '',
            null,
            '',
            0,
            '',
            null,
            null,
            '',
            '',
            null
        );

        RAISE NOTICE 'Test user test@canonsite.com created successfully with UUID: %', test_user_uuid;
    ELSE
        RAISE NOTICE 'Test user test@canonsite.com already exists, skipping.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to create test user: %', SQLERRM;
END $$;
