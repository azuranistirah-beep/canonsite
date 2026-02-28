-- Admin Panel Migration
-- Timestamp: 20260228210000

-- 1. Add is_admin column to user_profiles (idempotent)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Payment Bank Accounts Table
CREATE TABLE IF NOT EXISTS public.payment_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  swift_code TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Payment Instant Accounts Table
CREATE TABLE IF NOT EXISTS public.payment_instant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  account_info TEXT NOT NULL,
  currencies TEXT[] DEFAULT ARRAY['USD']::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Payment Crypto Wallets Table
CREATE TABLE IF NOT EXISTS public.payment_crypto_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crypto TEXT NOT NULL,
  network TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  qr_code_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Admin Activity Logs Table
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_payment_bank_accounts_currency ON public.payment_bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_payment_bank_accounts_status ON public.payment_bank_accounts(status);
CREATE INDEX IF NOT EXISTS idx_payment_instant_accounts_method ON public.payment_instant_accounts(method);
CREATE INDEX IF NOT EXISTS idx_payment_instant_accounts_status ON public.payment_instant_accounts(status);
CREATE INDEX IF NOT EXISTS idx_payment_crypto_wallets_crypto ON public.payment_crypto_wallets(crypto);
CREATE INDEX IF NOT EXISTS idx_payment_crypto_wallets_status ON public.payment_crypto_wallets(status);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings(key);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_id ON public.admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);

-- 8. Helper function: check if current user is admin (safe - queries user_profiles not itself)
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

-- 9. Enable RLS
ALTER TABLE public.payment_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instant_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for payment_bank_accounts
-- Members can read active bank accounts (for deposit modal)
DROP POLICY IF EXISTS "members_read_active_bank_accounts" ON public.payment_bank_accounts;
CREATE POLICY "members_read_active_bank_accounts"
ON public.payment_bank_accounts
FOR SELECT
TO authenticated
USING (status = 'active');

-- Admins can do full CRUD
DROP POLICY IF EXISTS "admins_manage_bank_accounts" ON public.payment_bank_accounts;
CREATE POLICY "admins_manage_bank_accounts"
ON public.payment_bank_accounts
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 11. RLS Policies for payment_instant_accounts
DROP POLICY IF EXISTS "members_read_active_instant_accounts" ON public.payment_instant_accounts;
CREATE POLICY "members_read_active_instant_accounts"
ON public.payment_instant_accounts
FOR SELECT
TO authenticated
USING (status = 'active');

DROP POLICY IF EXISTS "admins_manage_instant_accounts" ON public.payment_instant_accounts;
CREATE POLICY "admins_manage_instant_accounts"
ON public.payment_instant_accounts
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 12. RLS Policies for payment_crypto_wallets
DROP POLICY IF EXISTS "members_read_active_crypto_wallets" ON public.payment_crypto_wallets;
CREATE POLICY "members_read_active_crypto_wallets"
ON public.payment_crypto_wallets
FOR SELECT
TO authenticated
USING (status = 'active');

DROP POLICY IF EXISTS "admins_manage_crypto_wallets" ON public.payment_crypto_wallets;
CREATE POLICY "admins_manage_crypto_wallets"
ON public.payment_crypto_wallets
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 13. RLS Policies for platform_settings
DROP POLICY IF EXISTS "members_read_platform_settings" ON public.platform_settings;
CREATE POLICY "members_read_platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admins_manage_platform_settings" ON public.platform_settings;
CREATE POLICY "admins_manage_platform_settings"
ON public.platform_settings
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 14. RLS Policies for admin_activity_logs
DROP POLICY IF EXISTS "admins_manage_activity_logs" ON public.admin_activity_logs;
CREATE POLICY "admins_manage_activity_logs"
ON public.admin_activity_logs
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 15. Update triggers for payment tables
CREATE OR REPLACE FUNCTION public.update_payment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_payment_bank_accounts_updated_at ON public.payment_bank_accounts;
CREATE TRIGGER update_payment_bank_accounts_updated_at
  BEFORE UPDATE ON public.payment_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_updated_at();

DROP TRIGGER IF EXISTS update_payment_instant_accounts_updated_at ON public.payment_instant_accounts;
CREATE TRIGGER update_payment_instant_accounts_updated_at
  BEFORE UPDATE ON public.payment_instant_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_updated_at();

DROP TRIGGER IF EXISTS update_payment_crypto_wallets_updated_at ON public.payment_crypto_wallets;
CREATE TRIGGER update_payment_crypto_wallets_updated_at
  BEFORE UPDATE ON public.payment_crypto_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_updated_at();

-- 16. Also update user_profiles RLS to allow admins to read all profiles
DROP POLICY IF EXISTS "admins_read_all_user_profiles" ON public.user_profiles;
CREATE POLICY "admins_read_all_user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admins_update_all_user_profiles" ON public.user_profiles;
CREATE POLICY "admins_update_all_user_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin_user())
WITH CHECK (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admins_delete_user_profiles" ON public.user_profiles;
CREATE POLICY "admins_delete_user_profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- Allow admins to read all deposit_requests
DROP POLICY IF EXISTS "admins_read_all_deposit_requests" ON public.deposit_requests;
CREATE POLICY "admins_read_all_deposit_requests"
ON public.deposit_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admins_update_deposit_requests" ON public.deposit_requests;
CREATE POLICY "admins_update_deposit_requests"
ON public.deposit_requests
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Allow admins to read all withdrawal_requests
DROP POLICY IF EXISTS "admins_read_all_withdrawal_requests" ON public.withdrawal_requests;
CREATE POLICY "admins_read_all_withdrawal_requests"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admins_update_withdrawal_requests" ON public.withdrawal_requests;
CREATE POLICY "admins_update_withdrawal_requests"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Allow admins to read all trades
DROP POLICY IF EXISTS "admins_read_all_trades" ON public.trades;
CREATE POLICY "admins_read_all_trades"
ON public.trades
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- Allow admins to read all real_accounts
DROP POLICY IF EXISTS "admins_read_all_real_accounts" ON public.real_accounts;
CREATE POLICY "admins_read_all_real_accounts"
ON public.real_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admins_update_real_accounts" ON public.real_accounts;
CREATE POLICY "admins_update_real_accounts"
ON public.real_accounts
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Allow admins to read all demo_accounts
DROP POLICY IF EXISTS "admins_read_all_demo_accounts" ON public.demo_accounts;
CREATE POLICY "admins_read_all_demo_accounts"
ON public.demo_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admins_update_demo_accounts" ON public.demo_accounts;
CREATE POLICY "admins_update_demo_accounts"
ON public.demo_accounts
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 17. Storage policy: admins can view all deposit proofs
DROP POLICY IF EXISTS "Admins can view all deposit proofs" ON storage.objects;
CREATE POLICY "Admins can view all deposit proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deposit_proofs' AND public.is_admin_user());

-- 18. Default platform settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('min_deposit_usd', '10'),
  ('max_deposit_usd', '50000'),
  ('min_withdrawal_usd', '10'),
  ('max_withdrawal_usd', '10000'),
  ('deposit_fee_percent', '0'),
  ('withdrawal_fee_percent', '0'),
  ('trading_fee_percent', '0'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'Platform sedang dalam pemeliharaan. Silakan coba lagi nanti.'),
  ('payout_btc', '85'),
  ('payout_eth', '85'),
  ('payout_gold', '82'),
  ('payout_eurusd', '80'),
  ('trade_durations', '30,60,120,300,900'),
  ('trading_weekends', 'true')
ON CONFLICT (key) DO NOTHING;
