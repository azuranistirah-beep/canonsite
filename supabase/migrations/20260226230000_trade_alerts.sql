-- Trade Alerts Module
-- Timestamp: 20260226230000

-- 1. Alert type enum
DROP TYPE IF EXISTS public.alert_type CASCADE;
CREATE TYPE public.alert_type AS ENUM ('success', 'error', 'warning', 'info');

-- 2. Trade Alerts Table
CREATE TABLE IF NOT EXISTS public.trade_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type public.alert_type NOT NULL DEFAULT 'info'::public.alert_type,
    message TEXT NOT NULL,
    trade_details JSONB,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_trade_alerts_user_id ON public.trade_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_alerts_created_at ON public.trade_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_alerts_read ON public.trade_alerts(user_id, read);

-- 4. Enable RLS
ALTER TABLE public.trade_alerts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_trade_alerts" ON public.trade_alerts;
CREATE POLICY "users_manage_own_trade_alerts"
ON public.trade_alerts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. Enable Realtime for trade_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_alerts;
