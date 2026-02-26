import { NextResponse } from 'next/server';

export const revalidate = 0;

// Fallback prices (updated to realistic Feb 2026 values)
const FALLBACK_PRICES: Record<string, { price: number; change: number }> = {
  'EUR/USD': { price: 1.0450, change: 0.12 },
  'GBP/USD': { price: 1.2634, change: 0.08 },
  'USD/JPY': { price: 151.87, change: -0.15 },
  'Gold': { price: 5164.78, change: -0.04 },
  'Silver': { price: 32.50, change: 0.31 },
  'Crude Oil': { price: 72.50, change: -0.55 },
  'AAPL': { price: 227.50, change: 0.28 },
  'TSLA': { price: 285.00, change: 1.20 },
  'NVDA': { price: 875.00, change: 2.10 },
  'MSFT': { price: 415.00, change: 0.35 },
};

// Stooq symbols for commodities and forex (free, no API key, matches TradingView)
const STOOQ_SYMBOLS: { key: string; stooq: string; decimals: number }[] = [
  { key: 'Gold', stooq: 'xauusd', decimals: 2 },
  { key: 'Silver', stooq: 'xagusd', decimals: 3 },
  { key: 'Crude Oil', stooq: 'cl.f', decimals: 2 },
  { key: 'EUR/USD', stooq: 'eurusd', decimals: 4 },
  { key: 'GBP/USD', stooq: 'gbpusd', decimals: 4 },
  { key: 'USD/JPY', stooq: 'usdjpy', decimals: 2 },
];

// Yahoo Finance symbols for stocks
const STOCK_SYMBOLS: { key: string; yahoo: string; decimals: number }[] = [
  { key: 'AAPL', yahoo: 'AAPL', decimals: 2 },
  { key: 'TSLA', yahoo: 'TSLA', decimals: 2 },
  { key: 'NVDA', yahoo: 'NVDA', decimals: 2 },
  { key: 'MSFT', yahoo: 'MSFT', decimals: 2 },
];

async function fetchStooqPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    // Stooq CSV API: returns OHLCV data, last row is most recent
    const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketDataBot/1.0)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
    const dataLine = lines[lines.length - 1];
    const parts = dataLine.split(',');
    if (parts.length < 7) return null;
    const open = parseFloat(parts[3]);
    const close = parseFloat(parts[6]);
    if (isNaN(close) || close <= 0) return null;
    const changePercent = open > 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, change: parseFloat(changePercent.toFixed(2)) };
  } catch {
    return null;
  }
}

async function fetchYahooPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    // Yahoo Finance v8 quote endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketDataBot/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    if (!price || price <= 0) return null;
    const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, change: parseFloat(changePercent.toFixed(2)) };
  } catch {
    return null;
  }
}

export async function GET() {
  const result: Record<string, { price: number; change: number; symbol: string }> = {};

  // Fetch Stooq prices (commodities + forex) in parallel
  const stooqResults = await Promise.allSettled(
    STOOQ_SYMBOLS.map(s => fetchStooqPrice(s.stooq))
  );

  STOOQ_SYMBOLS.forEach((item, idx) => {
    const r = stooqResults[idx];
    if (r.status === 'fulfilled' && r.value) {
      result[item.key] = {
        price: parseFloat(r.value.price.toFixed(item.decimals)),
        change: r.value.change,
        symbol: item.key,
      };
    } else {
      // Use fallback
      const fb = FALLBACK_PRICES[item.key];
      if (fb) result[item.key] = { ...fb, symbol: item.key };
    }
  });

  // Fetch Yahoo Finance prices for stocks in parallel
  const yahooResults = await Promise.allSettled(
    STOCK_SYMBOLS.map(s => fetchYahooPrice(s.yahoo))
  );

  STOCK_SYMBOLS.forEach((item, idx) => {
    const r = yahooResults[idx];
    if (r.status === 'fulfilled' && r.value) {
      result[item.key] = {
        price: parseFloat(r.value.price.toFixed(item.decimals)),
        change: r.value.change,
        symbol: item.key,
      };
    } else {
      const fb = FALLBACK_PRICES[item.key];
      if (fb) result[item.key] = { ...fb, symbol: item.key };
    }
  });

  return NextResponse.json({ success: true, data: result });
}
