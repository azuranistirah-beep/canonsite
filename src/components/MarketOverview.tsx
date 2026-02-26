'use client';
import React, { useState } from 'react';

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

export default function MarketOverview() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState<Asset>(allAssets[16]); // Bitcoin default
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = allAssets.filter(asset => {
    const matchesCategory = activeCategory === 'All' || asset.category === activeCategory.toLowerCase();
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const chartConfig = JSON.stringify({
    symbol: selectedAsset.tvSymbol || 'BITSTAMP:BTCUSD',
    interval: 'D',
    hide_side_toolbar: '0',
    allow_symbol_change: '1',
    save_image: '1',
    studies: 'MASimple@tv-basicstudies\u001fRSI@tv-basicstudies',
    theme: 'light',
    style: '1',
    timezone: 'Etc/UTC',
    show_popup_button: '1',
    studies_overrides: '{}',
  });

  return (
    <section className="bg-slate-50 py-12 sm:py-16 md:py-20 border-y border-slate-200" id="charts">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-10 gap-3 sm:gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Live Market Overview</h2>
            <p className="text-slate-500 text-sm sm:text-base">Real-time prices from global exchanges</p>
          </div>
          <button className="hidden sm:flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all">
            View Full Chart
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Main card */}
        <div className="space-y-6">
          <div className="border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col lg:flex-row rounded-2xl">
            {/* Chart area */}
            <div className="flex-1 bg-white relative flex flex-col min-w-0">
              {/* Search + filters */}
              <div className="border-b border-slate-200 p-3 sm:p-4 bg-white">
                <div className="relative mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                  <input
                    className="flex w-full min-w-0 rounded-md border px-3 py-1 outline-none pl-9 sm:pl-10 h-10 sm:h-12 bg-white border-slate-300 focus:ring-2 focus:ring-blue-600 text-slate-900 text-sm sm:text-base"
                    placeholder="Search any asset..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                        activeCategory === cat
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {/* TradingView chart */}
              <div className="relative bg-white" style={{ height: '350px', minHeight: '300px' }}>
                <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                  <iframe
                    title="advanced chart TradingView widget"
                    lang="en"
                    frameBorder={0}
                    allowtransparency="true"
                    scrolling="no"
                    allowFullScreen={true}
                    src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({
                      symbol: selectedAsset.tvSymbol || 'BITSTAMP:BTCUSD',
                      interval: 'D',
                      hide_side_toolbar: '0',
                      allow_symbol_change: '1',
                      save_image: '1',
                      studies: 'MASimple@tv-basicstudies\u001fRSI@tv-basicstudies',
                      theme: 'light',
                      style: '1',
                      timezone: 'Etc/UTC',
                      show_popup_button: '1',
                      studies_overrides: '{}',
                    }))}`}
                    style={{ width: '100%', height: '100%', margin: 0, padding: 0 }}
                  />
                </div>
              </div>
            </div>

            {/* Market Watch sidebar */}
            <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col bg-slate-50">
              <div className="p-3 sm:p-4 border-b border-slate-200 bg-white">
                <h3 className="font-bold text-slate-900 mb-0.5">Market Watch</h3>
                <p className="text-xs text-slate-500">Click to view chart</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                {filteredAssets.map((asset) => (
                  <div
                    key={`${asset.symbol}-${asset.category}`}
                    onClick={() => setSelectedAsset(asset)}
                    className={`p-3 sm:p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-white group border-l-4 ${
                      selectedAsset.symbol === asset.symbol && selectedAsset.category === asset.category
                        ? 'bg-white border-l-blue-600 shadow-sm'
                        : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className={`font-bold text-xs truncate ${
                          selectedAsset.symbol === asset.symbol && selectedAsset.category === asset.category
                            ? 'text-slate-900' :'text-slate-700'
                        }`}>{asset.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{asset.category}</span>
                      </div>
                      <div className="text-right ml-2">
                        <div className={`text-xs font-mono font-medium ${
                          selectedAsset.symbol === asset.symbol && selectedAsset.category === asset.category
                            ? 'text-slate-900' :'text-slate-700'
                        }`}>{asset.price}</div>
                        <div className={`text-[10px] font-bold ${
                          asset.positive ? 'text-green-600' : 'text-red-600'
                        }`}>{asset.change}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile view full chart button */}
        <div className="mt-6 sm:mt-8 text-center sm:hidden">
          <button className="w-full rounded-md text-sm font-medium h-9 px-4 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all">
            View Full Chart
          </button>
        </div>
      </div>
    </section>
  );
}
