import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_EMAIL = 'support@investoft.com';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only guard /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Skip middleware for non-GET requests (POST, PUT, etc.) to avoid interfering with API calls
  if (request.method !== 'GET') {
    return NextResponse.next();
  }

  // Build a response we can attach refreshed cookies to
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Server-side session verification
  // getUser() validates the JWT with Supabase server — more secure than getSession()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // No valid session → send to /auth
  if (error || !user) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Valid session but NOT the admin email → send to /trade
  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/trade', request.url));
  }

  // Admin email confirmed — allow through with refreshed cookies
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
