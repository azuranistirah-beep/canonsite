-- Trading Dashboard Module
-- Timestamp: 20260226181000

-- 1. Types
DROP TYPE IF EXISTS public.trade_direction CASCADE;
CREATE TYPE public.trade_direction AS ENUM ('buy', 'sell');

DROP TYPE IF EXISTS public.trade_status CASCADE;
CREATE TYPE public.trade_status AS ENUM ('pending', 'active', 'won', 'lost', 'cancelled');

DROP TYPE IF EXISTS public.account_type CASCADE;
CREATE TYPE public.account_type AS ENUM ('demo', 'real');

-- 2. Real Accounts Table
CREATE TABLE IF NOT EXISTS public.real_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Trades Table
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    account_type public.account_type NOT NULL DEFAULT 'demo'::public.account_type,
    asset_symbol TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    direction public.trade_direction NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    close_price DECIMAL(20,8),
    duration_seconds INTEGER NOT NULL,
    status public.trade_status DEFAULT 'pending'::public.trade_status,
    profit_loss DECIMAL(15,2) DEFAULT 0.00,
    opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_real_accounts_user_id ON public.real_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades(created_at DESC);

-- 5. Functions
CREATE OR REPLACE FUNCTION public.handle_new_real_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.real_accounts (user_id, balance, currency)
    VALUES (NEW.id, 0.00, 'USD')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_real_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- 6. Enable RLS
ALTER TABLE public.real_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_real_accounts" ON public.real_accounts;
CREATE POLICY "users_manage_own_real_accounts"
ON public.real_accounts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_trades" ON public.trades;
CREATE POLICY "users_manage_own_trades"
ON public.trades
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 8. Triggers
DROP TRIGGER IF EXISTS on_user_profile_created_real_account ON public.user_profiles;
CREATE TRIGGER on_user_profile_created_real_account
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_real_account();

DROP TRIGGER IF EXISTS update_real_accounts_updated_at ON public.real_accounts;
CREATE TRIGGER update_real_accounts_updated_at
    BEFORE UPDATE ON public.real_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_real_accounts_updated_at();
