import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

const getSupabaseAdmin = () => {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Webhook] Missing stripe-signature or webhook secret');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    console.error('[Webhook] Signature verification failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { user_id, amount, currency } = session.metadata ?? {};

      if (!user_id || !amount || !currency) {
        console.error('[Webhook] Missing metadata in session:', session.id);
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }

      if (session.payment_status !== 'paid') {
        console.log('[Webhook] Session not paid yet:', session.id);
        return NextResponse.json({ received: true });
      }

      const supabaseAdmin = getSupabaseAdmin();
      const depositAmount = parseFloat(amount);

      const { data: existingRequest } = await supabaseAdmin
        .from('deposit_requests')
        .select('id, status')
        .like('notes', `%${session.id}%`)
        .maybeSingle();

      if (existingRequest?.status === 'completed') {
        console.log('[Webhook] Already processed:', session.id);
        return NextResponse.json({ received: true });
      }

      const { data: realAccount, error: accountError } = await supabaseAdmin
        .from('real_accounts')
        .select('id, balance')
        .eq('user_id', user_id)
        .single();

      if (accountError || !realAccount) {
        console.error('[Webhook] Real account not found for user:', user_id);
        const { error: createError } = await supabaseAdmin
          .from('real_accounts')
          .insert({ user_id, balance: depositAmount, currency: currency });
        if (createError) {
          console.error('[Webhook] Failed to create real account:', createError);
          return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
        }
      } else {
        const newBalance = parseFloat(String(realAccount.balance)) + depositAmount;
        const { error: updateError } = await supabaseAdmin
          .from('real_accounts')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', realAccount.id);

        if (updateError) {
          console.error('[Webhook] Failed to update balance:', updateError);
          return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
        }
      }

      if (existingRequest?.id) {
        await supabaseAdmin
          .from('deposit_requests')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', existingRequest.id);
      } else {
        await supabaseAdmin.from('deposit_requests').insert({
          user_id,
          amount: depositAmount,
          payment_method: 'stripe_checkout',
          account_type: 'real',
          status: 'completed',
          notes: JSON.stringify({
            currency,
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
          }),
        });
      }

      console.log(`[Webhook] Deposit processed: user=${user_id}, amount=${depositAmount} ${currency}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('[Webhook] Processing error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
