import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
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
                cookieStore.set(name, value, options)
              );
            } catch {
              // Route handler — cookies can be set here
            }
          },
        },
      }
    );

    // Verify authenticated user from cookie-based session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log('[Bootstrap] auth.getUser() result:', {
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      error: userError?.message ?? null,
    });

    if (userError || !user) {
      console.error('[Bootstrap] No authenticated user from cookie session:', userError?.message);
      return NextResponse.redirect(new URL('/auth?error=not_authenticated', request.url));
    }

    const userId = user.id;
    const userEmail = user.email ?? '';

    // Upsert profile via SECURITY DEFINER RPC — auth context is valid server-side
    const { data: rpcResult, error: rpcError } = await supabase.rpc('upsert_own_profile', {
      p_email: userEmail,
      p_full_name: user.user_metadata?.full_name ?? '',
    });

    console.log('[Bootstrap] upsert_own_profile RPC result:', {
      rpcResult,
      rpcError: rpcError ? { message: rpcError.message, code: rpcError.code, hint: rpcError.hint } : null,
    });

    if (rpcError) {
      console.error('[Bootstrap] RPC error:', rpcError.message, 'code:', rpcError.code);
      // Fallback: try direct SELECT if RPC fails
    }

    // Query profile to get is_admin and role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_admin, role')
      .eq('id', userId)
      .maybeSingle();

    console.log('[Bootstrap] profile query result:', {
      userId,
      profile,
      profileError: profileError ? { message: profileError.message, code: profileError.code } : null,
    });

    if (profileError) {
      console.error('[Bootstrap] Profile query error:', profileError.message);
      return NextResponse.redirect(
        new URL(`/auth?error=${encodeURIComponent(profileError.message)}`, request.url)
      );
    }

    const isAdmin = profile?.is_admin === true;
    const redirectTarget = isAdmin ? '/admin' : '/trade';

    console.log('[Bootstrap] Final decision:', {
      userId,
      userEmail,
      isAdmin,
      role: profile?.role,
      redirectTarget,
    });

    return NextResponse.redirect(new URL(redirectTarget, request.url));
  } catch (err: any) {
    console.error('[Bootstrap] Unexpected error:', err?.message ?? err);
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(err?.message ?? 'unknown')}`, request.url)
    );
  }
}
