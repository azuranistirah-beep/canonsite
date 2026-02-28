import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Only apply auth check for /admin routes
  if (pathname.startsWith('/admin')) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      // Get authenticated user (verifies JWT with Supabase server)
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] /admin access attempt:', {
          pathname,
          userId: user?.id,
          userEmail: user?.email,
          userError: userError?.message,
        });
      }

      // No session → redirect to /auth
      if (userError || !user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Middleware] No authenticated user, redirecting to /auth');
        }
        return NextResponse.redirect(new URL('/auth?redirect=/admin', request.url));
      }

      // Check admin status from user_profiles
      // Use .select('is_admin') only — user can always read their own row via RLS
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('is_admin, role')
        .eq('id', user.id)
        .single();

      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] Profile check result:', {
          userId: user.id,
          userEmail: user.email,
          profile,
          profileError: profileError?.message,
          is_admin: profile?.is_admin,
        });
      }

      // If profile query failed (RLS or network issue), allow access
      // Client-side AdminLayout will do secondary verification
      if (profileError) {
        console.warn('[Middleware] Profile query error:', profileError.message, '— allowing access, client will verify');
        return response;
      }

      // Profile loaded successfully — check is_admin
      const isAdmin = profile?.is_admin === true || profile?.role === 'admin';

      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] Admin check:', { isAdmin, is_admin: profile?.is_admin, role: profile?.role });
      }

      if (!isAdmin) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Middleware] User is not admin, redirecting to /trade');
        }
        return NextResponse.redirect(new URL('/trade', request.url));
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Middleware] Admin access granted for:', user.email);
      }
      return response;
    } catch (err) {
      console.error('[Middleware] Unexpected error:', err);
      // On unexpected errors, redirect to auth to be safe
      return NextResponse.redirect(new URL('/auth?redirect=/admin', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
