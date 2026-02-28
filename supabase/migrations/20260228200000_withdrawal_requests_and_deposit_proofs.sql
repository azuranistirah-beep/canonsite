-- Add proof_url column to deposit_requests
ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  withdrawal_method TEXT NOT NULL,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  bank_swift_code TEXT,
  crypto_wallet_address TEXT,
  crypto_network TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests(created_at DESC);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_withdrawal_requests" ON public.withdrawal_requests;
CREATE POLICY "users_manage_own_withdrawal_requests"
ON public.withdrawal_requests
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create deposit_proofs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deposit_proofs',
  'deposit_proofs',
  false,
  5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for deposit_proofs
DROP POLICY IF EXISTS "Users can upload deposit proofs" ON storage.objects;
CREATE POLICY "Users can upload deposit proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deposit_proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can view own deposit proofs" ON storage.objects;
CREATE POLICY "Users can view own deposit proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deposit_proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
