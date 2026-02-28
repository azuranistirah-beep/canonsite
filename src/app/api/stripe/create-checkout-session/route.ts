import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

// Payment methods per currency
// MYR: card, fpx (online banking), grabpay (Touch n Go / Boost use GrabPay/FPX rails on Stripe)
// SGD: card, paynow, grabpay
// THB: card, promptpay, grabpay
// PHP: card, gcash, grabpay
// CNY: card, alipay, wechat_pay
// USD/EUR: card, alipay (global)
const CURRENCY_PAYMENT_METHODS: Record<string, Stripe.Checkout.SessionCreateParams.PaymentMethodType[]> = {
  MYR: ['card', 'fpx', 'grabpay'],
  SGD: ['card', 'paynow', 'grabpay'],
  THB: ['card', 'promptpay', 'grabpay'],
  PHP: ['card', 'gcash', 'grabpay'],
  USD: ['card', 'alipay'],
  EUR: ['card', 'alipay'],
  GBP: ['card'],
  AED: ['card'],
  AUD: ['card'],
  JPY: ['card'],
  CNY: ['card', 'alipay', 'wechat_pay'],
  VND: ['card'],
};

const CURRENCY_MAX_AMOUNTS: Record<string, number> = {
  MYR: 10000,
  USD: 2300,
  EUR: 2150,
  GBP: 1850,
  SGD: 3100,
  THB: 77000,
  PHP: 131000,
  JPY: 345000,
  AUD: 3500,
  CNY: 16700,
  AED: 8450,
  VND: 57000000,
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, currency, depositTab } = body as {
      amount: number;
      currency: string;
      depositTab: string;
    };

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const currencyUpper = (currency || 'USD').toUpperCase();
    const maxAmount = CURRENCY_MAX_AMOUNTS[currencyUpper] ?? CURRENCY_MAX_AMOUNTS['USD'];
    if (amount > maxAmount) {
      return NextResponse.json({ error: `Maximum deposit is ${currencyUpper} ${maxAmount.toLocaleString()}` }, { status: 400 });
    }

    const paymentMethods = CURRENCY_PAYMENT_METHODS[currencyUpper] ?? ['card'];
    const amountInSmallestUnit = Math.round(amount * 100);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canonsite8485.builtwithrocket.new';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: paymentMethods,
      line_items: [
        {
          price_data: {
            currency: currencyUpper.toLowerCase(),
            product_data: {
              name: 'Investoft Account Deposit',
              description: `Deposit to Real Trading Account — ${currencyUpper} ${amount.toLocaleString()}`,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/dashboard?deposit_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard?deposit_cancelled=true`,
      metadata: {
        user_id: user.id,
        amount: String(amount),
        currency: currencyUpper,
        deposit_tab: depositTab || 'stripe',
      },
      customer_email: user.email,
    };

    // WeChat Pay requires additional client configuration
    if (paymentMethods.includes('wechat_pay')) {
      sessionParams.payment_method_options = {
        wechat_pay: {
          client: 'web',
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    const { error: dbError } = await supabase.from('deposit_requests').insert({
      user_id: user.id,
      amount: amount,
      payment_method: `stripe_${depositTab || 'card'}`,
      account_type: 'real',
      status: 'pending',
      notes: JSON.stringify({
        currency: currencyUpper,
        stripe_session_id: session.id,
        payment_methods: paymentMethods,
      }),
    });

    if (dbError) {
      console.error('[Stripe] DB insert error:', dbError);
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    console.error('[Stripe] create-checkout-session error:', err);
    // User-friendly error for unsupported payment methods
    if (message.includes('payment_method_types') || message.includes('Invalid payment method') || message.includes('does not support')) {
      return NextResponse.json({ error: 'Metode pembayaran tidak didukung untuk mata uang ini. Silakan gunakan kartu kredit/debit.' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
