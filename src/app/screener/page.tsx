'use client';
import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TickerTape from '@/components/TickerTape';

interface ScreenerRow {
  symbol: string;
  name: string;
  type: string;
  typeColor: string;
  price: string;
  change: string;
  positive: boolean;
  sector: string;
  rating: string;
  ratingColor: string;
}

const screenerData: ScreenerRow[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$178.34', change: '+1.23%', positive: true, sector: 'Technology', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$330.45', change: '+0.67%', positive: true, sector: 'Technology', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$135.67', change: '+0.89%', positive: true, sector: 'Consumer Cyclical', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$460.12', change: '+3.45%', positive: true, sector: 'Technology', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$245.67', change: '-2.34%', positive: false, sector: 'Consumer Cyclical', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$136.23', change: '+1.12%', positive: true, sector: 'Communication Services', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'META', name: 'Meta Platforms', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$298.67', change: '-0.45%', positive: false, sector: 'Communication Services', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$360.12', change: '+0.23%', positive: true, sector: 'Financial Services', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'LLY', name: 'Eli Lilly', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$550.45', change: '+2.12%', positive: true, sector: 'Healthcare', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'V', name: 'Visa Inc.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$245.67', change: '+0.56%', positive: true, sector: 'Financial Services', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'JPM', name: 'JPMorgan Chase', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$145.23', change: '+0.34%', positive: true, sector: 'Financial Services', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$158.9', change: '+0.12%', positive: true, sector: 'Healthcare', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'WMT', name: 'Walmart Inc.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$52.45', change: '+0.78%', positive: true, sector: 'Consumer Defensive', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'PG', name: 'Procter & Gamble', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$150.34', change: '-0.23%', positive: false, sector: 'Consumer Defensive', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'DIS', name: 'Walt Disney Co.', type: 'Stock', typeColor: 'bg-blue-500/20 text-blue-400', price: '$98.12', change: '+1.45%', positive: true, sector: 'Communication Services', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'BTCUSD', name: 'Bitcoin', type: 'Crypto', typeColor: 'bg-orange-500/20 text-orange-400', price: '$64,250', change: '+2.45%', positive: true, sector: 'Cryptocurrency', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'ETHUSD', name: 'Ethereum', type: 'Crypto', typeColor: 'bg-orange-500/20 text-orange-400', price: '$3,520', change: '+1.89%', positive: true, sector: 'Cryptocurrency', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'BNBUSD', name: 'Binance Coin', type: 'Crypto', typeColor: 'bg-orange-500/20 text-orange-400', price: '$420.5', change: '+0.67%', positive: true, sector: 'Cryptocurrency', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'XRPUSD', name: 'Ripple', type: 'Crypto', typeColor: 'bg-orange-500/20 text-orange-400', price: '$0.52', change: '-1.23%', positive: false, sector: 'Cryptocurrency', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'SOLUSD', name: 'Solana', type: 'Crypto', typeColor: 'bg-orange-500/20 text-orange-400', price: '$145.3', change: '+3.12%', positive: true, sector: 'Cryptocurrency', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'ADAUSD', name: 'Cardano', type: 'Crypto', typeColor: 'bg-orange-500/20 text-orange-400', price: '$0.48', change: '+0.89%', positive: true, sector: 'Cryptocurrency', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'Forex', typeColor: 'bg-purple-500/20 text-purple-400', price: '$1.085', change: '-0.15%', positive: false, sector: 'Forex Major', rating: 'Sell', ratingColor: 'bg-red-500/20 text-red-400' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'Forex', typeColor: 'bg-purple-500/20 text-purple-400', price: '$1.263', change: '+0.23%', positive: true, sector: 'Forex Major', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'Forex', typeColor: 'bg-purple-500/20 text-purple-400', price: '$149.45', change: '+0.45%', positive: true, sector: 'Forex Major', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'Forex', typeColor: 'bg-purple-500/20 text-purple-400', price: '$0.651', change: '-0.34%', positive: false, sector: 'Forex Major', rating: 'Sell', ratingColor: 'bg-red-500/20 text-red-400' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'Forex', typeColor: 'bg-purple-500/20 text-purple-400', price: '$1.365', change: '+0.12%', positive: true, sector: 'Forex Major', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'Forex', typeColor: 'bg-purple-500/20 text-purple-400', price: '$0.882', change: '+0.09%', positive: true, sector: 'Forex Major', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'SPX500', name: 'S&P 500', type: 'Index', typeColor: 'bg-teal-500/20 text-teal-400', price: '$4,850.45', change: '+0.78%', positive: true, sector: 'US Indices', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'NSX100', name: 'Nasdaq 100', type: 'Index', typeColor: 'bg-teal-500/20 text-teal-400', price: '$16,420.3', change: '+1.23%', positive: true, sector: 'US Indices', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'DJI30', name: 'Dow Jones Industrial', type: 'Index', typeColor: 'bg-teal-500/20 text-teal-400', price: '$37,850.2', change: '+0.45%', positive: true, sector: 'US Indices', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'UK100', name: 'FTSE 100', type: 'Index', typeColor: 'bg-teal-500/20 text-teal-400', price: '$7,650.8', change: '-0.12%', positive: false, sector: 'European Indices', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'GER40', name: 'DAX 40', type: 'Index', typeColor: 'bg-teal-500/20 text-teal-400', price: '$17,240.5', change: '+0.34%', positive: true, sector: 'European Indices', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'JPN225', name: 'Nikkei 225', type: 'Index', typeColor: 'bg-teal-500/20 text-teal-400', price: '$38,450.7', change: '+0.89%', positive: true, sector: 'Asian Indices', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'XAUUSD', name: 'Gold', type: 'Commodity', typeColor: 'bg-yellow-500/20 text-yellow-400', price: '$2,345.6', change: '+0.56%', positive: true, sector: 'Precious Metals', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'XAGUSD', name: 'Silver', type: 'Commodity', typeColor: 'bg-yellow-500/20 text-yellow-400', price: '$24.85', change: '+1.12%', positive: true, sector: 'Precious Metals', rating: 'Strong Buy', ratingColor: 'bg-green-500/20 text-green-400' },
  { symbol: 'WTIUSD', name: 'Crude Oil WTI', type: 'Commodity', typeColor: 'bg-yellow-500/20 text-yellow-400', price: '$78.45', change: '-0.45%', positive: false, sector: 'Energy', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'BRUSD', name: 'Brent Crude Oil', type: 'Commodity', typeColor: 'bg-yellow-500/20 text-yellow-400', price: '$82.3', change: '-0.23%', positive: false, sector: 'Energy', rating: 'Hold', ratingColor: 'bg-yellow-500/20 text-yellow-400' },
  { symbol: 'NATGAS', name: 'Natural Gas', type: 'Commodity', typeColor: 'bg-yellow-500/20 text-yellow-400', price: '$2.65', change: '+2.34%', positive: true, sector: 'Energy', rating: 'Buy', ratingColor: 'bg-green-500/20 text-green-400' },
];

export default function ScreenerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = screenerData.filter(row =>
    row.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0b1e' }}>
      <Navbar />
      <TickerTape />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Market Screener</h1>
              <p className="text-slate-400 text-sm">Filter and analyze all asset types - stocks, crypto, forex, indices, and commodities</p>
            </div>
            <div className="relative w-full md:w-72">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-white placeholder-slate-400"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Search symbol, name, sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['Symbol', 'Name', 'Type', 'Price', 'Change %', 'Sector', 'Analyst Rating'].map((col) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-white select-none"
                      >
                        <div className="flex items-center gap-1">
                          {col}
                          {sortField === col && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {sortDir === 'asc' ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                            </svg>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr
                      key={row.symbol}
                      className="cursor-pointer transition-colors hover:bg-white/5"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-white text-sm">{row.symbol}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 text-sm">{row.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.typeColor}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-white">{row.price}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${
                          row.positive ? 'text-green-400' : 'text-red-400'
                        }`}>{row.change}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400 text-sm">{row.sector}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.ratingColor}`}>
                          {row.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No results found for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-400 text-right">
            Showing {filtered.length} of {screenerData.length} assets
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
