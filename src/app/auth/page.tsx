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
  const { user, loading, signUp, signIn } = useAuth();
  const redirectingRef = React.useRef(false);

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

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');  
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');

  const passwordStrength = getPasswordStrength(suPassword);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!loading && user && !redirectingRef.current) {
      redirectingRef.current = true;
      router.replace('/trade');
    }
  }, [user, loading, router]);

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
    setResendLoading(true);
    setResendMsg('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: siEmail,
      });
      if (error) {
        setResendMsg('Gagal mengirim ulang: ' + error.message);
      } else {
        setResendMsg('Email konfirmasi telah dikirim ulang. Periksa kotak masuk Anda.');
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

    // Check env variables at runtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      setSiError('Konfigurasi server tidak lengkap (env variables hilang). Hubungi administrator.');
      setSiErrorType('env_mismatch');
      return;
    }

    // Log project ref (safe — not the key)
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
    console.log('[Auth] Supabase project ref:', projectRef);

    setSiLoading(true);

    // Safety timeout: if no response in 10 seconds, reset loading
    const timeoutId = setTimeout(() => {
      setSiLoading(false);
      setSiError('Login timeout. Periksa koneksi internet Anda dan coba lagi.');
      setSiErrorType('other');
    }, 10000);

    try {
      console.log('[Auth] Calling signIn for:', siEmail);
      // signIn() in AuthContext returns data directly (the inner {user, session} object)
      // It throws if Supabase returns an error.
      const sessionData = await signIn(siEmail, siPassword);
      clearTimeout(timeoutId);

      console.log('[Auth] signIn result — session exists:', !!sessionData?.session, 'user exists:', !!sessionData?.user);

      if (sessionData?.session) {
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
        // Case A: Email not confirmed
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
        // Case B: Invalid credentials
        setSiError(
          `${msg || 'Email atau password salah.'}` +
          (status ? ` (status: ${status})` : '') +
          ` Gunakan "Lupa password?" untuk mereset password Anda.`
        );
        setSiErrorType('invalid_credentials');
      } else if (msg.toLowerCase().includes('too many requests') || msg.toLowerCase().includes('rate limit')) {
        setSiError(`${msg} — Terlalu banyak percobaan. Tunggu beberapa menit.`);
        setSiErrorType('other');
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
    if (!otpCode || otpCode.length < 6) { setOtpError('Please enter the 6-digit OTP code'); return; }
    setOtpLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: otpCode,
        type: 'sms',
      });
      if (error) {
        setOtpError(error.message || 'Invalid OTP code. Please try again.');
      } else {
        setOtpStep(false);
        router.push('/dashboard');
      }
    } catch {
      setOtpError('An unexpected error occurred.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    setOtpError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone: pendingPhone });
      if (error) {
        setOtpError(error.message || 'Failed to resend OTP.');
      } else {
        setOtpSent(true);
      }
    } catch {
      setOtpError('Failed to resend OTP.');
    }
  }

  function handleSkipOtp() {
    setOtpStep(false);
    setSuSuccess('Registration successful! Please check your email to verify your account.');
    switchMode('signin');
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg('');
    if (!forgotEmail) { setForgotMsg('Please enter your email'); return; }
    setForgotLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        setForgotMsg('Failed to send reset link. Please try again.');
      } else {
        setForgotMsg('Password reset link sent! Please check your email.');
      }
    } catch {
      setForgotMsg('Failed to send reset link. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b1e' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0b1e' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/10">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 cursor-pointer">
          <div className="bg-blue-600 rounded p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
              <path d="M18 17V9"/>
              <path d="M13 17V5"/>
              <path d="M8 17v-3"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-white">Investoft</span>
        </button>
        <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white text-sm transition-colors">
          ← Back to Home
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* OTP Step */}
          {otpStep ? (
            <div
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2.78h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">OTP Verification</h2>
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
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    className="w-full px-4 py-3 rounded-xl text-white text-center text-2xl font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: otpError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)' }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
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
                  <button type="button" onClick={handleResendOtp} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Resend
                  </button>
                  <button type="button" onClick={handleSkipOtp} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Skip
                  </button>
                </div>
              </form>
            </div>
          ) : forgotMode ? (
            /* Forgot Password */
            <div
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <button onClick={() => setForgotMode(false)} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
                ← Back
              </button>
              <h2 className="text-xl font-bold text-white mb-2">Forgot Password</h2>
              <p className="text-slate-400 text-sm mb-6">Enter your email to receive a password reset link.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder="email@example.com"
                />
                {forgotMsg && (
                  <p className={`text-sm ${forgotMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{forgotMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </div>
          ) : (
            /* Main Auth Card */
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {/* Toggle */}
              <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => switchMode('signin')}
                  className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                    mode === 'signin' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={mode === 'signin' ? { background: 'rgba(59,130,246,0.08)' } : {}}
                >
                  Sign In
                  {mode === 'signin' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                    mode === 'signup' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={mode === 'signup' ? { background: 'rgba(59,130,246,0.08)' } : {}}
                >
                  Register
                  {mode === 'signup' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
              </div>

              <div
                className={`transition-opacity duration-200 ${
                  isTransitioning ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {mode === 'signin' ? (
                  /* Sign In Form */
                  <div className="p-6 sm:p-8">
                    <h2 className="text-xl font-bold text-white mb-1">Welcome Back</h2>
                    <p className="text-slate-400 text-sm mb-6">Sign in to your trading account</p>

                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Email</label>
                        <input
                          type="email"
                          value={siEmail}
                          onChange={(e) => { setSiEmail(e.target.value); setSiError(''); setSiErrorType(null); setResendMsg(''); }}
                          className="w-full px-4 py-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                          placeholder="Enter your email"
                          autoComplete="email"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Password</label>
                        <div className="relative">
                          <input
                            type={siShowPass ? 'text' : 'password'}
                            value={siPassword}
                            onChange={(e) => { setSiPassword(e.target.value); setSiError(''); setSiErrorType(null); }}
                            className="w-full px-4 py-3 pr-12 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                            placeholder="Enter password"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setSiShowPass(!siShowPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                          >
                            {siShowPass ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={siRemember}
                            onChange={(e) => setSiRemember(e.target.checked)}
                            className="w-4 h-4 rounded accent-blue-500"
                          />
                          <span className="text-sm text-slate-400">Remember me</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => { setForgotEmail(siEmail); setForgotMode(true); }}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>

                      {siError && (
                        <div className="px-3 py-3 rounded-lg space-y-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <div className="flex items-start gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <p className="text-red-400 text-sm">{siError}</p>
                          </div>
                          {/* Contextual one-click actions */}
                          {siErrorType === 'email_not_confirmed' && (
                            <div className="pt-1 space-y-2">
                              <button
                                type="button"
                                onClick={handleResendConfirmation}
                                disabled={resendLoading}
                                className="w-full py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60"
                              >
                                {resendLoading ? 'Mengirim...' : 'Kirim Ulang Email Konfirmasi'}
                              </button>
                              {resendMsg && (
                                <p className={`text-xs ${resendMsg.includes('Gagal') ? 'text-red-400' : 'text-green-400'}`}>{resendMsg}</p>
                              )}
                            </div>
                          )}
                          {siErrorType === 'invalid_credentials' && (
                            <button
                              type="button"
                              onClick={() => { setForgotEmail(siEmail); setForgotMode(true); }}
                              className="w-full py-2 rounded-lg text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
                            >
                              Reset Password
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={siLoading}
                        className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                      >
                        {siLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </span>
                        ) : 'Sign In'}
                      </button>
                    </form>

                    <p className="text-center text-sm text-slate-400 mt-4">
                      Don&apos;t have an account?{' '}
                      <button onClick={() => switchMode('signup')} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Create account now
                      </button>
                    </p>
                  </div>
                ) : (
                  /* Sign Up Form */
                  <div className="p-6 sm:p-8">
                    <h2 className="text-xl font-bold text-white mb-1">Create New Account</h2>
                    <p className="text-slate-400 text-sm mb-6">Register and start trading with $10,000 demo</p>

                    <form onSubmit={handleSignUp} className="space-y-4">
                      {/* Email */}
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Email</label>
                        <input
                          type="email"
                          value={suEmail}
                          onChange={(e) => { setSuEmail(e.target.value); setSuError(''); }}
                          className="w-full px-4 py-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                          placeholder="Enter your email"
                          autoComplete="email"
                        />
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Phone Number</label>
                        <input
                          type="tel"
                          value={suPhone}
                          onChange={(e) => { setSuPhone(e.target.value); setSuError(''); }}
                          className="w-full px-4 py-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                          placeholder="Enter your phone number"
                          autoComplete="tel"
                        />
                      </div>

                      {/* Password with strength */}
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Password</label>
                        <div className="relative">
                          <input
                            type={suShowPass ? 'text' : 'password'}
                            value={suPassword}
                            onChange={(e) => { setSuPassword(e.target.value); setSuError(''); }}
                            className="w-full px-4 py-3 pr-12 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                            placeholder="Minimum 8 characters"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setSuShowPass(!suShowPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                          >
                            {suShowPass ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                        {/* Password strength indicator */}
                        {suPassword && (
                          <div className="mt-2">
                            <div className="flex gap-1 mb-1">
                              {[1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  className="flex-1 h-1 rounded-full transition-all"
                                  style={{
                                    background:
                                      passwordStrength.strength === 'strong' ? '#22c55e' :
                                      passwordStrength.strength === 'medium' && i <= 2 ? '#f59e0b' :
                                      passwordStrength.strength === 'weak' && i === 1 ? '#ef4444' : 'rgba(255,255,255,0.1)',
                                  }}
                                />
                              ))}
                            </div>
                            <p className={`text-xs ${
                              passwordStrength.strength === 'strong' ? 'text-green-400' :
                              passwordStrength.strength === 'medium' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              Strength: {passwordStrength.label}
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
                            onChange={(e) => { setSuConfirmPass(e.target.value); setSuError(''); }}
                            className="w-full px-4 py-3 pr-12 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: suConfirmPass && suConfirmPass !== suPassword
                                ? '1px solid #ef4444'
                                : suConfirmPass && suConfirmPass === suPassword
                                ? '1px solid #22c55e' :'1px solid rgba(255,255,255,0.12)',
                            }}
                            placeholder="Repeat password"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setSuShowConfirm(!suShowConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                          >
                            {suShowConfirm ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Terms */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={suTerms}
                          onChange={(e) => { setSuTerms(e.target.checked); setSuError(''); }}
                          className="w-4 h-4 mt-0.5 rounded accent-blue-500 flex-shrink-0"
                        />
                        <span className="text-sm text-slate-400">
                          I agree to{' '}
                          <span className="text-blue-400 hover:text-blue-300 cursor-pointer">Terms &amp; Conditions</span>
                          {' '}and{' '}
                          <span className="text-blue-400 hover:text-blue-300 cursor-pointer">Privacy Policy</span>
                        </span>
                      </label>

                      {suError && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <p className="text-red-400 text-sm">{suError}</p>
                        </div>
                      )}

                      {suSuccess && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
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
                            Registering...
                          </span>
                        ) : 'Create Account & Start Trading'}
                      </button>
                    </form>

                    <p className="text-center text-sm text-slate-400 mt-4">
                      Already have an account?{' '}
                      <button onClick={() => switchMode('signin')} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Sign in now
                      </button>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}