'use client';
import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TickerTape from '@/components/TickerTape';

interface Asset {
  symbol: string;
  name: string;
  category: string;
  price: string;
  change: string;
  positive: boolean;
  tvSymbol?: string;
}

const allAssets: Asset[] = [
  { symbol: 'S&P 500', name: 'S&P 500', category: 'indices', price: '$4,850.45', change: '+0.78%', positive: true, tvSymbol: 'FOREXCOM:SPXUSD' },
  { symbol: 'Nasdaq 100', name: 'Nasdaq 100', category: 'indices', price: '$16,420.3', change: '+1.23%', positive: true, tvSymbol: 'FOREXCOM:NSXUSD' },
  { symbol: 'Dow Jones', name: 'Dow Jones', category: 'indices', price: '$37,850.2', change: '+0.45%', positive: true, tvSymbol: 'DJ:DJI' },
  { symbol: 'FTSE 100', name: 'FTSE 100', category: 'indices', price: '$7,650.8', change: '-0.12%', positive: false, tvSymbol: 'SPREADEX:UK100' },
  { symbol: 'DAX', name: 'DAX', category: 'indices', price: '$17,240.5', change: '+0.34%', positive: true, tvSymbol: 'XETR:DAX' },
  { symbol: 'Nikkei 225', name: 'Nikkei 225', category: 'indices', price: '$38,450.7', change: '+0.89%', positive: true, tvSymbol: 'TVC:NI225' },
  { symbol: 'Apple Inc', name: 'Apple Inc', category: 'stocks', price: '$178.34', change: '+1.23%', positive: true, tvSymbol: 'NASDAQ:AAPL' },
  { symbol: 'Microsoft', name: 'Microsoft', category: 'stocks', price: '$330.45', change: '+0.67%', positive: true, tvSymbol: 'NASDAQ:MSFT' },
  { symbol: 'Alphabet', name: 'Alphabet', category: 'stocks', price: '$136.23', change: '+1.12%', positive: true, tvSymbol: 'NASDAQ:GOOGL' },
  { symbol: 'Amazon', name: 'Amazon', category: 'stocks', price: '$135.67', change: '+0.89%', positive: true, tvSymbol: 'NASDAQ:AMZN' },
  { symbol: 'NVIDIA', name: 'NVIDIA', category: 'stocks', price: '$460.12', change: '+3.45%', positive: true, tvSymbol: 'NASDAQ:NVDA' },
  { symbol: 'Tesla', name: 'Tesla', category: 'stocks', price: '$245.67', change: '-2.34%', positive: false, tvSymbol: 'NASDAQ:TSLA' },
  { symbol: 'Meta', name: 'Meta', category: 'stocks', price: '$298.67', change: '-0.45%', positive: false, tvSymbol: 'NASDAQ:META' },
  { symbol: 'JPMorgan', name: 'JPMorgan', category: 'stocks', price: '$145.23', change: '+0.34%', positive: true, tvSymbol: 'NYSE:JPM' },
  { symbol: 'Visa', name: 'Visa', category: 'stocks', price: '$245.67', change: '+0.56%', positive: true, tvSymbol: 'NYSE:V' },
  { symbol: 'Walmart', name: 'Walmart', category: 'stocks', price: '$52.45', change: '+0.78%', positive: true, tvSymbol: 'NYSE:WMT' },
  { symbol: 'Bitcoin', name: 'Bitcoin', category: 'crypto', price: '$64,250', change: '+2.45%', positive: true, tvSymbol: 'BITSTAMP:BTCUSD' },
  { symbol: 'Ethereum', name: 'Ethereum', category: 'crypto', price: '$3,520', change: '+1.89%', positive: true, tvSymbol: 'BITSTAMP:ETHUSD' },
  { symbol: 'Binance Coin', name: 'Binance Coin', category: 'crypto', price: '$420.5', change: '+0.67%', positive: true, tvSymbol: 'BINANCE:BNBUSDT' },
  { symbol: 'Solana', name: 'Solana', category: 'crypto', price: '$145.3', change: '+3.12%', positive: true, tvSymbol: 'BINANCE:SOLUSDT' },
  { symbol: 'Cardano', name: 'Cardano', category: 'crypto', price: '$0.48', change: '+0.89%', positive: true, tvSymbol: 'BINANCE:ADAUSDT' },
  { symbol: 'Ripple', name: 'Ripple', category: 'crypto', price: '$0.52', change: '-1.23%', positive: false, tvSymbol: 'BITSTAMP:XRPUSD' },
  { symbol: 'EUR/USD', name: 'EUR/USD', category: 'forex', price: '$1.085', change: '-0.15%', positive: false, tvSymbol: 'FX:EURUSD' },
  { symbol: 'GBP/USD', name: 'GBP/USD', category: 'forex', price: '$1.263', change: '+0.23%', positive: true, tvSymbol: 'FX:GBPUSD' },
  { symbol: 'USD/JPY', name: 'USD/JPY', category: 'forex', price: '$149.45', change: '+0.45%', positive: true, tvSymbol: 'FX:USDJPY' },
  { symbol: 'AUD/USD', name: 'AUD/USD', category: 'forex', price: '$0.651', change: '-0.34%', positive: false, tvSymbol: 'FX:AUDUSD' },
  { symbol: 'USD/CAD', name: 'USD/CAD', category: 'forex', price: '$1.365', change: '+0.12%', positive: true, tvSymbol: 'FX:USDCAD' },
  { symbol: 'USD/CHF', name: 'USD/CHF', category: 'forex', price: '$0.882', change: '+0.09%', positive: true, tvSymbol: 'FX:USDCHF' },
  { symbol: 'Gold', name: 'Gold', category: 'commodities', price: '$2,345.6', change: '+0.56%', positive: true, tvSymbol: 'OANDA:XAUUSD' },
  { symbol: 'Silver', name: 'Silver', category: 'commodities', price: '$24.85', change: '+1.12%', positive: true, tvSymbol: 'OANDA:XAGUSD' },
  { symbol: 'Crude Oil WTI', name: 'Crude Oil WTI', category: 'commodities', price: '$78.45', change: '-0.45%', positive: false, tvSymbol: 'TVC:USOIL' },
  { symbol: 'Brent Oil', name: 'Brent Oil', category: 'commodities', price: '$82.3', change: '-0.23%', positive: false, tvSymbol: 'TVC:UKOIL' },
  { symbol: 'Natural Gas', name: 'Natural Gas', category: 'commodities', price: '$2.65', change: '+2.34%', positive: true, tvSymbol: 'NYMEX:NG1!' },
];

const categories = ['All', 'Stocks', 'Forex', 'Crypto', 'Indices', 'Commodities'];

export default function ChartPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState<Asset>(allAssets[16]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = allAssets.filter(asset => {
    const matchesCategory = activeCategory === 'All' || asset.category === activeCategory.toLowerCase();
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0b1e' }}>
      <Navbar />
      <TickerTape />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-white mb-6">Interactive Chart</h1>

          <div className="border border-white/10 overflow-hidden flex flex-col md:flex-row rounded-2xl" style={{ background: '#0d0e23', height: '700px' }}>
            {/* Chart area */}
            <div className="flex-1 relative flex flex-col" style={{ background: '#0d0e23' }}>
              {/* Search + filters */}
              <div className="border-b border-white/10 p-4" style={{ background: '#0d0e23' }}>
                <div className="relative mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                  <input
                    className="flex w-full min-w-0 rounded-md border px-3 py-1 outline-none pl-10 h-12 text-base text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                    placeholder="Search any asset (stocks, crypto, forex, indices, commodities)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                        activeCategory === cat
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      style={activeCategory !== cat ? { background: 'rgba(255,255,255,0.06)' } : {}}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {/* TradingView chart */}
              <div className="flex-1 relative" style={{ background: '#0d0e23' }}>
                <iframe
                  title="advanced chart TradingView widget"
                  lang="en"
                  frameBorder={0}
                  allowtransparency="true"
                  scrolling="no"
                  allowFullScreen={true}
                  src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({ symbol: selectedAsset.tvSymbol, interval: 'D', hide_side_toolbar: '0', allow_symbol_change: '1', save_image: '1', theme: 'dark', style: '1', timezone: 'Etc/UTC', show_popup_button: '1' }))}`}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>

            {/* Market Watch sidebar */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 flex flex-col" style={{ background: '#0a0b1e' }}>
              <div className="p-4 border-b border-white/10 sticky top-0 z-10" style={{ background: '#0d0e23' }}>
                <h3 className="font-bold text-white mb-1">Market Watch</h3>
                <p className="text-xs text-slate-400">Click to view chart</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredAssets.map((asset) => (
                  <div
                    key={`${asset.symbol}-${asset.category}`}
                    onClick={() => setSelectedAsset(asset)}
                    className={`p-4 cursor-pointer transition-all border-b border-white/5 border-l-4 ${
                      selectedAsset.symbol === asset.symbol && selectedAsset.category === asset.category
                        ? 'border-l-blue-500' :'border-l-transparent hover:bg-white/5'
                    }`}
                    style={selectedAsset.symbol === asset.symbol && selectedAsset.category === asset.category ? { background: 'rgba(59,130,246,0.1)' } : {}}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-bold text-xs truncate text-white">{asset.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{asset.category}</span>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-xs font-mono font-medium text-white">{asset.price}</div>
                        <div className={`text-[10px] font-bold ${
                          asset.positive ? 'text-green-400' : 'text-red-400'
                        }`}>{asset.change}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
