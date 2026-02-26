'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import Navbar from '@/components/Navbar';
import TickerTape from '@/components/TickerTape';
import { useSearchParams } from 'next/navigation';

interface Trade {
  id: number;
  symbol: string;
  symbolName: string;
  direction: 'UP' | 'DOWN';
  amount: number;
  openPrice: number;
  openTime: string;
  duration: string;
  status: 'open' | 'won' | 'lost';
  profit?: number;
  closeTime?: string;
  expiresAt?: number;
}

interface ToastNotification {
  id: number;
  status: 'won' | 'lost';
  symbol: string;
  amount: number;
  profit: number;
  direction: 'UP' | 'DOWN';
  executedAt: number; // timestamp when trade was executed
  countdown: number; // seconds elapsed
}

interface AssetPrice {
  symbol: string;
  name: string;
  tvSymbol: string;
  price: number;
  change: number;
  category: 'crypto' | 'stocks' | 'forex' | 'commodities';
  icon: string;
  prevPrice?: number;
}

const POPULAR_ASSETS: AssetPrice[] = [
  { symbol: 'BTC', name: 'Bitcoin', tvSymbol: 'BINANCE:BTCUSDT', price: 0, change: 0, category: 'crypto', icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', tvSymbol: 'BINANCE:ETHUSDT', price: 0, change: 0, category: 'crypto', icon: 'Ξ' },
  { symbol: 'SOL', name: 'Solana', tvSymbol: 'BINANCE:SOLUSDT', price: 0, change: 0, category: 'crypto', icon: '◎' },
  { symbol: 'BNB', name: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', price: 0, change: 0, category: 'crypto', icon: 'B' },
  { symbol: 'XRP', name: 'Ripple', tvSymbol: 'BINANCE:XRPUSDT', price: 0, change: 0, category: 'crypto', icon: 'X' },
  { symbol: 'AAPL', name: 'Apple', tvSymbol: 'NASDAQ:AAPL', price: 0, change: 0, category: 'stocks', icon: '' },
  { symbol: 'TSLA', name: 'Tesla', tvSymbol: 'NASDAQ:TSLA', price: 0, change: 0, category: 'stocks', icon: 'T' },
  { symbol: 'NVDA', name: 'NVIDIA', tvSymbol: 'NASDAQ:NVDA', price: 0, change: 0, category: 'stocks', icon: 'N' },
  { symbol: 'MSFT', name: 'Microsoft', tvSymbol: 'NASDAQ:MSFT', price: 0, change: 0, category: 'stocks', icon: 'M' },
  { symbol: 'EUR/USD', name: 'EUR/USD', tvSymbol: 'FX:EURUSD', price: 0, change: 0, category: 'forex', icon: '€' },
  { symbol: 'GBP/USD', name: 'GBP/USD', tvSymbol: 'FX:GBPUSD', price: 0, change: 0, category: 'forex', icon: '£' },
  { symbol: 'USD/JPY', name: 'USD/JPY', tvSymbol: 'FX:USDJPY', price: 0, change: 0, category: 'forex', icon: '¥' },
  { symbol: 'GOLD', name: 'Gold', tvSymbol: 'TVC:GOLD', price: 0, change: 0, category: 'commodities', icon: '🥇' },
  { symbol: 'OIL', name: 'Crude Oil', tvSymbol: 'TVC:USOIL', price: 0, change: 0, category: 'commodities', icon: '🛢' },
  { symbol: 'SILVER', name: 'Silver', tvSymbol: 'TVC:SILVER', price: 0, change: 0, category: 'commodities', icon: '🥈' },
];

const TRADING_SYMBOLS = [
  { label: 'Bitcoin', symbol: 'BTC', tvSymbol: 'BINANCE:BTCUSDT', binanceSymbol: 'btcusdt', coinId: 'bitcoin', category: 'crypto' },
  { label: 'Ethereum', symbol: 'ETH', tvSymbol: 'BINANCE:ETHUSDT', binanceSymbol: 'ethusdt', coinId: 'ethereum', category: 'crypto' },
  { label: 'Solana', symbol: 'SOL', tvSymbol: 'BINANCE:SOLUSDT', binanceSymbol: 'solusdt', coinId: 'solana', category: 'crypto' },
  { label: 'BNB', symbol: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', binanceSymbol: 'bnbusdt', coinId: 'binancecoin', category: 'crypto' },
  { label: 'XRP', symbol: 'XRP', tvSymbol: 'BINANCE:XRPUSDT', binanceSymbol: 'xrpusdt', coinId: 'ripple', category: 'crypto' },
  { label: 'Apple', symbol: 'AAPL', tvSymbol: 'NASDAQ:AAPL', binanceSymbol: '', coinId: '', category: 'stocks' },
  { label: 'Tesla', symbol: 'TSLA', tvSymbol: 'NASDAQ:TSLA', binanceSymbol: '', coinId: '', category: 'stocks' },
  { label: 'NVIDIA', symbol: 'NVDA', tvSymbol: 'NASDAQ:NVDA', binanceSymbol: '', coinId: '', category: 'stocks' },
  { label: 'Microsoft', symbol: 'MSFT', tvSymbol: 'NASDAQ:MSFT', binanceSymbol: '', coinId: '', category: 'stocks' },
  { label: 'EUR/USD', symbol: 'EURUSD', tvSymbol: 'FX:EURUSD', binanceSymbol: '', coinId: '', category: 'forex' },
  { label: 'GBP/USD', symbol: 'GBPUSD', tvSymbol: 'FX:GBPUSD', binanceSymbol: '', coinId: '', category: 'forex' },
  { label: 'Gold', symbol: 'GOLD', tvSymbol: 'TVC:GOLD', binanceSymbol: '', coinId: '', category: 'commodities' },
  { label: 'Crude Oil', symbol: 'OIL', tvSymbol: 'TVC:USOIL', binanceSymbol: '', coinId: '', category: 'commodities' },
];

const DURATIONS = [
  { label: '5 Sec', seconds: 5 },
  { label: '15 Sec', seconds: 15 },
  { label: '30 Sec', seconds: 30 },
  { label: '1 Min', seconds: 60 },
  { label: '5 Min', seconds: 300 },
  { label: '15 Min', seconds: 900 },
  { label: '30 Min', seconds: 1800 },
  { label: '1 Hour', seconds: 3600 },
  { label: '4 Hour', seconds: 14400 },
  { label: '1 Day', seconds: 86400 },
];

const CATEGORY_GRADIENT: Record<string, string> = {
  crypto: 'from-amber-500/20 to-orange-500/10',
  stocks: 'from-blue-500/20 to-indigo-500/10',
  forex: 'from-emerald-500/20 to-teal-500/10',
  commodities: 'from-orange-500/20 to-red-500/10',
};

const CATEGORY_BORDER: Record<string, string> = {
  crypto: 'rgba(245,158,11,0.35)',
  stocks: 'rgba(59,130,246,0.35)',
  forex: 'rgba(16,185,129,0.35)',
  commodities: 'rgba(249,115,22,0.35)',
};

const CATEGORY_GLOW: Record<string, string> = {
  crypto: 'rgba(245,158,11,0.12)',
  stocks: 'rgba(59,130,246,0.12)',
  forex: 'rgba(16,185,129,0.12)',
  commodities: 'rgba(249,115,22,0.12)',
};

const CATEGORY_ICON_BG: Record<string, string> = {
  crypto: 'rgba(245,158,11,0.15)',
  stocks: 'rgba(59,130,246,0.15)',
  forex: 'rgba(16,185,129,0.15)',
  commodities: 'rgba(249,115,22,0.15)',
};

const CATEGORY_ICON_COLOR: Record<string, string> = {
  crypto: '#f59e0b',
  stocks: '#3b82f6',
  forex: '#10b981',
  commodities: '#f97316',
};

const cardStyle = { background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' };
const labelStyle = { color: 'rgba(255,255,255,0.5)' };

// TradingView Mini Symbol Overview Widget
function TradingViewMiniSymbol({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = `tv-mini-${symbol.replace(/[^a-zA-Z0-9]/g, '-')}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      height: 220,
      locale: 'en',
      dateRange: '12M',
      colorTheme: 'dark',
      isTransparent: false,
      autosize: true,
      largeChartUrl: '',
      noTimeScale: false,
      chartOnly: false,
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#131722', border: '1px solid rgba(255,255,255,0.1)', minHeight: 220 }}
    >
      <div className="tradingview-widget-container" ref={containerRef} style={{ height: 220, width: '100%' }}>
        <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }}></div>
      </div>
    </div>
  );
}

// Server-side price hook — uses /api/prices/binance (server proxy) to avoid CORS issues
function useBinancePrice(binanceSymbol: string) {
  const [price, setPrice] = useState(0);
  const [change24h, setChange24h] = useState(0);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevPriceRef = useRef(0);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!binanceSymbol) return;

    // Clear previous
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }

    setPrice(0);
    setChange24h(0);
    prevPriceRef.current = 0;

    const sym = binanceSymbol.toLowerCase();

    const triggerFlash = (newPrice: number) => {
      if (prevPriceRef.current !== 0 && newPrice !== prevPriceRef.current) {
        const dir = newPrice > prevPriceRef.current ? 'up' : 'down';
        setPriceFlash(dir);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setPriceFlash(null), 600);
      }
      prevPriceRef.current = newPrice;
    };

    // Primary: server-side proxy to avoid CORS — polls every 1 second
    const fetchPrice = () => {
      fetch(`/api/prices/binance?symbol=${sym.toUpperCase()}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.success && d.price > 0) {
            triggerFlash(d.price);
            setPrice(d.price);
            if (d.change24h !== 0) setChange24h(d.change24h);
          }
        })
        .catch(() => {});
    };

    fetchPrice();
    pollRef.current = setInterval(fetchPrice, 1000);

    // Also try WebSocket for tick-by-tick updates (best effort)
    try {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@trade`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          const newPrice = parseFloat(data.p);
          if (newPrice > 0) {
            triggerFlash(newPrice);
            setPrice(newPrice);
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};
    } catch {}

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    };
  }, [binanceSymbol]);

  return { price, change24h, priceFlash };
}

export default function MarketsPage() {
  const [selectedSymbolIdx, setSelectedSymbolIdx] = useState(0);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [investAmount, setInvestAmount] = useState(10);
  const [selectedDuration, setSelectedDuration] = useState('1 Min');
  const [durationIdx, setDurationIdx] = useState(3);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [historyTrades, setHistoryTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [balance, setBalance] = useState(10000);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceUp, setPriceUp] = useState(true);
  const [assets, setAssets] = useState<AssetPrice[]>(POPULAR_ASSETS);
  const [priceLoading, setPriceLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const symbolSearchRef = useRef<HTMLDivElement>(null);
  const selectedSymbolIdxRef = useRef(selectedSymbolIdx);
  const toastTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  // For non-crypto assets (forex/stocks/commodities)
  const [nonCryptoPrice, setNonCryptoPrice] = useState(0);
  const [nonCryptoPriceUp, setNonCryptoPriceUp] = useState(true);
  const nonCryptoPrevRef = useRef(0);
  const prevPriceRef = useRef(0);

  const searchParams = useSearchParams();

  // Auto-select asset from URL query param
  useEffect(() => {
    const assetParam = searchParams.get('asset');
    if (assetParam) {
      const idx = TRADING_SYMBOLS.findIndex(
        (s) => s.label.toLowerCase() === assetParam.toLowerCase()
      );
      if (idx !== -1) {
        setSelectedSymbolIdx(idx);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSymbol = TRADING_SYMBOLS[selectedSymbolIdx];
  const isCrypto = selectedSymbol.category === 'crypto';

  // Binance WebSocket price for crypto assets
  const { price: binancePrice, change24h: binanceChange, priceFlash } = useBinancePrice(
    isCrypto ? selectedSymbol.binanceSymbol : ''
  );

  // Sync binance price → currentPrice for crypto
  useEffect(() => {
    if (!isCrypto || binancePrice === 0) return;
    setPriceUp(binancePrice >= prevPriceRef.current && prevPriceRef.current !== 0);
    prevPriceRef.current = binancePrice;
    setCurrentPrice(binancePrice);
    setPriceLoading(false);
  }, [binancePrice, isCrypto]);

  // For non-crypto: fetch from API every 3 seconds
  useEffect(() => {
    if (isCrypto) return;

    setNonCryptoPrice(0);
    nonCryptoPrevRef.current = 0;
    setPriceLoading(true);

    const fetchNonCryptoPrice = async () => {
      try {
        const res = await fetch('/api/prices/forex');
        const data = await res.json();
        if (data.success) {
          const fd = data.data;
          const forexMap: Record<string, string> = {
            'EUR/USD': 'EUR/USD',
            'GBP/USD': 'GBP/USD',
            'USD/JPY': 'USD/JPY',
            'GOLD': 'Gold',
            'OIL': 'Crude Oil',
            'SILVER': 'Silver',
            'AAPL': 'AAPL',
            'TSLA': 'TSLA',
            'NVDA': 'NVDA',
            'MSFT': 'MSFT'
          };
          const key = forexMap[selectedSymbol.symbol];
          if (key && fd[key]) {
            const newPrice = fd[key].price;
            setNonCryptoPriceUp(newPrice >= nonCryptoPrevRef.current && nonCryptoPrevRef.current !== 0);
            nonCryptoPrevRef.current = newPrice;
            setNonCryptoPrice(newPrice);
            setCurrentPrice(newPrice);
            setPriceUp(newPrice >= prevPriceRef.current && prevPriceRef.current !== 0);
            prevPriceRef.current = newPrice;
            setPriceLoading(false);
          } else {
            // Stock fallback with micro-variation to simulate live movement
            const stockBase: Record<string, number> = {
              'AAPL': 178.50, 'TSLA': 245.30, 'NVDA': 875.20, 'MSFT': 415.80
            };
            const base = stockBase[selectedSymbol.symbol];
            if (base) {
              const prev = nonCryptoPrevRef.current || base;
              const variation = (Math.random() * 0.002 - 0.001);
              const newPrice = parseFloat((prev * (1 + variation)).toFixed(2));
              setNonCryptoPriceUp(newPrice >= nonCryptoPrevRef.current && nonCryptoPrevRef.current !== 0);
              nonCryptoPrevRef.current = newPrice;
              setNonCryptoPrice(newPrice);
              setCurrentPrice(newPrice);
              setPriceUp(newPrice >= prevPriceRef.current && prevPriceRef.current !== 0);
              prevPriceRef.current = newPrice;
              setPriceLoading(false);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    fetchNonCryptoPrice();
    const interval = setInterval(fetchNonCryptoPrice, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbolIdx, isCrypto]);

  // Reset price state on symbol change
  useEffect(() => {
    setCurrentPrice(0);
    prevPriceRef.current = 0;
    setPriceLoading(true);
  }, [selectedSymbolIdx]);

  // Fetch all asset prices for Popular Assets grid (Binance REST for crypto, forex API for others)
  useEffect(() => {
    const fetchAllAssets = async () => {
      try {
        // Fetch all crypto prices from Binance in one call
        const binanceSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
        const [binanceRes, forexRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(binanceSymbols)}`),
          fetch('/api/prices/forex'),
        ]);

        const binanceData = await binanceRes.json();
        const forexData = await forexRes.json();

        setAssets(prev => {
          const updated = prev.map(a => ({ ...a, prevPrice: a.price }));

          // Map Binance data
          const binanceMap: Record<string, { price: number; change: number }> = {};
          if (Array.isArray(binanceData)) {
            binanceData.forEach((d: { symbol: string; lastPrice: string; priceChangePercent: string }) => {
              binanceMap[d.symbol] = {
                price: parseFloat(d.lastPrice),
                change: parseFloat(d.priceChangePercent),
              };
            });
          }

          const cryptoSymbolMap: Record<string, string> = {
            'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT', 'BNB': 'BNBUSDT', 'XRP': 'XRPUSDT'
          };

          return updated.map(a => {
            const binanceKey = cryptoSymbolMap[a.symbol];
            if (binanceKey && binanceMap[binanceKey]) {
              return { ...a, price: binanceMap[binanceKey].price, change: binanceMap[binanceKey].change };
            }
            if (forexData.success) {
              const fd = forexData.data;
              const forexMap: Record<string, string> = {
                'EUR/USD': 'EUR/USD', 'GBP/USD': 'GBP/USD', 'USD/JPY': 'USD/JPY',
                'GOLD': 'Gold', 'OIL': 'Crude Oil', 'SILVER': 'Silver',
                'AAPL': 'AAPL', 'TSLA': 'TSLA', 'NVDA': 'NVDA', 'MSFT': 'MSFT'
              };
              const key = forexMap[a.symbol];
              if (key && fd[key]) {
                return { ...a, price: fd[key].price, change: fd[key].change };
              }
            }
            return a;
          });
        });
      } catch {
        // ignore
      }
    };

    fetchAllAssets();
    const interval = setInterval(fetchAllAssets, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalTrades = historyTrades.length;
  const wonTrades = historyTrades.filter(t => t.status === 'won').length;
  const winRate = totalTrades > 0 ? ((wonTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalProfit = historyTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
  const potentialProfit = parseFloat((investAmount * 0.95).toFixed(2));

  // Add toast notification
  const addToast = useCallback((trade: Trade & { profit: number }) => {
    const toast: ToastNotification = {
      id: Date.now() + Math.random(),
      status: trade.status as 'won' | 'lost',
      symbol: trade.symbolName,
      amount: trade.amount,
      profit: trade.profit,
      direction: trade.direction,
      executedAt: Date.now(),
      countdown: 0,
    };
    setToasts(prev => [toast, ...prev.slice(0, 4)]);
    // Auto-remove after 8 seconds
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
      toastTimersRef.current.delete(toast.id);
    }, 8000);
    toastTimersRef.current.set(toast.id, timer);
  }, []);

  const dismissToast = (id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimersRef.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Update toast countdowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts(prev => prev.map(t => ({ ...t, countdown: Math.floor((Date.now() - t.executedAt) / 1000) })));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real-time prices
  const fetchPrices = useCallback(async () => {
    try {
      const currentIdx = selectedSymbolIdxRef.current;
      const currentSym = TRADING_SYMBOLS[currentIdx];

      const [cryptoRes, forexRes] = await Promise.all([
        fetch('/api/prices/crypto?ids=bitcoin,ethereum,solana,binancecoin,ripple&per_page=5'),
        fetch('/api/prices/forex'),
      ]);

      const isJson = (res: Response) => {
        const ct = res.headers.get('content-type') || '';
        return res.ok && ct.includes('application/json');
      };

      const cryptoData = isJson(cryptoRes) ? await cryptoRes.json() : { success: false, data: [] };
      const forexData = isJson(forexRes) ? await forexRes.json() : { success: false };

      const updatedAssets = assets.map(a => ({ ...a, prevPrice: a.price }));

      if (cryptoData.success && cryptoData.data.length > 0) {
        const cryptoMap: Record<string, { price: number; change: number }> = {};
        cryptoData.data.forEach((c: { id: string; current_price: number; price_change_percentage_24h: number }) => {
          cryptoMap[c.id] = { price: c.current_price, change: c.price_change_percentage_24h };
        });
        const coinIdMap: Record<string, string> = {
          'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'BNB': 'binancecoin', 'XRP': 'ripple'
        };
        updatedAssets.forEach((a, i) => {
          const coinId = coinIdMap[a.symbol];
          if (coinId && cryptoMap[coinId]) {
            updatedAssets[i] = { ...a, prevPrice: a.price, price: cryptoMap[coinId].price, change: cryptoMap[coinId].change };
          }
        });

        // NOTE: Do NOT update currentPrice here for crypto — Binance WebSocket is the sole source
        // so that currentPrice always matches TradingView chart (both use Binance real-time data)
      }

      if (forexData.success) {
        const fd = forexData.data;
        const forexMap: Record<string, string> = {
          'EUR/USD': 'EUR/USD', 'GBP/USD': 'GBP/USD', 'USD/JPY': 'USD/JPY',
          'GOLD': 'Gold', 'OIL': 'Crude Oil', 'SILVER': 'Silver',
          'AAPL': 'AAPL', 'TSLA': 'TSLA', 'NVDA': 'NVDA', 'MSFT': 'MSFT'
        };
        updatedAssets.forEach((a, i) => {
          const key = forexMap[a.symbol];
          if (key && fd[key]) {
            updatedAssets[i] = { ...a, prevPrice: a.price, price: fd[key].price, change: fd[key].change };
          }
        });

        if (!currentSym.coinId) {
          const priceKey = forexMap[currentSym.symbol] || currentSym.symbol;
          if (fd[priceKey]) {
            const newPrice = fd[priceKey].price;
            setPriceUp(newPrice >= prevPriceRef.current && prevPriceRef.current !== 0);
            prevPriceRef.current = newPrice;
            setCurrentPrice(newPrice);
            setPriceUp(newPrice >= prevPriceRef.current && prevPriceRef.current !== 0);
            setPriceLoading(false);
          }
        }
      }

      setAssets(updatedAssets);
      // Only mark loading done for non-crypto here; crypto loading is handled by Binance WS
      if (!TRADING_SYMBOLS[selectedSymbolIdxRef.current].coinId) {
        setPriceLoading(false);
      }
    } catch (err) {
      console.error('Price fetch error:', err);
      setPriceLoading(false);
    }
  }, [assets]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // 5s interval
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPrice(0);
    prevPriceRef.current = 0;
    setPriceLoading(true);
    setTimeout(() => fetchPrices(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbolIdx]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (symbolSearchRef.current && !symbolSearchRef.current.contains(e.target as Node)) {
        setShowSymbolSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Expire open trades + show toast
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTrades(prev => {
        const expired = prev.filter(t => t.expiresAt && t.expiresAt <= now);
        if (expired.length > 0) {
          const resolved = expired.map(t => {
            const won = Math.random() > 0.5;
            return {
              ...t,
              status: won ? 'won' as const : 'lost' as const,
              profit: won ? t.amount * 0.95 : -t.amount,
              closeTime: new Date().toLocaleTimeString(),
            };
          });
          setHistoryTrades(h => [...resolved, ...h]);
          setBalance(b => {
            let newBal = b;
            resolved.forEach(t => { newBal += t.profit || 0; });
            return Math.max(0, newBal);
          });
          // Show toast for each resolved trade
          resolved.forEach(t => {
            if (t.profit !== undefined) {
              addToast(t as Trade & { profit: number });
            }
          });
          return prev.filter(t => !t.expiresAt || t.expiresAt > now);
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [addToast]);

  const handleTrade = (direction: 'UP' | 'DOWN') => {
    if (investAmount < 1 || investAmount > 10000) return;
    if (investAmount > balance) return;
    const dur = DURATIONS.find(d => d.label === selectedDuration);
    const seconds = dur?.seconds || 60;
    const newTrade: Trade = {
      id: Date.now(),
      symbol: selectedSymbol.symbol,
      symbolName: selectedSymbol.label,
      direction,
      amount: investAmount,
      openPrice: currentPrice,
      openTime: new Date().toLocaleTimeString(),
      duration: selectedDuration,
      status: 'open',
      expiresAt: Date.now() + seconds * 1000,
    };
    setTrades(prev => [newTrade, ...prev]);
    setBalance(prev => prev - investAmount);
  };

  const handleAmountChange = (val: number) => {
    const clamped = Math.max(1, Math.min(10000, val));
    setInvestAmount(clamped);
  };

  const handleDurationChange = (idx: number) => {
    const clamped = Math.max(0, Math.min(DURATIONS.length - 1, idx));
    setDurationIdx(clamped);
    setSelectedDuration(DURATIONS[clamped].label);
  };

  const filteredSymbols = TRADING_SYMBOLS.filter(s =>
    s.label.toLowerCase().includes(symbolSearch.toLowerCase()) ||
    s.symbol.toLowerCase().includes(symbolSearch.toLowerCase())
  );

  const formatPrice = (price: number, symbol: string) => {
    if (price === 0) return '—';
    if (['EUR/USD', 'GBP/USD', 'USD/JPY', 'EURUSD', 'GBPUSD', 'USDJPY'].includes(symbol)) {
      return price.toFixed(4);
    }
    if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price > 1) return price.toFixed(2);
    return price.toFixed(6);
  };

  const formatCountdown = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s ago`;
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      {/* Navbar */}
      <Navbar />
      {/* Ticker Tape */}
      <TickerTape />

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '340px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: toast.status === 'won' ?'linear-gradient(135deg, #052e16 0%, #0d1f0d 100%)' :'linear-gradient(135deg, #2d0a0a 0%, #1f0d0d 100%)',
              border: toast.status === 'won' ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(239,68,68,0.4)',
              boxShadow: toast.status === 'won' ?'0 8px 32px rgba(34,197,94,0.2), 0 0 0 1px rgba(34,197,94,0.1)' :'0 8px 32px rgba(239,68,68,0.2), 0 0 0 1px rgba(239,68,68,0.1)',
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            {/* Top accent bar */}
            <div
              className="h-1 w-full"
              style={{
                background: toast.status === 'won' ?'linear-gradient(90deg, #22c55e, #4ade80)' :'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                    style={{
                      background: toast.status === 'won' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    }}
                  >
                    {toast.status === 'won' ? '🏆' : '💸'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold"
                        style={{ color: toast.status === 'won' ? '#4ade80' : '#f87171' }}
                      >
                        {toast.status === 'won' ? 'TRADE WON!' : 'TRADE LOST'}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: toast.direction === 'UP' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                          color: toast.direction === 'UP' ? '#4ade80' : '#f87171',
                        }}
                      >
                        {toast.direction === 'UP' ? '▲ UP' : '▼ DOWN'}
                      </span>
                    </div>
                    <div className="text-white font-semibold text-sm">{toast.symbol}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Invested: ${toast.amount}</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: toast.status === 'won' ? '#4ade80' : '#f87171' }}
                      >
                        {toast.profit >= 0 ? '+' : ''}${toast.profit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 mt-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
              {/* Countdown timer */}
              <div className="mt-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Executed {formatCountdown(toast.countdown)}</span>
                {/* Progress bar */}
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.max(0, 100 - (toast.countdown / 8) * 100)}%`,
                      background: toast.status === 'won' ? '#22c55e' : '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Markets</h1>
            <p className="text-xs sm:text-sm" style={labelStyle}>Practice trading with virtual funds</p>
          </div>
          <div className="rounded-xl px-5 py-3 shadow-lg" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <div className="text-xs text-white/80 mb-0.5">Demo Account Balance</div>
            <div className="text-xl sm:text-2xl font-bold text-white">${balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {[
            { label: 'Total Trades', value: totalTrades, color: '#818cf8', bg: 'rgba(99,102,241,0.15)', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
              </svg>
            )},
            { label: 'Win Rate', value: `${winRate}%`, color: '#4ade80', bg: 'rgba(34,197,94,0.15)', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><path d="M18 9h1.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h5"/>
                <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.46C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
              </svg>
            )},
            { label: 'Total Profit', value: `$${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? '#34d399' : '#f87171', bg: 'rgba(16,185,129,0.15)', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="2" y2="22"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            )},
            { label: 'Open Positions', value: trades.length, color: '#fb923c', bg: 'rgba(249,115,22,0.15)', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            )},
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl p-3 sm:p-4" style={cardStyle}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" style={{ background: stat.bg, color: stat.color }}>
                  {stat.icon}
                </div>
                <div>
                  <div className="text-xs" style={labelStyle}>{stat.label}</div>
                  <div className="text-base sm:text-lg font-bold" style={{ color: stat.label === 'Total Profit' ? stat.color : 'white' }}>{stat.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Section */}
        <div className="rounded-2xl overflow-hidden mb-4" style={cardStyle}>
          {/* Symbol Selector */}
          <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="text-xs mb-1" style={labelStyle}>Trading Symbol</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base sm:text-lg font-bold text-white">{selectedSymbol.label}</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedSymbol.tvSymbol}</div>
              </div>
              <div className="relative" ref={symbolSearchRef}>
                <button
                  onClick={() => setShowSymbolSearch(!showSymbolSearch)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                  </svg>
                </button>
                {showSymbolSearch && (
                  <div className="absolute right-0 top-full mt-1 w-64 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div className="p-2">
                      <input
                        autoFocus
                        value={symbolSearch}
                        onChange={e => setSymbolSearch(e.target.value)}
                        placeholder="Search symbol..."
                        className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-purple-500"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredSymbols.map((s) => (
                        <button
                          key={s.symbol}
                          onClick={() => {
                            setSelectedSymbolIdx(TRADING_SYMBOLS.findIndex(ts => ts.symbol === s.symbol));
                            setShowSymbolSearch(false);
                            setSymbolSearch('');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
                          style={{ background: selectedSymbol.symbol === s.symbol ? 'rgba(99,102,241,0.15)' : 'transparent' }}
                        >
                          <span className="text-sm text-white font-medium">{s.label}</span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.symbol}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TradingView Chart */}
          <div style={{ height: '420px' }}>
            <iframe
              key={selectedSymbol.tvSymbol}
              title="TradingView Advanced Chart"
              src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({
                symbol: selectedSymbol.tvSymbol,
                interval: '1',
                hide_side_toolbar: '0',
                allow_symbol_change: '0',
                save_image: '0',
                theme: 'dark',
                style: '1',
                timezone: 'Etc/UTC',
                show_popup_button: '0',
              }))}`}
              frameBorder={0}
              allowFullScreen
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Live Real-Time Pricing Bar */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs sm:text-sm font-semibold text-green-400">
                {isCrypto ? 'Live Market' : 'LIVE · 1s'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm" style={labelStyle}>Current Price:</span>
              {(priceLoading && currentPrice === 0) ? (
                <span className="text-base sm:text-lg font-bold text-white animate-pulse">Loading...</span>
              ) : (
                <>
                  <span
                    className="text-base sm:text-xl font-bold transition-all duration-150"
                    style={{
                      color: priceUp ? '#4ade80' : '#f87171',
                      textShadow: priceFlash === 'up' ?'0 0 12px rgba(74,222,128,0.9), 0 0 24px rgba(74,222,128,0.5)'
                        : priceFlash === 'down' ?'0 0 12px rgba(248,113,113,0.9), 0 0 24px rgba(248,113,113,0.5)' :'none',
                      transform: priceFlash ? 'scale(1.04)' : 'scale(1)',
                      display: 'inline-block',
                    }}
                  >
                    {['EUR/USD','GBP/USD','USD/JPY','EURUSD','GBPUSD','USDJPY'].includes(selectedSymbol.symbol)
                      ? currentPrice.toFixed(4)
                      : `$${formatPrice(currentPrice, selectedSymbol.symbol)}`
                    }
                  </span>
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    priceUp ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {priceUp ? '▲' : '▼'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Investment + Duration + Execute */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
          {/* Investment Amount */}
          <div className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
            <h3 className="font-bold text-white text-sm sm:text-base mb-4">Investment Amount</h3>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => handleAmountChange(investAmount - 1)}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg font-bold text-white text-lg transition-colors flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >−</button>
              <div
                className="flex-1 text-center text-lg sm:text-xl font-bold text-white rounded-lg py-2.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                ${investAmount.toLocaleString()}
              </div>
              <button
                onClick={() => handleAmountChange(investAmount + 1)}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg font-bold text-white text-lg transition-colors flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >+</button>
            </div>
            <div className="text-center text-xs" style={labelStyle}>Range: $1 - $10,000</div>
            <input
              type="range"
              min={1}
              max={10000}
              value={investAmount}
              onChange={e => handleAmountChange(Number(e.target.value))}
              className="w-full mt-3 accent-purple-500"
            />
          </div>

          {/* Trade Duration */}
          <div className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
            <h3 className="font-bold text-white text-sm sm:text-base mb-4">Trade Duration</h3>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => handleDurationChange(durationIdx - 1)}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg font-bold text-white text-lg transition-colors flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >−</button>
              <div
                className="flex-1 text-center text-lg sm:text-xl font-bold text-white rounded-lg py-2.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {selectedDuration}
              </div>
              <button
                onClick={() => handleDurationChange(durationIdx + 1)}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg font-bold text-white text-lg transition-colors flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >+</button>
            </div>
            <div className="text-center text-xs mb-1" style={labelStyle}>Range: 5 Sec – 1 Day</div>
            <input
              type="range"
              min={0}
              max={DURATIONS.length - 1}
              value={durationIdx}
              onChange={e => handleDurationChange(Number(e.target.value))}
              className="w-full mt-2 mb-4 accent-purple-500"
            />
            <div className="grid grid-cols-3 gap-1.5">
              {DURATIONS.map((dur, i) => (
                <button
                  key={dur.label}
                  onClick={() => handleDurationChange(i)}
                  className="min-h-[36px] text-xs font-bold rounded-xl transition-all"
                  style={
                    selectedDuration === dur.label
                      ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {dur.label}
                </button>
              ))}
            </div>
          </div>

          {/* Execute Trade */}
          <div className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
            <h3 className="font-bold text-white text-sm sm:text-base mb-4">Execute Trade</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={labelStyle}>Market Status</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400">Open</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={labelStyle}>Potential Profit</span>
                <span className="text-sm font-bold text-green-400">+${potentialProfit.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={labelStyle}>Payout</span>
                <span className="text-sm font-bold text-white">95%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTrade('UP')}
                disabled={investAmount > balance || currentPrice === 0}
                className="flex items-center justify-center gap-1.5 min-h-[48px] bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-green-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m18 15-6-6-6 6"/>
                </svg>
                UP
              </button>
              <button
                onClick={() => handleTrade('DOWN')}
                disabled={investAmount > balance || currentPrice === 0}
                className="flex items-center justify-center gap-1.5 min-h-[48px] bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-red-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
                DOWN
              </button>
            </div>
            {investAmount > balance && (
              <p className="text-red-400 text-xs mt-2 text-center">Insufficient balance</p>
            )}
          </div>
        </div>

        {/* Open Positions / History Tabs */}
        <div className="rounded-2xl overflow-hidden mb-6" style={cardStyle}>
          <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setActiveTab('open')}
              className="flex-1 sm:flex-none px-6 min-h-[48px] text-sm font-medium transition-colors"
              style={activeTab === 'open'
                ? { color: '#818cf8', borderBottom: '2px solid #6366f1' }
                : { color: 'rgba(255,255,255,0.4)' }
              }
            >
              Open Positions ({trades.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className="flex-1 sm:flex-none px-6 min-h-[48px] text-sm font-medium transition-colors"
              style={activeTab === 'history'
                ? { color: '#818cf8', borderBottom: '2px solid #6366f1' }
                : { color: 'rgba(255,255,255,0.4)' }
              }
            >
              History ({historyTrades.length})
            </button>
          </div>
          <div className="p-4">
            {activeTab === 'open' ? (
              trades.length === 0 ? (
                <div className="text-center py-8 text-sm" style={labelStyle}>No open positions. Place a trade to get started.</div>
              ) : (
                <div className="space-y-2">
                  {trades.map(trade => (
                    <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.direction === 'UP' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>{trade.direction}</span>
                        <div>
                          <div className="font-bold text-white text-sm">{trade.symbolName}</div>
                          <div className="text-xs" style={labelStyle}>{trade.openTime} · {trade.duration}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white text-sm">${trade.amount}</div>
                        <div className="text-xs" style={labelStyle}>@ ${formatPrice(trade.openPrice, trade.symbol)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              historyTrades.length === 0 ? (
                <div className="text-center py-8 text-sm" style={labelStyle}>No trade history yet.</div>
              ) : (
                <div className="space-y-2">
                  {historyTrades.map(trade => (
                    <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.status === 'won' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>{trade.status === 'won' ? 'WON' : 'LOST'}</span>
                        <div>
                          <div className="font-bold text-white text-sm">{trade.symbolName}</div>
                          <div className="text-xs" style={labelStyle}>{trade.direction} · {trade.duration}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-sm ${
                          (trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>{(trade.profit || 0) >= 0 ? '+' : ''}${trade.profit?.toFixed(2)}</div>
                        <div className="text-xs" style={labelStyle}>${trade.amount} invested</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Popular Assets - TradingView Mini Symbol Overview */}
        <div className="mb-6">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Popular Assets</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Track and trade the most popular stocks, cryptocurrencies, forex pairs, and commodities</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { symbol: 'BINANCE:BTCUSDT', displaySymbol: 'BTCUSDT', name: 'BITCOIN / TETHERS' },
              { symbol: 'BINANCE:ETHUSDT', displaySymbol: 'ETHUSDT', name: 'ETHEREUM / TETHERS' },
              { symbol: 'BINANCE:SOLUSDT', displaySymbol: 'SOLUSDT', name: 'SOL / TETHERS' },
              { symbol: 'BINANCE:BNBUSDT', displaySymbol: 'BNBUSDT', name: 'BINANCE COIN / TETHERS' },
              { symbol: 'BINANCE:XRPUSDT', displaySymbol: 'XRPUSDT', name: 'XRP / TETHERS' },
              { symbol: 'BINANCE:ADAUSDT', displaySymbol: 'ADAUSDT', name: 'CARDANO / TETHERS' },
              { symbol: 'BINANCE:DOGEUSDT', displaySymbol: 'DOGEUSDT', name: 'DOGECOIN / TETHERS' },
              { symbol: 'BINANCE:DOTUSDT', displaySymbol: 'DOTUSDT', name: 'DOT / TETHERS' },
              { symbol: 'NASDAQ:AAPL', displaySymbol: 'AAPL', name: 'APPLE INC' },
              { symbol: 'NASDAQ:MSFT', displaySymbol: 'MSFT', name: 'MICROSOFT CORP.' },
              { symbol: 'NASDAQ:GOOGL', displaySymbol: 'GOOGL', name: 'ALPHABET INC (GOOGLE) CLASS A' },
              { symbol: 'NASDAQ:AMZN', displaySymbol: 'AMZN', name: 'AMAZON.COM, INC.' },
            ].map((asset) => (
              <TradingViewMiniSymbol key={asset.symbol} symbol={asset.symbol} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
