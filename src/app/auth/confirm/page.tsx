'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleConfirmation = async () => {
      const supabase = createClient();

      // Supabase sends token_hash and type in the URL for email confirmation
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const token = searchParams.get('token');
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');

      try {
        if (tokenHash && type) {
          // New Supabase PKCE flow
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) {
            setStatus('error');
            setMessage(error.message || 'Verification failed. The link may have expired.');
            return;
          }
          setStatus('success');
          setMessage('Email verified successfully! Redirecting to your dashboard...');
          setTimeout(() => router.replace('/trade?verified=1'), 2000);
        } else if (accessToken && refreshToken) {
          // Legacy flow with access_token in URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setStatus('error');
            setMessage(error.message || 'Verification failed. The link may have expired.');
            return;
          }
          setStatus('success');
          setMessage('Email verified successfully! Redirecting to your dashboard...');
          setTimeout(() => router.replace('/trade?verified=1'), 2000);
        } else if (token) {
          // Fallback: try verifyOtp with token
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email' as any,
          });
          if (error) {
            setStatus('error');
            setMessage(error.message || 'Verification failed. The link may have expired.');
            return;
          }
          setStatus('success');
          setMessage('Email verified successfully! Redirecting to your dashboard...');
          setTimeout(() => router.replace('/trade?verified=1'), 2000);
        } else {
          // Check if already verified via session
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email_confirmed_at) {
            setStatus('success');
            setMessage('Your email is already verified! Redirecting...');
            setTimeout(() => router.replace('/trade'), 1500);
          } else {
            setStatus('error');
            setMessage('Invalid verification link. Please request a new one.');
          }
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'An unexpected error occurred.');
      }
    };

    handleConfirmation();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b1e' }}>
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 420, width: '90%' }}
      >
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verifying your email...</h2>
            <p className="text-slate-400 text-sm">Please wait while we confirm your email address.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Email Verified! ✅</h2>
            <p className="text-slate-400 text-sm">{message}</p>
            <div className="mt-4 w-full bg-slate-700 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-green-500 animate-pulse" style={{ width: '100%' }} />
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-slate-400 text-sm mb-6">{message}</p>
            <button
              onClick={() => router.push('/auth')}
              className="w-full py-3 rounded-xl font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b1e' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
