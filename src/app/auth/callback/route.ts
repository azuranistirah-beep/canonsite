import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_EMAIL = 'support@investoft.com';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  // Handle email confirmation token_hash flow
  if (tokenHash && type) {
    return NextResponse.redirect(`${origin}/auth/confirm?token_hash=${tokenHash}&type=${type}`);
  }

  // If no OAuth code, this is a direct visit — redirect to auth
  if (!code) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
              })
            );
          } catch {
            // ignore in read-only contexts
          }
        },
      },
    }
  );

  // Exchange OAuth code for session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[/auth/callback] exchangeCodeForSession error:', exchangeError.message);
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent('OAuth login failed: ' + exchangeError.message)}`, request.url)
    );
  }

  // Verify session server-side via getUser (reads cookies)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    // Cookie may be blocked in preview/iframe environments.
    // Redirect back to login with a helpful message.
    console.error('[/auth/callback] getUser() returned null after code exchange. userError:', userError?.message);
    return NextResponse.redirect(
      new URL('/auth?error=' + encodeURIComponent('Session could not be verified. Please try signing in again.'), request.url)
    );
  }

  // Session valid — redirect based on email
  if (user.email === ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.redirect(new URL('/trade', request.url));
}
