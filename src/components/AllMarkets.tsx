'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { useRouter } from 'next/navigation';

type FilterType = 'all' | 'crypto' | 'forex' | 'commodities' | 'indices';
type FlashState = 'up' | 'down' | null;

const TICKER_COLORS: Record<string, string> = {
  solana: '#f97316',
  ethereum: '#3b82f6',
  ripple: '#f97316',
  binancecoin: '#eab308',
  bitcoin: '#f97316',
  'EUR/USD': '#3b82f6',
  'GBP/USD': '#22c55e',
  'USD/JPY': '#3b82f6',
  Gold: '#eab308',
  Silver: '#94a3b8',
  'Crude Oil': '#78716c',
  'S&P 500': '#22c55e',
  'Nasdaq 100': '#a855f7',
};

const TICKER_ABBR: Record<string, string> = {
  solana: 'SO',
  ethereum: 'ET',
  ripple: 'XR',
  binancecoin: 'BN',
  bitcoin: 'BT',
  'EUR/USD': 'EU',
  'GBP/USD': 'GB',
  'USD/JPY': 'UJ',
  Gold: 'GO',
  Silver: 'SI',
  'Crude Oil': 'OI',
  'S&P 500': 'SP',
  'Nasdaq 100': 'NS',
};

const DISPLAY_NAMES: Record<string, string> = {
  ripple: 'XRP',
  binancecoin: 'BNB',
};

function formatPrice(price: number): string {
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(2);
  return '$' + price.toFixed(4);
}

function formatChange(change: number): string {
  return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
}

function usePriceFlash(price: string): FlashState {
  const prevRef = useRef<string>(price);
  const [flash, setFlash] = useState<FlashState>(null);

  useEffect(() => {
    if (prevRef.current !== price) {
      const prev = parseFloat(prevRef.current.replace(/[$,]/g, ''));
      const curr = parseFloat(price.replace(/[$,]/g, ''));
      if (!isNaN(prev) && !isNaN(curr) && prev !== curr) {
        setFlash(curr > prev ? 'up' : 'down');
        const t = setTimeout(() => setFlash(null), 800);
        prevRef.current = price;
        return () => clearTimeout(t);
      }
      prevRef.current = price;
    }
  }, [price]);

  return flash;
}

interface AssetRowProps {
  assetKey: string;
  ticker: string;
  tickerColor: string;
  name: string;
  type: string;
  price: string;
  change: string;
  positive: boolean;
  onNavigate: (name: string, type: string) => void;
}

function AssetRow({ ticker, tickerColor, name, type, price, change, positive, onNavigate }: AssetRowProps) {
  const flash = usePriceFlash(price);

  const rowBg =
    flash === 'up' ? 'bg-green-500/5 shadow-[inset_0_0_24px_rgba(34,197,94,0.08)]'
      : flash === 'down' ? 'bg-red-500/5 shadow-[inset_0_0_24px_rgba(239,68,68,0.08)]' : 'hover:bg-white/5';

  const priceColor =
    flash === 'up' ? 'text-green-400'
      : flash === 'down' ? 'text-red-400' : 'text-white';

  return (
    <tr
      onClick={() => onNavigate(name, type)}
      className={`cursor-pointer transition-all duration-300 ${rowBg} border-b border-[#1e2a4a]`}
    >
      <td className="px-4 sm:px-5" style={{ height: '44px' }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
              flash ? (flash === 'up' ? 'shadow-[0_0_12px_rgba(34,197,94,0.5)]' : 'shadow-[0_0_12px_rgba(239,68,68,0.5)]') : ''
            }`}
            style={{ backgroundColor: tickerColor + '33', color: tickerColor }}
          >
            {ticker}
          </span>
          <span className="text-white text-xs sm:text-sm font-medium">{name}</span>
        </div>
      </td>
      <td className="px-3 sm:px-4" style={{ height: '44px' }}>
        <span className="px-2 py-1 rounded-md border border-[#1e2a4a] text-slate-400 text-xs">
          {type}
        </span>
      </td>
      <td className="px-3 sm:px-4 text-right" style={{ height: '44px' }}>
        <span
          className={`text-xs sm:text-sm font-mono font-medium transition-all duration-300 ${priceColor}`}
          style={{
            textShadow:
              flash === 'up' ? '0 0 8px rgba(34,197,94,0.7)'
                : flash === 'down' ? '0 0 8px rgba(239,68,68,0.7)' : 'none',
          }}
        >
          {price}
        </span>
      </td>
      <td className="px-4 sm:px-5 text-right" style={{ height: '44px' }}>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all duration-300 ${
            positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          } ${
            flash
              ? flash === 'up' ? 'scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''
          }`}
        >
          <span
            className={`inline-block ${
              flash === 'up' ? 'animate-bounce-up' : flash === 'down' ? 'animate-bounce-down' : ''
            }`}
          >
            {positive ? '▲' : '▼'}
          </span>
          {change}
        </span>
      </td>
    </tr>
  );
}

export default function AllMarkets() {
  const { crypto, forex, loading } = useMarketPrices(30000);
  const [filter, setFilter] = useState<FilterType>('all');
  const router = useRouter();

  // Map display name → TRADING_SYMBOLS label
  const DISPLAY_NAME_TO_MARKET: Record<string, string> = {
    // crypto
    'Bitcoin': 'Bitcoin',
    'Ethereum': 'Ethereum',
    'Solana': 'Solana',
    'BNB': 'BNB',
    'XRP': 'XRP',
    // forex
    'EUR/USD': 'EUR/USD',
    'GBP/USD': 'GBP/USD',
    'USD/JPY': 'USD/JPY',
    // commodities
    'Gold': 'Gold',
    'Silver': 'Silver',
    'Crude Oil': 'Crude Oil',
  };

  const handleNavigate = (name: string) => {
    const marketName = DISPLAY_NAME_TO_MARKET[name];
    if (marketName) {
      router.push(`/markets?asset=${encodeURIComponent(marketName)}`);
    }
  };

  const cryptoRows = crypto.map((c) => ({
    key: c.id,
    ticker: TICKER_ABBR[c.id] || c.symbol.substring(0, 2).toUpperCase(),
    tickerColor: TICKER_COLORS[c.id] || '#3b82f6',
    name: DISPLAY_NAMES[c.id] || c.name,
    type: 'crypto' as const,
    price: formatPrice(c.current_price),
    change: formatChange(c.price_change_percentage_24h),
    positive: c.price_change_percentage_24h >= 0,
  }));

  const forexKeys = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
  const forexRows = forexKeys
    .filter((k) => forex[k])
    .map((k) => ({
      key: k,
      ticker: TICKER_ABBR[k] || k.substring(0, 2),
      tickerColor: TICKER_COLORS[k] || '#3b82f6',
      name: k,
      type: 'forex' as const,
      price: formatPrice(forex[k].price),
      change: formatChange(forex[k].change),
      positive: forex[k].change >= 0,
    }));

  const commodityKeys = ['Gold', 'Silver', 'Crude Oil'];
  const commodityRows = commodityKeys
    .filter((k) => forex[k])
    .map((k) => ({
      key: k,
      ticker: TICKER_ABBR[k] || k.substring(0, 2).toUpperCase(),
      tickerColor: TICKER_COLORS[k] || '#eab308',
      name: k,
      type: 'commodities' as const,
      price: formatPrice(forex[k].price),
      change: formatChange(forex[k].change),
      positive: forex[k].change >= 0,
    }));

  const indicesKeys = ['S&P 500', 'Nasdaq 100'];
  const indicesRows = indicesKeys
    .filter((k) => forex[k])
    .map((k) => ({
      key: k,
      ticker: TICKER_ABBR[k] || k.substring(0, 2).toUpperCase(),
      tickerColor: TICKER_COLORS[k] || '#22c55e',
      name: k,
      type: 'indices' as const,
      price: formatPrice(forex[k].price),
      change: formatChange(forex[k].change),
      positive: forex[k].change >= 0,
    }));

  const allRows = [...cryptoRows, ...forexRows, ...commodityRows, ...indicesRows];
  const filtered = filter === 'all' ? allRows : allRows.filter((r) => r.type === filter);

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Crypto', value: 'crypto' },
    { label: 'Forex', value: 'forex' },
    { label: 'Commodities', value: 'commodities' },
    { label: 'Indices', value: 'indices' },
  ];

  return (
    <section className="bg-[#0a0b1e] py-3 sm:py-4 px-4 sm:px-6 pb-8 sm:pb-12">
      <div className="container mx-auto">
        <div className="bg-[#0d1030] border border-[#1e2a4a] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-4 sm:py-5 border-b border-[#1e2a4a] gap-3">
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-sm sm:text-base">All Markets</span>
              {!loading && (
                <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                  {filtered.length} Assets
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors min-h-[28px] ${
                    filter === f.value
                      ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-[#1e2a4a]">
                  <th className="text-left px-4 sm:px-5 py-3 text-slate-500 text-xs font-medium">Asset</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-slate-500 text-xs font-medium">Type</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-slate-500 text-xs font-medium">Price</th>
                  <th className="text-right px-4 sm:px-5 py-3 text-slate-500 text-xs font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {loading && filtered.length === 0
                  ? [1, 2, 3, 4, 5, 6].map((i) => (
                      <tr key={i} className="animate-pulse border-b border-[#1e2a4a]">
                        <td className="px-4 sm:px-5" style={{ height: '44px' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-700" />
                            <div className="h-4 w-24 bg-slate-700 rounded" />
                          </div>
                        </td>
                        <td className="px-3 sm:px-4"><div className="h-5 w-16 bg-slate-700 rounded" /></td>
                        <td className="px-3 sm:px-4 text-right"><div className="h-4 w-20 bg-slate-700 rounded ml-auto" /></td>
                        <td className="px-4 sm:px-5 text-right"><div className="h-6 w-16 bg-slate-700 rounded ml-auto" /></td>
                      </tr>
                    ))
                  : filtered.map((asset) => (
                      <AssetRow
                        key={asset.key}
                        assetKey={asset.key}
                        ticker={asset.ticker}
                        tickerColor={asset.tickerColor}
                        name={asset.name}
                        type={asset.type}
                        price={asset.price}
                        change={asset.change}
                        positive={asset.positive}
                        onNavigate={handleNavigate}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
