import { NextResponse } from 'next/server';

export const revalidate = 0;

// Fallback prices (realistic Feb 2026 values)
const FALLBACK_PRICES: Record<string, { price: number; change: number }> = {
  'EUR/USD': { price: 1.0450, change: 0.12 },
  'GBP/USD': { price: 1.2634, change: 0.08 },
  'USD/JPY': { price: 151.87, change: -0.15 },
  'AUD/USD': { price: 0.6320, change: -0.10 },
  'USD/CAD': { price: 1.4350, change: 0.05 },
  'NZD/USD': { price: 0.5720, change: -0.08 },
  'USD/CHF': { price: 0.9050, change: 0.03 },
  'EUR/GBP': { price: 0.8270, change: 0.04 },
  'EUR/JPY': { price: 158.80, change: -0.20 },
  'GBP/JPY': { price: 192.00, change: -0.25 },
  'AUD/JPY': { price: 96.00, change: -0.18 },
  'EUR/AUD': { price: 1.6530, change: 0.15 },
  'GBP/AUD': { price: 1.9990, change: 0.12 },
  'Gold': { price: 5232.00, change: 0.97 },
  'Silver': { price: 33.50, change: 0.31 },
  'Crude Oil': { price: 70.50, change: -0.55 },
  'Platinum': { price: 1020.00, change: 0.20 },
  'Copper': { price: 4.65, change: 0.15 },
  'Natural Gas': { price: 3.85, change: -1.20 },
  'Wheat': { price: 560.00, change: 0.80 },
  'Corn': { price: 480.00, change: 0.60 },
  'AAPL': { price: 227.50, change: 0.28 },
  'MSFT': { price: 415.00, change: 0.35 },
  'GOOGL': { price: 175.00, change: 0.45 },
  'AMZN': { price: 210.00, change: 0.55 },
  'TSLA': { price: 285.00, change: 1.20 },
  'META': { price: 580.00, change: 0.90 },
  'NFLX': { price: 720.00, change: 0.65 },
  'NVDA': { price: 875.00, change: 2.10 },
};

// Yahoo Finance symbols — primary source for commodities, stocks, and forex
const YAHOO_SYMBOLS: { key: string; yahoo: string; decimals: number }[] = [
  // Commodities (futures)
  { key: 'Gold', yahoo: 'GC=F', decimals: 2 },
  { key: 'Silver', yahoo: 'SI=F', decimals: 3 },
  { key: 'Crude Oil', yahoo: 'CL=F', decimals: 2 },
  { key: 'Platinum', yahoo: 'PL=F', decimals: 2 },
  { key: 'Copper', yahoo: 'HG=F', decimals: 4 },
  { key: 'Natural Gas', yahoo: 'NG=F', decimals: 3 },
  { key: 'Wheat', yahoo: 'ZW=F', decimals: 2 },
  { key: 'Corn', yahoo: 'ZC=F', decimals: 2 },
  // Forex
  { key: 'EUR/USD', yahoo: 'EURUSD=X', decimals: 4 },
  { key: 'GBP/USD', yahoo: 'GBPUSD=X', decimals: 4 },
  { key: 'USD/JPY', yahoo: 'JPY=X', decimals: 2 },
  { key: 'AUD/USD', yahoo: 'AUDUSD=X', decimals: 4 },
  { key: 'USD/CAD', yahoo: 'CAD=X', decimals: 4 },
  { key: 'NZD/USD', yahoo: 'NZDUSD=X', decimals: 4 },
  { key: 'USD/CHF', yahoo: 'CHF=X', decimals: 4 },
  { key: 'EUR/GBP', yahoo: 'EURGBP=X', decimals: 4 },
  { key: 'EUR/JPY', yahoo: 'EURJPY=X', decimals: 2 },
  { key: 'GBP/JPY', yahoo: 'GBPJPY=X', decimals: 2 },
  { key: 'AUD/JPY', yahoo: 'AUDJPY=X', decimals: 2 },
  { key: 'EUR/AUD', yahoo: 'EURAUD=X', decimals: 4 },
  { key: 'GBP/AUD', yahoo: 'GBPAUD=X', decimals: 4 },
  // Stocks
  { key: 'AAPL', yahoo: 'AAPL', decimals: 2 },
  { key: 'MSFT', yahoo: 'MSFT', decimals: 2 },
  { key: 'GOOGL', yahoo: 'GOOGL', decimals: 2 },
  { key: 'AMZN', yahoo: 'AMZN', decimals: 2 },
  { key: 'TSLA', yahoo: 'TSLA', decimals: 2 },
  { key: 'META', yahoo: 'META', decimals: 2 },
  { key: 'NFLX', yahoo: 'NFLX', decimals: 2 },
  { key: 'NVDA', yahoo: 'NVDA', decimals: 2 },
];

// Stooq symbols — secondary/fallback source for commodities and forex
const STOOQ_SYMBOLS: { key: string; stooq: string; decimals: number }[] = [
  { key: 'Gold', stooq: 'xauusd', decimals: 2 },
  { key: 'Silver', stooq: 'xagusd', decimals: 3 },
  { key: 'Crude Oil', stooq: 'cl.f', decimals: 2 },
  { key: 'Platinum', stooq: 'xptusd', decimals: 2 },
  { key: 'Copper', stooq: 'hg.f', decimals: 4 },
  { key: 'Natural Gas', stooq: 'ng.f', decimals: 3 },
  { key: 'Wheat', stooq: 'w.f', decimals: 2 },
  { key: 'Corn', stooq: 'c.f', decimals: 2 },
  { key: 'EUR/USD', stooq: 'eurusd', decimals: 4 },
  { key: 'GBP/USD', stooq: 'gbpusd', decimals: 4 },
  { key: 'USD/JPY', stooq: 'usdjpy', decimals: 2 },
  { key: 'AUD/USD', stooq: 'audusd', decimals: 4 },
  { key: 'USD/CAD', stooq: 'usdcad', decimals: 4 },
  { key: 'NZD/USD', stooq: 'nzdusd', decimals: 4 },
  { key: 'USD/CHF', stooq: 'usdchf', decimals: 4 },
  { key: 'EUR/GBP', stooq: 'eurgbp', decimals: 4 },
  { key: 'EUR/JPY', stooq: 'eurjpy', decimals: 2 },
  { key: 'GBP/JPY', stooq: 'gbpjpy', decimals: 2 },
  { key: 'AUD/JPY', stooq: 'audjpy', decimals: 2 },
  { key: 'EUR/AUD', stooq: 'euraud', decimals: 4 },
  { key: 'GBP/AUD', stooq: 'gbpaud', decimals: 4 },
];

async function fetchYahooPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
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

async function fetchStooqPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketDataBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
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

export async function GET() {
  const result: Record<string, { price: number; change: number; symbol: string }> = {};

  // Fetch Yahoo Finance prices (primary source) in parallel
  const yahooResults = await Promise.allSettled(
    YAHOO_SYMBOLS.map(s => fetchYahooPrice(s.yahoo))
  );

  YAHOO_SYMBOLS.forEach((item, idx) => {
    const r = yahooResults[idx];
    if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
      result[item.key] = {
        price: parseFloat(r.value.price.toFixed(item.decimals)),
        change: r.value.change,
        symbol: item.key,
      };
    }
  });

  // For any missing keys, try Stooq as secondary source
  const missingStooqItems = STOOQ_SYMBOLS.filter(s => !result[s.key]);
  if (missingStooqItems.length > 0) {
    const stooqResults = await Promise.allSettled(
      missingStooqItems.map(s => fetchStooqPrice(s.stooq))
    );
    missingStooqItems.forEach((item, idx) => {
      const r = stooqResults[idx];
      if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
        result[item.key] = {
          price: parseFloat(r.value.price.toFixed(item.decimals)),
          change: r.value.change,
          symbol: item.key,
        };
      }
    });
  }

  // For any still-missing keys, use fallback prices
  Object.keys(FALLBACK_PRICES).forEach(key => {
    if (!result[key]) {
      const fb = FALLBACK_PRICES[key];
      result[key] = { ...fb, symbol: key };
    }
  });

  return NextResponse.json({ success: true, data: result });
}
