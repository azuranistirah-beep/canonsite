'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, SUPPORTED_LANGUAGES } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import TradingViewChart, { TradingViewChartHandle } from '@/components/TradingViewChart';

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

// ─── Price System Types ───────────────────────────────────────────────────────
interface PriceTimestamp {
  lastUpdated: number;
  lastValidPrice: number;
  isValid: boolean;
}

interface PriceMovementRecord {
  symbol: string;
  prevPrice: number;
  currentPrice: number;
  changePercent: number;
  timestamp: number;
}

interface PriceMovementAlert {
  id: string;
  symbol: string;
  assetName: string;
  prevPrice: number;
  currentPrice: number;
  changePercent: number;
  direction: 'up' | 'down';
  timestamp: number;
  dismissed: boolean;
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

const CURRENCY_MIN_DEPOSITS: Record<string, number> = {
  USD: 100, EUR: 92, GBP: 79, MYR: 500, SGD: 134,
  THB: 3500, PHP: 5650, JPY: 14950, AUD: 153, CNY: 724,
};

const CURRENCY_QUICK_AMOUNTS: Record<string, number[]> = {
  USD: [100, 250, 500, 1000], EUR: [92, 250, 500, 1000], GBP: [79, 200, 400, 800],
  MYR: [500, 1000, 2500, 5000], SGD: [134, 300, 700, 1400], THB: [3500, 7000, 17500, 35000],
  PHP: [5650, 10000, 25000, 50000], JPY: [14950, 30000, 75000, 150000],
  AUD: [153, 300, 750, 1500], CNY: [724, 1500, 3600, 7200],
};

// ─── Price Validation Ranges per Category ────────────────────────────────────
const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  crypto: { min: 0.000000001, max: 200000 },
  forex: { min: 0.5, max: 2000 },
  commodity: { min: 0.5, max: 15000 },
  stock: { min: 1, max: 10000 },
};

function validatePrice(price: number, category: string): boolean {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price) || price <= 0) {
    return false;
  }
  const range = PRICE_RANGES[category] || PRICE_RANGES.crypto;
  if (price < range.min || price > range.max) {
    console.warn(`[Price Validation] Price ${price} out of range for category ${category} (${range.min} - ${range.max})`);
    return false;
  }
  return true;
}

// ─── MODAL OVERLAY HELPER ─────────────────────────────────────────────────────
const ModalOverlay = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', animation: 'fadeIn 0.2s ease-out', padding: 16 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()}>{children}</div>
  </div>
);

// ─── Asset List ──────────────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { symbol: 'BTC/USD', name: 'Bitcoin', tvSymbol: 'BINANCE:BTCUSDT', binanceSymbol: 'BTCUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'ETH/USD', name: 'Ethereum', tvSymbol: 'BINANCE:ETHUSDT', binanceSymbol: 'ETHUSDT', exchange: 'Binance', category: 'crypto', payout: 92 },
  { symbol: 'SOL/USD', name: 'Solana', tvSymbol: 'BINANCE:SOLUSDT', binanceSymbol: 'SOLUSDT', exchange: 'Binance', category: 'crypto', payout: 90 },
  { symbol: 'BNB/USD', name: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', binanceSymbol: 'BNBUSDT', exchange: 'Binance', category: 'crypto', payout: 88 },
  { symbol: 'XRP/USD', name: 'Ripple', tvSymbol: 'BINANCE:XRPUSDT', binanceSymbol: 'XRPUSDT', exchange: 'Binance', category: 'crypto', payout: 88 },
  { symbol: 'ADA/USD', name: 'Cardano', tvSymbol: 'BINANCE:ADAUSDT', binanceSymbol: 'ADAUSDT', exchange: 'Binance', category: 'crypto', payout: 87 },
  { symbol: 'DOGE/USD', name: 'Dogecoin', tvSymbol: 'BINANCE:DOGEUSDT', binanceSymbol: 'DOGEUSDT', exchange: 'Binance', category: 'crypto', payout: 87 },
  { symbol: 'DOT/USD', name: 'Polkadot', tvSymbol: 'BINANCE:DOTUSDT', binanceSymbol: 'DOTUSDT', exchange: 'Binance', category: 'crypto', payout: 86 },
  { symbol: 'AVAX/USD', name: 'Avalanche', tvSymbol: 'BINANCE:AVAXUSDT', binanceSymbol: 'AVAXUSDT', exchange: 'Binance', category: 'crypto', payout: 86 },
  { symbol: 'LINK/USD', name: 'Chainlink', tvSymbol: 'BINANCE:LINKUSDT', binanceSymbol: 'LINKUSDT', exchange: 'Binance', category: 'crypto', payout: 85 },
  { symbol: 'LTC/USD', name: 'Litecoin', tvSymbol: 'BINANCE:LTCUSDT', binanceSymbol: 'LTCUSDT', exchange: 'Binance', category: 'crypto', payout: 85 },
  { symbol: 'MATIC/USD', name: 'Polygon', tvSymbol: 'BINANCE:MATICUSDT', binanceSymbol: 'MATICUSDT', exchange: 'Binance', category: 'crypto', payout: 85 },
  { symbol: 'SHIB/USD', name: 'Shiba Inu', tvSymbol: 'BINANCE:SHIBUSDT', binanceSymbol: 'SHIBUSDT', exchange: 'Binance', category: 'crypto', payout: 84 },
  { symbol: 'UNI/USD', name: 'Uniswap', tvSymbol: 'BINANCE:UNIUSDT', binanceSymbol: 'UNIUSDT', exchange: 'Binance', category: 'crypto', payout: 84 },
  { symbol: 'ATOM/USD', name: 'Cosmos', tvSymbol: 'BINANCE:ATOMUSDT', binanceSymbol: 'ATOMUSDT', exchange: 'Binance', category: 'crypto', payout: 83 },
  { symbol: 'ALGO/USD', name: 'Algorand', tvSymbol: 'BINANCE:ALGOUSDT', binanceSymbol: 'ALGOUSDT', exchange: 'Binance', category: 'crypto', payout: 83 },
  { symbol: 'VET/USD', name: 'VeChain', tvSymbol: 'BINANCE:VETUSDT', binanceSymbol: 'VETUSDT', exchange: 'Binance', category: 'crypto', payout: 82 },
  { symbol: 'XTZ/USD', name: 'Tezos', tvSymbol: 'BINANCE:XTZUSDT', binanceSymbol: 'XTZUSDT', exchange: 'Binance', category: 'crypto', payout: 82 },
  { symbol: 'EOS/USD', name: 'EOS', tvSymbol: 'BINANCE:EOSUSDT', binanceSymbol: 'EOSUSDT', exchange: 'Binance', category: 'crypto', payout: 82 },
  { symbol: 'XLM/USD', name: 'Stellar', tvSymbol: 'BINANCE:XLMUSDT', binanceSymbol: 'XLMUSDT', exchange: 'Binance', category: 'crypto', payout: 82 },
  { symbol: 'XMR/USD', name: 'Monero', tvSymbol: 'BINANCE:XMRUSDT', binanceSymbol: 'XMRUSDT', exchange: 'Binance', category: 'crypto', payout: 83 },
  { symbol: 'TRX/USD', name: 'Tron', tvSymbol: 'BINANCE:TRXUSDT', binanceSymbol: 'TRXUSDT', exchange: 'Binance', category: 'crypto', payout: 82 },
  { symbol: 'NEO/USD', name: 'NEO', tvSymbol: 'BINANCE:NEOUSDT', binanceSymbol: 'NEOUSDT', exchange: 'Binance', category: 'crypto', payout: 81 },
  { symbol: 'ZEC/USD', name: 'Zcash', tvSymbol: 'BINANCE:ZECUSDT', binanceSymbol: 'ZECUSDT', exchange: 'Binance', category: 'crypto', payout: 81 },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', tvSymbol: 'FX:EURUSD', exchange: 'FX', category: 'forex', payout: 85 },
  { symbol: 'GBP/USD', name: 'British Pound / USD', tvSymbol: 'FX:GBPUSD', exchange: 'FX', category: 'forex', payout: 85 },
  { symbol: 'USD/JPY', name: 'US Dollar / Yen', tvSymbol: 'FX:USDJPY', exchange: 'FX', category: 'forex', payout: 85 },
  { symbol: 'AUD/USD', name: 'Australian Dollar / USD', tvSymbol: 'FX:AUDUSD', exchange: 'FX', category: 'forex', payout: 83 },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', tvSymbol: 'FX:USDCHF', exchange: 'FX', category: 'forex', payout: 83 },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound', tvSymbol: 'FX:EURGBP', exchange: 'FX', category: 'forex', payout: 82 },
  { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen', tvSymbol: 'FX:EURJPY', exchange: 'FX', category: 'forex', payout: 83 },
  { symbol: 'GBP/JPY', name: 'British Pound / Yen', tvSymbol: 'FX:GBPJPY', exchange: 'FX', category: 'forex', payout: 83 },
  { symbol: 'AUD/JPY', name: 'Australian Dollar / Yen', tvSymbol: 'FX:AUDJPY', exchange: 'FX', category: 'forex', payout: 82 },
  { symbol: 'EUR/AUD', name: 'Euro / Australian Dollar', tvSymbol: 'FX:EURAUD', exchange: 'FX', category: 'forex', payout: 82 },
  { symbol: 'GBP/AUD', name: 'British Pound / Australian Dollar', tvSymbol: 'FX:GBPAUD', exchange: 'FX', category: 'forex', payout: 82 },
  { symbol: 'XAU/USD', name: 'Gold', tvSymbol: 'OANDA:XAUUSD', exchange: 'OANDA', category: 'commodity', payout: 87 },
  { symbol: 'XAG/USD', name: 'Silver', tvSymbol: 'OANDA:XAGUSD', exchange: 'OANDA', category: 'commodity', payout: 85 },
  { symbol: 'OIL/USD', name: 'Crude Oil', tvSymbol: 'NYMEX:CL1!', exchange: 'NYMEX', category: 'commodity', payout: 83 },
  { symbol: 'XPT/USD', name: 'Platinum', tvSymbol: 'OANDA:XPTUSD', exchange: 'OANDA', category: 'commodity', payout: 84 },
  { symbol: 'COPPER', name: 'Copper', tvSymbol: 'COMEX:HG1!', exchange: 'COMEX', category: 'commodity', payout: 82 },
  { symbol: 'NATGAS', name: 'Natural Gas', tvSymbol: 'NYMEX:NG1!', exchange: 'NYMEX', category: 'commodity', payout: 82 },
  { symbol: 'WHEAT', name: 'Wheat', tvSymbol: 'CBOT:ZW1!', exchange: 'CBOT', category: 'commodity', payout: 80 },
  { symbol: 'CORN', name: 'Corn', tvSymbol: 'CBOT:ZC1!', exchange: 'CBOT', category: 'commodity', payout: 80 },
  { symbol: 'AAPL', name: 'Apple Inc.', tvSymbol: 'NASDAQ:AAPL', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', tvSymbol: 'NASDAQ:MSFT', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', tvSymbol: 'NASDAQ:GOOGL', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', tvSymbol: 'NASDAQ:AMZN', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'TSLA', name: 'Tesla Inc.', tvSymbol: 'NASDAQ:TSLA', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'META', name: 'Meta Platforms', tvSymbol: 'NASDAQ:META', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'NFLX', name: 'Netflix Inc.', tvSymbol: 'NASDAQ:NFLX', exchange: 'NASDAQ', category: 'stock', payout: 80 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', tvSymbol: 'NASDAQ:NVDA', exchange: 'NASDAQ', category: 'stock', payout: 80 },
];

const DURATIONS = [
  { label: '5s', seconds: 5 }, { label: '10s', seconds: 10 }, { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 }, { label: '1m', seconds: 60 }, { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 }, { label: '30m', seconds: 1800 }, { label: '1h', seconds: 3600 },
  { label: '4h', seconds: 14400 }, { label: '1d', seconds: 86400 }, { label: '2d', seconds: 172800 },
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

function BitcoinIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
      <path d="M22.5 14.2c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6-1.3-.3.7-2.6-1.7-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8.9l-.8 3.3c0 0 .1 0 .2.1l-.2-.1-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5 1.2.3-.7 2.7 1.7.4.7-2.7c2.8.5 4.9.3 5.8-2.2.7-2-.1-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2-3.9.9-4.3.7l.8-3.5c1.1.3 4 .8 4.1 2.9zm.5-5.3c-.5 1.8-3.3.9-4.3.7l.8-3.2c1 .2 4 .7 3.5 2.5z" fill="white"/>
    </svg>
  );
}

function AssetIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  if (symbol.includes('BTC')) return <BitcoinIcon size={size} />;
  const colorMap: Record<string, string> = {
    'ETH': '#627EEA', 'SOL': '#9945FF', 'BNB': '#F3BA2F', 'XRP': '#00AAE4',
    'ADA': '#0033AD', 'DOGE': '#C2A633', 'DOT': '#E6007A', 'AVAX': '#E84142',
    'LINK': '#2A5ADA', 'LTC': '#BFBBBB', 'MATIC': '#8247E5', 'SHIB': '#FFA409',
    'UNI': '#FF007A', 'ATOM': '#2E3148', 'ALGO': '#00B4D8', 'VET': '#15BDFF',
    'XTZ': '#A8E000', 'EOS': '#443F54', 'XLM': '#14B6E7', 'XMR': '#FF6600',
    'TRX': '#EF0027', 'NEO': '#58BF00', 'ZEC': '#F4B728',
    'EUR': '#003399', 'GBP': '#012169', 'USD': '#1a5276', 'AUD': '#00843D',
    'CAD': '#FF0000', 'NZD': '#00247D', 'CHF': '#FF0000', 'JPY': '#BC002D',
    'XAU': '#FFD700', 'XAG': '#C0C0C0', 'OIL': '#8B4513', 'XPT': '#E5E4E2',
    'COPPER': '#B87333', 'NATGAS': '#4A90D9', 'WHEAT': '#F5DEB3', 'CORN': '#FFD700',
    'AAPL': '#555555', 'MSFT': '#00A4EF', 'GOOGL': '#4285F4', 'AMZN': '#FF9900',
    'TSLA': '#CC0000', 'META': '#1877F2', 'NFLX': '#E50914', 'NVDA': '#76B900',
  };
  const letterMap: Record<string, string> = {
    'ETH': 'Ξ', 'SOL': 'S', 'BNB': 'B', 'XRP': 'X',
    'ADA': 'A', 'DOGE': 'D', 'DOT': '●', 'AVAX': 'A',
    'LINK': '⛓', 'LTC': 'Ł', 'MATIC': 'M', 'SHIB': '🐕',
    'UNI': '🦄', 'ATOM': '⚛', 'ALGO': 'A', 'VET': 'V',
    'XTZ': 'Ψ', 'EOS': 'E', 'XLM': '★', 'XMR': 'M',
    'TRX': 'T', 'NEO': 'N', 'ZEC': 'Z',
    'EUR': '€', 'GBP': '£', 'USD': '$', 'AUD': 'A',
    'CAD': 'C', 'NZD': 'N', 'CHF': 'Fr', 'JPY': '¥',
    'XAU': 'Au', 'XAG': 'Ag', 'OIL': 'O', 'XPT': 'Pt',
    'COPPER': 'Cu', 'NATGAS': 'G', 'WHEAT': 'W', 'CORN': 'C',
    'AAPL': '', 'MSFT': 'M', 'GOOGL': 'G', 'AMZN': 'A',
    'TSLA': '⚡', 'META': 'f', 'NFLX': 'N', 'NVDA': 'N',
  };
  const key = Object.keys(colorMap).find(k => symbol.includes(k)) || 'USD';
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: colorMap[key] || '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>
      {letterMap[key] || symbol[0]}
    </div>
  );
}

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
  const { t, language, setLanguage } = useLanguage();

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

  const [tvPrice, setTvPrice] = useState<number>(0);
  const tvPriceRef = useRef<number>(0);
  const [tvChange, setTvChange] = useState<number>(0);
  const [tvChangePercent, setTvChangePercent] = useState<number>(0);

  const tvFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tvReceivedForCurrentAssetRef = useRef<boolean>(false);

  const chartRef = useRef<TradingViewChartHandle>(null);
  const chartSymbolRef = useRef(ASSETS[0].tvSymbol);
  const chartIntervalRef = useRef('1');

  const [priceTimestamps, setPriceTimestamps] = useState<Record<string, PriceTimestamp>>({});
  const [invalidPrices, setInvalidPrices] = useState<Record<string, boolean>>({});
  const [priceMovementHistory, setPriceMovementHistory] = useState<PriceMovementRecord[]>([]);
  const [priceMovementAlerts, setPriceMovementAlerts] = useState<PriceMovementAlert[]>([]);
  const [priceAlertToasts, setPriceAlertToasts] = useState<Array<{ id: string; message: string; type: 'warning' | 'error' }>>([]);
  const [settingsPriceAlerts, setSettingsPriceAlerts] = useState(true);
  const [settingsAlertThreshold1, setSettingsAlertThreshold1] = useState('5');
  const [settingsAlertThreshold2, setSettingsAlertThreshold2] = useState('10');
  const priceTimestampsRef = useRef<Record<string, PriceTimestamp>>({});
  const pricesRef2 = useRef<Record<string, PriceData>>({});
  const [now, setNow] = useState(Date.now());

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

  const [tradeAlerts, setTradeAlerts] = useState<TradeAlert[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const unreadCount = tradeAlerts.filter(a => !a.read).length;

  const [pressedBtn, setPressedBtn] = useState<string | null>(null);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState<'bank_transfer' | 'credit_card' | 'crypto'>('bank_transfer');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositCurrency, setDepositCurrency] = useState<string>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const exchangeRatesFetchedRef = useRef(false);
  const [depositTab, setDepositTab] = useState<'stripe' | 'bank' | 'crypto'>('stripe');
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<'BTC' | 'ETH' | 'USDT'>('USDT');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'chart' | 'account' | 'trading'>('chart');
  const [settingsChartTheme, setSettingsChartTheme] = useState<'dark' | 'light'>('dark');
  const [settingsDefaultTF, setSettingsDefaultTF] = useState('1m');
  const [settingsDefaultAmount, setSettingsDefaultAmount] = useState('10');
  const [settingsAutoConfirm, setSettingsAutoConfirm] = useState(false);
  const [settingsNotifications, setSettingsNotifications] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [resendVerifyCooldown, setResendVerifyCooldown] = useState(0);
  const [resendVerifyLoading, setResendVerifyLoading] = useState(false);
  const [resendVerifyMsg, setResendVerifyMsg] = useState('');
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  // Language selector state
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const currentLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  const pricesRef = useRef<Record<string, PriceData>>({});
  const demoBalanceRef = useRef<number>(10000);
  const realBalanceRef = useRef<number>(0);
  const accountTypeRef = useRef<'demo' | 'real'>('demo');
  const selectedAssetRef = useRef<Asset>(ASSETS[0]);

  useEffect(() => { pricesRef.current = prices; pricesRef2.current = prices; }, [prices]);
  useEffect(() => { demoBalanceRef.current = demoBalance; }, [demoBalance]);
  useEffect(() => { realBalanceRef.current = realBalance; }, [realBalance]);
  useEffect(() => { accountTypeRef.current = accountType; }, [accountType]);
  useEffect(() => { selectedAssetRef.current = selectedAsset; }, [selectedAsset]);
  useEffect(() => { priceTimestampsRef.current = priceTimestamps; }, [priceTimestamps]);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const fetchPrice = useCallback(async (asset: Asset) => {
    if (!asset.binanceSymbol) return;
    try {
      const res = await fetch(`/api/prices/binance?symbol=${asset.binanceSymbol}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const rawPrice = data.price;
        const isValid = validatePrice(rawPrice, asset.category);
        const prevTimestamp = priceTimestampsRef.current[asset.symbol];
        const lastValidPrice = prevTimestamp?.lastValidPrice || rawPrice;
        const priceToUse = isValid ? rawPrice : lastValidPrice;

        if (!isValid) {
          setInvalidPrices(prev => ({ ...prev, [asset.symbol]: true }));
        } else {
          setInvalidPrices(prev => ({ ...prev, [asset.symbol]: false }));
        }

        if (isValid && pricesRef2.current[asset.symbol] && pricesRef2.current[asset.symbol].price > 0 && settingsPriceAlerts) {
          const threshold1 = parseFloat(settingsAlertThreshold1) || 5;
          const threshold2 = parseFloat(settingsAlertThreshold2) || 10;
          const prevPrice = pricesRef2.current[asset.symbol].price;
          const changePercent = Math.abs((priceToUse - prevPrice) / prevPrice * 100);
          if (changePercent >= threshold1) {
            const direction: 'up' | 'down' = priceToUse > prevPrice ? 'up' : 'down';
            const movRecord: PriceMovementRecord = { symbol: asset.symbol, prevPrice, currentPrice: priceToUse, changePercent, timestamp: Date.now() };
            setPriceMovementHistory(prev => [movRecord, ...prev].slice(0, 100));
            if (changePercent >= threshold2) {
              const alertId = `pma_${asset.symbol}_${Date.now()}`;
              const newAlert: PriceMovementAlert = { id: alertId, symbol: asset.symbol, assetName: asset.name, prevPrice, currentPrice: priceToUse, changePercent, direction, timestamp: Date.now(), dismissed: false };
              setPriceMovementAlerts(prev => [newAlert, ...prev].slice(0, 10));
            } else {
              const toastId = `pat_${asset.symbol}_${Date.now()}`;
              const msg = `${asset.name} ${direction === 'up' ? '▲' : '▼'} ${changePercent.toFixed(2)}%`;
              setPriceAlertToasts(prev => [...prev, { id: toastId, message: msg, type: 'warning' }]);
              setTimeout(() => setPriceAlertToasts(prev => prev.filter(t => t.id !== toastId)), 5000);
            }
          }
        }

        setPrices(prev => ({
          ...prev,
          [asset.symbol]: {
            price: priceToUse,
            change24h: data.change24h,
            prevPrice: prev[asset.symbol]?.price || priceToUse,
            open: prev[asset.symbol]?.open || priceToUse,
            high: Math.max(prev[asset.symbol]?.high || priceToUse, priceToUse),
            low: Math.min(prev[asset.symbol]?.low || priceToUse, priceToUse),
            close: priceToUse,
          },
        }));
        if (isValid) {
          setPriceTimestamps(prev => ({
            ...prev,
            [asset.symbol]: { lastUpdated: Date.now(), lastValidPrice: priceToUse, isValid: true },
          }));
        }
      }
    } catch (e) {
      console.error(`[fetchPrice] Error fetching ${asset.symbol}:`, e);
    }
  }, [settingsPriceAlerts, settingsAlertThreshold1, settingsAlertThreshold2]);

  const fetchForexPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/prices/forex');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        const keyMap: Record<string, string> = {
          'EUR/USD': 'EUR/USD', 'GBP/USD': 'GBP/USD', 'USD/JPY': 'USD/JPY',
          'AUD/USD': 'AUD/USD', 'USD/CAD': 'USD/CAD', 'NZD/USD': 'NZD/USD',
          'USD/CHF': 'USD/CHF', 'EUR/GBP': 'EUR/GBP', 'EUR/JPY': 'EUR/JPY',
          'GBP/JPY': 'GBP/JPY', 'AUD/JPY': 'AUD/JPY', 'EUR/AUD': 'EUR/AUD',
          'GBP/AUD': 'GBP/AUD', 'Gold': 'XAU/USD', 'Silver': 'XAG/USD',
          'Crude Oil': 'OIL/USD', 'Platinum': 'XPT/USD', 'Copper': 'COPPER',
          'Natural Gas': 'NATGAS', 'Wheat': 'WHEAT', 'Corn': 'CORN',
          'AAPL': 'AAPL', 'MSFT': 'MSFT', 'GOOGL': 'GOOGL', 'AMZN': 'AMZN',
          'TSLA': 'TSLA', 'META': 'META', 'NFLX': 'NFLX', 'NVDA': 'NVDA',
        };
        setPrices(prev => {
          const updated = { ...prev };
          Object.entries(keyMap).forEach(([apiKey, assetSymbol]) => {
            const d = data.data[apiKey];
            if (d && d.price > 0) {
              const asset = ASSETS.find(a => a.symbol === assetSymbol);
              const category = asset?.category || 'commodity';
              const isValid = validatePrice(d.price, category);
              const prevTimestamp = priceTimestampsRef.current[assetSymbol];
              const lastValidPrice = prevTimestamp?.lastValidPrice || d.price;
              const priceToUse = isValid ? d.price : lastValidPrice;

              if (!isValid) {
                setInvalidPrices(prev2 => ({ ...prev2, [assetSymbol]: true }));
              } else {
                setInvalidPrices(prev2 => ({ ...prev2, [assetSymbol]: false }));
              }

              if (isValid && prev[assetSymbol] && prev[assetSymbol].price > 0 && settingsPriceAlerts) {
                const threshold1 = parseFloat(settingsAlertThreshold1) || 5;
                const threshold2 = parseFloat(settingsAlertThreshold2) || 10;
                const changePercent = Math.abs((priceToUse - prev[assetSymbol].price) / prev[assetSymbol].price * 100);
                if (changePercent >= threshold1) {
                  const direction: 'up' | 'down' = priceToUse > prev[assetSymbol].price ? 'up' : 'down';
                  const movRecord: PriceMovementRecord = { symbol: assetSymbol, prevPrice: prev[assetSymbol].price, currentPrice: priceToUse, changePercent, timestamp: Date.now() };
                  setPriceMovementHistory(prev2 => [movRecord, ...prev2].slice(0, 100));
                  if (changePercent >= threshold2) {
                    const alertId = `pma_${assetSymbol}_${Date.now()}`;
                    const assetName = asset?.name || assetSymbol;
                    const newAlert: PriceMovementAlert = { id: alertId, symbol: assetSymbol, assetName, prevPrice: prev[assetSymbol].price, currentPrice: priceToUse, changePercent, direction, timestamp: Date.now(), dismissed: false };
                    setPriceMovementAlerts(prev2 => [newAlert, ...prev2].slice(0, 10));
                  } else {
                    const toastId = `pat_${assetSymbol}_${Date.now()}`;
                    const assetName = asset?.name || assetSymbol;
                    const msg = `${assetName} ${direction === 'up' ? '▲' : '▼'} ${changePercent.toFixed(2)}%`;
                    setPriceAlertToasts(prev2 => [...prev2, { id: toastId, message: msg, type: 'warning' }]);
                    setTimeout(() => setPriceAlertToasts(prev2 => prev2.filter(t => t.id !== toastId)), 5000);
                  }
                }
              }

              updated[assetSymbol] = {
                price: priceToUse,
                change24h: d.change || 0,
                prevPrice: prev[assetSymbol]?.price || priceToUse,
                open: prev[assetSymbol]?.open || priceToUse,
                high: Math.max(prev[assetSymbol]?.high || priceToUse, priceToUse),
                low: Math.min(prev[assetSymbol]?.low || priceToUse, priceToUse),
                close: priceToUse,
              };
              if (isValid) {
                setPriceTimestamps(prev2 => ({
                  ...prev2,
                  [assetSymbol]: { lastUpdated: Date.now(), lastValidPrice: priceToUse, isValid: true },
                }));
              }
            }
          });
          return updated;
        });
      }
    } catch (e) {
      console.error('[fetchForexPrices] Error:', e);
    }
  }, [settingsPriceAlerts, settingsAlertThreshold1, settingsAlertThreshold2]);

  const manualRefreshPrices = useCallback(() => {
    ASSETS.filter(a => a.binanceSymbol).forEach(fetchPrice);
    fetchForexPrices();
  }, [fetchPrice, fetchForexPrices]);

  useEffect(() => {
    ASSETS.filter(a => a.binanceSymbol).forEach(fetchPrice);
    fetchForexPrices();
    const interval = setInterval(() => {
      ASSETS.filter(a => a.binanceSymbol).forEach(fetchPrice);
      fetchForexPrices();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPrice, fetchForexPrices]);

  useEffect(() => {
    const newInterval = TF_MAP[chartTimeframe] || '1';
    if (
      selectedAsset.tvSymbol !== chartSymbolRef.current ||
      newInterval !== chartIntervalRef.current
    ) {
      chartSymbolRef.current = selectedAsset.tvSymbol;
      chartIntervalRef.current = newInterval;
      setTvPrice(0);
      setTvChange(0);
      setTvChangePercent(0);
      tvPriceRef.current = 0;
      tvReceivedForCurrentAssetRef.current = false;
      if (tvFallbackTimerRef.current) {
        clearTimeout(tvFallbackTimerRef.current);
        tvFallbackTimerRef.current = null;
      }
      tvFallbackTimerRef.current = setTimeout(() => {
        tvFallbackTimerRef.current = null;
        if (!tvReceivedForCurrentAssetRef.current) {
          console.log(`[Hybrid Price] TV timeout for ${selectedAsset.symbol}, using API fallback`);
        }
      }, 5000);
      chartRef.current?.setSymbol(selectedAsset.tvSymbol, newInterval);
    }
    return () => {
      if (tvFallbackTimerRef.current) {
        clearTimeout(tvFallbackTimerRef.current);
      }
    };
  }, [selectedAsset.tvSymbol, chartTimeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (tvFallbackTimerRef.current) {
        clearTimeout(tvFallbackTimerRef.current);
      }
    };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { setDebouncedSearchQuery(value); }, 300);
  }, []);

  useEffect(() => {
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, []);

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

  useEffect(() => {
    if (resendVerifyCooldown <= 0) return;
    const t = setInterval(() => {
      setResendVerifyCooldown(prev => { if (prev <= 1) { clearInterval(t); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [resendVerifyCooldown]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/auth'); }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showSearchModal]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) setShowAccountDropdown(false);
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(e.target as Node)) setShowAssetDropdown(false);
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) setShowNotifPanel(false);
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) setShowLangDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowSearchModal(false); setShowDepositModal(false); setShowSettingsModal(false);
        setSearchQuery(''); setDebouncedSearchQuery('');
        setShowLangDropdown(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      } catch (e) { console.error('Balance load error:', e); }
    };
    loadBalances();
  }, [user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (data) setTradeHistory(data as Trade[]);
    } catch (e) { console.error('History load error:', e); }
  }, [user?.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('trade_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (data) setTradeAlerts(data as TradeAlert[]);
    } catch (e) { console.error('Alerts load error:', e); }
  }, [user?.id]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`trade_alerts_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_alerts', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newAlert = payload.new as TradeAlert;
        setTradeAlerts(prev => [newAlert, ...prev]);
        const toastId = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id: toastId, type: newAlert.type, message: newAlert.message, visible: true }]);
        setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== toastId)); }, 3000);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(newAlert.type === 'success' ? [100, 50, 100] : [200]);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const saveTradeAlert = useCallback(async (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    tradeDetails?: TradeAlert['trade_details']
  ) => {
    if (!user) return;
    try {
      await supabase.from('trade_alerts').insert({ user_id: user.id, type, message, trade_details: tradeDetails || null, read: false });
    } catch (e) { console.error('Save alert error:', e); }
  }, [user?.id]);

  const markAlertRead = useCallback(async (alertId: string) => {
    try {
      await supabase.from('trade_alerts').update({ read: true }).eq('id', alertId);
      setTradeAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    } catch (e) { console.error('Mark read error:', e); }
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('trade_alerts').update({ read: true }).eq('user_id', user.id).eq('read', false);
      setTradeAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch (e) { console.error('Mark all read error:', e); }
  }, [user?.id]);

  const dismissPriceMovementAlert = useCallback((id: string) => {
    setPriceMovementAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  const dismissPriceAlertToast = useCallback((id: string) => {
    setPriceAlertToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const current = tvPrice > 0 ? tvPrice : (prices[selectedAsset.symbol]?.price || 0);
    if (!current) return;
    if (prevPriceRef.current && current !== prevPriceRef.current) {
      setPriceFlash(current > prevPriceRef.current ? 'up' : 'down');
      const t = setTimeout(() => setPriceFlash(null), 600);
      prevPriceRef.current = current;
      return () => clearTimeout(t);
    }
    prevPriceRef.current = current;
  }, [tvPrice, prices, selectedAsset.symbol]);

  useEffect(() => {
    if (!activeTrade) return;
    const duration = activeTrade.duration_seconds;
    setTradeCountdown(duration);
    const interval = setInterval(() => {
      setTradeCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); resolveTrade(activeTrade); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTrade]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveTrade = useCallback(async (trade: Trade) => {
    const currentPrices = pricesRef.current;
    const currentDemoBalance = demoBalanceRef.current;
    const currentRealBalance = realBalanceRef.current;
    const currentAsset = selectedAssetRef.current;

    const closePrice = tvPriceRef.current > 0
      ? tvPriceRef.current
      : (currentPrices[trade.asset_symbol]?.price || trade.entry_price);
    const priceChange = closePrice - trade.entry_price;
    const won = trade.direction === 'buy' ? priceChange > 0 : priceChange < 0;
    const randomWin = Math.random() > 0.45;
    const finalWon = won || randomWin ? (won ? true : randomWin) : false;
    const profit = finalWon ? trade.amount * (currentAsset.payout / 100) : -trade.amount;

    try {
      if (user) {
        await supabase.from('trades').update({ status: finalWon ? 'won' : 'lost', close_price: closePrice, profit_loss: profit, closed_at: new Date().toISOString() }).eq('id', trade.id);
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
          ? `🏆 WON! ${trade.direction.toUpperCase()} ${trade.asset_symbol} +$${profit.toFixed(2)}`
          : `😔 LOST! ${trade.direction.toUpperCase()} ${trade.asset_symbol} -$${Math.abs(profit).toFixed(2)}`;
        await saveTradeAlert(finalWon ? 'success' : 'error', alertMsg, { asset: trade.asset_symbol, direction: trade.direction, amount: trade.amount, profit, duration: durationLabel });
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
      if (notifCountdown <= 0) { clearInterval(notifInterval); setNotification(prev => ({ ...prev, visible: false })); }
    }, 1000);
  }, [user, loadHistory, saveTradeAlert]);

  const executeTrade = async (direction: 'buy' | 'sell') => {
    // Guard: user must be logged in with a valid id
    if (!user || !user.id) {
      await saveTradeAlert('error', 'Silakan login ulang untuk melakukan trade.');
      return;
    }
    if (isExecuting) return;
    const currentPrice = tvPriceRef.current > 0
      ? tvPriceRef.current
      : (prices[selectedAsset.symbol]?.price || 0);
    if (!currentPrice) return;
    const balance = accountType === 'demo' ? demoBalance : realBalance;
    if (tradeAmount > balance) { await saveTradeAlert('error', 'Insufficient balance to place this trade!'); return; }
    setIsExecuting(true);
    setConfirmModal({ visible: false, direction: null });
    try {
      const { data: tradeData, error } = await supabase.from('trades').insert({
        user_id: user.id, account_type: accountType, asset_symbol: selectedAsset.symbol,
        asset_name: selectedAsset.name, direction, amount: tradeAmount, entry_price: currentPrice,
        duration_seconds: DURATIONS[durationIdx].seconds, status: 'active',
      }).select().single();
      if (error) {
        console.error('Execute trade Supabase error:', error.code, error.message);
        if (error.code === '42501') {
          await saveTradeAlert('error', 'Akses ditolak (RLS 42501). Silakan logout dan login ulang.');
        } else if (error.code === '23503') {
          await saveTradeAlert('error', 'Profil akun belum siap. Silakan logout dan login ulang.');
        } else {
          await saveTradeAlert('error', `Gagal membuka trade: ${error.message}`);
        }
        setIsExecuting(false);
        return;
      }
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
      await saveTradeAlert('info', `⏱ Trade opened: ${direction.toUpperCase()} ${selectedAsset.symbol} $${tradeAmount} (${durationLabel})`, { asset: selectedAsset.symbol, direction, amount: tradeAmount, duration: durationLabel });
      setActiveTrade(tradeData as Trade);
    } catch (e) {
      console.error('Execute trade error:', e);
      await saveTradeAlert('error', `Failed to open trade: ${selectedAsset.symbol}`);
      setIsExecuting(false);
    }
  };

  const fetchExchangeRates = useCallback(async () => {
    if (exchangeRatesFetchedRef.current) return;
    setRatesLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Rate fetch failed');
      const data = await res.json();
      if (data.rates) { setExchangeRates(data.rates); exchangeRatesFetchedRef.current = true; }
    } catch {
      setExchangeRates({ USD: 1, EUR: 0.92, GBP: 0.79, MYR: 4.47, SGD: 1.34, THB: 35.1, PHP: 56.5, JPY: 149.5, AUD: 1.53, CNY: 7.24 });
      exchangeRatesFetchedRef.current = true;
    } finally { setRatesLoading(false); }
  }, []);

  const openDepositModal = useCallback(() => {
    setShowDepositModal(true); setDepositSuccess(''); setDepositError(''); setDepositAmount('');
    fetchExchangeRates();
  }, [fetchExchangeRates]);

  const depositAmountNum = parseFloat(depositAmount) || 0;
  const selectedCurrencyObj = CURRENCIES.find(c => c.code === depositCurrency) || CURRENCIES[0];
  const rateToUSD = depositCurrency === 'USD' ? 1 : (exchangeRates[depositCurrency] ? 1 / exchangeRates[depositCurrency] : 1);
  const depositAmountUSD = depositAmountNum * rateToUSD;
  const minDepositLocal = CURRENCY_MIN_DEPOSITS[depositCurrency] ?? CURRENCY_MIN_DEPOSITS['USD'];
  const isBelowMinimum = depositAmountNum > 0 && depositAmountNum < minDepositLocal;

  const CURRENCY_MAX_DEPOSITS: Record<string, number> = {
    MYR: 10000, USD: 2300, EUR: 2150, GBP: 1850, SGD: 3100,
    THB: 77000, PHP: 131000, JPY: 345000, AUD: 3500, CNY: 16700,
  };
  const maxDepositLocal = CURRENCY_MAX_DEPOSITS[depositCurrency] ?? 2300;
  const isAboveMaximum = depositAmountNum > 0 && depositAmountNum > maxDepositLocal;

  interface BankInfo {
    name: string;
    account: string;
    swift: string;
    flag: string;
  }
  const BANKS: Record<string, BankInfo[]> = {
    MYR: [
      { name: 'Maybank Malaysia', account: '5621 4890 2341', swift: 'MBBEMYKL', flag: '🇲🇾' },
      { name: 'CIMB Bank', account: '7012 3456 7890', swift: 'CIBBMYKL', flag: '🇲🇾' },
      { name: 'Public Bank', account: '3198 7654 3210', swift: 'PBBEMYKL', flag: '🇲🇾' },
      { name: 'RHB Bank', account: '2-12345-00012345-6', swift: 'RHBBMYKL', flag: '🇲🇾' },
      { name: 'Hong Leong Bank', account: '06200-00-12345', swift: 'HLBBMYKL', flag: '🇲🇾' },
      { name: 'AmBank', account: '8888-0123-4567-89', swift: 'ARBKMYKL', flag: '🇲🇾' },
      { name: 'Bank Islam Malaysia', account: '14-0123456-01-2', swift: 'BIMBMYKL', flag: '🇲🇾' },
      { name: 'OCBC Malaysia', account: '7-12345-67890-1', swift: 'OCBCMYKL', flag: '🇲🇾' },
    ],
    SGD: [
      { name: 'DBS Bank Singapore', account: '012-345678-9', swift: 'DBSSSGSG', flag: '🇸🇬' },
      { name: 'OCBC Bank Singapore', account: '501-123456-001', swift: 'OCBCSGSG', flag: '🇸🇬' },
      { name: 'UOB Bank Singapore', account: '123-456-789-0', swift: 'UOVBSGSG', flag: '🇸🇬' },
    ],
    USD: [
      { name: 'Bank of America', account: '4567 8901 2345', swift: 'BOFAUS3N', flag: '🇺🇸' },
      { name: 'Chase Bank (JPMorgan)', account: '7890 1234 5678', swift: 'CHASUS33', flag: '🇺🇸' },
      { name: 'Wells Fargo', account: '1234 5678 9012', swift: 'WFBIUS6S', flag: '🇺🇸' },
      { name: 'Citibank USA', account: '9012 3456 7890', swift: 'CITIUS33', flag: '🇺🇸' },
      { name: 'US Bank', account: '3456 7890 1234', swift: 'USBKUS44', flag: '🇺🇸' },
    ],
    THB: [
      { name: 'Bangkok Bank', account: '123-4-56789-0', swift: 'BKKBTHBK', flag: '🇹🇭' },
      { name: 'Kasikorn Bank (KBank)', account: '012-3-45678-9', swift: 'KASITHBK', flag: '🇹🇭' },
      { name: 'Siam Commercial Bank (SCB)', account: '234-5-67890-1', swift: 'SICOTHBK', flag: '🇹🇭' },
    ],
    PHP: [
      { name: 'BDO Unibank', account: '1234 5678 9012', swift: 'BNORPHMM', flag: '🇵🇭' },
      { name: 'Bank of the Philippine Islands (BPI)', account: '9876 5432 1098', swift: 'BOPIPHMM', flag: '🇵🇭' },
      { name: 'Metrobank Philippines', account: '5678 9012 3456', swift: 'MBTCPHMM', flag: '🇵🇭' },
    ],
    VND: [
      { name: 'Vietcombank', account: '0123456789012', swift: 'BFTVVNVX', flag: '🇻🇳' },
      { name: 'BIDV Vietnam', account: '1234567890123', swift: 'BIDVVNVX', flag: '🇻🇳' },
      { name: 'Techcombank', account: '9876543210987', swift: 'VTCBVNVX', flag: '🇻🇳' },
    ],
    AED: [
      { name: 'Emirates NBD', account: 'AE12 0260 0012 3456 7890 123', swift: 'EBILAEAD', flag: '🇦🇪' },
      { name: 'Dubai Islamic Bank', account: 'AE34 0240 0012 3456 7890 123', swift: 'DUIBAEAD', flag: '🇦🇪' },
      { name: 'Mashreq Bank', account: 'AE56 0330 0012 3456 7890 123', swift: 'BOMLAEAD', flag: '🇦🇪' },
    ],
    EUR: [
      { name: 'Deutsche Bank Germany', account: 'DE89 3704 0044 0532 0130 00', swift: 'DEUTDEDB', flag: '🇩🇪' },
      { name: 'HSBC UK', account: 'GB29 NWBK 6016 1331 9268 19', swift: 'HBUKGB4B', flag: '🇬🇧' },
      { name: 'BNP Paribas France', account: 'FR76 3000 6000 0112 3456 7890 189', swift: 'BNPAFRPP', flag: '🇫🇷' },
    ],
    GBP: [
      { name: 'HSBC UK', account: 'GB29 NWBK 6016 1331 9268 19', swift: 'HBUKGB4B', flag: '🇬🇧' },
      { name: 'Barclays Bank UK', account: 'GB60 BARC 2000 0055 7799 11', swift: 'BARCGB22', flag: '🇬🇧' },
      { name: 'Lloyds Bank UK', account: 'GB82 WEST 1234 5698 7654 32', swift: 'LOYDGB2L', flag: '🇬🇧' },
    ],
    AUD: [
      { name: 'Commonwealth Bank Australia', account: '062-000 12345678', swift: 'CTBAAU2S', flag: '🇦🇺' },
      { name: 'Westpac Banking', account: '032-001 123456', swift: 'WPACAU2S', flag: '🇦🇺' },
      { name: 'ANZ Bank Australia', account: '013-999 123456789', swift: 'ANZBAU3M', flag: '🇦🇺' },
    ],
    JPY: [
      { name: 'MUFG Bank Japan', account: '1234567', swift: 'BOTKJPJT', flag: '🇯🇵' },
      { name: 'Sumitomo Mitsui Bank', account: '7654321', swift: 'SMBCJPJT', flag: '🇯🇵' },
      { name: 'Mizuho Bank Japan', account: '9876543', swift: 'MHCBJPJT', flag: '🇯🇵' },
    ],
    CNY: [
      { name: 'Bank of China', account: '6217 0012 3456 7890', swift: 'BKCHCNBJ', flag: '🇨🇳' },
      { name: 'Industrial & Commercial Bank (ICBC)', account: '6222 0012 3456 7890', swift: 'ICBKCNBJ', flag: '🇨🇳' },
      { name: 'China Construction Bank', account: '6227 0012 3456 7890', swift: 'PCBCCNBJ', flag: '🇨🇳' },
    ],
  };

  const CRYPTO_WALLETS: Record<string, { address: string; network: string; icon: string }> = {
    USDT: { address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', network: 'TRC-20 (Tron)', icon: '💵' },
    BTC: { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', network: 'Bitcoin Network', icon: '₿' },
    ETH: { address: '0x742d35Cc6634C0532925a3b8D4C9C3E4F5a6b7c8', network: 'ERC-20 (Ethereum)', icon: '⟠' },
  };

  const handleDepositSubmit = async () => {
    if (!user) return;
    if (!depositAmount || isNaN(depositAmountNum) || depositAmountNum <= 0) { setDepositError('Please enter a valid deposit amount'); return; }
    if (depositAmountNum < minDepositLocal) { setDepositError(`Minimum deposit is ${selectedCurrencyObj.symbol}${minDepositLocal.toLocaleString()} ${depositCurrency}`); return; }
    if (isAboveMaximum) { setDepositError(`Maximum deposit is ${selectedCurrencyObj.symbol}${maxDepositLocal.toLocaleString()} ${depositCurrency}`); return; }

    if (depositTab === 'stripe') {
      setDepositLoading(true); setDepositError('');
      try {
        const res = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: depositAmountNum, currency: depositCurrency, depositTab: 'stripe' }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to create checkout session');
        if (data.url) window.location.href = data.url;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Payment failed. Please try again.';
        setDepositError(msg);
      } finally { setDepositLoading(false); }
      return;
    }

    setDepositLoading(true); setDepositError('');
    try {
      const notes = depositTab === 'bank'
        ? JSON.stringify({ currency: depositCurrency, bank: selectedBank })
        : JSON.stringify({ currency: depositCurrency, crypto: selectedCrypto });
      const { error } = await supabase.from('deposit_requests').insert({
        user_id: user.id,
        amount: depositAmountUSD,
        payment_method: depositTab === 'bank' ? 'bank_transfer' : 'crypto',
        account_type: 'real',
        status: 'pending',
        notes,
      });
      if (error) throw error;
      setDepositSuccess(`Your deposit request of ${selectedCurrencyObj.symbol}${depositAmountNum.toLocaleString()} ${depositCurrency} has been submitted. Our team will process it within 1–24 hours.`);
      setDepositAmount('');
    } catch (e) { setDepositError('Failed to submit deposit request. Please try again.'); }
    finally { setDepositLoading(false); }
  };

  const handleSettingsSave = () => {
    const amount = parseInt(settingsDefaultAmount);
    if (!isNaN(amount) && amount >= AMOUNT_MIN && amount <= AMOUNT_MAX) setTradeAmount(amount);
    setChartTimeframe(settingsDefaultTF);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleResendVerification = async () => {
    if (!user?.email || resendVerifyCooldown > 0 || resendVerifyLoading) return;
    setResendVerifyLoading(true); setResendVerifyMsg('');
    try {
      await resendVerificationEmail(user.email);
      setResendVerifyMsg('Verification email sent! Check your inbox.');
      setResendVerifyCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend. Please try again.';
      setResendVerifyMsg(msg);
    }
    finally { setResendVerifyLoading(false); }
  };

  const filteredAssets = useMemo(() => ASSETS.filter(a => {
    const matchCat = assetCategory === 'all' || a.category === assetCategory;
    const matchSearch = !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.symbol.toLowerCase().includes(assetSearch.toLowerCase());
    return matchCat && matchSearch;
  }), [assetCategory, assetSearch]);

  const searchFilteredAssets = useMemo(() => ASSETS.filter(a => {
    if (!debouncedSearchQuery) return true;
    const q = debouncedSearchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
  }), [debouncedSearchQuery]);

  const currentPrice = tvPrice > 0 ? tvPrice : (prices[selectedAsset.symbol]?.price || 0);
  const currentChange = tvPrice > 0 && tvChangePercent !== 0
    ? tvChangePercent
    : (prices[selectedAsset.symbol]?.change24h || 0);
  const balance = accountType === 'demo' ? demoBalance : realBalance;
  const absChange = currentPrice > 0 && currentChange !== 0
    ? Math.abs(currentChange * currentPrice / 100)
    : (tvChange !== 0 ? Math.abs(tvChange) : 0);
  const isEmailVerified = !!(user?.email_confirmed_at);

  const selectedPriceTs = priceTimestamps[selectedAsset.symbol];
  const secondsSinceUpdate = selectedPriceTs ? Math.floor((now - selectedPriceTs.lastUpdated) / 1000) : null;
  const isPriceTertunda = secondsSinceUpdate !== null && secondsSinceUpdate >= 30 && secondsSinceUpdate < 120;
  const isPriceKadaluarsa = secondsSinceUpdate !== null && secondsSinceUpdate >= 120;
  const isPriceInvalid = invalidPrices[selectedAsset.symbol] === true;
  const isTradingDisabled = isExecuting || !isEmailVerified || (isPriceKadaluarsa && tvPrice === 0);

  const activePriceMovementModal = priceMovementAlerts.find(a => !a.dismissed) || null;

  // NAV_ITEMS with translations
  const NAV_ITEMS = [
    {
      id: 'platform', label: t('bottomNav.platform'),
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
    },
    {
      id: 'penawaran', label: t('bottomNav.offers'),
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><path strokeLinecap="round" strokeLinejoin="round" d="M18 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2H3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 22V7" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>),
    },
    {
      id: 'robot', label: t('bottomNav.bot'),
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="8" width="18" height="12" rx="2" /><path strokeLinecap="round" d="M8 8V6a4 4 0 0110 0v2" /><circle cx="9" cy="14" r="1.5" fill="currentColor" /><circle cx="15" cy="14" r="1.5" fill="currentColor" /><path strokeLinecap="round" d="M12 22V7" /><path strokeLinecap="round" d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /><path strokeLinecap="round" d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>),
    },
    {
      id: 'dukungan', label: t('bottomNav.support'),
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><path strokeLinecap="round" strokeLinejoin="round" d="M18 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2H3z" /></svg>),
    },
    {
      id: 'akun', label: t('bottomNav.account'),
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b1e' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const renderPanelContent = () => {
    if (activeNav === 'platform') {
      return (
        <TradingViewChart
          ref={chartRef}
          tvSymbol={selectedAsset.tvSymbol}
          interval={TF_MAP[chartTimeframe] || '1'}
          theme={settingsChartTheme}
          onPriceUpdate={(price: number, change?: number, changePercent?: number) => {
            if (price > 0) {
              tvReceivedForCurrentAssetRef.current = true;
              if (tvFallbackTimerRef.current) {
                clearTimeout(tvFallbackTimerRef.current);
                tvFallbackTimerRef.current = null;
              }
              tvPriceRef.current = price;
              setTvPrice(price);
              if (changePercent !== undefined) setTvChangePercent(changePercent);
              if (change !== undefined) setTvChange(change);
              const sym = selectedAssetRef.current.symbol;
              setPrices(prev => ({
                ...prev,
                [sym]: {
                  ...prev[sym],
                  price,
                  prevPrice: prev[sym]?.price || price,
                  close: price,
                  change24h: changePercent !== undefined ? changePercent : (prev[sym]?.change24h || 0),
                },
              }));
              setPriceTimestamps(prev => ({
                ...prev,
                [sym]: { lastUpdated: Date.now(), lastValidPrice: price, isValid: true },
              }));
              setInvalidPrices(prev => ({ ...prev, [sym]: false }));
            }
          }}
        />
      );
    }
    if (activeNav === 'penawaran') {
      return (
        <div className="h-full overflow-y-auto p-3">
          <div className="text-white font-bold text-base mb-3">{t('offers.title')}</div>
          {(['crypto', 'forex', 'commodity', 'stock'] as const).map(cat => (
            <div key={cat} className="mb-4">
              <div className="text-gray-400 text-xs font-bold uppercase mb-2">
                {cat === 'commodity' ? t('offers.commodities') : cat === 'stock' ? t('offers.stocks') : cat === 'crypto' ? t('offers.crypto') : t('offers.forex')}
              </div>
              {ASSETS.filter(a => a.category === cat).map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setActiveNav('platform'); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl mb-1"
                    style={{ background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 44, cursor: 'pointer' }}
                  >
                    <div className="flex items-center gap-3">
                      <AssetIcon symbol={asset.symbol} size={36} />
                      <div className="text-left">
                        <div className="text-white text-sm font-bold">{asset.name}</div>
                        <div className="text-gray-400 text-xs">{asset.symbol}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm font-mono">{p ? formatPrice(p.price, asset.symbol) : '—'}</div>
                      <div className="text-xs font-bold" style={{ color: (p?.change24h || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {t('secondBar.payout')}: <span className="text-yellow-400">{asset.payout}%</span>
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
          <div className="text-5xl mb-4">🤖</div>
          <div className="text-white text-lg font-bold mb-2">{t('bot.title')}</div>
          <div className="text-gray-400 text-sm mb-6">{t('bot.desc')}</div>
          <div className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' }}>{t('bot.comingSoon')}</div>
        </div>
      );
    }
    if (activeNav === 'dukungan') {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="text-white font-bold text-base mb-4">{t('support.title')}</div>
          <div className="space-y-3">
            {[
              { icon: '💬', title: t('support.liveChat'), desc: t('support.liveChatDesc'), action: t('support.liveChatAction') },
              { icon: '📧', title: t('support.email'), desc: t('support.emailDesc'), action: t('support.emailAction') },
              { icon: '📚', title: t('support.guide'), desc: t('support.guideDesc'), action: t('support.guideAction') },
              { icon: '❓', title: t('support.faq'), desc: t('support.faqDesc'), action: t('support.faqAction') },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-2xl">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-white text-sm font-bold">{item.title}</div>
                  <div className="text-gray-400 text-xs">{item.desc}</div>
                </div>
                <button className="text-xs px-3 py-2 rounded-lg font-bold" style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa', minHeight: 44, minWidth: 80 }}>{item.action}</button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (activeNav === 'akun') {
      return (
        <div className="h-full overflow-y-auto p-4">
          <div className="text-white font-bold text-base mb-4">{t('account.title')}</div>
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
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-gray-400 text-xs mb-1">{t('account.demoBalance')}</div>
              <div className="text-white font-bold">${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="text-gray-400 text-xs mb-1">{t('account.realBalance')}</div>
              <div className="text-white font-bold">${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="text-white font-bold text-sm mb-3">{t('account.tradeHistory')}</div>
          {tradeHistory.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-6">{t('account.noHistory')}</div>
          ) : (
            <div className="space-y-2">
              {tradeHistory.map(trade => (
                <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="text-white text-sm font-bold">{trade.asset_symbol}</div>
                    <div className="text-gray-400 text-xs">{trade.direction.toUpperCase()} · {DURATIONS.find(d => d.seconds === trade.duration_seconds)?.label || trade.duration_seconds + 's'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: trade.status === 'won' ? '#22c55e' : trade.status === 'lost' ? '#ef4444' : '#eab308' }}>
                      {trade.status === 'won' ? '+' : trade.status === 'lost' ? '-' : ''}${Math.abs(trade.profit_loss || trade.amount).toFixed(2)}
                    </div>
                    <div className="text-xs" style={{ color: trade.status === 'won' ? '#22c55e' : trade.status === 'lost' ? '#ef4444' : '#eab308' }}>
                      {trade.status === 'won' ? t('tradeHistory.won') : trade.status === 'lost' ? t('tradeHistory.lost') : t('tradeHistory.active')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={async () => { await authSignOut(); router.push('/'); }} className="mt-4 w-full py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', minHeight: 44 }}>{t('account.signOut')}</button>
        </div>
      );
    }
    return null;
  };

  const renderNotifPanel = () => (
    <div ref={notifPanelRef} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, width: 340, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 60, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', animation: 'fadeInDown 0.2s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{t('notifications.title')}</span>
        {unreadCount > 0 && (<button onClick={markAllRead} style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, minHeight: 32 }}>{t('notifications.markAllRead')}</button>)}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {tradeAlerts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{t('notifications.noNotifications')}</div>
        ) : (
          tradeAlerts.map(alert => {
            const alertColors = { success: { dot: '#22c55e', bg: 'rgba(34,197,94,0.06)' }, error: { dot: '#ef4444', bg: 'rgba(239,68,68,0.06)' }, warning: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)' }, info: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)' } };
            const ac = alertColors[alert.type];
            return (
              <button key={alert.id} onClick={() => markAlertRead(alert.id)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: alert.read ? 'transparent' : ac.bg, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left', minHeight: 44 }}>
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

  const renderTopBar = () => (
    <div style={{ flexShrink: 0, background: '#0d0e23', borderBottom: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 1px 0 rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: isDesktop ? 16 : 10, paddingRight: isDesktop ? 16 : 10, zIndex: 20, position: 'relative', height: isDesktop ? 64 : 52 }}>
      <div ref={accountDropdownRef} style={{ position: 'relative' }}>
        <button onClick={() => setShowAccountDropdown(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 8 : 6, background: 'none', border: 'none', cursor: 'pointer', padding: isDesktop ? '8px 4px' : '4px 2px', minHeight: 44, minWidth: 44, borderRadius: 8 }}>
          <div style={{ width: isDesktop ? 32 : 28, height: isDesktop ? 32 : 28, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isDesktop ? 13 : 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{user?.email?.[0]?.toUpperCase() || 'U'}</div>
          <div style={{ textAlign: 'left', maxWidth: isDesktop ? 'none' : 90, overflow: 'hidden' }}>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: isDesktop ? 10 : 9, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accountType === 'demo' ? t('topBar.demoAccount') : t('topBar.realAccount')}</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: isDesktop ? 13 : 11, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showAccountDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, minWidth: 210, zIndex: 50, overflow: 'hidden', animation: 'fadeInDown 0.2s ease-out' }}>
            <button onClick={() => { setAccountType('demo'); setShowAccountDropdown(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }} className="hover:bg-white/5">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>D</div>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{t('topBar.demoAccount')}</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
              {accountType === 'demo' && <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 14 }}>✓</span>}
            </button>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
            <button onClick={() => { setAccountType('real'); setShowAccountDropdown(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }} className="hover:bg-white/5">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>R</div>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{t('topBar.realAccount')}</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
              {accountType === 'real' && <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: 14 }}>✓</span>}
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 8 : 5 }}>
        {/* Language Selector */}
        <div ref={langDropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLangDropdown(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: showLangDropdown ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showLangDropdown ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: isDesktop ? '0 10px' : '0 7px', height: isDesktop ? 36 : 32, cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0 }}
            title={t('language.select')}
          >
            <span style={{ fontSize: isDesktop ? 16 : 14 }}>{currentLangInfo.flag}</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{currentLangInfo.code.toUpperCase()}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showLangDropdown && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, width: isDesktop ? 200 : 180, maxHeight: isDesktop ? 320 : 260, overflowY: 'auto', zIndex: 60, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeInDown 0.2s ease-out' }}>
              <div style={{ padding: '8px 14px 4px', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('language.select')}</div>
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code); setShowLangDropdown(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: language === lang.code ? 'rgba(37,99,235,0.2)' : 'none', border: 'none', cursor: 'pointer', transition: 'background 0.1s ease' }}
                  className="hover:bg-white/5"
                >
                  <span style={{ fontSize: 16 }}>{lang.flag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 12, fontWeight: language === lang.code ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lang.nativeName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{lang.name}</div>
                  </div>
                  {language === lang.code && <span style={{ color: '#3b82f6', fontSize: 14 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotifPanel(v => !v)} style={{ width: isDesktop ? 44 : 36, height: isDesktop ? 44 : 36, borderRadius: 10, background: showNotifPanel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showNotifPanel ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`, color: unreadCount > 0 ? '#fff' : 'rgba(255,255,255,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
            <BellIcon hasUnread={unreadCount > 0} />
            {unreadCount > 0 && (<div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #0d0e23', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>)}
          </button>
          {showNotifPanel && renderNotifPanel()}
        </div>
        <button onClick={openDepositModal} style={{ background: '#3b4264', color: '#fff', fontSize: isDesktop ? 13 : 11, fontWeight: 700, padding: isDesktop ? '0 18px' : '0 10px', height: isDesktop ? 44 : 36, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s ease, transform 0.1s ease, opacity 0.15s ease', whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#4a5380'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#3b4264'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >{t('topBar.deposit')}</button>
      </div>
    </div>
  );

  const renderSecondBar = () => (
    <div style={{ flexShrink: 0, background: '#0d0e23', borderBottom: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 1px 0 rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', zIndex: 19, position: 'relative' }}>
      {/* Mobile: 2-row layout to avoid text overlap */}
      {!isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 8px 4px' }}>
          {/* Row 1: Asset name + payout + dropdown arrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
            <div ref={assetDropdownRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button onClick={() => setShowAssetDropdown(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', minHeight: 36, borderRadius: 8, maxWidth: '100%' }}>
                <AssetIcon symbol={selectedAsset.symbol} size={20} />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{selectedAsset.name}</span>
                <span style={{ color: '#f97316', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>{selectedAsset.payout}%</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showAssetDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#12132a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 300, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'slideUpPanel 0.25s ease-out' }}>
                  <div style={{ padding: '10px 16px 4px', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('secondBar.allAssets')}</div>
                  {searchFilteredAssets.map(asset => {
                    const p = prices[asset.symbol];
                    return (
                      <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setActiveNav('platform'); setShowAssetDropdown(false); setAssetSearch(''); setDebouncedSearchQuery(''); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', minHeight: 56 }} className="hover:bg-white/5">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <AssetIcon symbol={asset.symbol} size={36} />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{asset.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{asset.symbol} &bull; {asset.category === 'commodity' ? t('offers.commodities') : asset.category === 'stock' ? t('offers.stocks') : asset.category === 'crypto' ? t('offers.crypto') : t('offers.forex')}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{p ? formatPrice(p.price, asset.symbol) : '—'}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>{t('secondBar.payout')} {asset.payout}%</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button onClick={() => { setShowSearchModal(true); setSearchQuery(''); setDebouncedSearchQuery(''); }} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8 }} className="hover:text-white" title={t('secondBar.searchAssets')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>
              <button onClick={() => setChartTimeframe(chartTimeframe === '1m' ? '30m' : chartTimeframe === '30m' ? '1h' : '1m')} style={{ background: '#1e2139', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 8px', height: 28, minWidth: 36, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', flexShrink: 0 }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; setPressedBtn('dur-chip'); }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; setPressedBtn(null); }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setPressedBtn(null); }}
              >{chartTimeframe}</button>
            </div>
          </div>
          {/* Row 2: Price + change */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 4, minHeight: 24 }}>
            <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13, color: priceFlash === 'up' ? '#22c55e' : priceFlash === 'down' ? '#ef4444' : '#ffffff', transition: 'color 0.3s ease', whiteSpace: 'nowrap' }}>
              {currentPrice > 0 ? formatPrice(currentPrice, selectedAsset.symbol) : '—'}
            </span>
            {isPriceInvalid && (
              <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '1px 4px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.4)', flexShrink: 0 }}>{t('priceStatus.invalid')}</span>
            )}
            {currentPrice > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: currentChange >= 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>{currentChange >= 0 ? '+' : '-'}{absChange.toFixed(2)} ({currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)}%)</span>
            )}
            {activeTrade && <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(234,179,8,0.2)', color: '#eab308', padding: '1px 5px', borderRadius: 999, flexShrink: 0 }}>⏱ {tradeCountdown}s</span>}
          </div>
        </div>
      ) : (
        /* Desktop: original single-row layout */
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48 }}>
          <div ref={assetDropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowAssetDropdown(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', minHeight: 44, borderRadius: 8 }}>
              <AssetIcon symbol={selectedAsset.symbol} size={22} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{selectedAsset.name}</span>
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: 14 }}>{selectedAsset.payout}%</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showAssetDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#12132a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 320, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'slideUpPanel 0.25s ease-out' }}>
                <div style={{ padding: '10px 16px 4px', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('secondBar.allAssets')}</div>
                {searchFilteredAssets.map(asset => {
                  const p = prices[asset.symbol];
                  return (
                    <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setActiveNav('platform'); setShowAssetDropdown(false); setAssetSearch(''); setDebouncedSearchQuery(''); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', minHeight: 56 }} className="hover:bg-white/5">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AssetIcon symbol={asset.symbol} size={36} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{asset.name}</div>
                          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{asset.symbol} &bull; {asset.category === 'commodity' ? t('offers.commodities') : asset.category === 'stock' ? t('offers.stocks') : asset.category === 'crypto' ? t('offers.crypto') : t('offers.forex')}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{p ? formatPrice(p.price, asset.symbol) : '—'}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>{t('secondBar.payout')} {asset.payout}%</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15, color: priceFlash === 'up' ? '#22c55e' : priceFlash === 'down' ? '#ef4444' : '#ffffff', transition: 'color 0.3s ease' }}>
              {currentPrice > 0 ? formatPrice(currentPrice, selectedAsset.symbol) : '—'}
            </span>
            {isPriceInvalid && (
              <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 5px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.4)' }}>{t('priceStatus.invalid')}</span>
            )}
            {currentPrice > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: currentChange >= 0 ? '#22c55e' : '#ef4444' }}>{currentChange >= 0 ? '+' : '-'}{absChange.toFixed(2)} ({currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)}%)</span>
            )}
            {activeTrade && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.2)', color: '#eab308', padding: '2px 6px', borderRadius: 999 }}>⏱ {tradeCountdown}s</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setShowSearchModal(true); setSearchQuery(''); setDebouncedSearchQuery(''); }} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8 }} className="hover:text-white" title={t('secondBar.searchAssets')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button onClick={() => setShowSettingsModal(true)} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8 }} className="hover:text-white" title={t('secondBar.settings')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 0118 0v6" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2H3z" /></svg>
            </button>
            <button onClick={() => setChartTimeframe(chartTimeframe === '1m' ? '30m' : chartTimeframe === '30m' ? '1h' : '1m')} style={{ background: '#1e2139', color: '#fff', fontSize: 12, fontWeight: 700, padding: '0 12px', height: 36, minWidth: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; setPressedBtn('dur-chip'); }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; setPressedBtn(null); }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setPressedBtn(null); }}
            >{chartTimeframe}</button>
          </div>
        </div>
      )}
      {(isPriceTertunda || isPriceKadaluarsa) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 6px', background: isPriceKadaluarsa ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', borderTop: `1px solid ${isPriceKadaluarsa ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>{isPriceKadaluarsa ? '🔴' : '⚠️'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isPriceKadaluarsa ? '#ef4444' : '#f59e0b' }}>
              {isPriceKadaluarsa ? t('priceStatus.expired') : t('priceStatus.delayed')}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              ({secondsSinceUpdate !== null ? (secondsSinceUpdate >= 60 ? `${Math.floor(secondsSinceUpdate / 60)}m ${secondsSinceUpdate % 60}s` : `${secondsSinceUpdate}s`) : '—'} {t('priceStatus.ago')})
            </span>
          </div>
          <button
            onClick={manualRefreshPrices}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: isPriceKadaluarsa ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', border: `1px solid ${isPriceKadaluarsa ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`, color: isPriceKadaluarsa ? '#ef4444' : '#f59e0b', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t('priceStatus.refresh')}
          </button>
        </div>
      )}
    </div>
  );

  const renderBottomTradePanel = (panelHeight: number = 120) => (
    <div style={{ height: panelHeight, flexShrink: 0, background: '#0a0c1f', borderTop: '2px solid rgba(255,255,255,0.10)', boxShadow: '0 -4px 16px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: panelHeight === 150 ? 76 : 62, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', borderRight: '1px solid rgba(255,255,255,0.07)', gap: 3 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>{t('tradePanel.duration')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setDurationIdx(Math.max(0, durationIdx - 1))} onMouseDown={() => setPressedBtn('dur-minus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('dur-minus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'dur-minus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'dur-minus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>−</button>
            <div style={{ flex: 1, height: 36, borderRadius: 8, background: '#1e2139', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{DURATIONS[durationIdx].label}</div>
            <button onClick={() => setDurationIdx(Math.min(DURATIONS.length - 1, durationIdx + 1))} onMouseDown={() => setPressedBtn('dur-plus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('dur-plus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'dur-plus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'dur-plus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', gap: 3 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>{t('tradePanel.amount')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setTradeAmount(prev => Math.max(AMOUNT_MIN, prev - (prev >= 100 ? 50 : 10)))} onMouseDown={() => setPressedBtn('amt-minus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('amt-minus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'amt-minus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'amt-minus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>−</button>
            <div style={{ flex: 1, height: 36, borderRadius: 8, background: '#1e2139', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>${tradeAmount.toLocaleString()}</div>
            <button onClick={() => setTradeAmount(prev => Math.min(AMOUNT_MAX, prev + (prev >= 100 ? 50 : 10)))} onMouseDown={() => setPressedBtn('amt-plus')} onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)} onTouchStart={() => setPressedBtn('amt-plus')} onTouchEnd={() => setPressedBtn(null)} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: pressedBtn === 'amt-plus' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: pressedBtn === 'amt-plus' ? 'scale(0.92)' : 'scale(1)', transition: 'background 0.1s ease, transform 0.1s ease' }}>+</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0, gap: 8, padding: '6px 12px' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => !isTradingDisabled && setConfirmModal({ visible: true, direction: 'sell' })}
            disabled={isTradingDisabled}
            onMouseDown={() => !isTradingDisabled && setPressedBtn('sell')}
            onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)}
            onTouchStart={() => !isTradingDisabled && setPressedBtn('sell')}
            onTouchEnd={() => setPressedBtn(null)}
            title={isPriceKadaluarsa && tvPrice === 0 ? t('tradePanel.priceUnavailable') : !isEmailVerified ? t('tradePanel.emailVerificationRequired') : undefined}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: !isEmailVerified ? '#4b1c1c' : (isPriceKadaluarsa && tvPrice === 0) ? '#3d1515' : isExecuting ? '#7f1d1d' : '#dc2626', opacity: isTradingDisabled ? 0.5 : 1, border: 'none', cursor: isTradingDisabled ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700, borderRadius: 10, padding: '8px 12px', transform: pressedBtn === 'sell' ? 'scale(0.96)' : 'scale(1)', transition: 'background 0.15s ease, transform 0.1s ease, opacity 0.15s ease' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            <span style={{ fontSize: 14, letterSpacing: '0.08em' }}>{t('tradePanel.sell')}</span>
          </button>
          {isPriceKadaluarsa && tvPrice === 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: 'rgba(239,68,68,0.95)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{t('tradePanel.priceUnavailable')}</div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => !isTradingDisabled && setConfirmModal({ visible: true, direction: 'buy' })}
            disabled={isTradingDisabled}
            onMouseDown={() => !isTradingDisabled && setPressedBtn('buy')}
            onMouseUp={() => setPressedBtn(null)} onMouseLeave={() => setPressedBtn(null)}
            onTouchStart={() => !isTradingDisabled && setPressedBtn('buy')}
            onTouchEnd={() => setPressedBtn(null)}
            title={isPriceKadaluarsa && tvPrice === 0 ? t('tradePanel.priceUnavailable') : !isEmailVerified ? t('tradePanel.emailVerificationRequired') : undefined}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: !isEmailVerified ? '#14391f' : (isPriceKadaluarsa && tvPrice === 0) ? '#0f2d1a' : isExecuting ? '#14532d' : '#16a34a', opacity: isTradingDisabled ? 0.5 : 1, border: 'none', cursor: isTradingDisabled ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700, borderRadius: 10, padding: '8px 12px', transform: pressedBtn === 'buy' ? 'scale(0.96)' : 'scale(1)', transition: 'background 0.15s ease, transform 0.1s ease, opacity 0.15s ease' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            <span style={{ fontSize: 14, letterSpacing: '0.08em' }}>{t('tradePanel.buy')}</span>
          </button>
          {isPriceKadaluarsa && tvPrice === 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: 'rgba(239,68,68,0.95)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{t('tradePanel.priceUnavailable')}</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDesktopSidebar = () => (
    <div style={{ width: 70, flexShrink: 0, background: '#0d0e23', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, paddingBottom: 12, gap: 4, overflowY: 'auto' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 8 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 00-2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
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

  const renderSearchModal = () => (
    <ModalOverlay onClose={() => { setShowSearchModal(false); setSearchQuery(''); setDebouncedSearchQuery(''); }}>
      <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUpPanel 0.25s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.08) 100%)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={searchInputRef} type="text" placeholder={t('search.placeholder')} value={searchQuery} onChange={e => handleSearchChange(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, fontWeight: 500 }} />
          <button onClick={() => { setShowSearchModal(false); setSearchQuery(''); setDebouncedSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {searchFilteredAssets.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{t('search.noResults')} &quot;{searchQuery}&quot;</div>
          ) : (
            <>
              {!debouncedSearchQuery && <div style={{ padding: '10px 16px 4px', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('search.allAssets')}</div>}
              {searchFilteredAssets.map(asset => {
                const p = prices[asset.symbol];
                return (
                  <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setActiveNav('platform'); setShowSearchModal(false); setSearchQuery(''); setDebouncedSearchQuery(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: selectedAsset.symbol === asset.symbol ? 'rgba(37,99,235,0.15)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', minHeight: 56 }} className="hover:bg-white/5">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AssetIcon symbol={asset.symbol} size={36} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{asset.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{asset.symbol} &bull; {asset.category === 'commodity' ? t('offers.commodities') : asset.category === 'stock' ? t('offers.stocks') : asset.category === 'crypto' ? t('offers.crypto') : t('offers.forex')}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{p ? formatPrice(p.price, asset.symbol) : '—'}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>{t('secondBar.payout')} {asset.payout}%</div>
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

  const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: t('deposit.bankTransfer'), icon: '🏦', info: t('deposit.bankTransferInfo') },
    { id: 'credit_card', label: t('deposit.creditCard'), icon: '💳', info: t('deposit.creditCardInfo') },
    { id: 'crypto', label: t('deposit.crypto'), icon: '₿', info: t('deposit.cryptoInfo') },
  ] as const;

  const renderDepositModal = () => {
    const banksForCurrency = BANKS[depositCurrency] ?? BANKS['USD'];
    const filteredBanks = bankSearch
      ? banksForCurrency.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
      : banksForCurrency;
    const selectedBankInfo = banksForCurrency.find(b => b.name === selectedBank);
    const cryptoWallet = CRYPTO_WALLETS[selectedCrypto];

    // Payment methods per currency (no emojis)
    const getPaymentMethods = () => {
      const base = [{ key: 'card', label: 'Kartu Kredit / Debit', sub: 'Visa, Mastercard, Amex' }];
      if (depositCurrency === 'MYR') return [
        ...base,
        { key: 'fpx', label: 'FPX Online Banking', sub: 'Maybank, CIMB, RHB, dll' },
        { key: 'touchngo', label: "Touch 'n Go eWallet", sub: "Touch 'n Go eWallet" },
        { key: 'grabpay', label: 'GrabPay', sub: 'GrabPay Malaysia' },
      ];
      if (depositCurrency === 'SGD') return [
        ...base,
        { key: 'paynow', label: 'PayNow', sub: 'PayNow Singapore' },
        { key: 'grabpay', label: 'GrabPay', sub: 'GrabPay Singapore' },
      ];
      if (depositCurrency === 'THB') return [
        ...base,
        { key: 'promptpay', label: 'PromptPay', sub: 'PromptPay Thailand' },
        { key: 'grabpay', label: 'GrabPay', sub: 'GrabPay Thailand' },
      ];
      if (depositCurrency === 'PHP') return [
        ...base,
        { key: 'gcash', label: 'GCash', sub: 'GCash Philippines' },
        { key: 'grabpay', label: 'GrabPay', sub: 'GrabPay Philippines' },
      ];
      if (depositCurrency === 'CNY') return [
        { key: 'card', label: 'Kartu Kredit / Debit', sub: 'Visa, Mastercard' },
        { key: 'alipay', label: 'Alipay', sub: 'Alipay China/Global' },
        { key: 'wechatpay', label: 'WeChat Pay', sub: 'WeChat Pay China' },
      ];
      if (depositCurrency === 'USD' || depositCurrency === 'EUR') return [
        ...base,
        { key: 'alipay', label: 'Alipay', sub: 'Alipay Global' },
      ];
      return base;
    };

    const paymentMethods = getPaymentMethods();
    const [selectedPaymentMethod, setSelectedPaymentMethodLocal] = React.useState(paymentMethods[0]?.key || 'card');

    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) { setProofError('Format file tidak didukung. Gunakan JPG, PNG, atau PDF.'); return; }
      if (file.size > 5 * 1024 * 1024) { setProofError('Ukuran file maksimal 5MB.'); return; }
      setProofError('');
      setProofFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => setProofPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setProofPreview('pdf');
      }
    };

    const isSubmitDisabled = depositLoading || proofUploading || isBelowMinimum || isAboveMaximum ||
      (depositTab === 'bank' && !selectedBank);

    return (
      <ModalOverlay onClose={() => { setShowDepositModal(false); setDepositSuccess(''); setDepositError(''); setShowCurrencyDropdown(false); setShowBankDropdown(false); setProofFile(null); setProofPreview(null); setProofError(''); }}>
        <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', animation: 'slideUpPanel 0.3s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 25px 80px rgba(0,0,0,0.9)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>Deposit Dana</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 }}>Tambah saldo ke akun Real trading</div>
              </div>
            </div>
            <button onClick={() => { setShowDepositModal(false); setDepositSuccess(''); setDepositError(''); setShowCurrencyDropdown(false); setShowBankDropdown(false); setProofFile(null); setProofPreview(null); setProofError(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, lineHeight: 1, borderRadius: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {depositSuccess ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Permintaan Terkirim</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7, marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>{depositSuccess}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {depositReceiptId && (
                    <button onClick={() => { setShowDepositModal(false); setDepositSuccess(''); router.push(`/receipt/${depositReceiptId}`); }} style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Lihat Bukti</button>
                  )}
                  <button onClick={() => { setShowDepositModal(false); setDepositSuccess(''); }} style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Tutup</button>
                </div>
              </div>
            ) : (
              <>
                {/* Real Account Badge */}
                <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 13 }}>Real Account</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>Deposit dikreditkan ke saldo Real Account</div>
                  </div>
                </div>

                {/* 3-Tab Navigation */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 20, padding: 3, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {([['stripe', 'Instant Payment'], ['bank', 'Bank Transfer'], ['crypto', 'Crypto']] as const).map(([tab, label]) => (
                    <button key={tab} onClick={() => { setDepositTab(tab); setDepositError(''); }}
                      style={{ padding: '9px 6px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s ease', background: depositTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent', color: depositTab === tab ? '#fff' : 'rgba(255,255,255,0.4)', borderBottom: depositTab === tab ? '2px solid #3b82f6' : '2px solid transparent' }}
                    >{label}</button>
                  ))}
                </div>

                {/* Amount + Currency Section */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Jumlah Deposit</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {/* Currency Selector */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); setShowCurrencyDropdown(v => !v); setShowBankDropdown(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 50, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 16 }}>{selectedCurrencyObj.flag}</span>
                        <span>{depositCurrency}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {showCurrencyDropdown && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, zIndex: 200, minWidth: 200, maxHeight: 260, overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                          {CURRENCIES.map(cur => (
                            <button key={cur.code} onClick={() => { setDepositCurrency(cur.code); setShowCurrencyDropdown(false); setSelectedBank(''); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: depositCurrency === cur.code ? 'rgba(59,130,246,0.15)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                              <span style={{ fontSize: 16 }}>{cur.flag}</span>
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{cur.code}</div>
                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{cur.name}</div>
                              </div>
                              {depositCurrency === cur.code && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Amount Input */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="text" inputMode="numeric" placeholder="0" value={depositAmount}
                        onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setDepositAmount(raw); setDepositError(''); }}
                        style={{ width: '100%', height: 50, padding: '0 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${depositError && !depositAmount ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, color: '#fff', fontSize: 20, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}
                      />
                      {depositAmountNum > 0 && (
                        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 600 }}>{selectedCurrencyObj.symbol}</div>
                      )}
                    </div>
                  </div>

                  {/* USD Equivalent */}
                  {depositAmountNum > 0 && (
                    <div style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ratesLoading ? <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Memuat kurs...</span> : (
                        <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>≈ ${depositAmountUSD.toFixed(2)} USD{depositCurrency !== 'USD' && exchangeRates[depositCurrency] && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 400, marginLeft: 6 }}>(1 {depositCurrency} = ${(1 / exchangeRates[depositCurrency]).toFixed(4)})</span>}</span>
                      )}
                    </div>
                  )}

                  {/* Quick Amount Buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(CURRENCY_QUICK_AMOUNTS[depositCurrency] ?? CURRENCY_QUICK_AMOUNTS['USD']).map(amt => (
                      <button key={amt} onClick={() => { setDepositAmount(String(amt)); setDepositError(''); }}
                        style={{ padding: '6px 12px', borderRadius: 7, background: depositAmountNum === amt ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${depositAmountNum === amt ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, color: depositAmountNum === amt ? '#60a5fa' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {selectedCurrencyObj.symbol}{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── STRIPE TAB ── */}
                {depositTab === 'stripe' && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Metode Pembayaran</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {paymentMethods.map((pm) => (
                        <button
                          key={pm.key}
                          onClick={() => setSelectedPaymentMethodLocal(pm.key)}
                          style={{ padding: '12px 14px', borderRadius: 10, background: selectedPaymentMethod === pm.key ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedPaymentMethod === pm.key ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left' }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {pm.key === 'card' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>}
                            {pm.key === 'fpx' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M3 2v20c0 1.105 1.095 2 2 2h14c0.905 0 2-0.895 2-2V4c0-1.105-1.095-2-2-2H5c-0.905 0-2 0.895-2 2z" /></svg>}
                            {pm.key === 'touchngo' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><path d="M9 17v-3" /><path d="M15 17v-3" /></svg>}
                            {pm.key === 'grabpay' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /><path d="M12 14l-4-4 4-4 4 4-4 4z" /></svg>}
                            {pm.key === 'paynow' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
                            {pm.key === 'promptpay' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
                            {pm.key === 'gcash' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
                            {pm.key === 'alipay' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 12h8" /></svg>}
                            {pm.key === 'wechatpay' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>{pm.label}</div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{pm.sub}</div>
                          </div>
                          {selectedPaymentMethod === pm.key && (
                            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 12 }}>Pembayaran Aman via Stripe</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 1 }}>256-bit SSL · PCI DSS compliant · Update saldo instan</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BANK TRANSFER TAB ── */}
                {depositTab === 'bank' && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pilih Bank</div>
                    {/* Bank Dropdown */}
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <button onClick={e => { e.stopPropagation(); setShowBankDropdown(v => !v); setShowCurrencyDropdown(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 50, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500, fontSize: 13, color: selectedBank ? '#fff' : 'rgba(255,255,255,0.35)' }}>{selectedBank || 'Pilih bank...'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {showBankDropdown && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, zIndex: 200, maxHeight: 260, overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: '#0a0a0a' }}>
                            <input type="text" placeholder="Cari bank..." value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, outline: 'none' }} />
                          </div>
                          {filteredBanks.length === 0 ? (
                            <div style={{ padding: '14px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Bank tidak ditemukan</div>
                          ) : filteredBanks.map(bank => (
                            <button key={bank.name} onClick={() => { setSelectedBank(bank.name); setShowBankDropdown(false); setBankSearch(''); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: selectedBank === bank.name ? 'rgba(59,130,246,0.12)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                              <span style={{ fontSize: 16 }}>{bank.flag}</span>
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>{bank.name}</div>
                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>SWIFT: {bank.swift}</div>
                              </div>
                              {selectedBank === bank.name && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bank Details Card */}
                    {selectedBankInfo && (
                      <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 14 }}>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Detail Transfer</div>
                        {[
                          { label: 'Nama Bank', value: selectedBankInfo.name },
                          { label: 'Nomor Rekening', value: selectedBankInfo.account },
                          { label: 'Nama Pemilik', value: 'Investoft International Ltd' },
                          { label: 'SWIFT / BIC', value: selectedBankInfo.swift },
                          { label: 'Jumlah', value: `${selectedCurrencyObj.symbol}${depositAmountNum > 0 ? depositAmountNum.toLocaleString() : '—'} ${depositCurrency}` },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{label}</span>
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: 12, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all', fontFamily: 'monospace' }}>{value}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', marginTop: 4 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.6 }}>Setelah transfer, kirim formulir ini. Sertakan email akun Anda sebagai referensi. Waktu proses: 1–24 jam.</div>
                        </div>
                      </div>
                    )}
                    {!selectedBankInfo && (
                      <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center', marginBottom: 14 }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} style={{ margin: '0 auto 8px', display: 'block' }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Pilih bank di atas untuk melihat detail transfer</div>
                      </div>
                    )}

                    {/* Proof Upload */}
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Bukti Transfer (Opsional)</div>
                      {proofPreview ? (
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          {proofPreview === 'pdf' ? (
                            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                              <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 500 }}>{proofFile?.name}</span>
                              <button onClick={() => { setProofFile(null); setProofPreview(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <img src={proofPreview} alt="Bukti transfer" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                              <button onClick={() => { setProofFile(null); setProofPreview(null); }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', cursor: 'pointer', gap: 8 }}>
                          <input type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" onChange={handleProofFileChange} style={{ display: 'none' }} />
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Upload bukti transfer (JPG, PNG, PDF — maks 5MB)</span>
                        </label>
                      )}
                      {proofError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{proofError}</div>}
                    </div>
                  </div>
                )}

                {/* ── CRYPTO TAB ── */}
                {depositTab === 'crypto' && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pilih Cryptocurrency</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {(['USDT', 'BTC', 'ETH'] as const).map(coin => (
                        <button key={coin} onClick={() => setSelectedCrypto(coin)}
                          style={{ padding: '12px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', background: selectedCrypto === coin ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)', borderWidth: 1, borderStyle: 'solid', borderColor: selectedCrypto === coin ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)' }}>
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{CRYPTO_WALLETS[coin].icon}</div>
                          <div style={{ color: selectedCrypto === coin ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 13 }}>{coin}</div>
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 14 }}>
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Detail Wallet</div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 3 }}>Jaringan</div>
                        <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13 }}>{cryptoWallet.network}</div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 6 }}>Alamat Wallet</div>
                        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#fff', fontWeight: 500, fontSize: 11, flex: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}>{cryptoWallet.address}</span>
                          <button onClick={() => { navigator.clipboard.writeText(cryptoWallet.address); }} style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 5, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Salin</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.6 }}>Hanya kirim {selectedCrypto} di jaringan {cryptoWallet.network}. Mengirim koin lain dapat mengakibatkan kehilangan permanen. Min. 2 konfirmasi jaringan.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {depositError && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 500 }}>{depositError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleDepositSubmit}
                  disabled={isSubmitDisabled}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 10, background: isSubmitDisabled ? 'rgba(255,255,255,0.06)' : '#2563eb', color: isSubmitDisabled ? 'rgba(255,255,255,0.25)' : '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: isSubmitDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease', letterSpacing: '-0.2px' }}
                >
                  {depositLoading || proofUploading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      {depositTab === 'stripe' ? 'Mengarahkan ke Stripe...' : proofUploading ? 'Mengunggah bukti...' : 'Memproses...'}
                    </span>
                  ) : depositTab === 'stripe' ? (
                    `Bayar Sekarang${depositAmountNum > 0 ? ` — ${selectedCurrencyObj.symbol}${depositAmountNum.toLocaleString()} ${depositCurrency}` : ''}`
                  ) : depositTab === 'bank' ? (
                    `Kirim Permintaan Transfer${depositAmountNum > 0 ? ` — ${selectedCurrencyObj.symbol}${depositAmountNum.toLocaleString()}` : ''}`
                  ) : (
                    `Konfirmasi Pengiriman ${selectedCrypto}${depositAmountNum > 0 ? ` — ${selectedCurrencyObj.symbol}${depositAmountNum.toLocaleString()}` : ''}`
                  )}
                </button>

                {depositTab === 'stripe' && (
                  <div style={{ textAlign: 'center', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Powered by Stripe · Secured with 256-bit SSL</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </ModalOverlay>
    );
  };

  const renderWithdrawModal = () => {
    const withdrawAmountNum = parseFloat(withdrawAmount) || 0;
    const isWithdrawDisabled = withdrawLoading || withdrawAmountNum <= 0 || withdrawAmountNum < 100 || withdrawAmountNum > realBalance ||
      (withdrawMethod === 'bank' && (!withdrawBankName.trim() || !withdrawBankAccount.trim() || !withdrawBankHolder.trim())) ||
      (withdrawMethod === 'crypto' && !withdrawCryptoAddress.trim());

    return (
      <ModalOverlay onClose={() => { setShowWithdrawModal(false); setWithdrawSuccess(''); setWithdrawError(''); setWithdrawReceiptId(''); }}>
        <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', animation: 'slideUpPanel 0.3s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 25px 80px rgba(0,0,0,0.9)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>Tarik Dana</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 }}>Penarikan dari Real Account</div>
              </div>
            </div>
            <button onClick={() => { setShowWithdrawModal(false); setWithdrawSuccess(''); setWithdrawError(''); setWithdrawReceiptId(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {withdrawSuccess ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Permintaan Terkirim</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7, marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>{withdrawSuccess}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {withdrawReceiptId && (
                    <button onClick={() => { setShowWithdrawModal(false); setWithdrawSuccess(''); router.push(`/receipt/${withdrawReceiptId}`); }} style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Lihat Bukti</button>
                  )}
                  <button onClick={() => { setShowWithdrawModal(false); setWithdrawSuccess(''); }} style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Tutup</button>
                </div>
              </div>
            ) : (
              <>
                {/* Balance Info */}
                <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 3 }}>Saldo Real Account</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                </div>

                {/* Amount */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Jumlah Penarikan (USD)</div>
                  <input
                    type="text" inputMode="numeric" placeholder="Min. $100"
                    value={withdrawAmount}
                    onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); setWithdrawAmount(raw); setWithdrawError(''); }}
                    style={{ width: '100%', height: 50, padding: '0 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  {withdrawAmountNum > 0 && withdrawAmountNum < 100 && (
                    <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 6 }}>Minimum penarikan adalah $100 USD</div>
                  )}
                  {withdrawAmountNum > realBalance && (
                    <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>Saldo tidak mencukupi</div>
                  )}
                </div>

                {/* Method Tabs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 20, padding: 3, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {([['bank', 'Transfer Bank'], ['crypto', 'Cryptocurrency']] as const).map(([m, label]) => (
                    <button key={m} onClick={() => { setWithdrawMethod(m); setWithdrawError(''); }}
                      style={{ padding: '9px 6px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: withdrawMethod === m ? 'rgba(255,255,255,0.1)' : 'transparent', color: withdrawMethod === m ? '#fff' : 'rgba(255,255,255,0.4)', borderBottom: withdrawMethod === m ? '2px solid #3b82f6' : '2px solid transparent' }}
                    >{label}</button>
                  ))}
                </div>

                {/* Bank Form */}
                {withdrawMethod === 'bank' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Nama Bank', value: withdrawBankName, setter: setWithdrawBankName, placeholder: 'Contoh: Maybank Malaysia' },
                      { label: 'Nomor Rekening', value: withdrawBankAccount, setter: setWithdrawBankAccount, placeholder: 'Contoh: 1234 5678 9012' },
                      { label: 'Nama Pemilik Rekening', value: withdrawBankHolder, setter: setWithdrawBankHolder, placeholder: 'Nama sesuai buku tabungan' },
                      { label: 'SWIFT / BIC Code (Opsional)', value: withdrawSwift, setter: setWithdrawSwift, placeholder: 'Contoh: MBBEMYKL' },
                    ].map(({ label, value, setter, placeholder }) => (
                      <div key={label}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{label}</div>
                        <input
                          type="text" value={value} placeholder={placeholder}
                          onChange={e => { setter(e.target.value); setWithdrawError(''); }}
                          style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Crypto Form */}
                {withdrawMethod === 'crypto' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Jaringan</div>
                      <select
                        value={withdrawCryptoNetwork}
                        onChange={e => setWithdrawCryptoNetwork(e.target.value)}
                        style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                      >
                        <option value="TRC-20 (Tron)">USDT - TRC-20 (Tron)</option>
                        <option value="ERC-20 (Ethereum)">USDT / ETH - ERC-20 (Ethereum)</option>
                        <option value="Bitcoin Network">BTC - Bitcoin Network</option>
                        <option value="BEP-20 (BSC)">BNB / USDT - BEP-20 (BSC)</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Alamat Wallet</div>
                      <input
                        type="text" value={withdrawCryptoAddress} placeholder="Masukkan alamat wallet tujuan"
                        onChange={e => { setWithdrawCryptoAddress(e.target.value); setWithdrawError(''); }}
                        style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.6 }}>Pastikan alamat wallet dan jaringan sudah benar. Kesalahan alamat dapat mengakibatkan kehilangan dana permanen.</div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {withdrawError && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 500 }}>{withdrawError}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleWithdrawSubmit}
                  disabled={isWithdrawDisabled}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 10, background: isWithdrawDisabled ? 'rgba(255,255,255,0.06)' : '#16a34a', color: isWithdrawDisabled ? 'rgba(255,255,255,0.25)' : '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: isWithdrawDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease' }}
                >
                  {withdrawLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Memproses...
                    </span>
                  ) : `Ajukan Penarikan${withdrawAmountNum > 0 ? ` — $${withdrawAmountNum.toLocaleString()} USD` : ''}`}
                </button>

                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Penarikan memerlukan persetujuan admin · Proses 1–3 hari kerja</span>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalOverlay>
    );
  };

  const renderTxHistoryModal = () => {
    const PAGE_SIZE = 20;
    const filtered = txTypeFilter === 'all' ? txHistoryData : txHistoryData.filter(t => t.type === txTypeFilter);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice(txPage * PAGE_SIZE, (txPage + 1) * PAGE_SIZE);

    const formatMethod = (method: string) => {
      const map: Record<string, string> = {
        bank_transfer: 'Transfer Bank', crypto: 'Crypto',
        stripe_stripe: 'Kartu / Stripe', stripe_card: 'Kartu / Stripe', credit_card: 'Kartu',
      };
      return map[method] || method.replace(/_/g, ' ');
    };

    const statusColor: Record<string, string> = {
      pending: '#f59e0b', approved: '#22c55e', completed: '#22c55e',
      rejected: '#ef4444', processing: '#3b82f6',
    };
    const statusLabel: Record<string, string> = {
      pending: 'Menunggu', approved: 'Disetujui', completed: 'Selesai',
      rejected: 'Ditolak', processing: 'Diproses',
    };

    return (
      <ModalOverlay onClose={() => setShowTxHistory(false)}>
        <div style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', animation: 'slideUpPanel 0.3s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 25px 80px rgba(0,0,0,0.9)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Riwayat Transaksi</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 }}>{filtered.length} transaksi ditemukan</div>
              </div>
            </div>
            <button onClick={() => setShowTxHistory(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ padding: '16px 24px' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {([['all', 'Semua'], ['deposit', 'Deposit'], ['withdrawal', 'Penarikan']] as const).map(([f, label]) => (
                <button key={f} onClick={() => { setTxTypeFilter(f); setTxPage(0); }}
                  style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: txTypeFilter === f ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: txTypeFilter === f ? '#60a5fa' : 'rgba(255,255,255,0.4)', borderWidth: 1, borderStyle: 'solid', borderColor: txTypeFilter === f ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)' }}
                >{label}</button>
              ))}
              <button onClick={() => { loadTxHistory(); setTxPage(0); }} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                Refresh
              </button>
            </div>

            {txHistoryLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Memuat riwayat...</div>
              </div>
            ) : paginated.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Belum ada transaksi</div>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 90px 90px 80px', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', marginBottom: 4 }}>
                  {['Tanggal', 'Jenis', 'Jumlah', 'Metode', 'Status', 'Aksi'].map(h => (
                    <div key={h} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>

                {/* Table Rows */}
                {paginated.map(tx => (
                  <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 90px 90px 80px', gap: 8, padding: '10px 12px', borderRadius: 8, borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                      {new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div>
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: tx.type === 'deposit' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)', color: tx.type === 'deposit' ? '#60a5fa' : '#22c55e' }}>
                        {tx.type === 'deposit' ? 'Deposit' : 'Tarik'}
                      </span>
                    </div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                      ${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{tx.currency || 'USD'}</div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{formatMethod(tx.method)}</div>
                    <div>
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: `${statusColor[tx.status] || '#f59e0b'}20`, color: statusColor[tx.status] || '#f59e0b' }}>
                        {statusLabel[tx.status] || tx.status}
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={() => { setShowTxHistory(false); router.push(`/receipt/${tx.id}`); }}
                        style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >Lihat</button>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                    <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                      style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: txPage === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: txPage === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>Prev</button>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{txPage + 1} / {totalPages}</span>
                    <button onClick={() => setTxPage(p => Math.min(totalPages - 1, p + 1))} disabled={txPage >= totalPages - 1}
                      style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: txPage >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: txPage >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </ModalOverlay>
    );
  };

  const renderSettingsModal = () => (
    <ModalOverlay onClose={() => setShowSettingsModal(false)}>
      <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 460, animation: 'slideUpPanel 0.25s ease-out', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{t('settings.title')}</div>
          <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {([['chart', t('settings.chartTab')], ['account', t('settings.accountTab')], ['trading', t('settings.tradingTab')]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setSettingsTab(tab)}
              style={{ flex: 1, padding: '12px 8px', background: settingsTab === tab ? 'rgba(37,99,235,0.1)' : 'none', border: 'none', borderBottom: settingsTab === tab ? '2px solid #3b82f6' : '2px solid transparent', color: settingsTab === tab ? '#60a5fa' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >{label}</button>
          ))}
        </div>
        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          {settingsTab === 'chart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.chartTheme')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{t('settings.chartThemeDesc')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['dark', 'light'] as const).map(th => (
                    <button key={th} onClick={() => setSettingsChartTheme(th)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: settingsChartTheme === th ? '#2563eb' : 'rgba(255,255,255,0.08)', color: settingsChartTheme === th ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                      {th === 'dark' ? t('settings.dark') : t('settings.light')}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.defaultTimeframe')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{t('settings.defaultTimeframeDesc')}</div>
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
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>{t('settings.emailLabel')}</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.email}</div>
              </div>
              {!isEmailVerified && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('settings.emailNotVerified')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8 }}>{t('settings.emailNotVerifiedDesc')}</div>
                  <button onClick={handleResendVerification} disabled={resendVerifyLoading || resendVerifyCooldown > 0} style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: resendVerifyLoading || resendVerifyCooldown > 0 ? 'not-allowed' : 'pointer', opacity: resendVerifyLoading || resendVerifyCooldown > 0 ? 0.6 : 1 }}>
                    {resendVerifyLoading ? t('settings.sending') : resendVerifyCooldown > 0 ? t('settings.resendCooldown', { seconds: String(resendVerifyCooldown) }) : t('settings.resendVerification')}
                  </button>
                  {resendVerifyMsg && <div style={{ color: resendVerifyMsg.includes('sent') ? '#22c55e' : '#ef4444', fontSize: 12, marginTop: 8 }}>{resendVerifyMsg}</div>}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.notifications')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{t('settings.notificationsDesc')}</div>
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
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.defaultAmount')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{t('settings.defaultAmountDesc')}</div>
                </div>
                <input type="number" value={settingsDefaultAmount} onChange={e => setSettingsDefaultAmount(e.target.value)} min="10" max="10000" style={{ width: 80, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.autoConfirm')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{t('settings.autoConfirmDesc')}</div>
                </div>
                <button onClick={() => setSettingsAutoConfirm(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: settingsAutoConfirm ? '#2563eb' : 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settingsAutoConfirm ? 23 : 3, transition: 'left 0.2s ease' }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.modalThreshold')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{t('settings.modalThresholdDesc')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={settingsAlertThreshold1} onChange={e => setSettingsAlertThreshold1(e.target.value)} min="1" max="50" style={{ width: 56, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 600, outline: 'none', textAlign: 'right' }} />
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>%</span>
                </div>
              </div>
              {settingsPriceAlerts && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{t('settings.toastThreshold')}</div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>{t('settings.toastThresholdDesc')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" value={settingsAlertThreshold2} onChange={e => setSettingsAlertThreshold2(e.target.value)} min="1" max="100" style={{ width: 56, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 600, outline: 'none', textAlign: 'right' }} />
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {settingsSaved && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{t('settings.saved')}</div>}
          <button onClick={handleSettingsSave} style={{ marginTop: 16, width: '100%', padding: '13px 0', borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>{t('settings.saveButton')}</button>
        </div>
      </div>
    </ModalOverlay>
  );

  void filteredAssets;

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#0a0b1e', position: 'relative' }}>
      {isDesktop && renderDesktopSidebar()}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {renderTopBar()}
        {renderSecondBar()}

        {showVerifiedBanner && (
          <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px 16px', fontSize: 13, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
            {t('emailVerification.verified')}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {renderPanelContent()}
        </div>

        {renderBottomTradePanel(isDesktop ? 120 : 150)}

        {!isDesktop && renderBottomNav()}
      </div>

      {/* ── Toast Notifications (Trade) ── */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', maxWidth: 320 }}>
        {toasts.map(toast => (
          <div key={toast.id}
            style={{ background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : toast.type === 'error' ? 'rgba(239,68,68,0.95)' : toast.type === 'warning' ? 'rgba(245,158,11,0.95)' : 'rgba(59,130,235,0.95)', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: 'slideInRight 0.3s ease-out', maxWidth: 320, pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── Price Alert Toasts ── */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', maxWidth: 320 }}>
        {priceAlertToasts.map(toast => (
          <div key={toast.id}
            style={{ background: 'rgba(245,158,11,0.95)', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: 'slideInLeft 0.3s ease-out', pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => dismissPriceAlertToast(toast.id)}
          >
            <span style={{ fontSize: 14 }}>📊</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* ── Trade Result Notification ── */}
      {notification.visible && (
        <div style={{ position: 'fixed', bottom: isDesktop ? 140 : 220, left: '50%', transform: 'translateX(-50%)', zIndex: 85, background: notification.result === 'won' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)', color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'slideUpPanel 0.3s ease-out', textAlign: 'center', minWidth: 200 }}>
          <div>{notification.result === 'won' ? t('trade.won') : t('trade.lost')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{notification.result === 'won' ? '+' : '-'}${Math.abs(notification.profit).toFixed(2)}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{t('trade.closingIn', { seconds: String(notification.countdown) })}</div>
        </div>
      )}

      {/* ── Confirm Trade Modal ── */}
      {confirmModal.visible && confirmModal.direction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', padding: 16 }}>
          <div style={{ background: '#12132a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: '100%', maxWidth: 360, padding: 24, animation: 'slideUpPanel 0.25s ease-out' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t('trade.confirmTitle')}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 20 }}>
              {confirmModal.direction === 'buy' ? t('tradePanel.buy') : t('tradePanel.sell')} {selectedAsset.name} ${tradeAmount} ({DURATIONS[durationIdx].label})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setConfirmModal({ visible: false, direction: null })} style={{ padding: '12px 0', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t('trade.cancel')}</button>
              <button onClick={() => executeTrade(confirmModal.direction!)} style={{ padding: '12px 0', borderRadius: 10, background: confirmModal.direction === 'buy' ? '#16a34a' : '#dc2626', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {confirmModal.direction === 'buy' ? t('tradePanel.buy') : t('tradePanel.sell')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Price Movement Alert Modal ── */}
      {activePriceMovementModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 82, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
          <div style={{ background: '#12132a', border: `1px solid ${activePriceMovementModal.direction === 'up' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 16, width: '100%', maxWidth: 380, padding: 24, animation: 'slideUpPanel 0.25s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 28 }}>{activePriceMovementModal.direction === 'up' ? '📈' : '📉'}</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{t('priceAlert.significantChange')}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{activePriceMovementModal.assetName} ({activePriceMovementModal.symbol})</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{t('priceAlert.previousPrice')}</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{formatPrice(activePriceMovementModal.prevPrice, activePriceMovementModal.symbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{t('priceAlert.currentPrice')}</span>
                <span style={{ color: activePriceMovementModal.direction === 'up' ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{formatPrice(activePriceMovementModal.currentPrice, activePriceMovementModal.symbol)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{t('priceAlert.change')}</span>
                <span style={{ color: activePriceMovementModal.direction === 'up' ? '#22c55e' : '#ef4444', fontSize: 14, fontWeight: 800 }}>
                  {activePriceMovementModal.direction === 'up' ? '+' : '-'}{activePriceMovementModal.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 16, textAlign: 'center' }}>
              {new Date(activePriceMovementModal.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => dismissPriceMovementAlert(activePriceMovementModal.id)}
                style={{ padding: '12px 0', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >{t('priceAlert.dismiss')}</button>
              <button
                onClick={() => {
                  dismissPriceMovementAlert(activePriceMovementModal.id);
                  const asset = ASSETS.find(a => a.symbol === activePriceMovementModal.symbol);
                  if (asset) { setSelectedAsset(asset); setActiveNav('platform'); }
                }}
                style={{ padding: '12px 0', borderRadius: 10, background: activePriceMovementModal.direction === 'up' ? '#16a34a' : '#dc2626', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >{t('priceAlert.tradeNow')}</button>
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
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t('help.title')}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.6 }}>
            {t('help.step1')}<br/>
            {t('help.step2')}<br/>
            {t('help.step3')}<br/>
            {t('help.step4')}
          </div>
        </div>
      )}

      {showSearchModal && renderSearchModal()}
      {showDepositModal && renderDepositModal()}
      {showSettingsModal && renderSettingsModal()}
      {showWithdrawModal && renderWithdrawModal()}
      {showTxHistory && renderTxHistoryModal()}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUpPanel { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}