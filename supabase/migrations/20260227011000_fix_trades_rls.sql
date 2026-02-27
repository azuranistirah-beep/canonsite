-- Fix RLS Policies for trades and trade_alerts tables
-- Timestamp: 20260227011000

-- Ensure RLS is enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_alerts ENABLE ROW LEVEL SECURITY;

-- Re-apply trades RLS policies
DROP POLICY IF EXISTS "users_manage_own_trades" ON public.trades;
CREATE POLICY "users_manage_own_trades"
ON public.trades
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Re-apply trade_alerts RLS policies
DROP POLICY IF EXISTS "users_manage_own_trade_alerts" ON public.trade_alerts;
CREATE POLICY "users_manage_own_trade_alerts"
ON public.trade_alerts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
