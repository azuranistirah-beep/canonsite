import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use createServerClient with the token injected as global Authorization header
    // This is the correct pattern for verifying JWTs in API routes
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[Bootstrap] getUser failed:', userError?.message);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if profile already exists
    const { data: existing, error: selectError } = await supabase
      .from('user_profiles')
      .select('id, is_admin, role')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ profile: existing });
    }

    // Profile missing — insert via RPC (SECURITY DEFINER bypasses RLS)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('upsert_own_profile', {
        p_email: user.email ?? '',
        p_full_name: user.user_metadata?.full_name ?? '',
      });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const profile = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    return NextResponse.json({ profile: profile ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
