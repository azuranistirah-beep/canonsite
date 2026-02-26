'use client';
import React, { useState } from 'react';
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
  const [searchSubmitted, setSearchSubmitted] = useState(false);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchSubmitted(true);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSearchSubmitted(false);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 md:mb-6 gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Market Screener</h1>
            <p className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Filter and analyze all asset types - stocks, crypto, forex, indices, and commodities</p>
          </div>
          <div className="relative w-full sm:w-56 md:w-72">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  className="w-full pl-8 pr-3 rounded-lg text-xs sm:text-sm outline-none transition-colors min-h-[44px]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: searchSubmitted && searchQuery.trim() && filtered.length === 0
                      ? '1px solid #ef4444'
                      : searchSubmitted && searchQuery.trim() && filtered.length > 0
                      ? '1px solid #22c55e' :'1px solid rgba(255,255,255,0.12)',
                    color: '#fff'
                  }}
                  placeholder="Search symbol, name, sector..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              {searchSubmitted && searchQuery.trim() && filtered.length === 0 && (
                <p className="text-red-400 text-xs mt-1">No results found for &quot;{searchQuery}&quot;.</p>
              )}
              {searchSubmitted && searchQuery.trim() && filtered.length > 0 && (
                <p className="text-green-400 text-xs mt-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''} found.</p>
              )}
            </form>
          </div>
        </div>

        {/* Table with overflow-x-auto for mobile */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Symbol', 'Name', 'Type', 'Price', 'Change %', 'Sector', 'Analyst Rating'].map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-3 sm:px-4 text-left text-xs font-bold uppercase tracking-wide cursor-pointer select-none"
                      style={{ color: 'rgba(255,255,255,0.5)', height: '44px' }}
                    >
                      <div className="flex items-center gap-1">
                        {col}
                        {sortField === col && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                  >
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className="font-bold text-white text-xs sm:text-sm">{row.symbol}</span>
                    </td>
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.7)' }}>{row.name}</span>
                    </td>
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium ${row.typeColor}`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className="font-mono text-xs sm:text-sm font-medium text-white whitespace-nowrap">{row.price}</span>
                    </td>
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className={`text-xs sm:text-sm font-bold ${row.positive ? 'text-green-400' : 'text-red-400'}`}>{row.change}</span>
                    </td>
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.5)' }}>{row.sector}</span>
                    </td>
                    <td className="px-3 sm:px-4" style={{ height: '44px' }}>
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium ${row.ratingColor}`}>
                        {row.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-10 sm:py-12 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              No results found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        <div className="mt-2 sm:mt-3 md:mt-4 text-xs sm:text-sm text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Showing {filtered.length} of {screenerData.length} assets
        </div>
      </div>
    </div>
  );
}
