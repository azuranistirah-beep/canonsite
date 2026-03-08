-- Copy Trade Full Migration
-- Adds copy_trade_active, copy_trade_joined_at to user_profiles
-- Creates copy_trade_notifications table
-- RLS policies for users and admin

-- 1. Add columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS copy_trade_active BOOLEAN DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS copy_trade_joined_at TIMESTAMPTZ;

-- 2. Create copy_trade_notifications table
CREATE TABLE IF NOT EXISTS public.copy_trade_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('follow', 'unfollow')),
  balance_at_join NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_copy_trade_notif_user_id ON public.copy_trade_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trade_notif_created_at ON public.copy_trade_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copy_trade_notif_action ON public.copy_trade_notifications(action);

-- 4. Enable RLS
ALTER TABLE public.copy_trade_notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS: users can insert their own notifications
DROP POLICY IF EXISTS "users_insert_own_copy_trade_notif" ON public.copy_trade_notifications;
CREATE POLICY "users_insert_own_copy_trade_notif"
  ON public.copy_trade_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 6. RLS: users can read their own notifications
DROP POLICY IF EXISTS "users_read_own_copy_trade_notif" ON public.copy_trade_notifications;
CREATE POLICY "users_read_own_copy_trade_notif"
  ON public.copy_trade_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 7. RLS: admin can read all copy_trade_notifications
DROP POLICY IF EXISTS "admin_read_all_copy_trade_notif" ON public.copy_trade_notifications;
CREATE POLICY "admin_read_all_copy_trade_notif"
  ON public.copy_trade_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND (up.is_admin = true OR up.role = 'admin')
    )
  );

-- 8. RLS: users can update own copy_trade_active on user_profiles
-- (existing RLS policies on user_profiles should already allow this)
-- Add a specific policy if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
      AND policyname = 'users_update_own_copy_trade_active'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "users_update_own_copy_trade_active"
        ON public.user_profiles
        FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;
END;
$$;
