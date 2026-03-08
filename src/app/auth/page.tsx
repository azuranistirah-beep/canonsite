'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '../../lib/supabase/client';


// ─── Safe ErrorBoundary — never accesses window.__ErrorBoundary ──────────────
class AuthErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : JSON.stringify(error);
    return { hasError: true, errorMsg: msg };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[AuthErrorBoundary] Caught render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ background: '#0a0e1a' }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <p className="text-red-400 font-bold mb-2">⚠ Render Error (caught safely)</p>
            <p className="text-red-300 text-sm break-all">{this.state.errorMsg}</p>
            <button
              onClick={() => this.setState({ hasError: false, errorMsg: '' })}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const ADMIN_EMAIL = 'support@investoft.com';

const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan' },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+46', flag: '🇸🇪', name: 'Sweden' },
  { code: '+47', flag: '🇳🇴', name: 'Norway' },
  { code: '+45', flag: '🇩🇰', name: 'Denmark' },
  { code: '+358', flag: '🇫🇮', name: 'Finland' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: '+32', flag: '🇧🇪', name: 'Belgium' },
  { code: '+48', flag: '🇵🇱', name: 'Poland' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+30', flag: '🇬🇷', name: 'Greece' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+51', flag: '🇵🇪', name: 'Peru' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+1-CA', flag: '🇨🇦', name: 'Canada' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: '+98', flag: '🇮🇷', name: 'Iran' },
  { code: '+964', flag: '🇮🇶', name: 'Iraq' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
];

function AuthPageInner() {
  const router = useRouter();
  const { user, loading, signUp, signIn, rateLimited, setHardNavigating } = useAuth();
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
  const [siErrorType, setSiErrorType] = useState<'email_not_confirmed' | 'invalid_credentials' | 'env_mismatch' | 'other' | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [siCooldown, setSiCooldown] = useState(0);
  const siCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSigningInRef = useRef(false);

  // Sign Up fields
  const [suEmail, setSuEmail] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+1');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirmPass, setSuConfirmPass] = useState('');
  const [suShowPass, setSuShowPass] = useState(false);
  const [suShowConfirm, setSuShowConfirm] = useState(false);
  const [suTerms, setSuTerms] = useState(false);
  const [suLoading, setSuLoading] = useState(false);
  const [suError, setSuError] = useState('');
  const [suSuccess, setSuSuccess] = useState('');
  const signupJustCompletedRef = useRef(false);

  // OTP
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const passwordStrength = getPasswordStrength(suPassword);

  // If already logged in, redirect based on email
  // Only fires if we haven't already triggered a redirect from handleSignIn
  useEffect(() => {
    if (!loading && user && !redirectingRef.current && !signupJustCompletedRef.current) {
      redirectingRef.current = true;
      const dest = user.email === ADMIN_EMAIL ? '/admin' : '/trade';
      window.location.href = dest;
    }
  }, [user, loading]);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('investoft_remember_email');
      if (remembered) {
        setSiEmail(remembered);
        setSiRemember(true);
      }
    } catch (e) {}

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
    } catch (e) {}

    // Show error from URL query param (e.g. from /auth/callback redirect)
    try {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error');
      if (urlError) {
        setSiError(decodeURIComponent(urlError));
        setSiErrorType('other');
        // Clean up URL without reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch (e) {}
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
          setResendMsg('Too many requests. Please wait 60 seconds before trying again.');
          startCooldown(setResendCooldown, resendCooldownRef, 60);
        } else {
          setResendMsg('Failed to resend: ' + error.message);
        }
      } else {
        setResendMsg('Confirmation email has been resent. Please check your inbox.');
        startCooldown(setResendCooldown, resendCooldownRef, 60);
      }
    } catch (err: any) {
      setResendMsg('Failed to send confirmation email.');
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    try {
      await _handleSignInCore();
    } catch (unexpectedErr: unknown) {
      const msg =
        unexpectedErr instanceof Error
          ? unexpectedErr.message
          : typeof unexpectedErr === 'string'
          ? unexpectedErr
          : JSON.stringify(unexpectedErr);
      console.error('[Auth] handleSignIn: unexpected top-level error:', unexpectedErr);
      setSiError('Error not expected: ' + msg);
      setSiErrorType('other');
    } finally {
      isSigningInRef.current = false;
      setSiLoading(false);
    }
  }

  async function _handleSignInCore() {
    setSiError('');
    setSiErrorType(null);
    setResendMsg('');
    if (!siEmail) { setSiError('Please enter your email'); return; }
    if (!siPassword) { setSiError('Please enter your password'); return; }

    try {
      const cooldownUntil = sessionStorage.getItem('investoft_si_cooldown_until');
      if (cooldownUntil && parseInt(cooldownUntil, 10) > Date.now()) {
        const remaining = Math.ceil((parseInt(cooldownUntil, 10) - Date.now()) / 1000);
        setSiError(`Too many login attempts. Please wait ${remaining} seconds before trying again.`);
        return;
      }
    } catch (e) {}

    if (siCooldown > 0) return;

    if (isSigningInRef.current) {
      console.warn('[Auth] handleSignIn: already in progress, ignoring duplicate submit');
      return;
    }

    isSigningInRef.current = true;
    setSiLoading(true);

    // ── STEP 1: Sign In ──────────────────────────────────────────────────────
    let sessionData: any;
    try {
      sessionData = await signIn(siEmail, siPassword);
    } catch (err: any) {
      const msg: string = err?.message || err?.error_description || String(err) || '';
      const status: number | undefined = err?.status;
      console.error('[Auth] signInWithPassword error:', msg, 'status:', status);

      if (
        msg.toLowerCase().includes('email not confirmed') ||
        msg.toLowerCase().includes('email_not_confirmed') ||
        msg.toLowerCase().includes('confirm your email')
      ) {
        setSiError(
          `Email not confirmed. Please check your inbox and click the verification link, ` +
          `or click the button below to resend the confirmation email.`
        );
        setSiErrorType('email_not_confirmed');
      } else if (
        msg.toLowerCase().includes('invalid login credentials') ||
        msg.toLowerCase().includes('invalid_credentials') ||
        msg.toLowerCase().includes('invalid email or password') ||
        status === 400
      ) {
        setSiError(`Incorrect email or password. Use "Forgot password?" to reset your password.`);
        setSiErrorType('invalid_credentials');
      } else if (isRateLimitError(msg) || status === 429) {
        setSiError(`Too many login attempts. Please wait 60 seconds before trying again.`);
        setSiErrorType('other');
        try { sessionStorage.setItem('investoft_si_cooldown_until', String(Date.now() + 60000)); } catch (e) {}
        startCooldown(setSiCooldown, siCooldownRef, 60);
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setSiError('Connection failed. Please check your internet connection and try again.');
        setSiErrorType('other');
      } else {
        setSiError(msg || 'Login failed. Please try again.');
        setSiErrorType('other');
      }
      return;
    }

    // ── STEP 2: Validate session ─────────────────────────────────────────────
    const session = sessionData?.session ?? null;
    const sessionUser = session?.user ?? sessionData?.user ?? null;

    console.log('[LOGIN_OK] User:', sessionUser?.email, '| Session:', session ? 'EXISTS' : 'NULL');

    if (!session || !sessionUser) {
      setSiError('Login did not produce a session. Possible Supabase configuration mismatch.');
      setSiErrorType('env_mismatch');
      return;
    }

    // ── Remember Me ──────────────────────────────────────────────────────────
    try {
      if (siRemember) {
        localStorage.setItem('investoft_remember_email', siEmail);
      } else {
        localStorage.removeItem('investoft_remember_email');
      }
    } catch (e) {}

    // ── STEP 3: Redirect — set guard first to prevent useEffect double-redirect
    const userEmail = sessionUser.email ?? '';
    console.log('[AUTH_REDIRECT] Email:', userEmail, '| Redirecting directly based on email');

    // Set redirectingRef BEFORE window.location.href to prevent
    // the useEffect above from also triggering a redirect
    redirectingRef.current = true;
    // Also set hardNavigating in AuthContext to prevent SIGNED_OUT loop
    if (typeof setHardNavigating === 'function') {
      setHardNavigating(true);
    }

    // Redirect directly to admin or trade based on email
    const dest = userEmail === ADMIN_EMAIL ? '/admin' : '/trade';
    window.location.href = dest;
  }

  // ─── Sign Up handler ─────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSuError('');
    setSuSuccess('');
    if (!suEmail) { setSuError('Please enter your email'); return; }
    if (!suPassword) { setSuError('Please enter your password'); return; }
    if (suPassword !== suConfirmPass) { setSuError('Passwords do not match'); return; }
    if (!suTerms) { setSuError('You must agree to the terms and conditions'); return; }
    if (passwordStrength.strength === 'weak') { setSuError('Password is too weak. Use at least 8 characters with uppercase letters, numbers, and symbols.'); return; }

    setSuLoading(true);
    try {
      const phoneValue = suPhone ? selectedCountryCode + ' ' + suPhone : '';
      await signUp(suEmail, suPassword, { phone: phoneValue });
      signupJustCompletedRef.current = true;
      setSuSuccess('Account created successfully! Please check your email for confirmation.');
    } catch (err: any) {
      const msg = err?.message || String(err) || '';
      if (isRateLimitError(msg)) {
        setSuError('Too many requests. Please wait before trying again.');
      } else if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already exists')) {
        setSuError('This email is already registered. Please sign in or use a different email.');
      } else {
        setSuError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setSuLoading(false);
    }
  }

  // ─── Forgot Password handler ─────────────────────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) { setForgotMsg('Please enter your email'); return; }
    if (forgotCooldown > 0) return;
    setForgotLoading(true);
    setForgotMsg('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });
      if (error) {
        if (isRateLimitError(error.message)) {
          setForgotMsg('Too many requests. Please wait 60 seconds before trying again.');
          startCooldown(setForgotCooldown, forgotCooldownRef, 60);
        } else {
          setForgotMsg('Failed to send reset email: ' + error.message);
        }
      } else {
        setForgotMsg('Password reset email has been sent. Please check your inbox.');
        startCooldown(setForgotCooldown, forgotCooldownRef, 60);
      }
    } catch (err: any) {
      setForgotMsg('Failed to send password reset email.');
    } finally {
      setForgotLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1526 50%, #0a0e1a 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Investoft</span>
          </div>
          <p className="text-gray-400 text-sm">Professional Trading Platform</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Mode Tabs */}
          {!forgotMode && (
            <div className="flex mb-6 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'signin' ?'text-white' :'text-gray-400 hover:text-gray-300'
                }`}
                style={mode === 'signin' ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' } : {}}
              >
                Sign In
              </button>
              <button
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'signup' ?'text-white' :'text-gray-400 hover:text-gray-300'
                }`}
                style={mode === 'signup' ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' } : {}}
              >
                Sign Up
              </button>
            </div>
          )}

          <div className={`transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            {/* ── FORGOT PASSWORD ── */}
            {forgotMode ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-white mb-1">Reset Password</h2>
                  <p className="text-gray-400 text-sm">Enter your email to receive a password reset link</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                {forgotMsg && (
                  <p className={`text-sm ${forgotMsg.toLowerCase().includes('sent') || forgotMsg.toLowerCase().includes('check your inbox') ? 'text-green-400' : 'text-red-400'}`}>{forgotMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading || forgotCooldown > 0}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                >
                  {forgotLoading ? 'Sending...' : forgotCooldown > 0 ? `Wait ${forgotCooldown}s` : 'Send Reset Email'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(siEmail); setForgotMsg(''); }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  &#8592; Back to Login
                </button>
              </form>
            ) : mode === 'signin' ? (
              /* ── SIGN IN ── */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    placeholder="email@example.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={siShowPass ? 'text' : 'password'}
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setSiShowPass(!siShowPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {siShowPass ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
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
                      className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-400">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setForgotEmail(siEmail); setForgotMsg(''); }}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {siError && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-red-400 text-sm">{siError}</p>
                    {siErrorType === 'email_not_confirmed' && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendLoading || resendCooldown > 0}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend confirmation email'}
                      </button>
                    )}
                    {resendMsg && <p className="mt-1 text-xs text-green-400">{resendMsg}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={siLoading || siCooldown > 0}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                >
                  {siLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : siCooldown > 0 ? `Wait ${siCooldown}s` : 'Sign In'}
                </button>
              </form>
            ) : (
              /* ── SIGN UP ── */
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="email@example.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number (optional)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => setSelectedCountryCode(e.target.value)}
                      className="w-2/5 px-3 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 border border-slate-700"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code} style={{ background: '#1e293b' }}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={suPhone}
                      onChange={(e) => setSuPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="2125551234"
                      className="flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={suShowPass ? 'text' : 'password'}
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setSuShowPass(!suShowPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {suShowPass ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {suPassword && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(passwordStrength.score / 5) * 100}%`,
                            background: passwordStrength.strength === 'weak' ? '#ef4444' : passwordStrength.strength === 'medium' ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: passwordStrength.strength === 'weak' ? '#ef4444' : passwordStrength.strength === 'medium' ? '#f59e0b' : '#22c55e' }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={suShowConfirm ? 'text' : 'password'}
                      value={suConfirmPass}
                      onChange={(e) => setSuConfirmPass(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setSuShowConfirm(!suShowConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {suShowConfirm ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={suTerms}
                    onChange={(e) => setSuTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-400">
                    I agree to the{' '}
                    <a href="#" className="text-blue-400 hover:text-blue-300">Terms & Conditions</a>{' '}and{' '}
                    <a href="#" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
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
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                >
                  {suLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Registering...
                    </span>
                  ) : 'Register Now'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          &copy; 2024 Investoft. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <AuthErrorBoundary>
      <AuthPageInner />
    </AuthErrorBoundary>
  );
}