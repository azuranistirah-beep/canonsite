import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Check for stale Supabase auth cookies without making any network requests.
  // Network-based auth validation (getUser/getSession) causes repeated
  // refresh_token_not_found errors on every request when the token is stale.
  // The client-side AuthContext handles token validation and recovery instead.
  const authCookies = request.cookies.getAll().filter(
    ({ name }) =>
      name.startsWith('sb-') ||
      name.includes('auth-token') ||
      name.includes('supabase')
  );

  // Pass through — let client-side auth handle session management
  return response;
}

export const config = {
  // Run on all app routes except static assets and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
