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

    // createBrowserClient from @supabase/ssr uses cookies by default,
    // which is compatible with SSR and works even when localStorage is disabled.
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

// Kept for backward compatibility — no-op in SSR cookie mode
export function clearSupabaseAuthStorage(): void {
  // Cookies are managed by the browser/server automatically
}

export function incrementAuthCounter(_key: 'getSession' | 'onAuthStateChange') {
  // no-op
}
