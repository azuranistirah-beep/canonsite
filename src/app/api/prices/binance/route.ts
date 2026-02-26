import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';

  try {
    const [priceRes, tickerRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      }),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      }),
    ]);

    if (!priceRes.ok) throw new Error('Binance price error');

    const priceData = await priceRes.json();
    const tickerData = tickerRes.ok ? await tickerRes.json() : null;

    return NextResponse.json({
      success: true,
      price: parseFloat(priceData.price),
      change24h: tickerData ? parseFloat(tickerData.priceChangePercent) : 0,
    });
  } catch (error) {
    console.error('Binance proxy error:', error);
    return NextResponse.json({ success: false, price: 0, change24h: 0 }, { status: 200 });
  }
}
