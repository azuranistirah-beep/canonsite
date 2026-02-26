'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMarketPrices } from '@/hooks/useMarketPrices';

function formatPrice(price: number): string {
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(2);
  return '$' + price.toFixed(4);
}

function formatChange(change: number): string {
  return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
}

const DISPLAY_NAMES: Record<string, string> = {
  ripple: 'XRP',
  binancecoin: 'BNB',
};

// Map crypto id to TRADING_SYMBOLS label in MarketsPage
const CRYPTO_TO_MARKET: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  solana: 'Solana',
  binancecoin: 'BNB',
  ripple: 'XRP',
};

type FlashState = 'up' | 'down' | null;

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

interface MoverItemProps {
  rank: number;
  name: string;
  price: string;
  change: string;
  positive: boolean;
  cryptoId: string;
  onNavigate: (cryptoId: string) => void;
}

function MoverItem({ rank, name, price, change, positive, cryptoId, onNavigate }: MoverItemProps) {
  const flash = usePriceFlash(price);

  const rowGlow =
    flash === 'up' ? 'shadow-[inset_0_0_20px_rgba(34,197,94,0.12)] bg-green-500/5'
      : flash === 'down' ? 'shadow-[inset_0_0_20px_rgba(239,68,68,0.12)] bg-red-500/5' : '';

  const priceColor =
    flash === 'up' ? 'text-green-400'
      : flash === 'down' ? 'text-red-400' : 'text-slate-400';

  return (
    <div
      onClick={() => onNavigate(cryptoId)}
      className={`flex items-center justify-between px-4 sm:px-5 min-h-[44px] hover:bg-white/5 cursor-pointer transition-all duration-300 ${rowGlow}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {rank}
        </span>
        <div>
          <div className="text-white text-sm font-semibold">{name}</div>
          <div
            className={`text-xs font-mono transition-colors duration-300 ${priceColor}`}
            style={{
              textShadow:
                flash === 'up' ? '0 0 8px rgba(34,197,94,0.7)'
                  : flash === 'down' ? '0 0 8px rgba(239,68,68,0.7)' : 'none',
            }}
          >
            {price}
          </div>
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-300 ${
          positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        } ${flash ? (flash === 'up' ? 'scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]') : ''}`}
      >
        <span
          className={`inline-block transition-transform duration-300 ${
            flash === 'up' ? 'animate-bounce-up'
              : flash === 'down' ? 'animate-bounce-down' : ''
          }`}
        >
          {positive ? '▲' : '▼'}
        </span>
        {change}
      </span>
    </div>
  );
}

export default function TopMovers() {
  const { crypto, loading } = useMarketPrices(30000);
  const router = useRouter();

  const sorted = [...crypto]
    .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
    .slice(0, 5)
    .map((c, i) => ({
      rank: i + 1,
      cryptoId: c.id,
      name: DISPLAY_NAMES[c.id] || c.name,
      price: formatPrice(c.current_price),
      change: formatChange(c.price_change_percentage_24h),
      positive: c.price_change_percentage_24h >= 0,
    }));

  const handleNavigate = (cryptoId: string) => {
    const marketName = CRYPTO_TO_MARKET[cryptoId];
    if (marketName) {
      router.push(`/markets?asset=${encodeURIComponent(marketName)}`);
    }
  };

  return (
    <section className="bg-[#0a0b1e] py-3 sm:py-4 px-4 sm:px-6">
      <div className="container mx-auto">
        <div className="bg-[#0d1030] border border-[#1e2a4a] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-[#1e2a4a]">
            <div className="flex items-center gap-2 sm:gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 sm:w-5 sm:h-5">
                <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
              <span className="text-white font-semibold text-sm sm:text-base">Top Movers</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border border-blue-500/40 bg-transparent">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 text-xs font-medium">Live</span>
            </div>
          </div>
          {/* List */}
          <div className="divide-y divide-[#1e2a4a]">
            {loading && sorted.length === 0
              ? [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between px-4 sm:px-5 min-h-[44px] animate-pulse">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-7 h-7 rounded-md bg-slate-700" />
                      <div>
                        <div className="h-4 w-20 bg-slate-700 rounded mb-1" />
                        <div className="h-3 w-16 bg-slate-700 rounded" />
                      </div>
                    </div>
                    <div className="h-6 w-16 bg-slate-700 rounded" />
                  </div>
                ))
              : sorted.map((item) => (
                  <MoverItem key={item.rank} {...item} onNavigate={handleNavigate} />
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
