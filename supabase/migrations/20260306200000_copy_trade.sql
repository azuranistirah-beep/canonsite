-- Copy Trade Feature Migration
-- Adds copy_trade_followers table, copy_trade_active column, and platform settings

-- 1. Add copy_trade_active column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS copy_trade_active BOOLEAN DEFAULT false;

-- 2. Create copy_trade_followers table
CREATE TABLE IF NOT EXISTS public.copy_trade_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  stopped_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  balance_at_follow NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_copy_trade_followers_user_id ON public.copy_trade_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trade_followers_status ON public.copy_trade_followers(status);
CREATE INDEX IF NOT EXISTS idx_copy_trade_followers_followed_at ON public.copy_trade_followers(followed_at);

-- 4. Enable RLS
ALTER TABLE public.copy_trade_followers ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_copy_trade_followers" ON public.copy_trade_followers;
CREATE POLICY "users_manage_own_copy_trade_followers"
ON public.copy_trade_followers
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_read_all_copy_trade_followers" ON public.copy_trade_followers;
CREATE POLICY "admin_read_all_copy_trade_followers"
ON public.copy_trade_followers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND (up.is_admin = true OR up.role = 'admin')
  )
);

-- 6. Insert platform settings for copy trade
INSERT INTO public.platform_settings (key, value) VALUES
  ('copy_trade_enabled', 'true'),
  ('copy_trade_min_balance_usd', '1500'),
  ('copy_trade_win_ratio', '90'),
  ('copy_trade_automation_entry', 'Automated entry based on Investoft signals'),
  ('copy_trade_trading_ratio', '1:1')
ON CONFLICT (key) DO NOTHING;
