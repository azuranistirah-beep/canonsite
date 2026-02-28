'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, clearSupabaseAuthStorage, incrementAuthCounter } from '@/lib/supabase/client';

const AuthContext = createContext<any>({});

// Single client instance at module level — shared across the entire app
const supabase = createClient();

// ─── 429 Cooldown helpers ─────────────────────────────────────────────────────
const COOLDOWN_KEY = 'investoft_auth_429_until';
const COOLDOWN_DURATION_MS = 60_000; // 60 seconds

function isIn429Cooldown(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const until = sessionStorage.getItem(COOLDOWN_KEY);
    if (until && parseInt(until, 10) > Date.now()) return true;
    if (until) sessionStorage.removeItem(COOLDOWN_KEY);
  } catch { /* ignore */ }
  return false;
}

function set429Cooldown(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_DURATION_MS));
  } catch { /* ignore */ }
}

/**
 * Checks whether a JWT access token is still valid (not expired)
 * by decoding its payload locally — no network call needed.
 */
function isTokenValid(accessToken: string | undefined): boolean {
  if (!accessToken) return false;
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    return typeof payload.exp === 'number' && payload.exp > now + 10;
  } catch {
    return false;
  }
}

/**
 * Detect if an error message indicates an invalid/missing refresh token.
 */
function isInvalidRefreshTokenError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid refresh token') ||
    lower.includes('refresh token not found') ||
    lower.includes('token_not_found') ||
    lower.includes('refresh_token_not_found') ||
    lower.includes('invalid_grant')
  );
}

function is429Error(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('request rate limit') ||
    lower.includes('429')
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const initializedRef = useRef(false);
  // PERMANENT guard — once recovery runs, it NEVER resets to false.
  const alreadyRecoveredRef = useRef(false);
  // Tracks whether a signIn call is in-flight so startup checks don't interfere
  const loginInProgressRef = useRef(false);
  // Single-flight guard: prevents concurrent getSession() calls
  const inFlightRef = useRef(false);
  const router = useRouter();

  /**
   * Perform a safe recovery when an invalid refresh token is detected.
   * Guard: runs AT MOST ONCE per page lifecycle.
   */
  const handleInvalidRefreshToken = async () => {
    if (alreadyRecoveredRef.current || loginInProgressRef.current) return;
    alreadyRecoveredRef.current = true;

    console.warn('[AuthContext] Invalid refresh token detected — clearing session (one-time recovery)');

    clearSupabaseAuthStorage();

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore signOut errors
    }

    setSession(null);
    setUser(null);
    setLoading(false);

    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      router.replace('/auth');
    }
  };

  useEffect(() => {
    // Strict-mode / double-mount guard
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    // ── Dev counter log ──────────────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthContext] mount — setting up single onAuthStateChange listener');
    }

    // ── 429 cooldown check ───────────────────────────────────────────────────
    if (isIn429Cooldown()) {
      console.warn('[AuthContext] 429 cooldown active — skipping all auth calls. Reload after cooldown expires.');
      setRateLimited(true);
      setLoading(false);
      return;
    }

    // ── Single-flight guard ──────────────────────────────────────────────────
    if (inFlightRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthContext] initAuth already in-flight — skipping duplicate call');
      }
      return;
    }
    inFlightRef.current = true;

    const initAuth = async () => {
      if (!isMounted) return;

      // Register onAuthStateChange ONCE.
      // IMPORTANT: We do NOT call getSession() separately here.
      // The INITIAL_SESSION event fired by onAuthStateChange already provides
      // the current session — calling getSession() again would be a duplicate
      // request and the primary cause of 429 rate limits.
      incrementAuthCounter('onAuthStateChange');

      const { data } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!isMounted) return;

          if (process.env.NODE_ENV === 'development') {
            console.log('[AuthContext] onAuthStateChange event:', event, 'session:', currentSession ? 'exists' : 'null');
          }

          if (event === 'SIGNED_IN') {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setLoading(false);
          } else if (event === 'TOKEN_REFRESHED') {
            if (!currentSession) {
              if (!alreadyRecoveredRef.current && !loginInProgressRef.current) {
                await handleInvalidRefreshToken();
              }
              return;
            }
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setLoading(false);
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setLoading(false);
            if (
              !loginInProgressRef.current &&
              typeof window !== 'undefined' &&
              !window.location.pathname.startsWith('/auth')
            ) {
              router.replace('/auth');
            }
          } else if (event === 'USER_DELETED') {
            setSession(null);
            setUser(null);
            setLoading(false);
          } else if (event === 'INITIAL_SESSION') {
            if (currentSession) {
              if (!isTokenValid(currentSession.access_token)) {
                if (!currentSession.refresh_token) {
                  await handleInvalidRefreshToken();
                  return;
                }
              }
              setSession(currentSession);
              setUser(currentSession.user ?? null);
            } else {
              setSession(null);
              setUser(null);
            }
            setLoading(false);

            // ── Dev counter summary ──────────────────────────────────────────
            if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
              const counters = (window as any).__authCallCounters || {};
              console.log(
                `[AuthCounter] Mount complete — getSession: ${counters.getSession ?? 0}, onAuthStateChange: ${counters.onAuthStateChange ?? 0}`,
                '(target: getSession=0, onAuthStateChange=1)'
              );
            }
          }
        }
      );
      subscriptionRef.current = data.subscription;
      inFlightRef.current = false;
    };

    initAuth().catch((err: any) => {
      inFlightRef.current = false;
      const msg: string = err?.message || String(err || '');

      if (is429Error(msg)) {
        console.warn('[AuthContext] 429 from initAuth — activating cooldown');
        set429Cooldown();
        setRateLimited(true);
        setLoading(false);
        return;
      }
      if (isInvalidRefreshTokenError(msg)) {
        handleInvalidRefreshToken();
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthContext] initAuth error (non-fatal):', msg);
      }
      setLoading(false);
    });

    // Global safety net: catch any unhandled "Invalid Refresh Token" errors
    const handleAuthError = (event: ErrorEvent) => {
      if (
        event.message &&
        isInvalidRefreshTokenError(event.message) &&
        !alreadyRecoveredRef.current &&
        !loginInProgressRef.current
      ) {
        console.warn('[AuthContext] Caught unhandled invalid refresh token error — recovering');
        handleInvalidRefreshToken();
      }
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event?.reason?.message || String(event?.reason || '');
      if (is429Error(message)) {
        console.warn('[AuthContext] 429 unhandled rejection — activating cooldown');
        event.preventDefault();
        set429Cooldown();
        setRateLimited(true);
        setLoading(false);
        return;
      }
      if (
        isInvalidRefreshTokenError(message) &&
        !alreadyRecoveredRef.current &&
        !loginInProgressRef.current
      ) {
        console.warn('[AuthContext] Caught unhandled promise rejection for invalid refresh token — recovering');
        event.preventDefault();
        handleInvalidRefreshToken();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', handleAuthError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
    }

    return () => {
      isMounted = false;
      subscriptionRef.current?.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', handleAuthError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Email/Password Sign Up
  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          phone: metadata?.phone || '',
          avatar_url: metadata?.avatarUrl || ''
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`
      }
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    if (loginInProgressRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuthContext] signIn: already in progress, ignoring duplicate call');
      }
      throw new Error('Sign-in already in progress. Please wait.');
    }
    loginInProgressRef.current = true;
    if (process.env.NODE_ENV === 'development') {
      console.log('[AuthContext] signIn: calling signInWithPassword for', email);
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        if (is429Error(error.message)) {
          set429Cooldown();
          setRateLimited(true);
        }
        throw error;
      }
      return data;
    } finally {
      loginInProgressRef.current = false;
    }
  };

  // Sign Out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Resend verification email
  const resendVerificationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) throw error;
  };

  // Get Current User
  const getCurrentUser = async () => {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return currentUser;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at != null;
  };

  const value = {
    user,
    session,
    loading,
    rateLimited,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    resendVerificationEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
