import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Only apply admin check for /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
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

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return NextResponse.redirect(new URL('/auth?redirect=/admin', request.url));
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single();

      if (!profile || (profile.role !== 'admin' && !profile.is_admin)) {
        return NextResponse.redirect(new URL('/trade', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/auth?redirect=/admin', request.url));
    }
  }

  return response;
}

export const config = {
  // Run on all app routes except static assets and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
