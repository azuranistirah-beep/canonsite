'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// Singleton Supabase browser client — shared with AuthContext
const supabase = createClient();

// ─── Types ───────────────────────────────────────────────────────────────────
interface Asset {
  symbol: string;
  name: string;
  tvSymbol: string;
  binanceSymbol?: string;
  exchange?: string;
  category: 'crypto' | 'forex' | 'commodity' | 'stock';
  payout: number;
  quoteCurrency?: string;
}

interface PriceData {
  price: number;
  change24h: number;
  prevPrice: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

interface Trade {
  id: string;
  asset_symbol: string;
  asset_name: string;
  direction: 'buy' | 'sell';
  amount: number;
  entry_price: number;
  duration_seconds: number;
  status: 'pending' | 'active' | 'won' | 'lost' | 'cancelled';
  profit_loss: number;
  opened_at: string;
  closed_at?: string;
  account_type: 'demo' | 'real';
}

interface TradeNotification {
  visible: boolean;
  result: 'won' | 'lost' | null;
  amount: number;
  profit: number;
  countdown: number;
}

// ─── Asset List ──────────────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { symbol: 'BTC/USD', name: 'Bitcoin', tvSymbol: 'BINANCE:BTCUSDT', binanceSymbol: 'BTCUSDT', exchange: 'Binance', quoteCurrency: 'TetherUS', category: 'crypto', payout: 95 },
  { symbol: 'ETH/USD', name: 'Ethereum', tvSymbol: 'BINANCE:ETHUSDT', binanceSymbol: 'ETHUSDT', exchange: 'Binance', quoteCurrency: 'TetherUS', category: 'crypto', payout: 92 },
  { symbol: 'SOL/USD', name: 'Solana', tvSymbol: 'BINANCE:SOLUSDT', binanceSymbol: 'SOLUSDT', exchange: 'Binance', quoteCurrency: 'TetherUS', category: 'crypto', payout: 90 },
  { symbol: 'BNB/USD', name: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', binanceSymbol: 'BNBUSDT', exchange: 'Binance', quoteCurrency: 'TetherUS', category: 'crypto', payout: 88 },
  { symbol: 'XRP/USD', name: 'Ripple', tvSymbol: 'BINANCE:XRPUSDT', binanceSymbol: 'XRPUSDT', exchange: 'Binance', quoteCurrency: 'TetherUS', category: 'crypto', payout: 88 },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', tvSymbol: 'FX:EURUSD', exchange: 'FX', quoteCurrency: 'USD', category: 'forex', payout: 85 },
  { symbol: 'GBP/USD', name: 'British Pound / USD', tvSymbol: 'FX:GBPUSD', exchange: 'FX', quoteCurrency: 'USD', category: 'forex', payout: 85 },
  { symbol: 'USD/JPY', name: 'US Dollar / Yen', tvSymbol: 'FX:USDJPY', exchange: 'FX', quoteCurrency: 'JPY', category: 'forex', payout: 85 },
  { symbol: 'AUD/USD', name: 'Australian Dollar / USD', tvSymbol: 'FX:AUDUSD', exchange: 'FX', quoteCurrency: 'USD', category: 'forex', payout: 83 },
  { symbol: 'XAU/USD', name: 'Gold', tvSymbol: 'OANDA:XAUUSD', exchange: 'OANDA', quoteCurrency: 'USD', category: 'commodity', payout: 87 },
  { symbol: 'XAG/USD', name: 'Silver', tvSymbol: 'OANDA:XAGUSD', exchange: 'OANDA', quoteCurrency: 'USD', category: 'commodity', payout: 85 },
  { symbol: 'OIL/USD', name: 'Crude Oil', tvSymbol: 'NYMEX:CL1!', exchange: 'NYMEX', quoteCurrency: 'USD', category: 'commodity', payout: 83 },
  { symbol: 'AAPL', name: 'Apple Inc.', tvSymbol: 'NASDAQ:AAPL', exchange: 'NASDAQ', quoteCurrency: 'USD', category: 'stock', payout: 80 },
  { symbol: 'TSLA', name: 'Tesla Inc.', tvSymbol: 'NASDAQ:TSLA', exchange: 'NASDAQ', quoteCurrency: 'USD', category: 'stock', payout: 80 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', tvSymbol: 'NASDAQ:NVDA', exchange: 'NASDAQ', quoteCurrency: 'USD', category: 'stock', payout: 80 },
];

// ─── Duration Options ─────────────────────────────────────────────────────────
const DURATIONS = [
  { label: '5s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '4h', seconds: 14400 },
  { label: '1d', seconds: 86400 },
  { label: '2d', seconds: 172800 },
];

const AMOUNT_MIN = 10;
const AMOUNT_MAX = 10000;

const TF_MAP: Record<string, string> = {
  '1m': '1', '30m': '30', '1h': '60',
};

function formatPrice(price: number, symbol: string): string {
  if (!price) return '0.00';
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price > 1) return price.toFixed(4);
  return price.toFixed(6);
}

// ─── Bitcoin SVG Icon ─────────────────────────────────────────────────────────
function BitcoinIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
      <path d="M22.5 14.2c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6-1.3-.3.7-2.6-1.7-.4-.7 2.7-1.1-.3v0l-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8.9l-.8 3.3c0 0 .1 0 .2.1l-.2-.1-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5 1.2.3-.7 2.7 1.7.4.7-2.7 1.3.3-.7 2.7 1.7.4.7-2.7c2.8.5 4.9.3 5.8-2.2.7-2-.1-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2-3.9.9-5 .6l.9-3.5c1.1.3 4.6.8 4.1 2.9zm.5-5.3c-.5 1.8-3.3.9-4.3.7l.8-3.2c1 .2 4 .7 3.5 2.5z" fill="white"/>
    </svg>
  );
}

// ─── Asset Icon Component ─────────────────────────────────────────────────────
function AssetIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  if (symbol.includes('BTC')) return <BitcoinIcon size={size} />;
  const colors: Record<string, string> = {
    'ETH': '#627EEA', 'SOL': '#9945FF', 'BNB': '#F3BA2F', 'XRP': '#00AAE4',
    'EUR': '#003399', 'GBP': '#012169', 'USD': '#1a5276', 'AUD': '#00843D',
    'XAU': '#FFD700', 'XAG': '#C0C0C0', 'OIL': '#8B4513',
    'AAPL': '#555555', 'TSLA': '#CC0000', 'NVDA': '#76B900',
  };
  const key = Object.keys(colors).find(k => symbol.includes(k)) || 'USD';
  const letters: Record<string, string> = {
    'ETH': '\u039E', 'SOL': 'S', 'BNB': 'B', 'XRP': 'X',
    'EUR': '\u20AC', 'GBP': '\u00A3', 'USD': '$', 'AUD': 'A',
    'XAU': 'Au', 'XAG': 'Ag', 'OIL': 'O',
    'AAPL': '', 'TSLA': '\u26A1', 'NVDA': 'N',
  };
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: colors[key] || '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>
      {letters[key] || symbol[0]}
    </div>
  );
}

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: 'platform',
    label: 'Platform',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'penawaran',
    label: 'Penawaran',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2H3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    id: 'robot',
    label: 'Robot',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M8 8V6a4 4 0 018 0v2" />
        <circle cx="9" cy="14" r="1.5" fill="currentColor" />
        <circle cx="15" cy="14" r="1.5" fill="currentColor" />
        <path strokeLinecap="round" d="M9 18h6" />
        <path strokeLinecap="round" d="M12 2v2" />
      </svg>
    ),
  },
  {
    id: 'dukungan',
    label: 'Dukungan',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 0118 0v6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2H3z" />
      </svg>
    ),
  },
  {
    id: 'akun',
    label: 'Akun',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradeDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut: authSignOut } = useAuth();

  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  const [demoBalance, setDemoBalance] = useState<number>(10000);
  const [realBalance, setRealBalance] = useState<number>(0);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetCategory, setAssetCategory] = useState<'all' | 'crypto' | 'forex' | 'commodity' | 'stock'>('all');
  const assetDropdownRef = useRef<HTMLDivElement>(null);

  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number>(0);

  const [chartTimeframe, setChartTimeframe] = useState('1m');

  const [durationIdx, setDurationIdx] = useState(4);
  const [tradeAmount, setTradeAmount] = useState(10);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [tradeCountdown, setTradeCountdown] = useState(0);

  const [notification, setNotification] = useState<TradeNotification>({
    visible: false, result: null, amount: 0, profit: 0, countdown: 3,
  });

  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [activeNav, setActiveNav] = useState('platform');
  const [showHelp, setShowHelp] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; direction: 'buy' | 'sell' | null }>({
    visible: false, direction: null,
  });

  // ─── Detect desktop (>= 1024px) ──────────────────────────────────────────────
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ─── Client-side session guard ───────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, router]);

  // ─── Close dropdowns on outside click ───────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(e.target as Node)) {
        setShowAssetDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Load balances ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const loadBalances = async () => {
      try {
        const [demoRes, realRes] = await Promise.all([
          supabase.from('demo_accounts').select('balance').eq('user_id', user.id).maybeSingle(),
          supabase.from('real_accounts').select('balance').eq('user_id', user.id).maybeSingle(),
        ]);
        if (demoRes.data) setDemoBalance(Number(demoRes.data.balance));
        if (realRes.data) setRealBalance(Number(realRes.data.balance));
      } catch (e) {
        console.error('Balance load error:', e);
      }
    };
    loadBalances();
  }, [user]);

  // ─── Load trade history ──────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setTradeHistory(data as Trade[]);
    } catch (e) {
      console.error('History load error:', e);
    }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ─── Fetch prices ─────────────────────────────────────────────────────────────
  const fetchPrice = useCallback(async (asset: Asset) => {
    if (!asset.binanceSymbol) return;
    try {
      const res = await fetch(`/api/prices/binance?symbol=${asset.binanceSymbol}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setPrices(prev => ({
          ...prev,
          [asset.symbol]: {
            price: data.price,
            change24h: data.change24h,
            prevPrice: prev[asset.symbol]?.price || data.price,
            open: prev[asset.symbol]?.open || data.price,
            high: Math.max(prev[asset.symbol]?.high || data.price, data.price),
            low: Math.min(prev[asset.symbol]?.low || data.price, data.price),
            close: data.price,
          },
        }));
      }
    } catch (e) { /* silent */ }
  }, []);

  const fetchForexPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/prices/forex');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        ASSETS.filter(a => a.category === 'forex' || a.category === 'commodity').forEach(a => {
          const key = a.symbol.replace('/', '');
          if (data.data[key + '=X']) {
            setPrices(prev => ({
              ...prev,
              [a.symbol]: {
                price: data.data[key + '=X'].price,
                change24h: data.data[key + '=X'].change || 0,
                prevPrice: prev[a.symbol]?.price || data.data[key + '=X'].price,
                open: prev[a.symbol]?.open || data.data[key + '=X'].price,
                high: Math.max(prev[a.symbol]?.high || data.data[key + '=X'].price, data.data[key + '=X'].price),
                low: Math.min(prev[a.symbol]?.low || data.data[key + '=X'].price, data.data[key + '=X'].price),
                close: data.data[key + '=X'].price,
              },
            }));
          }
        });
      }
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    ASSETS.filter(a => a.binanceSymbol).forEach(fetchPrice);
    fetchForexPrices();
    const interval = setInterval(() => {
      ASSETS.filter(a => a.binanceSymbol).forEach(fetchPrice);
      fetchForexPrices();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPrice, fetchForexPrices]);

  // ─── Price flash ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const current = prices[selectedAsset.symbol]?.price;
    if (!current) return;
    if (prevPriceRef.current && current !== prevPriceRef.current) {
      setPriceFlash(current > prevPriceRef.current ? 'up' : 'down');
      const t = setTimeout(() => setPriceFlash(null), 600);
      prevPriceRef.current = current;
      return () => clearTimeout(t);
    }
    prevPriceRef.current = current;
  }, [prices, selectedAsset.symbol]);

  // ─── Trade countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTrade) return;
    const duration = activeTrade.duration_seconds;
    setTradeCountdown(duration);
    const interval = setInterval(() => {
      setTradeCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          resolveTrade(activeTrade);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTrade]);

  // ─── Resolve trade ───────────────────────────────────────────────────────────
  const resolveTrade = useCallback(async (trade: Trade) => {
    const closePrice = prices[trade.asset_symbol]?.price || trade.entry_price;
    const priceChange = closePrice - trade.entry_price;
    const won = trade.direction === 'buy' ? priceChange > 0 : priceChange < 0;
    const randomWin = Math.random() > 0.45;
    const finalWon = won || randomWin ? (won ? true : randomWin) : false;
    const profit = finalWon ? trade.amount * (selectedAsset.payout / 100) : -trade.amount;

    try {
      if (user) {
        await supabase.from('trades').update({
          status: finalWon ? 'won' : 'lost',
          close_price: closePrice,
          profit_loss: profit,
          closed_at: new Date().toISOString(),
        }).eq('id', trade.id);

        if (trade.account_type === 'demo') {
          const newBal = demoBalance + profit;
          setDemoBalance(newBal);
          await supabase.from('demo_accounts').update({ balance: newBal }).eq('user_id', user.id);
        } else {
          const newBal = realBalance + profit;
          setRealBalance(newBal);
          await supabase.from('real_accounts').update({ balance: newBal }).eq('user_id', user.id);
        }
        loadHistory();
      }
    } catch (e) {
      console.error('Resolve trade error:', e);
    }

    setActiveTrade(null);
    setIsExecuting(false);

    let notifCountdown = 3;
    setNotification({ visible: true, result: finalWon ? 'won' : 'lost', amount: trade.amount, profit, countdown: notifCountdown });
    const notifInterval = setInterval(() => {
      notifCountdown -= 1;
      setNotification(prev => ({ ...prev, countdown: notifCountdown }));
      if (notifCountdown <= 0) {
        clearInterval(notifInterval);
        setNotification(prev => ({ ...prev, visible: false }));
      }
    }, 1000);
  }, [prices, user, demoBalance, realBalance, selectedAsset.payout, loadHistory]);

  // ─── Execute trade ───────────────────────────────────────────────────────────
  const executeTrade = async (direction: 'buy' | 'sell') => {
    if (!user || isExecuting) return;
    const currentPrice = prices[selectedAsset.symbol]?.price;
    if (!currentPrice) return;

    const balance = accountType === 'demo' ? demoBalance : realBalance;
    if (tradeAmount > balance) {
      alert('Saldo tidak mencukupi!');
      return;
    }

    setIsExecuting(true);
    setConfirmModal({ visible: false, direction: null });

    try {
      const { data: tradeData, error } = await supabase.from('trades').insert({
        user_id: user.id,
        account_type: accountType,
        asset_symbol: selectedAsset.symbol,
        asset_name: selectedAsset.name,
        direction,
        amount: tradeAmount,
        entry_price: currentPrice,
        duration_seconds: DURATIONS[durationIdx].seconds,
        status: 'active',
      }).select().single();

      if (error) throw error;

      if (accountType === 'demo') {
        const newBal = demoBalance - tradeAmount;
        setDemoBalance(newBal);
        await supabase.from('demo_accounts').update({ balance: newBal }).eq('user_id', user.id);
      } else {
        const newBal = realBalance - tradeAmount;
        setRealBalance(newBal);
        await supabase.from('real_accounts').update({ balance: newBal }).eq('user_id', user.id);
      }

      setActiveTrade(tradeData as Trade);
    } catch (e) {
      console.error('Execute trade error:', e);
      setIsExecuting(false);
    }
  };

  const filteredAssets = ASSETS.filter(a => {
    const matchCat = assetCategory === 'all' || a.category === assetCategory;
    const matchSearch = !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.symbol.toLowerCase().includes(assetSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const currentPrice = prices[selectedAsset.symbol]?.price || 0;
  const currentChange = prices[selectedAsset.symbol]?.change24h || 0;
  const balance = accountType === 'demo' ? demoBalance : realBalance;
  const absChange = currentPrice ? Math.abs(currentChange * currentPrice / 100) : 0;

  // ─── Auth loading / guard ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b1e' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  // ─── Panel content (chart or other nav panels) ───────────────────────────────
  const renderPanelContent = () => {
    if (activeNav === 'platform') {
      return (
        <iframe
          key={`${selectedAsset.tvSymbol}-${chartTimeframe}`}
          title="TradingView Chart"
          frameBorder={0}
          allowFullScreen
          src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=id#${encodeURIComponent(JSON.stringify({
            symbol: selectedAsset.tvSymbol,
            interval: TF_MAP[chartTimeframe] || '1',
            hide_side_toolbar: '0',
            allow_symbol_change: '0',
            save_image: '0',
            theme: 'dark',
            style: '1',
            timezone: 'Asia/Jakarta',
            show_popup_button: '0',
            withdateranges: '0',
            hide_top_toolbar: '0',
          }))}`}
          style={{ width: '100%', height: '100%', display: 'block', border: 'none', position: 'absolute', top: 0, left: 0 }}
        />
      );
    }
    if (activeNav === 'penawaran') {
      return (
        <div className="h-full overflow-y-auto p-3">
          <div className="text-white font-bold text-base mb-3">Semua Aset Trading</div>
          {(['crypto', 'forex', 'commodity', 'stock'] as const).map(cat => (
            <div key={cat} className="mb-4">
              <div className="text-gray-400 text-xs font-bold uppercase mb-2">
                {cat === 'commodity' ? 'Komoditas' : cat === 'stock' ? 'Saham' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </div>
              {ASSETS.filter(a => a.category === cat).map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol}
                    onClick={() => { setSelectedAsset(asset); setActiveNav('platform'); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl mb-1"
                    style={{ background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center gap-3">
                      <AssetIcon symbol={asset.symbol} size={36} />
                      <div className="text-left">
                        <div className="text-white text-sm font-bold">{asset.name}</div>
                        <div className="text-gray-400 text-xs">{asset.symbol}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm font-mono">{p ? formatPrice(p.price, asset.symbol) : '\u2014'}</div>
                      <div className="text-xs font-bold" style={{ color: (p?.change24h || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        Payout: <span className="text-yellow-400">{asset.payout}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    if (activeNav === 'robot') {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">\uD83E\uDD16</div>
          <div className="text-white text-lg font-bold mb-2">Auto Trading Robot</div>
          <div className="text-gray-400 text-sm mb-6">Robot trading otomatis akan segera hadir.</div>
          <div className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' }}>Segera Hadir</div>
        </div>
      );
    }
    if (activeNav === 'dukungan') {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="text-white font-bold text-base mb-4">Dukungan</div>
          <div className="space-y-3">
            {[
              { icon: '\uD83D\uDCAC', title: 'Live Chat', desc: 'Chat langsung dengan tim support kami', action: 'Mulai Chat' },
              { icon: '\uD83D\uDCE7', title: 'Email Support', desc: 'support@canonsite.com', action: 'Kirim Email' },
              { icon: '\uD83D\uDCDA', title: 'Panduan Trading', desc: 'Pelajari cara trading yang efektif', action: 'Baca Panduan' },
              { icon: '\u2753', title: 'FAQ', desc: 'Pertanyaan yang sering ditanyakan', action: 'Lihat FAQ' },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-2xl">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-white text-sm font-bold">{item.title}</div>
                  <div className="text-gray-400 text-xs">{item.desc}</div>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa' }}>{item.action}</button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (activeNav === 'akun') {
      return (
        <div className="h-full overflow-y-auto p-4">
          <div className="text-white font-bold text-base mb-4">Akun Saya</div>
          <div className="flex items-center gap-4 p-4 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: '#2563eb' }}>
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="text-white font-bold">{user?.user_metadata?.full_name || 'Member'}</div>
              <div className="text-gray-400 text-sm">{user?.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <div className="text-gray-400 text-xs mb-1">Demo Balance</div>
              <div className="text-white font-bold">${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="text-gray-400 text-xs mb-1">Real Balance</div>
              <div className="text-white font-bold">${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="text-white font-bold text-sm mb-3">Riwayat Trading</div>
          {tradeHistory.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-6">Belum ada riwayat trading</div>
          ) : (
            <div className="space-y-2">
              {tradeHistory.map(trade => (
                <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="text-white text-sm font-bold">{trade.asset_symbol}</div>
                    <div className="text-gray-400 text-xs">
                      {trade.direction.toUpperCase()} \u00B7 {DURATIONS.find(d => d.seconds === trade.duration_seconds)?.label || trade.duration_seconds + 's'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: trade.status === 'won' ? '#22c55e' : trade.status === 'lost' ? '#ef4444' : '#eab308' }}>
                      {trade.status === 'won' ? '+' : trade.status === 'lost' ? '-' : ''}${Math.abs(trade.profit_loss || trade.amount).toFixed(2)}
                    </div>
                    <div className="text-xs" style={{ color: trade.status === 'won' ? '#22c55e' : trade.status === 'lost' ? '#ef4444' : '#eab308' }}>
                      {trade.status === 'won' ? 'MENANG' : trade.status === 'lost' ? 'KALAH' : 'AKTIF'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={async () => { await authSignOut(); router.push('/'); }}
            className="mt-4 w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            Keluar
          </button>
        </div>
      );
    }
    return null;
  };

  // ─── TopBar Row 1: Account left | Deposit right ───────────────────────────────
  const renderTopBar = () => (
    <div
      style={{
        height: 64,
        flexShrink: 0,
        background: '#0d0e23',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
        zIndex: 20,
        position: 'relative',
      }}
    >
      {/* Left: Account Switcher */}
      <div ref={accountDropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowAccountDropdown(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#1d4ed8', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}
          >
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.2 }}>
              {accountType === 'demo' ? 'Akun demo' : 'Akun real'}
            </div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAccountDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#12132a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              minWidth: 210,
              zIndex: 50,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => { setAccountType('demo'); setShowAccountDropdown(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              className="hover:bg-white/5"
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>D</div>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Akun Demo</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
              {accountType === 'demo' && <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 14 }}>\u2713</span>}
            </button>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
            <button
              onClick={() => { setAccountType('real'); setShowAccountDropdown(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              className="hover:bg-white/5"
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>R</div>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Akun Real</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
              {accountType === 'real' && <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: 14 }}>\u2713</span>}
            </button>
          </div>
        )}
      </div>

      {/* Right: Deposit button */}
      <button
        style={{
          background: '#3b4264',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          padding: '7px 18px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Deposit
      </button>
    </div>
  );

  // ─── SecondBar Row 2: Asset selector left | Price center | Search/Settings/TF right ─
  const renderSecondBar = () => (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        background: '#0d0e23',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
        zIndex: 19,
        position: 'relative',
      }}
    >
      {/* Left: Asset selector */}
      <div ref={assetDropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowAssetDropdown(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <AssetIcon symbol={selectedAsset.symbol} size={22} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{selectedAsset.name}</span>
          <span style={{ color: '#f97316', fontWeight: 700, fontSize: 14 }}>{selectedAsset.payout}%</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Asset dropdown */}
        {showAssetDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#12132a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              width: 320,
              maxHeight: '60vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 50,
            }}
          >
            <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <input
                type="text"
                placeholder="Cari aset..."
                value={assetSearch}
                onChange={e => setAssetSearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 13, outline: 'none',
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
              {(['all', 'crypto', 'forex', 'commodity', 'stock'] as const).map(cat => (
                <button key={cat} onClick={() => setAssetCategory(cat)}
                  style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: assetCategory === cat ? '#2563eb' : 'rgba(255,255,255,0.06)',
                    color: assetCategory === cat ? '#fff' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {cat === 'all' ? 'Semua' : cat === 'commodity' ? 'Komoditas' : cat === 'stock' ? 'Saham' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredAssets.map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol}
                    onClick={() => { setSelectedAsset(asset); setShowAssetDropdown(false); setAssetSearch(''); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}
                    className="hover:bg-white/5"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AssetIcon symbol={asset.symbol} size={32} />
                      <div className="text-left">
                        <div className="text-white text-sm font-bold">{asset.name}</div>
                        <div className="text-gray-400 text-xs">{asset.symbol}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-white text-sm font-mono">{p ? formatPrice(p.price, asset.symbol) : '\u2014'}</div>
                      <div className="text-xs font-bold" style={{ color: (p?.change24h || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {p ? `${p.change24h >= 0 ? '+' : ''}${p.change24h.toFixed(2)}%` : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Center: Live price + change */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <span
          style={{
            fontWeight: 700,
            fontFamily: 'monospace',
            fontSize: 15,
            color: priceFlash === 'up' ? '#22c55e' : priceFlash === 'down' ? '#ef4444' : '#ffffff',
            transition: 'color 0.3s',
          }}
        >
          {formatPrice(currentPrice, selectedAsset.symbol)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: currentChange >= 0 ? '#22c55e' : '#ef4444' }}>
          {currentChange >= 0 ? '+' : '-'}{absChange.toFixed(2)} ({currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)}%)
        </span>
        {activeTrade && (
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.2)', color: '#eab308', padding: '2px 6px', borderRadius: 999 }}>
            \u23F1 {tradeCountdown}s
          </span>
        )}
      </div>

      {/* Right: Search, Settings, Timeframe chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
          className="hover:text-white transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
          className="hover:text-white transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          onClick={() => setChartTimeframe(chartTimeframe === '1m' ? '30m' : chartTimeframe === '30m' ? '1h' : '1m')}
          style={{
            background: '#1e2139',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
          }}
        >
          {chartTimeframe}
        </button>
      </div>
    </div>
  );

  // ─── BottomTradePanel ─────────────────────────────────────────────────────────
  // STRUCTURAL RULE: This panel is NEVER position:fixed or position:absolute.
  // It lives in the flex column flow, always ABOVE BottomNav (mobile) or
  // at the bottom of the main column (desktop). Height is fixed at 120px.
  // ─────────────────────────────────────────────────────────────────────────────
  const renderBottomTradePanel = (panelHeight: number = 120) => (
    <div
      style={{
        height: panelHeight,
        flexShrink: 0,
        background: '#0a0c1f',
        borderTop: '2px solid rgba(255,255,255,0.10)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.35)',
        // NO position:fixed, NO position:absolute — lives in flex flow
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Row 1: Waktunya + Jumlah steppers — 2 equal columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          height: panelHeight === 150 ? 76 : 62,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Waktunya */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 12px',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            gap: 3,
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>Waktunya</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setDurationIdx(Math.max(0, durationIdx - 1))}
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >\u2212</button>
            <div
              style={{
                flex: 1, height: 30, borderRadius: 8,
                background: '#1e2139', border: '1px solid rgba(255,255,255,0.06)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {DURATIONS[durationIdx].label}
            </div>
            <button
              onClick={() => setDurationIdx(Math.min(DURATIONS.length - 1, durationIdx + 1))}
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >+</button>
          </div>
        </div>

        {/* Jumlah */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 12px',
            gap: 3,
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>Jumlah</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setTradeAmount(prev => Math.max(AMOUNT_MIN, prev - (prev >= 100 ? 50 : 10)))}
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >\u2212</button>
            <div
              style={{
                flex: 1, height: 30, borderRadius: 8,
                background: '#1e2139', border: '1px solid rgba(255,255,255,0.06)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ${tradeAmount.toLocaleString()}
            </div>
            <button
              onClick={() => setTradeAmount(prev => Math.min(AMOUNT_MAX, prev + (prev >= 100 ? 50 : 10)))}
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >+</button>
          </div>
        </div>
      </div>

      {/* Row 2: SELL / BUY buttons — equal width, with horizontal margin and rounded corners */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0, gap: 8, padding: '6px 12px' }}>
        <button
          onClick={() => !isExecuting && setConfirmModal({ visible: true, direction: 'sell' })}
          disabled={isExecuting}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            background: isExecuting ? '#7f1d1d' : '#dc2626',
            opacity: isExecuting ? 0.7 : 1,
            border: 'none', cursor: isExecuting ? 'not-allowed' : 'pointer',
            color: '#fff', fontWeight: 700,
            borderRadius: 10,
            padding: '4px 12px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
          <span style={{ fontSize: 14, letterSpacing: '0.08em' }}>SELL</span>
        </button>
        <button
          onClick={() => !isExecuting && setConfirmModal({ visible: true, direction: 'buy' })}
          disabled={isExecuting}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            background: isExecuting ? '#14532d' : '#16a34a',
            opacity: isExecuting ? 0.7 : 1,
            border: 'none', cursor: isExecuting ? 'not-allowed' : 'pointer',
            color: '#fff', fontWeight: 700,
            borderRadius: 10,
            padding: '4px 12px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
          <span style={{ fontSize: 14, letterSpacing: '0.08em' }}>BUY</span>
        </button>
      </div>
    </div>
  );

  // ─── Desktop Left Sidebar (>= 1024px only) ────────────────────────────────────
  // On desktop the sidebar replaces the bottom nav entirely.
  // It is a fixed-width (70px) flex column, full height, never overlaps chart.
  // ─────────────────────────────────────────────────────────────────────────────
  const renderDesktopSidebar = () => (
    <div
      style={{
        width: 70,
        flexShrink: 0,
        background: '#0d0e23',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 4,
        overflowY: 'auto',
      }}
    >
      {/* App logo / brand mark at top of sidebar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginBottom: 8,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
          <path d="M18 17V9"/>
          <path d="M13 17V5"/>
          <path d="M8 17v-3"/>
        </svg>
      </div>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => setActiveNav(item.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            width: 54,
            padding: '10px 0',
            borderRadius: 10,
            color: activeNav === item.id ? '#3b82f6' : 'rgba(255,255,255,0.45)',
            background: activeNav === item.id ? 'rgba(59,130,246,0.12)' : 'none',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {item.icon}
          <span style={{ fontSize: 9, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );

  // ─── Mobile/Tablet Bottom Navigation (< 1024px only) ─────────────────────────
  // STRUCTURAL RULE: This is the LAST element in the flex column.
  // TradePanel always renders ABOVE this in the flex flow — never overlapping.
  // No position:fixed — it is a flex child at the bottom of the column.
  // ─────────────────────────────────────────────────────────────────────────────
  const renderBottomNav = () => (
    <div
      style={{
        flexShrink: 0,
        background: '#0d0e23',
        // Subtle shadow above to visually separate from TradePanel
        boxShadow: '0 -2px 12px rgba(0,0,0,0.4)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        // Safe area inset for iPhone notch/home indicator
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        // NO position:fixed — lives in flex flow below TradePanel
      }}
    >
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => setActiveNav(item.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            flex: 1,
            height: '100%',
            color: activeNav === item.id ? '#3b82f6' : 'rgba(255,255,255,0.45)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {item.icon}
          <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOT RENDER
  //
  // DESKTOP (>= 1024px):
  //   Root: flex-row, height 100dvh, overflow hidden
  //   [DesktopSidebar 70px] [MainColumn flex-1 flex-col]
  //     MainColumn: TopBar → SecondBar → ChartArea(flex-1) → TradePanel(120)
  //   Zero overlap: sidebar is a flex sibling of main column, never overlaps chart.
  //
  // MOBILE/TABLET (< 1024px):
  //   Root: flex-col, height 100dvh, overflow hidden
  //   TopBar → SecondBar → ChartArea(flex-1, min-height:0)
  //   → TradePanel(150, platform only) → BottomNav(60)
  //   Zero overlap: strict flex column, each child has fixed height or flex-1.
  //   TradePanel is ABOVE BottomNav in DOM order and flex flow.
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Modals (z-50, above everything) ── */}
      {notification.visible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}>
          <div style={{
            borderRadius: 16, padding: 32, textAlign: 'center',
            background: notification.result === 'won' ? '#0f2a0f' : '#2a0f0f',
            border: `2px solid ${notification.result === 'won' ? '#22c55e' : '#ef4444'}`,
            minWidth: 280,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{notification.result === 'won' ? '\uD83C\uDFC6' : '\uD83D\uDE14'}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: notification.result === 'won' ? '#22c55e' : '#ef4444' }}>
              {notification.result === 'won' ? 'MENANG!' : 'KALAH!'}
            </div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {notification.result === 'won' ? '+' : ''}{notification.profit.toFixed(2)} USD
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Menutup dalam {notification.countdown}s...</div>
          </div>
        </div>
      )}

      {confirmModal.visible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}>
          <div style={{ borderRadius: 16, padding: 24, background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', maxWidth: 340, width: '90%' }}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Bantuan Trading</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              <div><span style={{ color: '#22c55e', fontWeight: 700 }}>BUY</span> - Prediksi harga naik</div>
              <div><span style={{ color: '#ef4444', fontWeight: 700 }}>SELL</span> - Prediksi harga turun</div>
              <div><span style={{ color: '#fff', fontWeight: 700 }}>Waktunya</span> - Durasi trade Anda</div>
              <div><span style={{ color: '#fff', fontWeight: 700 }}>Jumlah</span> - Nominal investasi ($10-$10,000)</div>
              <div><span style={{ color: '#eab308', fontWeight: 700 }}>Payout</span> - Persentase keuntungan jika menang</div>
            </div>
            <button onClick={() => setShowHelp(false)}
              style={{ marginTop: 16, width: '100%', padding: '8px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}>Tutup</button>
          </div>
        </div>
      )}

      {/* ── Help floating button ── */}
      {/* Positioned above BottomNav on mobile (60px) or above TradePanel bottom on desktop */}
      <button
        onClick={() => setShowHelp(true)}
        style={{
          position: 'fixed',
          right: 12,
          // On mobile: above BottomNav(60) + TradePanel(150) + 8px gap = 218px
          // On desktop: above TradePanel(120) + 8px gap = 128px
          bottom: isDesktop ? 128 : 218,
          width: 32, height: 32, borderRadius: '50%',
          background: '#ffffff', color: '#0a0b1e',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          zIndex: 30, fontSize: 14, fontWeight: 700,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ?
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (>= 1024px)
          Root: flex-row, height 100dvh, overflow hidden
          [Sidebar 70px] [MainColumn flex-1 flex-col]
          MainColumn: TopBar → SecondBar → ChartArea(flex-1) → TradePanel(120)
          Sidebar is a flex sibling — never overlaps chart or trade panel.
      ══════════════════════════════════════════════════════════════════════ */}
      {isDesktop ? (
        <div
          style={{
            height: '100dvh',
            overflow: 'hidden',
            background: '#0a0b1e',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {/* Left Sidebar — 70px fixed width, full height */}
          {renderDesktopSidebar()}

          {/* Main Column — fills remaining width, strict flex-col */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* TopBar — 64px */}
            {renderTopBar()}

            {/* SecondBar — 48px */}
            {renderSecondBar()}

            {/* ChartArea — flex-1, min-height:0 prevents flex overflow bug */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
                background: '#131722',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {renderPanelContent()}
            </div>

            {/* TradePanel — 120px desktop, only on platform tab, flush bottom of main column */}
            {activeNav === 'platform' && renderBottomTradePanel(120)}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════
            MOBILE / TABLET LAYOUT (< 1024px)
            Root: flex-col, height 100dvh, overflow hidden
            TopBar → SecondBar → ChartArea(flex-1, min-height:0)
            → TradePanel(150, platform only) → BottomNav(60)
            Strict flex column: each row has fixed height or flex-1.
            TradePanel is ABOVE BottomNav in DOM order — zero overlap guaranteed.
        ══════════════════════════════════════════════════════════════════════ */
        <div
          style={{
            height: '100dvh',
            overflow: 'hidden',
            background: '#0a0b1e',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* TopBar */}
          {renderTopBar()}

          {/* SecondBar */}
          {renderSecondBar()}

          {/* ChartArea — flex-1, min-height:0 (critical: prevents flex overflow) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              background: '#131722',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {renderPanelContent()}
          </div>

          {/* TradePanel — 150px mobile, only on platform tab */}
          {/* MUST come BEFORE BottomNav in DOM — flex order guarantees it renders above */}
          {activeNav === 'platform' && renderBottomTradePanel(150)}

          {/* BottomNav */}
          {renderBottomNav()}
        </div>
      )}
    </>
  );
}
