'use client';

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_SINGLETON_KEY = '__supabase_browser_client__';

// Consistent storage key — all session data is stored under this key only.
// Changing this key would invalidate all existing sessions, so keep it stable.
const STORAGE_KEY = 'sb-auth-token';

export function createClient() {
  if (!(globalThis as any)[SUPABASE_SINGLETON_KEY]) {
    (globalThis as any)[SUPABASE_SINGLETON_KEY] = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: STORAGE_KEY,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return (globalThis as any)[SUPABASE_SINGLETON_KEY];
}
