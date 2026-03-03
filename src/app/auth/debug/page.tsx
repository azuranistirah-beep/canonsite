'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DebugInfo {
  origin: string;
  hasSbCookie: boolean | null;
  sessionStatus: string;
  userEmail: string | null;
}

export default function AuthDebugPage() {
  const [info, setInfo] = useState<DebugInfo>({
    origin: '',
    hasSbCookie: null,
    sessionStatus: 'loading...',
    userEmail: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function gather() {
      const origin = window.location.origin;

      // Check for sb- or supabase cookies (show presence only, not value)
      const cookies = document.cookie;
      const hasSbCookie =
        cookies.split(';').some((c) => {
          const name = c.trim().split('=')[0];
          return name.startsWith('sb-') || name.toLowerCase().includes('supabase');
        });

      const supabase = createClient();

      // getSession
      let sessionStatus = 'MISSING';
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          sessionStatus = `ERROR: ${sessionError.message}`;
        } else if (sessionData?.session) {
          sessionStatus = `EXISTS (user: ${sessionData.session.user?.email ?? 'unknown'})`;
        } else {
          sessionStatus = 'MISSING';
        }
      } catch (e: any) {
        sessionStatus = `EXCEPTION: ${e?.message}`;
      }

      // getUser
      let userEmail: string | null = null;
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          userEmail = `ERROR: ${userError.message}`;
        } else if (userData?.user?.email) {
          userEmail = userData.user.email;
        } else {
          userEmail = null;
        }
      } catch (e: any) {
        userEmail = `EXCEPTION: ${e?.message}`;
      }

      setInfo({ origin, hasSbCookie, sessionStatus, userEmail });
      setLoading(false);
    }

    gather();
  }, []);

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', padding: '2rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#60a5fa', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
        🔍 Auth Debug — /auth/debug
      </h1>
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Gathering diagnostics...</p>
      ) : (
        <pre
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '1.5rem',
            fontSize: '0.875rem',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
{`1. window.location.origin
   → ${info.origin}

2. Cookie "sb-" / "supabase" detected?
   → ${info.hasSbCookie ? 'YES — sb-/supabase cookie found' : 'NO — no sb-/supabase cookie detected'}

3. supabase.auth.getSession()
   → ${info.sessionStatus}

4. supabase.auth.getUser()
   → ${info.userEmail !== null ? info.userEmail : 'null (no authenticated user)'}`}
        </pre>
      )}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <a
          href="/auth"
          style={{
            background: '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          ← Back to Login
        </a>
        <a
          href="/auth/callback"
          style={{
            background: '#16a34a',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          Test /auth/callback
        </a>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#7c3aed',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
