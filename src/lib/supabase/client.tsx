'use client';

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_SINGLETON_KEY = '__supabase_browser_client__';

// ─── Dev-only call counters ───────────────────────────────────────────────────
// These help verify that auth calls are not spamming in production.
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).__authCallCounters = (window as any).__authCallCounters || {
    getSession: 0,
    onAuthStateChange: 0,
  };
}

export function incrementAuthCounter(key: 'getSession' | 'onAuthStateChange') {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const counters = (window as any).__authCallCounters;
    if (counters) {
      counters[key] = (counters[key] || 0) + 1;
      console.log(`[AuthCounter] ${key} called — total: ${counters[key]}`);
    }
  }
}

/**
 * Clear all Supabase auth storage keys from localStorage, sessionStorage, and cookies.
 */
export function clearSupabaseAuthStorage(): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';

  const patterns = [
    'sb-auth-token',
    ...(projectRef ? [
      `sb-${projectRef}-auth-token`,
      `sb-${projectRef}-auth-token-code-verifier`,
    ] : []),
  ];

  // Clear localStorage
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase')
    );
    [...new Set([...keys, ...patterns])].forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
  } catch { /* SSR */ }

  // Clear sessionStorage
  try {
    const keys = Object.keys(sessionStorage).filter(
      (k) => k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase')
    );
    [...new Set([...keys, ...patterns])].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  } catch { /* SSR */ }

  // Clear cookies
  try {
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0].trim();
        if (name.startsWith('sb-') || name.includes('auth-token') || name.includes('supabase')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
        }
      });
    }
  } catch { /* SSR */ }
}

/**
 * Synchronously inspect the stored Supabase session in localStorage and
 * remove it if the refresh_token is missing or the access_token is expired.
 */
function purgeStaleSessions(): void {
  if (typeof window === 'undefined') return;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';

    const storageKeys = [
      'sb-auth-token',
      ...(projectRef ? [`sb-${projectRef}-auth-token`] : []),
    ];

    for (const key of storageKeys) {
      let raw: string | null = null;
      try { raw = localStorage.getItem(key); } catch { /* ignore */ }
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        // Handle both direct session objects and wrapped {currentSession: ...} shapes
        const sess = parsed?.currentSession ?? parsed;
        const refreshToken: string | undefined = sess?.refresh_token;
        const accessToken: string | undefined = sess?.access_token;

        let isExpired = true; // default to expired if we can't parse
        if (accessToken) {
          try {
            const parts = accessToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              const now = Math.floor(Date.now() / 1000);
              // Consider expired if within 30 seconds of expiry
              isExpired = typeof payload.exp === 'number' && payload.exp < now + 30;
            }
          } catch { isExpired = true; }
        }

        // With autoRefreshToken: false, we cannot refresh an expired token.
        // Remove the session if:
        //   1. No refresh token at all (can't refresh), OR
        //   2. Access token is expired (refresh would be needed but is disabled)
        // This prevents Supabase from attempting a refresh and throwing
        // "Invalid Refresh Token: Refresh Token Not Found"
        if (!refreshToken || isExpired) {
          console.warn(
            '[Supabase] Purging stale session from',
            key,
            '— reason:',
            !refreshToken ? 'no refresh token' : 'access token expired (autoRefreshToken disabled)'
          );
          try { localStorage.removeItem(key); } catch { /* ignore */ }
        }
      } catch {
        // Corrupt JSON — remove it
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore all errors in this pre-flight check */ }
}

export function createClient() {
  if (!(globalThis as any)[SUPABASE_SINGLETON_KEY]) {
    // Purge any stale/invalid sessions BEFORE creating the client.
    // This prevents autoRefreshToken from firing with a missing refresh token.
    purgeStaleSessions();

    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // ⚠️ DISABLED: autoRefreshToken causes repeated background requests
          // to Supabase Auth every ~4 minutes, which triggers 429 rate limits
          // in preview/sandbox environments. Token refresh is handled manually
          // via onAuthStateChange TOKEN_REFRESHED events instead.
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );
    (globalThis as any)[SUPABASE_SINGLETON_KEY] = client;
  }
  return (globalThis as any)[SUPABASE_SINGLETON_KEY];
}
