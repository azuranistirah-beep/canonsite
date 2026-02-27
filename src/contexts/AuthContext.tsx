'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const AuthContext = createContext<any>({});

// Single client instance at module level — shared across the entire app
const supabase = createClient();

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
 * Clear ALL Supabase auth-related keys from localStorage and sessionStorage.
 * Called when an invalid refresh token is detected.
 */
function clearAllAuthStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith('sb-') ||
        key.includes('auth-token') ||
        key.includes('supabase')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage not available (SSR)
  }
  try {
    const keysToRemove: string[] = [];
    for (const key of Object.keys(sessionStorage)) {
      if (
        key.startsWith('sb-') ||
        key.includes('auth-token') ||
        key.includes('supabase')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // sessionStorage not available
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
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const initializedRef = useRef(false);
  const recoveryInProgressRef = useRef(false);
  // Tracks whether a signIn call is in-flight so startup checks don't interfere
  const loginInProgressRef = useRef(false);
  // Prevents double-invocation of recovery from both getSession and INITIAL_SESSION
  const recoveryCalledRef = useRef(false);
  const router = useRouter();

  /**
   * Perform a safe recovery when an invalid refresh token is detected:
   * 1. Best-effort signOut (ignore errors)
   * 2. Clear all auth storage
   * 3. Reset state to null
   * 4. Redirect to /auth
   * Uses recoveryCalledRef to ensure this runs AT MOST ONCE per session lifecycle.
   */
  const handleInvalidRefreshToken = async () => {
    // Never run recovery while a fresh login is in progress
    if (recoveryInProgressRef.current || loginInProgressRef.current) return;
    // Prevent double-invocation (e.g. both getSession AND INITIAL_SESSION triggering this)
    if (recoveryCalledRef.current) return;
    recoveryCalledRef.current = true;
    recoveryInProgressRef.current = true;

    console.log('[AuthContext] handleInvalidRefreshToken: clearing session and redirecting');

    // Clear storage BEFORE signOut to prevent Supabase from trying to use the bad token
    clearAllAuthStorage();

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore signOut errors — we are already in a broken state
    }

    setSession(null);
    setUser(null);
    setLoading(false);

    // Only redirect if not already on /auth
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      router.replace('/auth');
    }

    recoveryInProgressRef.current = false;
    // NOTE: recoveryCalledRef stays true — do not reset it, to prevent re-entry
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    // Set up auth state listener ONCE
    const { data } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        console.log('[AuthContext] onAuthStateChange event:', event, 'session:', currentSession ? 'exists' : 'null');

        if (event === 'SIGNED_IN') {
          // Reset recovery flag on fresh sign-in so future sessions can recover if needed
          recoveryCalledRef.current = false;
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          if (!currentSession) {
            // TOKEN_REFRESHED with null session means the refresh token was invalid
            // This is the primary trigger for the refresh_token_not_found error
            if (!loginInProgressRef.current) {
              await handleInvalidRefreshToken();
            }
            return;
          }
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          // INITIAL_SESSION fires once on startup.
          // If session is null here, it means no valid session exists.
          // If session is present, validate the access token locally.
          if (currentSession) {
            if (isTokenValid(currentSession.access_token)) {
              setSession(currentSession);
              setUser(currentSession.user ?? null);
            } else {
              // Access token is expired — attempt recovery only if no login in progress
              if (isMounted && !loginInProgressRef.current) {
                await handleInvalidRefreshToken();
                return;
              }
            }
          } else {
            setSession(null);
            setUser(null);
          }
          setLoading(false);
        }
      }
    );
    subscriptionRef.current = data.subscription;

    // Startup check: call getSession once to detect broken sessions immediately.
    // This is the ONLY getSession call in the entire app.
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (!isMounted) return;

      // Never interfere with an active login attempt
      if (loginInProgressRef.current) return;

      if (error) {
        const msg = error.message || '';
        if (isInvalidRefreshTokenError(msg)) {
          handleInvalidRefreshToken();
          return;
        }
        // Other errors — treat as no session
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // If getSession returns a session, validate the access token
      if (sessionData?.session) {
        if (!isTokenValid(sessionData.session.access_token)) {
          handleInvalidRefreshToken();
          return;
        }
        // Valid session — state will be set by INITIAL_SESSION event above
      } else {
        // No session — state will be set by INITIAL_SESSION event above
      }
    });

    return () => {
      isMounted = false;
      subscriptionRef.current?.unsubscribe();
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
  // Returns { data, error } — never throws — so callers can inspect the raw Supabase response.
  const signIn = async (email: string, password: string) => {
    loginInProgressRef.current = true;
    // Reset recovery flag so a fresh login can succeed after a previous bad-token recovery
    recoveryCalledRef.current = false;
    console.log('[AuthContext] signIn: calling signInWithPassword for', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    console.log('[AuthContext] signInWithPassword result — data:', data, 'error:', error);
    loginInProgressRef.current = false;
    if (error) throw error;
    return data;
  };

  // Sign Out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Resend verification email — exposed so components don't need direct supabase access
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
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    resendVerificationEmail,
    // NOTE: supabase client is intentionally NOT exposed here.
    // Components must use the singleton from @/lib/supabase/client for DB queries,
    // and must NEVER call supabase.auth.* methods directly — use context methods instead.
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
