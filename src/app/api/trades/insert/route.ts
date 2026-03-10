import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Validate the token and get the user
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (!user || error) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    user_id,
    asset_symbol,
    asset_name,
    direction,
    amount,
    entry_price,
    duration_seconds,
    account_type,
    opened_at,
  } = body;

  if (user.id !== user_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create a client with the user's token so the insert runs as `authenticated` role
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data, error: insertError } = await supabaseUser
    .from('trades')
    .insert({
      user_id,
      asset_symbol,
      asset_name,
      direction,
      amount,
      entry_price,
      duration_seconds,
      status: 'active',
      profit_loss: 0,
      account_type,
      opened_at,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[/api/trades/insert] insert error:', JSON.stringify(insertError));
    return NextResponse.json({ error: insertError.message, details: insertError }, { status: 500 });
  }

  return NextResponse.json(data);
}
