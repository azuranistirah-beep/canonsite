'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useMarketPrices } from '@/hooks/useMarketPrices';

const CRYPTO_ORDER = ['solana', 'ethereum', 'ripple', 'binancecoin'];
const CRYPTO_NAMES: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  ripple: 'XRP',
  binancecoin: 'BNB',
};

// Map crypto id to TRADING_SYMBOLS label in MarketsPage
const CRYPTO_TO_MARKET: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
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

export default function CryptoCards() {
  const { crypto, loading } = useMarketPrices(30000);
  const router = useRouter();

  const displayAssets = CRYPTO_ORDER.map((id) => {
    const found = crypto.find((c) => c.id === id);
    return found ? {
      id,
      name: CRYPTO_NAMES[id] || found.name,
      price: formatPrice(found.current_price),
      change: formatChange(found.price_change_percentage_24h),
      positive: found.price_change_percentage_24h >= 0,
    } : null;
  }).filter(Boolean);

  const skeletonItems = [0, 1, 2, 3];

  const handleAssetClick = (id: string) => {
    const marketName = CRYPTO_TO_MARKET[id];
    if (marketName) {
      router.push(`/markets?asset=${encodeURIComponent(marketName)}`);
    }
  };

  return (
    <section className="bg-[#0a0b1e] py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading && displayAssets.length === 0
            ? skeletonItems.map((i) => (
                <div key={i} className="bg-[#0d1030] border border-[#1e2a4a] rounded-2xl p-4 sm:p-5 animate-pulse">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="h-4 w-20 bg-slate-700 rounded" />
                    <div className="w-8 h-8 rounded-lg bg-slate-700" />
                  </div>
                  <div className="h-8 w-32 bg-slate-700 rounded mb-2 sm:mb-3" />
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-16 bg-slate-700 rounded" />
                    <div className="h-4 w-12 bg-slate-700 rounded" />
                  </div>
                </div>
              ))
            : displayAssets.map((asset) => asset && (
                <div
                  key={asset.name}
                  onClick={() => handleAssetClick(asset.id)}
                  className="bg-[#0d1030] border border-[#1e2a4a] rounded-2xl p-4 sm:p-5 hover:border-blue-500/60 hover:bg-[#0f1535] hover:scale-[1.02] transition-all duration-200 cursor-pointer select-none"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div>
                      <div className="text-slate-300 text-sm font-medium mb-1">{asset.name}</div>
                    </div>
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#1a2a4a] flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={asset.positive ? 'text-green-400' : 'text-red-400'}>
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                        <polyline points="16 7 22 7 22 13"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-white text-xl sm:text-2xl font-bold mb-2 sm:mb-3">{asset.price}</div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                      asset.positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {asset.change}
                    </span>
                    <span className="text-slate-500 text-xs font-medium tracking-wider">CRYPTO</span>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
