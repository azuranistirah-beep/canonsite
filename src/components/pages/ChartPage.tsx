'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TickerTape from '@/components/TickerTape';

interface Asset {
  symbol: string;
  name: string;
  category: string;
  tvSymbol?: string;
  coinId?: string;
  forexKey?: string;
  stockFallback?: number;
}

const allAssets: Asset[] = [
  { symbol: 'S&P 500', name: 'S&P 500', category: 'indices', tvSymbol: 'FOREXCOM:SPXUSD', forexKey: 'S&P 500' },
  { symbol: 'Nasdaq 100', name: 'Nasdaq 100', category: 'indices', tvSymbol: 'FOREXCOM:NSXUSD', forexKey: 'Nasdaq 100' },
  { symbol: 'Dow Jones', name: 'Dow Jones', category: 'indices', tvSymbol: 'DJ:DJI', forexKey: 'Dow Jones' },
  { symbol: 'FTSE 100', name: 'FTSE 100', category: 'indices', tvSymbol: 'SPREADEX:UK100', forexKey: 'FTSE 100' },
  { symbol: 'DAX', name: 'DAX', category: 'indices', tvSymbol: 'XETR:DAX', forexKey: 'DAX' },
  { symbol: 'Nikkei 225', name: 'Nikkei 225', category: 'indices', tvSymbol: 'TVC:NI225', forexKey: 'Nikkei 225' },
  { symbol: 'Apple Inc', name: 'Apple Inc', category: 'stocks', tvSymbol: 'NASDAQ:AAPL', stockFallback: 178.50 },
  { symbol: 'Microsoft', name: 'Microsoft', category: 'stocks', tvSymbol: 'NASDAQ:MSFT', stockFallback: 415.80 },
  { symbol: 'Alphabet', name: 'Alphabet', category: 'stocks', tvSymbol: 'NASDAQ:GOOGL', stockFallback: 136.23 },
  { symbol: 'Amazon', name: 'Amazon', category: 'stocks', tvSymbol: 'NASDAQ:AMZN', stockFallback: 135.67 },
  { symbol: 'NVIDIA', name: 'NVIDIA', category: 'stocks', tvSymbol: 'NASDAQ:NVDA', stockFallback: 875.20 },
  { symbol: 'Tesla', name: 'Tesla', category: 'stocks', tvSymbol: 'NASDAQ:TSLA', stockFallback: 245.30 },
  { symbol: 'Meta', name: 'Meta', category: 'stocks', tvSymbol: 'NASDAQ:META', stockFallback: 298.67 },
  { symbol: 'JPMorgan', name: 'JPMorgan', category: 'stocks', tvSymbol: 'NYSE:JPM', stockFallback: 145.23 },
  { symbol: 'Visa', name: 'Visa', category: 'stocks', tvSymbol: 'NYSE:V', stockFallback: 245.67 },
  { symbol: 'Walmart', name: 'Walmart', category: 'stocks', tvSymbol: 'NYSE:WMT', stockFallback: 52.45 },
  { symbol: 'Bitcoin', name: 'Bitcoin', category: 'crypto', tvSymbol: 'BITSTAMP:BTCUSD', coinId: 'bitcoin' },
  { symbol: 'Ethereum', name: 'Ethereum', category: 'crypto', tvSymbol: 'BITSTAMP:ETHUSD', coinId: 'ethereum' },
  { symbol: 'Binance Coin', name: 'Binance Coin', category: 'crypto', tvSymbol: 'BINANCE:BNBUSDT', coinId: 'binancecoin' },
  { symbol: 'Solana', name: 'Solana', category: 'crypto', tvSymbol: 'BINANCE:SOLUSDT', coinId: 'solana' },
  { symbol: 'Cardano', name: 'Cardano', category: 'crypto', tvSymbol: 'BINANCE:ADAUSDT', coinId: 'cardano' },
  { symbol: 'Ripple', name: 'Ripple', category: 'crypto', tvSymbol: 'BITSTAMP:XRPUSD', coinId: 'ripple' },
  { symbol: 'EUR/USD', name: 'EUR/USD', category: 'forex', tvSymbol: 'FX:EURUSD', forexKey: 'EUR/USD' },
  { symbol: 'GBP/USD', name: 'GBP/USD', category: 'forex', tvSymbol: 'FX:GBPUSD', forexKey: 'GBP/USD' },
  { symbol: 'USD/JPY', name: 'USD/JPY', category: 'forex', tvSymbol: 'FX:USDJPY', forexKey: 'USD/JPY' },
  { symbol: 'AUD/USD', name: 'AUD/USD', category: 'forex', tvSymbol: 'FX:AUDUSD', forexKey: 'AUD/USD' },
  { symbol: 'USD/CAD', name: 'USD/CAD', category: 'forex', tvSymbol: 'FX:USDCAD', forexKey: 'USD/CAD' },
  { symbol: 'USD/CHF', name: 'USD/CHF', category: 'forex', tvSymbol: 'FX:USDCHF', forexKey: 'USD/CHF' },
  { symbol: 'Gold', name: 'Gold', category: 'commodities', tvSymbol: 'OANDA:XAUUSD', forexKey: 'Gold' },
  { symbol: 'Silver', name: 'Silver', category: 'commodities', tvSymbol: 'OANDA:XAGUSD', forexKey: 'Silver' },
  { symbol: 'Crude Oil WTI', name: 'Crude Oil WTI', category: 'commodities', tvSymbol: 'TVC:USOIL', forexKey: 'Crude Oil' },
  { symbol: 'Brent Oil', name: 'Brent Oil', category: 'commodities', tvSymbol: 'TVC:UKOIL', forexKey: 'Brent Oil' },
  { symbol: 'Natural Gas', name: 'Natural Gas', category: 'commodities', tvSymbol: 'NYMEX:NG1!', forexKey: 'Natural Gas' },
];

const categories = ['All', 'Stocks', 'Forex', 'Crypto', 'Indices', 'Commodities'];

function formatPrice(price: number, symbol: string): string {
  if (price === 0) return '—';
  if (['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/CAD', 'USD/CHF'].includes(symbol)) return price.toFixed(4);
  if (symbol === 'USD/JPY') return price.toFixed(2);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price > 1) return price.toFixed(2);
  return price.toFixed(6);
}

export default function ChartPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState<Asset>(allAssets[16]); // Bitcoin default
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time price state
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceUp, setPriceUp] = useState(true);
  const [priceLoading, setPriceLoading] = useState(true);
  const prevPriceRef = useRef(0);
  const selectedAssetRef = useRef<Asset>(allAssets[16]);

  // Keep ref in sync
  useEffect(() => {
    selectedAssetRef.current = selectedAsset;
  }, [selectedAsset]);

  const fetchPrices = useCallback(async () => {
    try {
      const asset = selectedAssetRef.current;
      const [cryptoRes, forexRes] = await Promise.all([
        fetch('/api/prices/crypto?ids=bitcoin,ethereum,solana,binancecoin,ripple,cardano&per_page=6'),
        fetch('/api/prices/forex'),
      ]);
      const cryptoData = await cryptoRes.json();
      const forexData = await forexRes.json();

      const newPrices: Record<string, { price: number; change: number }> = { ...prices };

      // Process crypto
      if (cryptoData.success && cryptoData.data.length > 0) {
        cryptoData.data.forEach((c: { id: string; current_price: number; price_change_percentage_24h: number }) => {
          newPrices[c.id] = { price: c.current_price, change: c.price_change_percentage_24h };
        });
      }

      // Process forex/commodities
      if (forexData.success && forexData.data) {
        const fd = forexData.data;
        Object.keys(fd).forEach(key => {
          newPrices[`forex_${key}`] = { price: fd[key].price, change: fd[key].change };
        });
      }

      setPrices(newPrices);

      // Update current price for selected asset
      let newPrice = 0;
      let newChange = 0;

      if (asset.coinId && newPrices[asset.coinId]) {
        newPrice = newPrices[asset.coinId].price;
        newChange = newPrices[asset.coinId].change;
      } else if (asset.forexKey && newPrices[`forex_${asset.forexKey}`]) {
        newPrice = newPrices[`forex_${asset.forexKey}`].price;
        newChange = newPrices[`forex_${asset.forexKey}`].change;
      } else if (asset.stockFallback) {
        const base = asset.stockFallback;
        const variation = (Math.random() * 0.004 - 0.002);
        newPrice = parseFloat((base * (1 + variation)).toFixed(2));
        newChange = parseFloat((variation * 100).toFixed(2));
      }

      if (newPrice > 0) {
        setPriceUp(newPrice >= prevPriceRef.current && prevPriceRef.current !== 0);
        prevPriceRef.current = newPrice;
        setCurrentPrice(newPrice);
        setPriceChange(newChange);
        setPriceLoading(false);
      }
    } catch (err) {
      console.error('ChartPage price fetch error:', err);
      setPriceLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start 5s interval
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Reset price on asset change
  useEffect(() => {
    setCurrentPrice(0);
    prevPriceRef.current = 0;
    setPriceLoading(true);
    setTimeout(() => fetchPrices(), 50);
  }, [selectedAsset, fetchPrices]);

  const filteredAssets = allAssets.filter(asset => {
    const matchesCategory = activeCategory === 'All' || asset.category === activeCategory.toLowerCase();
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get price for sidebar asset
  const getAssetPrice = (asset: Asset): { price: number; change: number } => {
    if (asset.coinId && prices[asset.coinId]) return prices[asset.coinId];
    if (asset.forexKey && prices[`forex_${asset.forexKey}`]) return prices[`forex_${asset.forexKey}`];
    if (asset.stockFallback) return { price: asset.stockFallback, change: 0 };
    return { price: 0, change: 0 };
  };

  const pricePositive = priceChange >= 0;

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4 md:mb-6">Interactive Chart</h1>

        {/* Live Price Bar */}
        <div className="rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3 sm:gap-6" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#4ade80' }}></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#4ade80' }}></span>
            </span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{selectedAsset.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>{selectedAsset.category}</span>
          </div>
          <div className="flex items-center gap-2">
            {priceLoading ? (
              <div className="h-5 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
            ) : (
              <>
                <span
                  className="text-lg sm:text-xl font-bold font-mono transition-colors duration-300"
                  style={{ color: priceUp ? '#4ade80' : '#f87171' }}
                >
                  ${formatPrice(currentPrice, selectedAsset.symbol)}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: pricePositive ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                    color: pricePositive ? '#4ade80' : '#f87171',
                  }}
                >
                  {pricePositive ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </>
            )}
          </div>
          <div className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Refreshes every 5s</div>
        </div>

        <div className="overflow-hidden flex flex-col lg:flex-row rounded-2xl" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Chart area */}
          <div className="flex-1 relative flex flex-col min-w-0" style={{ background: '#0d0e23' }}>
            {/* Search + filters */}
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="relative mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  className="flex w-full min-w-0 rounded-lg px-3 py-1 outline-none pl-9 h-9 sm:h-10 md:h-12 text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  placeholder="Search any asset..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="px-3 sm:px-4 min-h-[44px] rounded-full text-xs font-medium transition-all whitespace-nowrap inline-flex items-center"
                    style={activeCategory === cat
                      ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* TradingView chart */}
            <div className="relative flex-1" style={{ minHeight: '280px', height: '420px', background: '#0d0e23' }}>
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
                  theme: 'dark',
                  style: '1',
                  timezone: 'Etc/UTC',
                  show_popup_button: '1',
                  studies_overrides: '{}',
                }))}`}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Market Watch sidebar */}
          <div className="w-full lg:w-64 xl:w-72 flex flex-col" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="font-bold text-white text-sm mb-0.5">Market Watch</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Click to view chart</p>
            </div>
            <div className="overflow-x-auto lg:overflow-x-hidden overflow-y-auto flex flex-row lg:flex-col" style={{ maxHeight: 'none' }}>
              <div className="flex flex-row lg:flex-col min-w-max lg:min-w-0 w-full">
                {filteredAssets.map((asset) => {
                  const liveData = getAssetPrice(asset);
                  const isSelected = selectedAsset.symbol === asset.symbol && selectedAsset.category === asset.category;
                  const displayPrice = liveData.price > 0 ? formatPrice(liveData.price, asset.symbol) : '—';
                  const displayChange = liveData.change !== 0 ? `${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}%` : null;
                  const changePositive = liveData.change >= 0;
                  return (
                    <div
                      key={`${asset.symbol}-${asset.category}`}
                      onClick={() => setSelectedAsset(asset)}
                      className="px-2.5 sm:px-3 lg:px-4 py-3 cursor-pointer transition-all flex-shrink-0 lg:flex-shrink min-h-[44px] flex items-center"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: `4px solid ${isSelected ? '#6366f1' : 'transparent'}`,
                        background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                        minWidth: '120px',
                      }}
                    >
                      <div className="flex flex-col sm:flex-row lg:flex-row justify-between items-start sm:items-center gap-1 w-full">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-bold text-xs truncate" style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)' }}>{asset.name}</span>
                          <span className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{asset.category}</span>
                        </div>
                        <div className="text-left sm:text-right lg:text-right ml-0 sm:ml-2">
                          <div className="text-xs font-mono font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {displayPrice}
                          </div>
                          {displayChange ? (
                            <div className={`text-[10px] font-bold ${changePositive ? 'text-green-400' : 'text-red-400'}`}>{displayChange}</div>
                          ) : (
                            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
