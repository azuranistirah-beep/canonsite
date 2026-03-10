import { NextResponse } from 'next/server';

export const revalidate = 0;

// Map Binance symbols to CoinGecko IDs
const COINGECKO_ID_MAP: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  BNBUSDT: 'binancecoin',
  SOLUSDT: 'solana',
  XRPUSDT: 'ripple',
  ADAUSDT: 'cardano',
  DOGEUSDT: 'dogecoin',
  DOTUSDT: 'polkadot',
  LTCUSDT: 'litecoin',
  LINKUSDT: 'chainlink',
  AVAXUSDT: 'avalanche-2',
  MATICUSDT: 'matic-network',
  UNIUSDT: 'uniswap',
  ATOMUSDT: 'cosmos',
  ETCUSDT: 'ethereum-classic',
};

// Map Binance symbols to Kraken pairs
const KRAKEN_PAIR_MAP: Record<string, string> = {
  BTCUSDT: 'XBTUSD',
  ETHUSDT: 'ETHUSD',
  SOLUSDT: 'SOLUSD',
  XRPUSDT: 'XRPUSD',
  ADAUSDT: 'ADAUSD',
  DOGEUSDT: 'XDGUSD',
  DOTUSDT: 'DOTUSD',
  LTCUSDT: 'LTCUSD',
  LINKUSDT: 'LINKUSD',
  AVAXUSDT: 'AVAXUSD',
  UNIUSDT: 'UNIUSD',
  ATOMUSDT: 'ATOMUSD',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase();

  // ── Attempt 1: Binance official ──────────────────────────────────────────
  try {
    console.log(`[prices/binance] Attempt 1: Binance official for ${symbol}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const [priceRes, tickerRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      }),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      }),
    ]);
    clearTimeout(timeout);
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      const price = parseFloat(priceData.price);
      if (price > 0) {
        const tickerData = tickerRes.ok ? await tickerRes.json() : null;
        const change24h = tickerData ? parseFloat(tickerData.priceChangePercent) : 0;
        console.log(`[prices/binance] ✅ Binance official SUCCESS: ${symbol} = ${price}`);
        return NextResponse.json({ success: true, price, change24h });
      }
    }
    console.log(`[prices/binance] ❌ Binance official failed: status=${priceRes.status}`);
  } catch (e: any) {
    console.log(`[prices/binance] ❌ Binance official error: ${e?.message}`);
  }

  // ── Attempt 2: Binance US ────────────────────────────────────────────────
  try {
    console.log(`[prices/binance] Attempt 2: Binance US for ${symbol}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const [priceRes, tickerRes] = await Promise.all([
      fetch(`https://api.us.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      }),
      fetch(`https://api.us.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      }),
    ]);
    clearTimeout(timeout);
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      const price = parseFloat(priceData.price);
      if (price > 0) {
        const tickerData = tickerRes.ok ? await tickerRes.json() : null;
        const change24h = tickerData ? parseFloat(tickerData.priceChangePercent) : 0;
        console.log(`[prices/binance] ✅ Binance US SUCCESS: ${symbol} = ${price}`);
        return NextResponse.json({ success: true, price, change24h });
      }
    }
    console.log(`[prices/binance] ❌ Binance US failed: status=${priceRes.status}`);
  } catch (e: any) {
    console.log(`[prices/binance] ❌ Binance US error: ${e?.message}`);
  }

  // ── Attempt 3: CoinGecko ─────────────────────────────────────────────────
  const geckoId = COINGECKO_ID_MAP[symbol];
  if (geckoId) {
    try {
      console.log(`[prices/binance] Attempt 3: CoinGecko for ${symbol} (id=${geckoId})`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`,
        { headers: { 'Accept': 'application/json' }, signal: controller.signal, cache: 'no-store' }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const price = data[geckoId]?.usd;
        const change24h = data[geckoId]?.usd_24h_change ?? 0;
        if (price && price > 0) {
          console.log(`[prices/binance] ✅ CoinGecko SUCCESS: ${symbol} = ${price}`);
          return NextResponse.json({ success: true, price, change24h });
        }
      }
      console.log(`[prices/binance] ❌ CoinGecko failed: status=${res.status}`);
    } catch (e: any) {
      console.log(`[prices/binance] ❌ CoinGecko error: ${e?.message}`);
    }
  }

  // ── Attempt 4: Kraken ────────────────────────────────────────────────────
  const krakenPair = KRAKEN_PAIR_MAP[symbol];
  if (krakenPair) {
    try {
      console.log(`[prices/binance] Attempt 4: Kraken for ${symbol} (pair=${krakenPair})`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`,
        { headers: { 'Accept': 'application/json' }, signal: controller.signal, cache: 'no-store' }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (!data.error?.length && data.result) {
          const pairKey = Object.keys(data.result)[0];
          const ticker = data.result[pairKey];
          const price = parseFloat(ticker?.c?.[0]);
          const open = parseFloat(ticker?.o);
          const change24h = open > 0 ? ((price - open) / open) * 100 : 0;
          if (price > 0) {
            console.log(`[prices/binance] ✅ Kraken SUCCESS: ${symbol} = ${price}`);
            return NextResponse.json({ success: true, price, change24h });
          }
        }
      }
      console.log(`[prices/binance] ❌ Kraken failed: status=${res.status}`);
    } catch (e: any) {
      console.log(`[prices/binance] ❌ Kraken error: ${e?.message}`);
    }
  }

  // ── All fallbacks failed ─────────────────────────────────────────────────
  console.log(`[prices/binance] ❌ ALL sources failed for ${symbol} — returning price=0`);
  return NextResponse.json({ success: false, price: 0, change24h: 0 });
}
