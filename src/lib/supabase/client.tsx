'use client';

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_SINGLETON_KEY = '__supabase_browser_client__';

let _instanceId: string | null = null;
export function getClientInstanceId(): string {
  return _instanceId ?? 'not-created';
}

export function createClient() {
  if (!(globalThis as any)[SUPABASE_SINGLETON_KEY]) {
    _instanceId = Math.random().toString(36).slice(2, 8).toUpperCase();

    // createBrowserClient from @supabase/ssr automatically syncs the session
    // to cookies, which allows the server-side middleware to read the session.
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    (globalThis as any)[SUPABASE_SINGLETON_KEY] = client;
    (globalThis as any)[SUPABASE_SINGLETON_KEY + '_id'] = _instanceId;
    console.log(`[SupabaseSingleton] Created — instanceId: ${_instanceId}`);
  } else {
    if (!_instanceId) {
      _instanceId = (globalThis as any)[SUPABASE_SINGLETON_KEY + '_id'] || 'RESTORED';
    }
  }

  return (globalThis as any)[SUPABASE_SINGLETON_KEY];
}

// Kept for backward compatibility
export function clearSupabaseAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    // Clear all supabase-related storage keys
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function incrementAuthCounter(key: 'getSession' | 'onAuthStateChange') {
  if (typeof window === 'undefined') return;
  try {
    const counters = (window as any).__authCallCounters || {};
    counters[key] = (counters[key] ?? 0) + 1;
    (window as any).__authCallCounters = counters;
  } catch { /* ignore */ }
}
