-- Migration: Ensure test@canonsite.com member user exists
-- This is idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE

DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Check if test@canonsite.com already exists in auth.users
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'test@canonsite.com'
  LIMIT 1;

  -- If user does not exist, create them
  IF test_user_id IS NULL THEN
    test_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
      is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
      recovery_token, recovery_sent_at, email_change_token_new, email_change,
      email_change_sent_at, email_change_token_current, email_change_confirm_status,
      reauthentication_token, reauthentication_sent_at, phone, phone_change,
      phone_change_token, phone_change_sent_at
    ) VALUES (
      test_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'test@canonsite.com',
      crypt('Test@123456', gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      jsonb_build_object('full_name', 'Test Member', 'role', 'member'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created auth user test@canonsite.com with id: %', test_user_id;
  ELSE
    -- User exists -- ensure email is confirmed
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = test_user_id;

    RAISE NOTICE 'test@canonsite.com already exists with id: %', test_user_id;
  END IF;

  -- Ensure user_profiles row exists (only columns that exist in the table)
  INSERT INTO public.user_profiles (id, email, full_name, role, is_admin, is_active)
  VALUES (
    test_user_id,
    'test@canonsite.com',
    'Test Member',
    'member'::public.user_role,
    false,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'member'::public.user_role,
    is_admin = false,
    is_active = true
  ;

  -- Ensure demo_account exists for this user (check first to avoid duplicate)
  IF NOT EXISTS (
    SELECT 1 FROM public.demo_accounts WHERE user_id = test_user_id
  ) THEN
    INSERT INTO public.demo_accounts (user_id, balance, currency)
    VALUES (test_user_id, 10000.00, 'USD');
  END IF;

  -- Ensure real_account exists for this user (check first to avoid duplicate)
  IF NOT EXISTS (
    SELECT 1 FROM public.real_accounts WHERE user_id = test_user_id
  ) THEN
    INSERT INTO public.real_accounts (user_id, balance, currency)
    VALUES (test_user_id, 0.00, 'USD');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Migration error: %', SQLERRM;
END $$;
