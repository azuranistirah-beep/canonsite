'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

interface TradeAlert {
  id: string;
  user_id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  trade_details?: {
    asset?: string;
    direction?: string;
    amount?: number;
    profit?: number;
    duration?: string;
  };
  read: boolean;
  created_at: string;
}

interface ToastAlert {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  visible: boolean;
}

// ─── Currency Config ──────────────────────────────────────────────────────────
interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
];

// Minimum deposit per currency (USD $100 / MYR RM500 as reference)
// Rates used: EUR 0.92, GBP 0.79, MYR 4.47, SGD 1.34, THB 35.1, PHP 56.5, JPY 149.5, AUD 1.53, CNY 7.24
const CURRENCY_MIN_DEPOSITS: Record<string, number> = {
  USD: 100,
  EUR: 92,
  GBP: 79,
  MYR: 500,
  SGD: 134,
  THB: 3500,
  PHP: 5650,
  JPY: 14950,
  AUD: 153,
  CNY: 724,
};

const CURRENCY_QUICK_AMOUNTS: Record<string, number[]> = {
  USD: [100, 250, 500, 1000],
  EUR: [92, 250, 500, 1000],
  GBP: [79, 200, 400, 800],
  MYR: [500, 1000, 2500, 5000],
  SGD: [134, 300, 700, 1400],
  THB: [3500, 7000, 17500, 35000],
  PHP: [5650, 10000, 25000, 50000],
  JPY: [14950, 30000, 75000, 150000],
  AUD: [153, 300, 750, 1500],
  CNY: [724, 1500, 3600, 7200],
};

// ─── MODAL OVERLAY HELPER (module-level — stable, never recreated) ────────────
// CRITICAL: Defined outside the component so it is never recreated on re-render.
// If defined inside the component, React unmounts/remounts it every render,
// which triggers the onClose callback and causes an infinite reload loop.
const ModalOverlay = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', animation: 'fadeIn 0.2s ease-out', padding: 16 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()}>{children}</div>
  </div>
);

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

// ─── Nav Items (English labels) ───────────────────────────────────────────────
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
    label: 'Offers',
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
    label: 'Bot',
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
    label: 'Support',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 0118 0v6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2H3z" />
      </svg>
    ),
  },
  {
    id: 'akun',
    label: 'Account',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// ─── Bell Icon ────────────────────────────────────────────────────────────────
function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={hasUnread ? '#fff' : 'none'} stroke="currentColor" strokeWidth={hasUnread ? 0 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradeDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut: authSignOut, resendVerificationEmail } = useAuth();

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

  // ─── Stable chart key: only changes when asset or timeframe intentionally changes ─
  const chartKeyRef = useRef(`${ASSETS[0].tvSymbol}-1m`);
  const [chartKey, setChartKey] = useState(chartKeyRef.current);
  const prevChartAssetRef = useRef(ASSETS[0].tvSymbol);
  const prevChartTFRef = useRef('1m');

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

  // ─── Notification system state ────────────────────────────────────────────────
  const [tradeAlerts, setTradeAlerts] = useState<TradeAlert[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const unreadCount = tradeAlerts.filter(a => !a.read).length;

  // ─── Button hover/active states ───────────────────────────────────────────────
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);

  // ─── Search Modal State ───────────────────────────────────────────────────────
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Deposit Modal State ──────────────────────────────────────────────────────
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState<'bank_transfer' | 'credit_card' | 'crypto'>('bank_transfer');
  // Deposit is always for Real account only — removed demo option
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState('');
  const [depositError, setDepositError] = useState('');
  // Multi-currency state
  const [depositCurrency, setDepositCurrency] = useState<string>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const exchangeRatesFetchedRef = useRef(false);

  // ─── Settings Modal State ─────────────────────────────────────────────────────
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'chart' | 'account' | 'trading'>('chart');
  const [settingsChartTheme, setSettingsChartTheme] = useState<'dark' | 'light'>('dark');
  const [settingsDefaultTF, setSettingsDefaultTF] = useState('1m');
  const [settingsDefaultAmount, setSettingsDefaultAmount] = useState('10');
  const [settingsAutoConfirm, setSettingsAutoConfirm] = useState(false);
  const [settingsNotifications, setSettingsNotifications] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ─── Email Verification State ─────────────────────────────────────────────────
  const [resendVerifyCooldown, setResendVerifyCooldown] = useState(0);
  const [resendVerifyLoading, setResendVerifyLoading] = useState(false);
  const [resendVerifyMsg, setResendVerifyMsg] = useState('');
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  // ─── Refs for volatile values used in resolveTrade (avoids dependency churn) ──
  const pricesRef = useRef<Record<string, PriceData>>({});
  const demoBalanceRef = useRef<number>(10000);
  const realBalanceRef = useRef<number>(0);
  const accountTypeRef = useRef<'demo' | 'real'>('demo');
  const selectedAssetRef = useRef<Asset>(ASSETS[0]);

  useEffect(() => { pricesRef.current = prices; }, [prices]);
  useEffect(() => { demoBalanceRef.current = demoBalance; }, [demoBalance]);
  useEffect(() => { realBalanceRef.current = realBalance; }, [realBalance]);
  useEffect(() => { accountTypeRef.current = accountType; }, [accountType]);
  useEffect(() => { selectedAssetRef.current = selectedAsset; }, [selectedAsset]);

  // ─── Detect desktop (>= 1024px) ──────────────────────────────────────────────
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ─── Update chart key ONLY when asset or timeframe intentionally changes ──────
  useEffect(() => {
    const newKey = `${selectedAsset.tvSymbol}-${chartTimeframe}`;
    if (
      selectedAsset.tvSymbol !== prevChartAssetRef.current ||
      chartTimeframe !== prevChartTFRef.current
    ) {
      prevChartAssetRef.current = selectedAsset.tvSymbol;
      prevChartTFRef.current = chartTimeframe;
      chartKeyRef.current = newKey;
      setChartKey(newKey);
    }
  }, [selectedAsset.tvSymbol, chartTimeframe]);

  // ─── Debounce search query (300ms) ───────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(value);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // ─── Show verified success banner from URL param ──────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === '1') {
        setShowVerifiedBanner(true);
        window.history.replaceState({}, '', '/trade');
        setTimeout(() => setShowVerifiedBanner(false), 6000);
      }
    }
  }, []);

  // ─── Resend verification cooldown timer ──────────────────────────────────────
  useEffect(() => {
    if (resendVerifyCooldown <= 0) return;
    const t = setInterval(() => {
      setResendVerifyCooldown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendVerifyCooldown]);

  // ─── Client-side session guard ───────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, router]);

  // ─── Auto-focus search input when modal opens ────────────────────────────────
  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showSearchModal]);

  // ─── Close dropdowns on outside click ───────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(e.target as Node)) {
        setShowAssetDropdown(false);
      }
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Keyboard shortcut: Escape closes modals ─────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowDepositModal(false);
        setShowSettingsModal(false);
        setSearchQuery('');
        setDebouncedSearchQuery('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
  }, [user?.id]);

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
  }, [user?.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ─── Load trade alerts ───────────────────────────────────────────────────────
  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('trade_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setTradeAlerts(data as TradeAlert[]);
    } catch (e) {
      console.error('Alerts load error:', e);
    }
  }, [user?.id]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // ─── Realtime subscription for trade_alerts ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`trade_alerts_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_alerts', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newAlert = payload.new as TradeAlert;
          setTradeAlerts(prev => [newAlert, ...prev]);
          const toastId = `toast_${Date.now()}`;
          setToasts(prev => [...prev, { id: toastId, type: newAlert.type, message: newAlert.message, visible: true }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 3000);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(newAlert.type === 'success' ? [100, 50, 100] : [200]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // ─── Dismiss toast ────────────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Save trade alert to Supabase ────────────────────────────────────────────
  const saveTradeAlert = useCallback(async (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    tradeDetails?: TradeAlert['trade_details']
  ) => {
    if (!user) return;
    try {
      await supabase.from('trade_alerts').insert({
        user_id: user.id,
        type,
        message,
        trade_details: tradeDetails || null,
        read: false,
      });
    } catch (e) {
      console.error('Save alert error:', e);
    }
  }, [user?.id]);

  // ─── Mark alert as read ───────────────────────────────────────────────────────
  const markAlertRead = useCallback(async (alertId: string) => {
    try {
      await supabase.from('trade_alerts').update({ read: true }).eq('id', alertId);
      setTradeAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    } catch (e) {
      console.error('Mark read error:', e);
    }
  }, []);

  // ─── Mark all alerts as read ──────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('trade_alerts').update({ read: true }).eq('user_id', user.id).eq('read', false);
      setTradeAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  }, [user?.id]);

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
  }, [activeTrade]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Resolve trade (uses refs for volatile values — stable callback) ──────────
  const resolveTrade = useCallback(async (trade: Trade) => {
    const currentPrices = pricesRef.current;
    const currentDemoBalance = demoBalanceRef.current;
    const currentRealBalance = realBalanceRef.current;
    const currentAsset = selectedAssetRef.current;

    const closePrice = currentPrices[trade.asset_symbol]?.price || trade.entry_price;
    const priceChange = closePrice - trade.entry_price;
    const won = trade.direction === 'buy' ? priceChange > 0 : priceChange < 0;
    const randomWin = Math.random() > 0.45;
    const finalWon = won || randomWin ? (won ? true : randomWin) : false;
    const profit = finalWon ? trade.amount * (currentAsset.payout / 100) : -trade.amount;

    try {
      if (user) {
        await supabase.from('trades').update({
          status: finalWon ? 'won' : 'lost',
          close_price: closePrice,
          profit_loss: profit,
          closed_at: new Date().toISOString(),
        }).eq('id', trade.id);

        if (trade.account_type === 'demo') {
          const newBal = currentDemoBalance + profit;
          setDemoBalance(newBal);
          await supabase.from('demo_accounts').update({ balance: newBal }).eq('user_id', user.id);
        } else {
          const newBal = currentRealBalance + profit;
          setRealBalance(newBal);
          await supabase.from('real_accounts').update({ balance: newBal }).eq('user_id', user.id);
        }
        loadHistory();

        const durationLabel = DURATIONS.find(d => d.seconds === trade.duration_seconds)?.label || `${trade.duration_seconds}s`;
        const alertMsg = finalWon
          ? `\uD83C\uDFC6 WON! ${trade.direction.toUpperCase()} ${trade.asset_symbol} +$${profit.toFixed(2)}`
          : `\uD83D\uDE14 LOST! ${trade.direction.toUpperCase()} ${trade.asset_symbol} -$${Math.abs(profit).toFixed(2)}`;
        await saveTradeAlert(
          finalWon ? 'success' : 'error',
          alertMsg,
          {
            asset: trade.asset_symbol,
            direction: trade.direction,
            amount: trade.amount,
            profit,
            duration: durationLabel,
          }
        );
      }
    } catch (e) {
      console.error('Resolve trade error:', e);
      await saveTradeAlert('error', 'An error occurred while resolving the trade.');
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
  }, [user, loadHistory, saveTradeAlert]); // stable: user?.id-based callbacks, no volatile state

  // ─── Execute trade ───────────────────────────────────────────────────────────
  const executeTrade = async (direction: 'buy' | 'sell') => {
    if (!user || isExecuting) return;
    const currentPrice = prices[selectedAsset.symbol]?.price;
    if (!currentPrice) return;

    const balance = accountType === 'demo' ? demoBalance : realBalance;
    if (tradeAmount > balance) {
      await saveTradeAlert('error', 'Insufficient balance to place this trade!');
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

      const durationLabel = DURATIONS[durationIdx].label;
      await saveTradeAlert(
        'info',
        `\u23F1 Trade opened: ${direction.toUpperCase()} ${selectedAsset.symbol} $${tradeAmount} (${durationLabel})`,
        { asset: selectedAsset.symbol, direction, amount: tradeAmount, duration: durationLabel }
      );

      setActiveTrade(tradeData as Trade);
    } catch (e) {
      console.error('Execute trade error:', e);
      await saveTradeAlert('error', `Failed to open trade: ${selectedAsset.symbol}`);
      setIsExecuting(false);
    }
  };

  // ─── Fetch Exchange Rates (once per deposit modal open) ───────────────────────
  const fetchExchangeRates = useCallback(async () => {
    if (exchangeRatesFetchedRef.current) return;
    setRatesLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Rate fetch failed');
      const data = await res.json();
      if (data.rates) {
        setExchangeRates(data.rates);
        exchangeRatesFetchedRef.current = true;
      }
    } catch {
      setExchangeRates({
        USD: 1, EUR: 0.92, GBP: 0.79, MYR: 4.47,
        SGD: 1.34, THB: 35.1, PHP: 56.5, JPY: 149.5, AUD: 1.53, CNY: 7.24,
      });
      exchangeRatesFetchedRef.current = true;
    } finally {
      setRatesLoading(false);
    }
  }, []);

  // ─── Open deposit modal handler ───────────────────────────────────────────────
  const openDepositModal = useCallback(() => {
    setShowDepositModal(true);
    setDepositSuccess('');
    setDepositError('');
    setDepositAmount('');
    fetchExchangeRates();
  }, [fetchExchangeRates]);

  // ─── Computed: USD equivalent of deposit amount ────────────────────────────────────────────────
  const depositAmountNum = parseFloat(depositAmount) || 0;
  const selectedCurrencyObj = CURRENCIES.find(c => c.code === depositCurrency) || CURRENCIES[0];
  const rateToUSD = depositCurrency === 'USD' ? 1 : (exchangeRates[depositCurrency] ? 1 / exchangeRates[depositCurrency] : 1);
  const depositAmountUSD = depositAmountNum * rateToUSD;
  const minDepositLocal = CURRENCY_MIN_DEPOSITS[depositCurrency] ?? CURRENCY_MIN_DEPOSITS['USD'];
  const isBelowMinimum = depositAmountNum > 0 && depositAmountNum < minDepositLocal;

  // ─── Handle Deposit Submit ────────────────────────────────────────────────────────────────────────────────────
  const handleDepositSubmit = async () => {
    if (!user) return;
    if (!depositAmount || isNaN(depositAmountNum) || depositAmountNum <= 0) {
      setDepositError('Please enter a valid deposit amount');
      return;
    }
    if (depositAmountNum < minDepositLocal) {
      setDepositError(`Minimum deposit is ${selectedCurrencyObj.symbol}${minDepositLocal.toLocaleString()} ${depositCurrency}`);
      return;
    }
    setDepositLoading(true);
    setDepositError('');
    try {
      const { error } = await supabase.from('deposit_requests').insert({
        user_id: user.id,
        amount: depositAmountUSD,
        payment_method: depositMethod,
        account_type: 'real',
        status: 'pending',
      });
      if (error) throw error;
      setDepositSuccess(`Deposit request of ${selectedCurrencyObj.symbol}${depositAmountNum.toFixed(2)} ${depositCurrency} (\u2248 $${depositAmountUSD.toFixed(2)} USD) submitted! Our team will process it within 1\u201324 hours.`);
      setDepositAmount('');
    } catch (e) {
      setDepositError('Failed to submit deposit request. Please try again.');
    } finally {
      setDepositLoading(false);
    }
  };

  // ─── Handle Settings Save ─────────────────────────────────────────────────────
  const handleSettingsSave = () => {
    const amount = parseInt(settingsDefaultAmount);
    if (!isNaN(amount) && amount >= AMOUNT_MIN && amount <= AMOUNT_MAX) {
      setTradeAmount(amount);
    }
    setChartTimeframe(settingsDefaultTF);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // ─── Handle resend verification email ────────────────────────────────────────
  const handleResendVerification = async () => {
    if (!user?.email || resendVerifyCooldown > 0 || resendVerifyLoading) return;
    setResendVerifyLoading(true);
    setResendVerifyMsg('');
    try {
      await resendVerificationEmail(user.email);
      setResendVerifyMsg('Verification email sent! Check your inbox.');
      setResendVerifyCooldown(60);
    } catch (err: any) {
      setResendVerifyMsg(err?.message || 'Failed to resend. Please try again.');
    } finally {
      setResendVerifyLoading(false);
    }
  };

  // ─── Memoized filtered assets (asset dropdown in SecondBar) ──────────────────
  const filteredAssets = useMemo(() => ASSETS.filter(a => {
    const matchCat = assetCategory === 'all' || a.category === assetCategory;
    const matchSearch = !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.symbol.toLowerCase().includes(assetSearch.toLowerCase());
    return matchCat && matchSearch;
  }), [assetCategory, assetSearch]);

  // ─── Memoized search modal filtered assets (uses debounced query) ─────────────
  const searchFilteredAssets = useMemo(() => ASSETS.filter(a => {
    if (!debouncedSearchQuery) return true;
    const q = debouncedSearchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.symbol.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  }), [debouncedSearchQuery]);

  const currentPrice = prices[selectedAsset.symbol]?.price || 0;
  const currentChange = prices[selectedAsset.symbol]?.change24h || 0;
  const balance = accountType === 'demo' ? demoBalance : realBalance;
  const absChange = currentPrice ? Math.abs(currentChange * currentPrice / 100) : 0;

  // ─── Email verification check ─────────────────────────────────────────────────
  const isEmailVerified = !!(user?.email_confirmed_at);

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
          key={chartKey}
          title="TradingView Chart"
          frameBorder={0}
          allowFullScreen
          src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({
            symbol: selectedAsset.tvSymbol,
            interval: TF_MAP[chartTimeframe] || '1',
            hide_side_toolbar: '0',
            allow_symbol_change: '0',
            save_image: '0',
            theme: settingsChartTheme,
            style: '1',
            timezone: 'Etc/UTC',
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
          <div className="text-white font-bold text-base mb-3">All Trading Assets</div>
          {(['crypto', 'forex', 'commodity', 'stock'] as const).map(cat => (
            <div key={cat} className="mb-4">
              <div className="text-gray-400 text-xs font-bold uppercase mb-2">
                {cat === 'commodity' ? 'Commodities' : cat === 'stock' ? 'Stocks' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </div>
              {ASSETS.filter(a => a.category === cat).map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol}
                    onClick={() => { setSelectedAsset(asset); setActiveNav('platform'); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl mb-1"
                    style={{
                      background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      minHeight: 44,
                      cursor: 'pointer',
                    }}
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
        <div className="h-full flex flex-col p-4">
          <div className="text-5xl mb-4">\uD83E\uDD16</div>
          <div className="text-white text-lg font-bold mb-2">Auto Trading Bot</div>
          <div className="text-gray-400 text-sm mb-6">Automated trading bot coming soon.</div>
          <div className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' }}>Coming Soon</div>
        </div>
      );
    }
    if (activeNav === 'dukungan') {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="text-white font-bold text-base mb-4">Support</div>
          <div className="space-y-3">
            {[
              { icon: '\uD83D\uDCAC', title: 'Live Chat', desc: 'Chat directly with our support team', action: 'Start Chat' },
              { icon: '\uD83D\uDCE7', title: 'Email Support', desc: 'support@canonsite.com', action: 'Send Email' },
              { icon: '\uD83D\uDCDA', title: 'Trading Guide', desc: 'Learn effective trading strategies', action: 'Read Guide' },
              { icon: '\u2753', title: 'FAQ', desc: 'Frequently asked questions', action: 'View FAQ' },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-2xl">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-white text-sm font-bold">{item.title}</div>
                  <div className="text-gray-400 text-xs">{item.desc}</div>
                </div>
                <button
                  className="text-xs px-3 py-2 rounded-lg font-bold"
                  style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa', minHeight: 44, minWidth: 80 }}
                >{item.action}</button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (activeNav === 'akun') {
      return (
        <div className="h-full overflow-y-auto p-4">
          <div className="text-white font-bold text-base mb-4">My Account</div>
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
          <div className="text-white font-bold text-sm mb-3">Trade History</div>
          {tradeHistory.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-6">No trade history yet</div>
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
                      {trade.status === 'won' ? 'WON' : trade.status === 'lost' ? 'LOST' : 'ACTIVE'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={async () => { await authSignOut(); router.push('/'); }}
            className="mt-4 w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', minHeight: 44 }}
          >
            Sign Out
          </button>
        </div>
      );
    }
    return null;
  };

  // ─── Notifications Panel ──────────────────────────────────────────────────────
  const renderNotifPanel = () => (
    <div
      ref={notifPanelRef}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 8,
        background: '#12132a', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, width: 340, maxHeight: '70vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', zIndex: 60,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)', animation: 'fadeInDown 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Trade Notifications</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, minHeight: 32 }}>
            Mark all as read
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {tradeAlerts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No notifications yet</div>
        ) : (
          tradeAlerts.map(alert => {
            const alertColors = {
              success: { dot: '#22c55e', bg: 'rgba(34,197,94,0.06)' },
              error: { dot: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
              warning: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
              info: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
            };
            const ac = alertColors[alert.type];
            return (
              <button key={alert.id} onClick={() => markAlertRead(alert.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: alert.read ? 'transparent' : ac.bg, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left', minHeight: 44 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: alert.read ? 'rgba(255,255,255,0.15)' : ac.dot, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: alert.read ? 'rgba(255,255,255,0.6)' : '#fff', fontSize: 13, fontWeight: alert.read ? 400 : 600, lineHeight: 1.4, wordBreak: 'break-word' }}>{alert.message}</div>
                  {alert.trade_details && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {alert.trade_details.asset && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>{alert.trade_details.asset}</span>}
                      {alert.trade_details.duration && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>{alert.trade_details.duration}</span>}
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>{new Date(alert.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ─── TopBar ───────────────────────────────────────────────────────────────────
  const renderTopBar = () => (
    <div style={{ height: 64, flexShrink: 0, background: '#0d0e23', borderBottom: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 1px 0 rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, zIndex: 20, position: 'relative' }}>
      <div ref={accountDropdownRef} style={{ position: 'relative' }}>
        <button onClick={() => setShowAccountDropdown(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', minHeight: 44, minWidth: 44, borderRadius: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{user?.email?.[0]?.toUpperCase() || 'U'}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.2 }}>{accountType === 'demo' ? 'Demo Account' : 'Real Account'}</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showAccountDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#12132a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, minWidth: 210, zIndex: 50, overflow: 'hidden', animation: 'fadeInDown 0.2s ease-out' }}>
            <button onClick={() => { setAccountType('demo'); setShowAccountDropdown(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }} className="hover:bg-white/5">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>D</div>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Demo Account</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
              {accountType === 'demo' && <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 14 }}>\u2713</span>}
            </button>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
            <button onClick={() => { setAccountType('real'); setShowAccountDropdown(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }} className="hover:bg-white/5">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>R</div>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Real Account</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
              {accountType === 'real' && <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: 14 }}>\u2713</span>}
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotifPanel(v => !v)} style={{ width: 44, height: 44, borderRadius: 10, background: showNotifPanel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showNotifPanel ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`, color: unreadCount > 0 ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
            <BellIcon hasUnread={unreadCount > 0} />
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #0d0e23', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
            )}
          </button>
          {showNotifPanel && renderNotifPanel()}
        </div>
        <button onClick={openDepositModal} style={{ background: '#3b4264', color: '#fff', fontSize: 13, fontWeight: 700, padding: '0 18px', height: 44, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s ease, transform 0.1s ease' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#4a5380'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#3b4264'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >Deposit</button>
      </div>
    </div>
  );

  // ─── SecondBar ────────────────────────────────────────────────────────────────
  const renderSecondBar = () => (
    <div style={{ height: 48, flexShrink: 0, background: '#0d0e23', borderBottom: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 1px 0 rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, zIndex: 19, position: 'relative' }}>
      <div ref={assetDropdownRef} style={{ position: 'relative' }}>
        <button onClick={() => setShowAssetDropdown(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', minHeight: 44, borderRadius: 8 }}>
          <AssetIcon symbol={selectedAsset.symbol} size={22} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{selectedAsset.name}</span>
          <span style={{ color: '#f97316', fontWeight: 700, fontSize: 14 }}>{selectedAsset.payout}%</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showAssetDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#12132a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 320, maxHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'fadeInDown 0.2s ease-out' }}>
            <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <input type="text" placeholder="Search assets..." value={assetSearch} onChange={e => setAssetSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontWeight: 500, outline: 'none', minHeight: 44 }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
              {(['all', 'crypto', 'forex', 'commodity', 'stock'] as const).map(cat => (
                <button key={cat} onClick={() => setAssetCategory(cat)} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: assetCategory === cat ? '#2563eb' : 'rgba(255,255,255,0.06)', color: assetCategory === cat ? '#fff' : 'rgba(255,255,255,0.6)', minHeight: 32 }}>
                  {cat === 'all' ? 'All' : cat === 'commodity' ? 'Commodities' : cat === 'stock' ? 'Stocks' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredAssets.map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setShowAssetDropdown(false); setAssetSearch(''); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', minHeight: 56 }} className="hover:bg-white/5">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AssetIcon symbol={asset.symbol} size={32} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{asset.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{asset.symbol} &bull; {asset.category === 'commodity' ? 'Commodities' : asset.category === 'stock' ? 'Stocks' : asset.category.charAt(0).toUpperCase() + asset.category.slice(1)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{p ? formatPrice(p.price, asset.symbol) : '\u2014'}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>Payout {asset.payout}%</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15, color: priceFlash === 'up' ? '#22c55e' : priceFlash === 'down' ? '#ef4444' : '#ffffff', transition: 'color 0.3s ease' }}>{formatPrice(currentPrice, selectedAsset.symbol)}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: currentChange >= 0 ? '#22c55e' : '#ef4444' }}>{currentChange >= 0 ? '+' : '-'}{absChange.toFixed(2)} ({currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)}%)</span>
        {activeTrade && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.2)', color: '#eab308', padding: '2px 6px', borderRadius: 999 }}>\u23F1 {tradeCountdown}s</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => { setShowSearchModal(true); setSearchQuery(''); setDebouncedSearchQuery(''); }} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8 }} className="hover:text-white" title="Search Assets">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
        <button onClick={() => setShowSettingsModal(true)} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8 }} className="hover:text-white" title="Settings">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
        <button onClick={() => setChartTimeframe(chartTimeframe === '1m' ? '30m' : chartTimeframe === '30m' ? '1h' : '1m')} style={{ background: '#1e2139', color: '#fff', fontSize: 12, fontWeight: 700, padding: '0 12px', height: 36, minWidth: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; setPressedBtn('dur-chip'); }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; setPressedBtn(null); }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setPressedBtn(null); }}
        >{chartTimeframe}</button>
      </div>
    </div>
  );

  // ─── BottomTradePanel ─────────────────────────────────────────────────────────
  const renderBottomTradePanel = (panelHeight: number = 120) => (
    <div style={{ height: panelHeight, flexShrink: 0, background: '#0a0c1f', borderTop: '2px solid rgba(255,255,255,0.10)', boxShadow: '0 -4px 16px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: panelHeight === 150 ? 76 : 62, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', borderRight: '1px solid rgba(255,255,255,0.07)', gap: 3 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>Duration</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setDurationIdx(Math.max(0, durationIdx - 1))} onMouseDown={() => setPressedBtn('dur-minus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('dur-minus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'dur-minus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'dur-minus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>\u2212</button>
            <div style={{ flex: 1, height: 36, borderRadius: 8, background: '#1e2139', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{DURATIONS[durationIdx].label}</div>
            <button onClick={() => setDurationIdx(Math.min(DURATIONS.length - 1, durationIdx + 1))} onMouseDown={() => setPressedBtn('dur-plus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('dur-plus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'dur-plus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'dur-plus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', gap: 3 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>Amount</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setTradeAmount(prev => Math.max(AMOUNT_MIN, prev - (prev >= 100 ? 50 : 10)))} onMouseDown={() => setPressedBtn('amt-minus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('amt-minus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'amt-minus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'amt-minus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>\u2212</button>
            <div style={{ flex: 1, height: 36, borderRadius: 8, background: '#1e2139', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>${tradeAmount.toLocaleString()}</div>
            <button onClick={() => setTradeAmount(prev => Math.min(AMOUNT_MAX, prev + (prev >= 100 ? 50 : 10)))} onMouseDown={() => setPressedBtn('amt-plus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('amt-plus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'amt-plus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'amt-plus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>+</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0, gap: 8, padding: '6px 12px' }}>
        <button
          onClick={() => !isExecuting && isEmailVerified && setConfirmModal({ visible: true, direction: 'sell' })}
          disabled={isExecuting || !isEmailVerified}
          onMouseDown={() => !isExecuting && isEmailVerified && setPressedBtn('sell')}
          onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)}
          onTouchStart={() => !isExecuting && isEmailVerified && setPressedBtn('sell')}
          onTouchEnd={() => setPressedBtn(null)}
          title={!isEmailVerified ? 'Email verification required' : undefined}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: !isEmailVerified ? '#4b1c1c' : isExecuting ? '#7f1d1d' : '#dc2626', opacity: (isExecuting || !isEmailVerified) ? 0.6 : 1, border: 'none', cursor: (isExecuting || !isEmailVerified) ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700, borderRadius: 10, padding: '8px 12px', transform: pressedBtn === 'sell' ? 'scale(0.96)' : 'scale(1)', transition: 'background 0.15s ease, transform 0.1s ease, opacity 0.15s ease' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
          <span style={{ fontSize: 14, letterSpacing: '0.08em' }}>SELL</span>
        </button>
        <button
          onClick={() => !isExecuting && isEmailVerified && setConfirmModal({ visible: true, direction: 'buy' })}
          disabled={isExecuting || !isEmailVerified}
          onMouseDown={() => !isExecuting && isEmailVerified && setPressedBtn('buy')}
          onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)}
          onTouchStart={() => !isExecuting && isEmailVerified && setPressedBtn('buy')}
          onTouchEnd={() => setPressedBtn(null)}
          title={!isEmailVerified ? 'Email verification required' : undefined}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: !isEmailVerified ? '#14391f' : isExecuting ? '#14532d' : '#16a34a', opacity: (isExecuting || !isEmailVerified) ? 0.6 : 1, border: 'none', cursor: (isExecuting || !isEmailVerified) ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700, borderRadius: 10, padding: '8px 12px', transform: pressedBtn === 'buy' ? 'scale(0.96)' : 'scale(1)', transition: 'background 0.15s ease, transform 0.1s ease, opacity 0.15s ease' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
          <span style={{ fontSize: 14, letterSpacing: '0.08em' }}>BUY</span>
        </button>
      </div>
    </div>
  );

  // ─── Desktop Left Sidebar ─────────────────────────────────────────────────────
  const renderDesktopSidebar = () => (
    <div style={{ width: 70, flexShrink: 0, background: '#0d0e23', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, paddingBottom: 12, gap: 4, overflowY: 'auto' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 8 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
      </div>
      {NAV_ITEMS.map(item => (
        <button key={item.id} onClick={() => setActiveNav(item.id)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, width: 54, minHeight: 54, padding: '8px 0', borderRadius: 10, color: activeNav === item.id ? '#3b82f6' : 'rgba(255,255,255,0.45)', background: activeNav === item.id ? 'rgba(59,130,246,0.12)' : 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s ease, color 0.15s ease, transform 0.1s ease' }}
          onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
          onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {item.icon}
          <span style={{ fontSize: 9, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );

  // ─── Bottom Nav (mobile) ──────────────────────────────────────────────────────
  const renderBottomNav = () => (
    <div style={{ height: 60, flexShrink: 0, background: '#0d0e23', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 10 }}>
      {NAV_ITEMS.map(item => (
        <button key={item.id} onClick={() => setActiveNav(item.id)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, minHeight: 54, padding: '8px 0', color: activeNav === item.id ? '#3b82f6' : 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease, transform 0.1s ease' }}
          onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
          onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {item.icon}
          <span style={{ fontSize: 9, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );

  // ─── Search Modal ─────────────────────────────────────────────────────────────
  const renderSearchModal = () => (
    <ModalOverlay onClose={() => { setShowSearchModal(false); setSearchQuery(''); setDebouncedSearchQuery(''); }}>
      <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUpPanel 0.25s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search assets (Bitcoin, ETH, Gold, EUR/USD...)"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, fontWeight: 500 }}
          />
          <button onClick={() => { setShowSearchModal(false); setSearchQuery(''); setDebouncedSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>\u00D7</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {searchFilteredAssets.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No assets found for &quot;{searchQuery}&quot;</div>
          ) : (
            <>
              {!debouncedSearchQuery && <div style={{ padding: '10px 16px 4px', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>All Assets</div>}
              {searchFilteredAssets.map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol} onClick={() => {
                    setSelectedAsset(asset);
                    setActiveNav('platform');
                    setShowSearchModal(false);
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                  }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', minHeight: 56 }} className="hover:bg-white/5">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AssetIcon symbol={asset.symbol} size={36} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{asset.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{asset.symbol} &bull; {asset.category === 'commodity' ? 'Commodities' : asset.category === 'stock' ? 'Stocks' : asset.category.charAt(0).toUpperCase() + asset.category.slice(1)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{p ? formatPrice(p.price, asset.symbol) : '\u2014'}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>Payout {asset.payout}%</div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );

  // ─── Deposit Modal (Real account only — Demo option removed) ──────────────────
  const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Bank Transfer', icon: '\uD83C\uDFE6', info: 'BCA: 1234567890 a.n. PT Investoft Indonesia' },
    { id: 'credit_card', label: 'Credit Card', icon: '\uD83D\uDCB3', info: 'Visa / Mastercard \u2014 processed automatically within 5 minutes' },
    { id: 'crypto', label: 'Cryptocurrency', icon: '\u20BF', info: 'BTC: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  ] as const;

  const renderDepositModal = () => (
    <ModalOverlay onClose={() => { setShowDepositModal(false); setDepositSuccess(''); setDepositError(''); setShowCurrencyDropdown(false); }}>
      <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', animation: 'slideUpPanel 0.25s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Deposit Funds</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>Add balance to your Real trading account</div>
          </div>
          <button onClick={() => { setShowDepositModal(false); setDepositSuccess(''); setDepositError(''); setShowCurrencyDropdown(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>\u00D7</button>
        </div>
        <div style={{ padding: 20 }}>
          {depositSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>\u2705</div>
              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Request Submitted!</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{depositSuccess}</div>
              <button onClick={() => { setShowDepositModal(false); setDepositSuccess(''); }} style={{ padding: '12px 32px', borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>Close</button>
            </div>
          ) : (
            <>
              {/* Real account badge */}
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>\uD83D\uDFE2</span>
                <div>
                  <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>Real Account</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 }}>Deposits are credited to your Real account balance</div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Deposit Amount</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); setShowCurrencyDropdown(v => !v); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 10px', borderRadius: 10, height: 48, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <span>{selectedCurrencyObj.flag}</span><span>{depositCurrency}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showCurrencyDropdown && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#1a1b35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, zIndex: 100, minWidth: 200, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                        {CURRENCIES.map(cur => (
                          <button key={cur.code} onClick={() => { setDepositCurrency(cur.code); setShowCurrencyDropdown(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: depositCurrency === cur.code ? 'rgba(37,99,235,0.2)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }} className="hover:bg-white/5">
                            <span style={{ fontSize: 16 }}>{cur.flag}</span>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{cur.code}</span>
                            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>{cur.symbol}</span>
                            {depositCurrency === cur.code && <span style={{ color: '#3b82f6', fontSize: 13 }}>\u2713</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 600 }}>{selectedCurrencyObj.symbol}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      style={{ width: '100%', height: 48, paddingLeft: 28, paddingRight: 12, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 16, fontWeight: 600, outline: 'none' }}
                    />
                  </div>
                </div>
                {depositAmountNum > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 8 }}>
                    {ratesLoading ? <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Loading exchange rates...</span> : (
                      <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>≈ ${depositAmountUSD.toFixed(2)} USD{depositCurrency !== 'USD' && exchangeRates[depositCurrency] && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>(1 {depositCurrency} = ${(1 / exchangeRates[depositCurrency]).toFixed(4)} USD)</span>}</span>
                    )}
                  </div>
                )}
                {isBelowMinimum && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 8 }}>
                    <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>Minimum deposit is {selectedCurrencyObj.symbol}{minDepositLocal.toLocaleString()} {depositCurrency}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(CURRENCY_QUICK_AMOUNTS[depositCurrency] ?? CURRENCY_QUICK_AMOUNTS['USD']).map(amt => (
                    <button key={amt} onClick={() => setDepositAmount(String(amt))} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{selectedCurrencyObj.symbol}{amt.toLocaleString()}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Payment Method</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PAYMENT_METHODS.map(method => (
                    <button key={method.id} onClick={() => setDepositMethod(method.id as typeof depositMethod)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: depositMethod === method.id ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${depositMethod === method.id ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease' }}>
                      <span style={{ fontSize: 20 }}>{method.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{method.label}</div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{method.info}</div>
                      </div>
                      {depositMethod === method.id && <span style={{ color: '#3b82f6', fontSize: 16 }}>\u2713</span>}
                    </button>
                  ))}
                </div>
              </div>
              {depositError && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 12 }}>
                  <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>{depositError}</span>
                </div>}
              <button onClick={handleDepositSubmit} disabled={depositLoading || isBelowMinimum} style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: (depositLoading || isBelowMinimum) ? 'not-allowed' : 'pointer', opacity: (depositLoading || isBelowMinimum) ? 0.5 : 1 }}>
                {depositLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Processing...</span> : `Submit Deposit Request${depositAmountNum > 0 ? ` — ${selectedCurrencyObj.symbol}${depositAmountNum.toLocaleString()} ${depositCurrency}` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );

  // ─── Settings Modal ───────────────────────────────────────────────────────────
  const renderSettingsModal = () => (
    <ModalOverlay onClose={() => setShowSettingsModal(false)}>
      <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 460, animation: 'slideUpPanel 0.25s ease-out', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Settings</div>
          <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>\u00D7</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {([['chart', '\uD83D\uDCC8 Chart'], ['account', '\uD83D\uDC64 Account'], ['trading', '\u2699\uFE0F Trading']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setSettingsTab(tab)}
              style={{ flex: 1, padding: '12px 8px', background: settingsTab === tab ? 'rgba(37,99,235,0.1)' : 'none', border: 'none', borderBottom: settingsTab === tab ? '2px solid #3b82f6' : '2px solid transparent', color: settingsTab === tab ? '#60a5fa' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >{label}</button>
          ))}
        </div>
        <div style={{ padding: 20 }}>
          {settingsTab === 'chart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Chart Theme</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Dark or light chart background</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['dark', 'light'] as const).map(t => (
                    <button key={t} onClick={() => setSettingsChartTheme(t)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: settingsChartTheme === t ? '#2563eb' : 'rgba(255,255,255,0.08)', color: settingsChartTheme === t ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Default Timeframe</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Chart timeframe on load</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['1m', '30m', '1h'] as const).map(tf => (
                    <button key={tf} onClick={() => setSettingsDefaultTF(tf)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: settingsDefaultTF === tf ? '#2563eb' : 'rgba(255,255,255,0.08)', color: settingsDefaultTF === tf ? '#fff' : 'rgba(255,255,255,0.6)' }}>{tf}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {settingsTab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>Email</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.email}</div>
              </div>
              {!isEmailVerified && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>\u26A0\uFE0F Email not verified</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>Verify your email to enable trading.</div>
                  <button onClick={handleResendVerification} disabled={resendVerifyLoading || resendVerifyCooldown > 0} style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: resendVerifyLoading || resendVerifyCooldown > 0 ? 'not-allowed' : 'pointer', opacity: resendVerifyLoading || resendVerifyCooldown > 0 ? 0.6 : 1 }}>
                    {resendVerifyLoading ? 'Sending...' : resendVerifyCooldown > 0 ? `Resend in ${resendVerifyCooldown}s` : 'Resend Verification Email'}
                  </button>
                  {resendVerifyMsg && <div style={{ color: resendVerifyMsg.includes('sent') ? '#22c55e' : '#ef4444', fontSize: 12, marginTop: 8 }}>{resendVerifyMsg}</div>}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Notifications</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Trade result notifications</div>
                </div>
                <button onClick={() => setSettingsNotifications(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: settingsNotifications ? '#2563eb' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settingsNotifications ? 23 : 3, transition: 'left 0.2s ease' }} />
                </button>
              </div>
            </div>
          )}
          {settingsTab === 'trading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Default Trade Amount</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Starting amount for each trade</div>
                </div>
                <input
                  type="number"
                  value={settingsDefaultAmount}
                  onChange={e => setSettingsDefaultAmount(e.target.value)}
                  style={{ width: 80, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Auto-Confirm Trades</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Skip confirmation dialog</div>
                </div>
                <button onClick={() => setSettingsAutoConfirm(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: settingsAutoConfirm ? '#2563eb' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settingsAutoConfirm ? 23 : 3, transition: 'left 0.2s ease' }} />
                </button>
              </div>
            </div>
          )}
          {settingsSaved && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>\u2705 Settings saved!</div>}
          <button onClick={handleSettingsSave} style={{ marginTop: 16, width: '100%', padding: '13px 0', borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>Save Settings</button>
        </div>
      </div>
    </ModalOverlay>
  );

  // ─── Main Return ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#0a0b1e', position: 'relative' }}>
      {/* Desktop Left Sidebar */}
      {isDesktop && renderDesktopSidebar()}

      {/* Main Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {renderTopBar()}
        {renderSecondBar()}

        {/* Verified Banner */}
        {showVerifiedBanner && (
          <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px 16px', fontSize: 13, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
            \u2705 Email verified! You can now trade.
          </div>
        )}

        {/* Chart Area */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {renderPanelContent()}
        </div>

        {renderBottomTradePanel(isDesktop ? 120 : 150)}

        {/* Mobile Bottom Nav */}
        {!isDesktop && renderBottomNav()}
      </div>

      {/* ── Toast Notifications ── */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div key={toast.id}
            style={{
              background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : toast.type === 'error' ? 'rgba(239,68,68,0.95)' : toast.type === 'warning' ? 'rgba(245,158,11,0.95)' : 'rgba(59,130,246,0.95)',
              color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: 'slideInRight 0.3s ease-out',
              maxWidth: 320, pointerEvents: 'auto', cursor: 'pointer',
            }}
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── Trade Result Notification ── */}
      {notification.visible && (
        <div style={{
          position: 'fixed', bottom: isDesktop ? 140 : 220, left: '50%', transform: 'translateX(-50%)',
          zIndex: 85, background: notification.result === 'won' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'slideUpPanel 0.3s ease-out',
          textAlign: 'center', minWidth: 200,
        }}>
          <div>{notification.result === 'won' ? '\uD83C\uDFC6 WON!' : '\uD83D\uDE14 LOST'}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
            {notification.result === 'won' ? '+' : '-'}${Math.abs(notification.profit).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Closing in {notification.countdown}s</div>
        </div>
      )}

      {/* ── Confirm Trade Modal ── */}
      {confirmModal.visible && confirmModal.direction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', padding: 16 }}>
          <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 360, padding: 24, animation: 'slideUpPanel 0.25s ease-out' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Confirm Trade</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 20 }}>
              {confirmModal.direction?.toUpperCase()} {selectedAsset.name} for ${tradeAmount} ({DURATIONS[durationIdx].label})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setConfirmModal({ visible: false, direction: null })} style={{ padding: '12px 0', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => executeTrade(confirmModal.direction!)} style={{ padding: '12px 0', borderRadius: 10, background: confirmModal.direction === 'buy' ? '#16a34a' : '#dc2626', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {confirmModal.direction?.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Help Button ── */}
      <button
        onClick={() => setShowHelp(v => !v)}
        style={{ position: 'fixed', bottom: isDesktop ? 24 : 80, right: 16, width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', cursor: 'pointer', zIndex: 70, boxShadow: '0 4px 16px rgba(37,99,235,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >?
      </button>
      {showHelp && (
        <div style={{ position: 'fixed', bottom: isDesktop ? 76 : 132, right: 16, background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 16, zIndex: 70, maxWidth: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeInDown 0.2s ease-out' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Quick Help</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.6 }}>
            1. Select an asset from the top bar<br/>
            2. Set duration and amount<br/>
            3. Click SELL or BUY to open a trade<br/>
            4. Wait for the countdown to resolve
          </div>
        </div>
      )}

      {/* ── Search Modal ── */}
      {showSearchModal && renderSearchModal()}

      {/* ── Deposit Modal ── */}
      {showDepositModal && renderDepositModal()}

      {/* ── Settings Modal ── */}
      {showSettingsModal && renderSettingsModal()}

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUpPanel { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
