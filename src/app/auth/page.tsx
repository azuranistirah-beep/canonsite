'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '../../lib/supabase/client';

function getPasswordStrength(password: string): { strength: 'weak' | 'medium' | 'strong'; score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { strength: 'weak', score, label: 'Weak' };
  if (score <= 3) return { strength: 'medium', score, label: 'Medium' };
  return { strength: 'strong', score, label: 'Strong' };
}

export default function AuthPage() {
  const router = useRouter();
  const { user, loading, signUp, signIn, rateLimited } = useAuth();
  const redirectingRef = React.useRef(false);

  // Supabase project URL for diagnostic messages (no auth calls here)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sign In fields
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siRemember, setSiRemember] = useState(false);
  const [siShowPass, setSiShowPass] = useState(false);
  const [siLoading, setSiLoading] = useState(false);
  const [siError, setSiError] = useState('');
  // Error category for contextual actions
  const [siErrorType, setSiErrorType] = useState<'email_not_confirmed' | 'invalid_credentials' | 'env_mismatch' | 'other' | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  // Rate limit cooldown for resend confirmation
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rate limit cooldown for sign-in
  const [siCooldown, setSiCooldown] = useState(0);
  const siCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Single-flight guard: prevents double submission
  const isSigningInRef = useRef(false);

  // Sign Up fields
  const [suEmail, setSuEmail] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirmPass, setSuConfirmPass] = useState('');
  const [suShowPass, setSuShowPass] = useState(false);
  const [suShowConfirm, setSuShowConfirm] = useState(false);
  const [suTerms, setSuTerms] = useState(false);
  const [suLoading, setSuLoading] = useState(false);
  const [suError, setSuError] = useState('');
  const [suSuccess, setSuSuccess] = useState('');

  // OTP
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  // Rate limit cooldown for OTP resend
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  // Rate limit cooldown for forgot password
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const passwordStrength = getPasswordStrength(suPassword);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!loading && user && !redirectingRef.current) {
      redirectingRef.current = true;
      router.replace('/trade');
    }
  }, [user, loading, router]);

  // ─── Load remembered email on mount ─────────────────────────────────────────
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('investoft_remember_email');
      if (remembered) {
        setSiEmail(remembered);
        setSiRemember(true);
      }
    } catch (e) {
      // localStorage not available
    }

    // Restore 429 cooldown from sessionStorage if still active
    try {
      const cooldownUntil = sessionStorage.getItem('investoft_si_cooldown_until');
      if (cooldownUntil) {
        const remaining = Math.ceil((parseInt(cooldownUntil, 10) - Date.now()) / 1000);
        if (remaining > 0) {
          startCooldown(setSiCooldown, siCooldownRef, remaining);
        } else {
          sessionStorage.removeItem('investoft_si_cooldown_until');
        }
      }
    } catch (e) {
      // sessionStorage not available
    }
  }, []);

  // Cleanup cooldown intervals on unmount
  useEffect(() => {
    return () => {
      if (resendCooldownRef.current) clearInterval(resendCooldownRef.current);
      if (otpCooldownRef.current) clearInterval(otpCooldownRef.current);
      if (forgotCooldownRef.current) clearInterval(forgotCooldownRef.current);
      if (siCooldownRef.current) clearInterval(siCooldownRef.current);
    };
  }, []);

  function startCooldown(
    setter: React.Dispatch<React.SetStateAction<number>>,
    intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    seconds = 60
  ) {
    setter(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setter((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function isRateLimitError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      lower.includes('rate limit') ||
      lower.includes('too many requests') ||
      lower.includes('request rate limit') ||
      lower.includes('email rate limit') ||
      lower.includes('over_email_send_rate_limit') ||
      lower.includes('for security purposes')
    );
  }

  function switchMode(newMode: 'signin' | 'signup') {
    if (newMode === mode) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setSiError('');
      setSiErrorType(null);
      setResendMsg('');
      setSuError('');
      setSuSuccess('');
      setIsTransitioning(false);
    }, 150);
  }

  async function handleResendConfirmation() {
    if (!siEmail) return;
    if (resendCooldown > 0) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: siEmail,
      });
      if (error) {
        if (isRateLimitError(error.message)) {
          setResendMsg('Terlalu banyak permintaan. Harap tunggu 60 detik sebelum mencoba lagi.');
          startCooldown(setResendCooldown, resendCooldownRef, 60);
        } else {
          setResendMsg('Gagal mengirim ulang: ' + error.message);
        }
      } else {
        setResendMsg('Email konfirmasi telah dikirim ulang. Periksa kotak masuk Anda.');
        startCooldown(setResendCooldown, resendCooldownRef, 60);
      }
    } catch (err: any) {
      setResendMsg('Gagal mengirim ulang email konfirmasi.');
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSiError('');
    setSiErrorType(null);
    setResendMsg('');
    if (!siEmail) { setSiError('Masukkan email Anda'); return; }
    if (!siPassword) { setSiError('Masukkan password Anda'); return; }

    // ── Check cooldown via sessionStorage (synchronous, not relying on React state) ──
    try {
      const cooldownUntil = sessionStorage.getItem('investoft_si_cooldown_until');
      if (cooldownUntil && parseInt(cooldownUntil, 10) > Date.now()) {
        const remaining = Math.ceil((parseInt(cooldownUntil, 10) - Date.now()) / 1000);
        setSiError(`Terlalu banyak percobaan login. Harap tunggu ${remaining} detik sebelum mencoba lagi.`);
        return;
      }
    } catch (e) { /* ignore */ }

    if (siCooldown > 0) return;

    // ── Single-flight guard: block duplicate submissions ──────────────────────
    if (isSigningInRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Auth] handleSignIn: already in progress, ignoring duplicate submit');
      }
      return;
    }

    // ── SessionStorage auth lock (prevents multi-tab / double-render race) ────
    try {
      const lockUntil = sessionStorage.getItem('investoft_auth_lock');
      if (lockUntil && parseInt(lockUntil, 10) > Date.now()) {
        setSiError('Login sedang diproses. Harap tunggu sebentar.');
        return;
      }
      // Set lock for 10 seconds
      sessionStorage.setItem('investoft_auth_lock', String(Date.now() + 10000));
    } catch (e) {
      // sessionStorage not available — continue without lock
    }

    isSigningInRef.current = true;
    setSiLoading(true);

    // Safety timeout: if no response in 10 seconds, reset loading
    const timeoutId = setTimeout(() => {
      isSigningInRef.current = false;
      try { sessionStorage.removeItem('investoft_auth_lock'); } catch (e) { /* ignore */ }
      setSiLoading(false);
      setSiError('Login timeout. Periksa koneksi internet Anda dan coba lagi.');
      setSiErrorType('other');
    }, 10000);

    try {
      console.log('[Auth] Calling signIn for:', siEmail);
      const sessionData = await signIn(siEmail, siPassword);
      clearTimeout(timeoutId);

      console.log('[Auth] signIn result — session exists:', !!sessionData?.session, 'user exists:', !!sessionData?.user);

      if (sessionData?.session) {
        // ─── Remember Me: save or clear email ───────────────────────────────
        try {
          if (siRemember) {
            localStorage.setItem('investoft_remember_email', siEmail);
            localStorage.setItem('investoft_remember_expiry', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
          } else {
            localStorage.removeItem('investoft_remember_email');
            localStorage.removeItem('investoft_remember_expiry');
          }
        } catch (e) {
          // localStorage not available
        }
        // SUCCESS: session exists, redirect to dashboard
        redirectingRef.current = true;
        setSiLoading(false);
        router.replace('/trade');
      } else {
        // No error thrown but session is null — env/config mismatch
        const projectRefDisplay = supabaseUrl.replace('https://', '').split('.')[0];
        setSiError(
          `Login tidak menghasilkan sesi (tidak ada error dari Supabase). ` +
          `Project ref: ${projectRefDisplay}. ` +
          `Kemungkinan: konfigurasi Supabase client tidak cocok atau sesi tidak tersimpan. ` +
          `User ada: ${!!sessionData?.user}.`
        );
        setSiErrorType('env_mismatch');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg: string = err?.message || err?.error_description || String(err) || '';
      const status: number | undefined = err?.status;
      console.error('[Auth] signIn threw error — message:', msg, 'status:', status);

      if (
        msg.toLowerCase().includes('email not confirmed') ||
        msg.toLowerCase().includes('email_not_confirmed') ||
        msg.toLowerCase().includes('confirm your email')
      ) {
        setSiError(
          `Email belum dikonfirmasi. Periksa kotak masuk Anda dan klik tautan verifikasi, ` +
          `atau klik tombol di bawah untuk mengirim ulang email konfirmasi.` +
          (status ? ` (status: ${status})` : '')
        );
        setSiErrorType('email_not_confirmed');
      } else if (
        msg.toLowerCase().includes('invalid login credentials') ||
        msg.toLowerCase().includes('invalid_credentials') ||
        msg.toLowerCase().includes('invalid email or password') ||
        msg.toLowerCase().includes('wrong password') ||
        status === 400
      ) {
        setSiError(
          `${msg || 'Email atau password salah.'}` +
          (status ? ` (status: ${status})` : '') +
          ` Gunakan "Lupa password?" untuk mereset password Anda.`
        );
        setSiErrorType('invalid_credentials');
      } else if (msg.toLowerCase().includes('too many requests') || msg.toLowerCase().includes('rate limit') || isRateLimitError(msg) || status === 429) {
        setSiError(`Terlalu banyak percobaan login. Harap tunggu 60 detik sebelum mencoba lagi.`);
        setSiErrorType('other');
        // Persist cooldown in sessionStorage so reload doesn't bypass it
        try {
          sessionStorage.setItem('investoft_si_cooldown_until', String(Date.now() + 60000));
        } catch (e) { /* ignore */ }
        startCooldown(setSiCooldown, siCooldownRef, 60);
        // Reset guards so user can retry after cooldown expires
        isSigningInRef.current = false;
        setSiLoading(false);
        try { sessionStorage.removeItem('investoft_auth_lock'); } catch (e) { /* ignore */ }
        // Return early so finally block doesn't double-reset
        return;
      } else if (msg.toLowerCase().includes('sign-in already in progress')) {
        // Silently ignore duplicate call errors — UI already shows loading
        return;
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setSiError('Koneksi gagal. Periksa koneksi internet Anda dan coba lagi.');
        setSiErrorType('other');
      } else {
        // Show exact Supabase error message
        setSiError(msg || 'Login gagal. Silakan coba lagi.');
        setSiErrorType('other');
      }
    } finally {
      clearTimeout(timeoutId);
      isSigningInRef.current = false;
      try { sessionStorage.removeItem('investoft_auth_lock'); } catch (e) { /* ignore */ }
      setSiLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSuError('');
    setSuSuccess('');
    if (!suEmail) { setSuError('Please enter your email'); return; }
    if (!suPassword) { setSuError('Please enter a password'); return; }
    if (suPassword.length < 8) { setSuError('Password must be at least 8 characters'); return; }
    if (suPassword !== suConfirmPass) { setSuError('Passwords do not match'); return; }
    if (!suTerms) { setSuError('Please agree to the Terms & Conditions'); return; }
    setSuLoading(true);
    try {
      await signUp(suEmail, suPassword);
      setSuSuccess('Registration successful! Please check your email to verify your account.');
      setSuEmail('');
      setSuPassword('');
      setSuConfirmPass('');
      setSuPhone('');
      setSuTerms(false);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already registered')) {
        setSuError('This email is already registered. Please sign in instead.');
      } else if (isRateLimitError(msg)) {
        setSuError('Terlalu banyak permintaan. Harap tunggu beberapa menit sebelum mencoba lagi.');
      } else {
        setSuError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setSuLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError('');
    if (!otpCode) { setOtpError('Please enter the OTP code'); return; }
    setOtpLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: otpCode,
        type: 'sms',
      });
      if (error) {
        setOtpError(error.message || 'Invalid OTP code.');
      } else {
        router.replace('/trade');
      }
    } catch {
      setOtpError('Failed to verify OTP.');
    } finally {
      setOtpLoading(false);
    }
  }

  function handleSkipOtp() {
    setOtpStep(false);
    setOtpCode('');
    setOtpError('');
  }

  async function handleResendOtp() {
    setOtpError('');
    if (otpCooldown > 0) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone: pendingPhone });
      if (error) {
        if (isRateLimitError(error.message)) {
          setOtpError('Terlalu banyak permintaan OTP. Harap tunggu 60 detik sebelum mencoba lagi.');
          startCooldown(setOtpCooldown, otpCooldownRef, 60);
        } else {
          setOtpError(error.message || 'Failed to resend OTP.');
        }
      } else {
        setOtpSent(true);
        startCooldown(setOtpCooldown, otpCooldownRef, 60);
      }
    } catch {
      setOtpError('Failed to resend OTP.');
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg('');
    if (!forgotEmail) { setForgotMsg('Please enter your email'); return; }
    if (forgotCooldown > 0) return;
    setForgotLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        if (isRateLimitError(error.message)) {
          setForgotMsg('Terlalu banyak permintaan. Harap tunggu 60 detik sebelum mencoba lagi.');
          startCooldown(setForgotCooldown, forgotCooldownRef, 60);
        } else {
          setForgotMsg('Failed to send reset link. Please try again.');
        }
      } else {
        setForgotMsg('Password reset link sent! Please check your email.');
        startCooldown(setForgotCooldown, forgotCooldownRef, 60);
      }
    } catch {
      setForgotMsg('Failed to send reset link. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (rateLimited) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-lg">Terlalu Banyak Request</h2>
          <p className="text-slate-400 text-sm">Terlalu banyak request ke server autentikasi. Harap tunggu 1 menit lalu reload halaman ini.</p>
          <button
            onClick={() => { try { sessionStorage.removeItem('investoft_auth_429_until'); } catch { /* ignore */ } window.location.reload(); }}
            className="mt-2 px-6 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
          >
            Reload Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1224 50%, #0a0e1a 100%)' }}>
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #2563eb, transparent)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(60px)' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">InvesoFT</span>
          </div>
          <p className="text-slate-400 text-sm">Professional Trading Platform</p>
        </div>

        {/* OTP Step */}
        {otpStep ? (
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(37,99,235,0.15)' }}>
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Verify Phone</h2>
              <p className="text-slate-400 text-sm">
                {otpSent ? `OTP code has been sent to ${pendingPhone}` : 'Enter the OTP code sent to your number'}
              </p>
            </div>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">OTP Code</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                {otpError && <p className="text-red-400 text-xs mt-1">{otpError}</p>}
              </div>
              <button
                type="submit"
                disabled={otpLoading}
                className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                {otpLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={handleResendOtp} disabled={otpCooldown > 0} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {otpCooldown > 0 ? `Tunggu ${otpCooldown}s` : 'Resend'}
                </button>
                <button type="button" onClick={handleSkipOtp} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Skip
                </button>
              </div>
            </form>
          </div>
        ) : forgotMode ? (
          /* Forgot Password */
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <button
              type="button"
              onClick={() => { setForgotMode(false); setForgotMsg(''); }}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Sign In
            </button>
            <h2 className="text-xl font-bold text-white mb-2">Forgot Password</h2>
            <p className="text-slate-400 text-sm mb-6">Enter your email to receive a password reset link.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              {forgotMsg && (
                <p className={`text-sm ${forgotMsg.includes('Failed') || forgotMsg.includes('Terlalu') ? 'text-red-400' : 'text-green-400'}`}>{forgotMsg}</p>
              )}
              <button
                type="submit"
                disabled={forgotLoading || forgotCooldown > 0}
                className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                {forgotLoading ? 'Sending...' : forgotCooldown > 0 ? `Tunggu ${forgotCooldown}s...` : 'Send Reset Link'}
              </button>
            </form>
          </div>
        ) : (
          /* Main Auth Card */
          <div
            className={`rounded-2xl overflow-hidden transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
          >
            {/* Toggle */}
            <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => switchMode('signin')}
                className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                  mode === 'signin' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Sign In
                {mode === 'signin' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
              <button
                onClick={() => switchMode('signup')}
                className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                  mode === 'signup' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Create Account
                {mode === 'signup' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            </div>

            <div className="p-6">
              {mode === 'signin' ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">Welcome Back</h2>
                  <p className="text-slate-400 text-sm mb-6">Sign in to your trading account</p>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Email</label>
                      <input
                        type="email"
                        value={siEmail}
                        onChange={(e) => setSiEmail(e.target.value)}
                        placeholder="your@email.com"
                        autoComplete="email"
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Password</label>
                      <div className="relative">
                        <input
                          type={siShowPass ? 'text' : 'password'}
                          value={siPassword}
                          onChange={(e) => setSiPassword(e.target.value)}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setSiShowPass(!siShowPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                          {siShowPass ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me + Forgot Password */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={siRemember}
                          onChange={(e) => setSiRemember(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-400">Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setForgotEmail(siEmail); }}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Error message */}
                    {siError && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p className="text-red-400 text-sm">{siError}</p>
                        {siErrorType === 'email_not_confirmed' && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={handleResendConfirmation}
                              disabled={resendLoading || resendCooldown > 0}
                              className="w-full py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60"
                            >
                              {resendLoading ? 'Mengirim...' : resendCooldown > 0 ? `Tunggu ${resendCooldown}s...` : 'Kirim Ulang Email Konfirmasi'}
                            </button>
                            {resendMsg && (
                              <p className={`text-xs mt-1 ${resendMsg.includes('Gagal') ? 'text-red-400' : 'text-green-400'}`}>{resendMsg}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={siLoading || siCooldown > 0}
                      className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                    >
                      {siLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Signing in...
                        </span>
                      ) : siCooldown > 0 ? `Tunggu ${siCooldown}s...` : 'Sign In'}
                    </button>
                  </form>

                  <p className="text-center text-sm text-slate-400 mt-4">
                    Don&apos;t have an account?{' '}
                    <button onClick={() => switchMode('signup')} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Create account now
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">Create New Account</h2>
                  <p className="text-slate-400 text-sm mb-6">Register and start trading with $10,000 demo</p>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    {/* Email */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Email</label>
                      <input
                        type="email"
                        value={suEmail}
                        onChange={(e) => setSuEmail(e.target.value)}
                        placeholder="your@email.com"
                        autoComplete="email"
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Password</label>
                      <div className="relative">
                        <input
                          type={suShowPass ? 'text' : 'password'}
                          value={suPassword}
                          onChange={(e) => setSuPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                          className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setSuShowPass(!suShowPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                          {suShowPass ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {/* Password strength */}
                      {suPassword && (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-1 flex-1 rounded-full transition-all"
                                style={{
                                  background: i <= passwordStrength.score
                                    ? passwordStrength.strength === 'weak' ? '#ef4444'
                                      : passwordStrength.strength === 'medium'? '#f59e0b' :'#22c55e' :'rgba(255,255,255,0.1)'
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-xs" style={{
                            color: passwordStrength.strength === 'weak' ? '#ef4444'
                              : passwordStrength.strength === 'medium'? '#f59e0b' :'#22c55e'
                          }}>
                            {passwordStrength.label} password
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={suShowConfirm ? 'text' : 'password'}
                          value={suConfirmPass}
                          onChange={(e) => setSuConfirmPass(e.target.value)}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setSuShowConfirm(!suShowConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                          {suShowConfirm ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {suConfirmPass && suPassword !== suConfirmPass && (
                        <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                      )}
                    </div>

                    {/* Terms */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={suTerms}
                        onChange={(e) => setSuTerms(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-400">
                        I agree to the{' '}
                        <span className="text-blue-400">Terms & Conditions</span>
                        {' '}and{' '}
                        <span className="text-blue-400">Privacy Policy</span>
                      </span>
                    </label>

                    {suError && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p className="text-red-400 text-sm">{suError}</p>
                      </div>
                    )}
                    {suSuccess && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <p className="text-green-400 text-sm">{suSuccess}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={suLoading}
                      className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                    >
                      {suLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating account...
                        </span>
                      ) : 'Create Account'}
                    </button>
                  </form>

                  <p className="text-center text-sm text-slate-400 mt-4">
                    Already have an account?{' '}
                    <button onClick={() => switchMode('signin')} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Sign in now
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          © 2024 InvesoFT. All rights reserved. Trading involves risk.
        </p>
      </div>
    </div>
  );
}