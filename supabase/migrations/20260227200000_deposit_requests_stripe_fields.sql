-- Add Stripe fields to deposit_requests table
ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

CREATE INDEX IF NOT EXISTS idx_deposit_requests_stripe_session ON public.deposit_requests(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
