'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import TickerTape from '@/components/TickerTape';
import Footer from '@/components/Footer';
import { CryptoAsset } from '@/hooks/useMarketPrices';

function formatPrice(price: number): string {
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(2);
  if (price >= 0.01) return '$' + price.toFixed(4);
  return '$' + price.toFixed(6);
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  return '$' + num.toLocaleString();
}

function formatChange(change: number): string {
  return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
}

const PER_PAGE = 50;

export default function CryptocurrencyPage() {
  const [coins, setCoins] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCoins = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/prices/crypto?page=${pageNum}&per_page=${PER_PAGE}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        if (append) {
          setCoins((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newCoins = data.data.filter((c: CryptoAsset) => !existingIds.has(c.id));
            return [...prev, ...newCoins];
          });
        } else {
          setCoins(data.data);
        }
        setTotalLoaded((prev) => prev + data.data.length);
        setHasMore(data.data.length === PER_PAGE);
        setLastUpdated(new Date());
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to fetch coins:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchCoins(1, false);
    const interval = setInterval(() => fetchCoins(1, false), 60000);
    return () => clearInterval(interval);
  }, [fetchCoins]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCoins(nextPage, true);
  };

  const filtered = coins.filter(
    (c) =>
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0b1e]">
      <Navbar />
      <TickerTape />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-2xl sm:text-3xl font-bold">Cryptocurrency</h1>
            <p className="text-slate-400 text-sm mt-1">
              Top cryptocurrencies by market cap
              {lastUpdated && (
                <span className="ml-2 text-slate-500">
                  · Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search coins..."
                className="pl-9 pr-4 py-2.5 bg-[#0d1030] border border-[#1e2a4a] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[44px] w-full sm:w-64"
              />
            </div>
            <button
              onClick={() => fetchCoins(1, false)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1030] border border-[#1e2a4a] rounded-xl text-slate-400 hover:text-white hover:border-blue-500 transition-colors text-sm min-h-[44px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {!loading && coins.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Coins', value: coins.length + '+' },
              { label: 'Total Market Cap', value: formatLargeNumber(coins.reduce((s, c) => s + (c.market_cap || 0), 0)) },
              { label: '24h Volume', value: formatLargeNumber(coins.reduce((s, c) => s + (c.total_volume || 0), 0)) },
              { label: 'BTC Dominance', value: (() => {
                const totalMcap = coins.reduce((s, c) => s + (c.market_cap || 0), 0);
                const btcMcap = coins.find((c) => c.id === 'bitcoin')?.market_cap || 0;
                return totalMcap > 0 ? ((btcMcap / totalMcap) * 100).toFixed(1) + '%' : 'N/A';
              })() },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#0d1030] border border-[#1e2a4a] rounded-xl p-3 sm:p-4">
                <div className="text-slate-500 text-xs mb-1">{stat.label}</div>
                <div className="text-white font-semibold text-sm sm:text-base">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-[#0d1030] border border-[#1e2a4a] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#1e2a4a]">
                  <th className="text-left px-4 sm:px-5 py-3 text-slate-500 text-xs font-medium w-10">#</th>
                  <th className="text-left px-3 py-3 text-slate-500 text-xs font-medium">Name</th>
                  <th className="text-right px-3 py-3 text-slate-500 text-xs font-medium">Price</th>
                  <th className="text-right px-3 py-3 text-slate-500 text-xs font-medium">24h %</th>
                  <th className="text-right px-3 py-3 text-slate-500 text-xs font-medium hidden sm:table-cell">Market Cap</th>
                  <th className="text-right px-4 sm:px-5 py-3 text-slate-500 text-xs font-medium hidden md:table-cell">Volume (24h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a4a]">
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 sm:px-5 py-3"><div className="h-4 w-6 bg-slate-700 rounded" /></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700" />
                            <div>
                              <div className="h-4 w-24 bg-slate-700 rounded mb-1" />
                              <div className="h-3 w-12 bg-slate-700 rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right"><div className="h-4 w-20 bg-slate-700 rounded ml-auto" /></td>
                        <td className="px-3 py-3 text-right"><div className="h-6 w-16 bg-slate-700 rounded ml-auto" /></td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell"><div className="h-4 w-24 bg-slate-700 rounded ml-auto" /></td>
                        <td className="px-4 sm:px-5 py-3 text-right hidden md:table-cell"><div className="h-4 w-20 bg-slate-700 rounded ml-auto" /></td>
                      </tr>
                    ))
                  : filtered.map((coin) => (
                      <tr key={coin.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="px-4 sm:px-5" style={{ height: '52px' }}>
                          <span className="text-slate-500 text-xs font-medium">{coin.market_cap_rank}</span>
                        </td>
                        <td className="px-3" style={{ height: '52px' }}>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {coin.image ? (
                              <img
                                src={coin.image}
                                alt={coin.name}
                                width={32}
                                height={32}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-400 text-xs font-bold">{coin.symbol.substring(0, 2).toUpperCase()}</span>
                              </div>
                            )}
                            <div>
                              <div className="text-white text-xs sm:text-sm font-semibold">{coin.name}</div>
                              <div className="text-slate-500 text-xs uppercase">{coin.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 text-right" style={{ height: '52px' }}>
                          <span className="text-white text-xs sm:text-sm font-medium">{formatPrice(coin.current_price)}</span>
                        </td>
                        <td className="px-3 text-right" style={{ height: '52px' }}>
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                            coin.price_change_percentage_24h >= 0
                              ? 'bg-green-500/20 text-green-400' :'bg-red-500/20 text-red-400'
                          }`}>
                            {formatChange(coin.price_change_percentage_24h)}
                          </span>
                        </td>
                        <td className="px-3 text-right hidden sm:table-cell" style={{ height: '52px' }}>
                          <span className="text-slate-300 text-xs sm:text-sm">{formatLargeNumber(coin.market_cap)}</span>
                        </td>
                        <td className="px-4 sm:px-5 text-right hidden md:table-cell" style={{ height: '52px' }}>
                          <span className="text-slate-300 text-xs sm:text-sm">{formatLargeNumber(coin.total_volume)}</span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {!loading && filtered.length > 0 && hasMore && search === '' && (
            <div className="flex justify-center py-4 border-t border-[#1e2a4a]">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors min-h-[44px]"
              >
                {loadingMore ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Loading...
                  </>
                ) : (
                  `Load More (${totalLoaded} loaded)`
                )}
              </button>
            </div>
          )}

          {!loading && filtered.length === 0 && search !== '' && (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No coins found for &quot;{search}&quot;</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
