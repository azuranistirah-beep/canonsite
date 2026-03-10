'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import CopyTradePage from '@/components/pages/CopyTradePage';
import TradeMainContent from '@/components/pages/TradeMainContent';

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
  close_price?: number;
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

interface TxItem {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

// ─── Currency Config ──────────────────────────────────────────────────────────────────────────────────────
interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: 'USD' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: 'EUR' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: 'GBP' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: 'MYR' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: 'SGD' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: 'THB' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: 'PHP' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: 'JPY' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: 'AUD' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: 'CNY' },
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

// ─── Price Validation ─────────────────────────────────────────────────────────
const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  crypto: { min: 0.000000001, max: 200000 },
  forex: { min: 0.5, max: 2000 },
  commodity: { min: 0.5, max: 15000 },
  stock: { min: 1, max: 10000 },
};

function validatePrice(price: number, category: string): boolean {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price) || price <= 0) return false;
  const range = PRICE_RANGES[category] || PRICE_RANGES.crypto;
  if (price < range.min || price > range.max) return false;
  return true;
}

// ─── Modal Overlay ────────────────────────────────────────────────────────────
const ModalOverlay = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', padding: 16 }}
    onClick={onClose}
  >
    <div onClick={e => e.stopPropagation()}>{children}</div>
  </div>
);

// ─── Asset List ───────────────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { symbol: 'BTC/USD', name: 'Bitcoin', tvSymbol: 'BINANCE:BTCUSDT', binanceSymbol: 'BTCUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'ETH/USD', name: 'Ethereum', tvSymbol: 'BINANCE:ETHUSDT', binanceSymbol: 'ETHUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'SOL/USD', name: 'Solana', tvSymbol: 'BINANCE:SOLUSDT', binanceSymbol: 'SOLUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'BNB/USD', name: 'BNB', tvSymbol: 'BINANCE:BNBUSDT', binanceSymbol: 'BNBUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'XRP/USD', name: 'Ripple', tvSymbol: 'BINANCE:XRPUSDT', binanceSymbol: 'XRPUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'ADA/USD', name: 'Cardano', tvSymbol: 'BINANCE:ADAUSDT', binanceSymbol: 'ADAUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'DOGE/USD', name: 'Dogecoin', tvSymbol: 'BINANCE:DOGEUSDT', binanceSymbol: 'DOGEUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'DOT/USD', name: 'Polkadot', tvSymbol: 'BINANCE:DOTUSDT', binanceSymbol: 'DOTUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'AVAX/USD', name: 'Avalanche', tvSymbol: 'BINANCE:AVAXUSDT', binanceSymbol: 'AVAXUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'LINK/USD', name: 'Chainlink', tvSymbol: 'BINANCE:LINKUSDT', binanceSymbol: 'LINKUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'LTC/USD', name: 'Litecoin', tvSymbol: 'BINANCE:LTCUSDT', binanceSymbol: 'LTCUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'MATIC/USD', name: 'Polygon', tvSymbol: 'BINANCE:MATICUSDT', binanceSymbol: 'MATICUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'SHIB/USD', name: 'Shiba Inu', tvSymbol: 'BINANCE:SHIBUSDT', binanceSymbol: 'SHIBUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'UNI/USD', name: 'Uniswap', tvSymbol: 'BINANCE:UNIUSDT', binanceSymbol: 'UNIUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'ATOM/USD', name: 'Cosmos', tvSymbol: 'BINANCE:ATOMUSDT', binanceSymbol: 'ATOMUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'ALGO/USD', name: 'Algorand', tvSymbol: 'BINANCE:ALGOUSDT', binanceSymbol: 'ALGOUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'VET/USD', name: 'VeChain', tvSymbol: 'BINANCE:VETUSDT', binanceSymbol: 'VETUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'XTZ/USD', name: 'Tezos', tvSymbol: 'BINANCE:XTZUSDT', binanceSymbol: 'XTZUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'EOS/USD', name: 'EOS', tvSymbol: 'BINANCE:EOSUSDT', binanceSymbol: 'EOSUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'XLM/USD', name: 'Stellar', tvSymbol: 'BINANCE:XLMUSDT', binanceSymbol: 'XLMUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'XMR/USD', name: 'Monero', tvSymbol: 'BINANCE:XMRUSDT', binanceSymbol: 'XMRUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'TRX/USD', name: 'Tron', tvSymbol: 'BINANCE:TRXUSDT', binanceSymbol: 'TRXUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'NEO/USD', name: 'NEO', tvSymbol: 'BINANCE:NEOUSDT', binanceSymbol: 'NEOUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'ZEC/USD', name: 'Zcash', tvSymbol: 'BINANCE:ZECUSDT', binanceSymbol: 'ZECUSDT', exchange: 'Binance', category: 'crypto', payout: 95 },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', tvSymbol: 'FX:EURUSD', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'GBP/USD', name: 'British Pound / USD', tvSymbol: 'FX:GBPUSD', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'USD/JPY', name: 'US Dollar / Yen', tvSymbol: 'FX:USDJPY', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'AUD/USD', name: 'Australian Dollar / USD', tvSymbol: 'FX:AUDUSD', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', tvSymbol: 'FX:USDCHF', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound', tvSymbol: 'FX:EURGBP', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen', tvSymbol: 'FX:EURJPY', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'GBP/JPY', name: 'British Pound / Yen', tvSymbol: 'FX:GBPJPY', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'AUD/JPY', name: 'Australian Dollar / Yen', tvSymbol: 'FX:AUDJPY', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'EUR/AUD', name: 'Euro / Australian Dollar', tvSymbol: 'FX:EURAUD', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'GBP/AUD', name: 'British Pound / Australian Dollar', tvSymbol: 'FX:GBPAUD', exchange: 'FX', category: 'forex', payout: 95 },
  { symbol: 'XAU/USD', name: 'Gold', tvSymbol: 'OANDA:XAUUSD', exchange: 'OANDA', category: 'commodity', payout: 95 },
  { symbol: 'XAG/USD', name: 'Silver', tvSymbol: 'OANDA:XAGUSD', exchange: 'OANDA', category: 'commodity', payout: 95 },
  { symbol: 'OIL/USD', name: 'Crude Oil', tvSymbol: 'NYMEX:CL1!', exchange: 'NYMEX', category: 'commodity', payout: 95 },
  { symbol: 'XPT/USD', name: 'Platinum', tvSymbol: 'OANDA:XPTUSD', exchange: 'OANDA', category: 'commodity', payout: 95 },
  { symbol: 'COPPER', name: 'Copper', tvSymbol: 'COMEX:HG1!', exchange: 'COMEX', category: 'commodity', payout: 95 },
  { symbol: 'NATGAS', name: 'Natural Gas', tvSymbol: 'NYMEX:NG1!', exchange: 'NYMEX', category: 'commodity', payout: 95 },
  { symbol: 'WHEAT', name: 'Wheat', tvSymbol: 'CBOT:ZW1!', exchange: 'CBOT', category: 'commodity', payout: 95 },
  { symbol: 'CORN', name: 'Corn', tvSymbol: 'CBOT:ZC1!', exchange: 'CBOT', category: 'commodity', payout: 95 },
  { symbol: 'AAPL', name: 'Apple Inc.', tvSymbol: 'NASDAQ:AAPL', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', tvSymbol: 'NASDAQ:MSFT', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', tvSymbol: 'NASDAQ:GOOGL', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', tvSymbol: 'NASDAQ:AMZN', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'TSLA', name: 'Tesla Inc.', tvSymbol: 'NASDAQ:TSLA', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'META', name: 'Meta Platforms', tvSymbol: 'NASDAQ:META', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'NFLX', name: 'Netflix Inc.', tvSymbol: 'NASDAQ:NFLX', exchange: 'NASDAQ', category: 'stock', payout: 95 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', tvSymbol: 'NASDAQ:NVDA', exchange: 'NASDAQ', category: 'stock', payout: 95 },
];

// ─── Duration Presets (FULL LIST: 23 options) ─────────────────────────────────
const DURATION_PRESETS = [
  { label: '5s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '15s', seconds: 15 },
  { label: '20s', seconds: 20 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '20m', seconds: 1200 },
  { label: '30m', seconds: 1800 },
  { label: '40m', seconds: 2400 },
  { label: '50m', seconds: 3000 },
  { label: '1h', seconds: 3600 },
  { label: '2h', seconds: 7200 },
  { label: '3h', seconds: 10800 },
  { label: '4h', seconds: 14400 },
  { label: '6h', seconds: 21600 },
  { label: '9h', seconds: 32400 },
  { label: '12h', seconds: 43200 },
  { label: '1d', seconds: 86400 },
  { label: '2d', seconds: 172800 },
];

const AMOUNT_PRESETS = [10, 50, 100, 500];

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  forex: 'Forex',
  commodity: 'Commodity',
  stock: 'Stocks',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function formatPrice(price: number, category: string): string {
  if (price <= 0) return '—';
  if (category === 'crypto') {
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (category === 'forex') return price.toFixed(5);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Category SVG Icons ───────────────────────────────────────────────────────
const CategoryIcon = ({ category, size = 14 }: { category: string; size?: number }) => {
  if (category === 'crypto') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9 8h4a2 2 0 0 1 0 4H9v4h4a2 2 0 0 0 0-4"/>
      <line x1="9" y1="8" x2="9" y2="12"/>
    </svg>
  );
  if (category === 'forex') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
  if (category === 'commodity') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  );
};

// ─── CSS Styles ───────────────────────────────────────────────────────────────
const DASHBOARD_STYLES = `
  /* ── Base Layout ── */
  .td-dashboard-root {
    height: 100vh;
    overflow: hidden;
    background: #000000;
    color: #e2e8f0;
    font-family: Inter, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
  }

  /* ── Controls Grid ── */
  .td-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px 10px;
    background: #000000;
    border-top: 1px solid #1a1a1a;
    flex-shrink: 0;
  }
  .td-control-col {
    display: flex;
    flex-direction: column;
    background: #111111;
    border-radius: 12px;
    padding: 10px 12px;
    border: 1px solid rgba(63,63,70,0.5);
    gap: 6px;
    flex-shrink: 0;
  }

  /* ── Trade Buttons ── */
  .td-trade-btn {
    width: 100%;
    padding: 0;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .td-trade-btn:not(:disabled):active {
    transform: scale(0.97);
    filter: brightness(0.9);
  }
  .td-trade-panel {
    flex-shrink: 0;
    height: auto;
    overflow: visible;
  }

  /* ── Asset Panel (floating dropdown overlay) ── */
  .td-asset-panel {
    position: absolute;
    top: 40px;
    left: 0;
    width: 300px;
    max-height: 420px;
    background: #111111;
    border: 1px solid #27272a;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8);
    z-index: 300;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .td-asset-panel-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 299;
  }
  .td-asset-selector-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  /* ── Button Animations ── */
  .td-bottom-nav-btn {
    transition: color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }
  .td-bottom-nav-btn:active {
    transform: scale(0.9);
    filter: brightness(0.85);
  }
  .td-sell-btn {
    transition: all 0.15s ease;
  }
  .td-sell-btn:not(:disabled):active {
    transform: scale(0.95);
    filter: brightness(0.9);
  }
  .td-buy-btn {
    transition: all 0.15s ease;
  }
  .td-buy-btn:not(:disabled):active {
    transform: scale(0.95);
    filter: brightness(0.9);
  }
  .td-preset-btn {
    transition: all 0.15s ease;
  }
  .td-preset-btn:active {
    transform: scale(0.95);
    filter: brightness(0.9);
  }

  /* ── Bottom nav: visible on ALL devices ── */
  .td-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 52px;
    background: #000000;
    border-top: 1px solid #1a1a1a;
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .td-main-wrapper {
    padding-bottom: 56px;
    overflow: visible;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* ── Desktop layout: chart fills remaining height ── */
@media (min-width: 769px) {
    .td-main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }
    .td-chart-area {
      height: calc(100vh - 52px - 40px - 32px - 36px - 200px);
      flex: none;
      min-height: 300px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .td-chart-container {
      flex: 1;
      position: relative;
      background: #000000;
      width: 100%;
      min-height: 0;
    }
    .td-chart-iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
    .td-trade-panel {
      flex-shrink: 0;
      height: auto;
      overflow: visible;
    }
    .td-controls-grid {
      flex-shrink: 0;
      height: auto;
    }
    .td-main-wrapper {
      padding-bottom: 56px;
      overflow: visible;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  }

  /* ── Tablet (768-1279px) ── */
  @media (min-width: 769px) and (max-width: 1279px) {
    .td-controls-grid { gap: 6px !important; padding: 6px 8px !important; }
    .td-control-col { padding: 8px 10px !important; }
    .td-preset-btn { font-size: 10px !important; }
  }

  /* ── Mobile (<768px) ── */
  @media (max-width: 768px) {
    /* Root: pure black bg */
    .td-dashboard-root {
      height: 100dvh !important;
      overflow: hidden !important;
      background: #000000 !important;
    }

    /* Header: pure black, 56px */
    .td-header-row {
      background: #000000 !important;
      height: 56px !important;
      min-height: 56px !important;
      padding: 0 16px !important;
      border-bottom: 1px solid #1a1a1a !important;
      border-top: 1px solid #1a1a1a !important;
      flex-shrink: 0;
    }
    /* Hide desktop header elements on mobile */
    .td-header-desktop-only { display: none !important; }
    /* Show mobile header elements */
    .td-header-mobile-only { display: flex !important; }

    /* Asset row: pure black, 44px */
    .td-asset-row-mobile {
      background: #000000 !important;
      border-bottom: 1px solid #1a1a1a !important;
      height: 44px !important;
    }
    /* Hide desktop asset bar on mobile */
    .td-asset-bar-desktop { display: none !important; }
    /* Show mobile asset row */
    .td-asset-bar-mobile { display: flex !important; }

    /* Main wrapper */
    .td-main-wrapper {
      padding-bottom: 52px !important;
      overflow: visible !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      min-height: 0 !important;
    }

    /* Main content */
    .td-main-content {
      flex-direction: column !important;
      overflow: hidden !important;
      flex: 1 !important;
      min-height: 0 !important;
      display: flex !important;
      height: auto !important;
    }

    /* Chart area */
    .td-chart-area {
      flex: 1 !important;
      width: 100% !important;
      min-height: 240px !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
    }
    .td-chart-container {
      flex: 1 !important;
      position: relative !important;
      min-height: 0 !important;
    }
    .td-chart-iframe {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }

    /* Hide search toolbar on mobile */
    .td-search-toolbar { display: none !important; }

    /* Trade panel: auto height */
    .td-trade-panel {
      flex: none !important;
      height: auto !important;
      overflow: visible !important;
    }

    /* Hide desktop controls grid on mobile */
    .td-controls-grid-desktop { display: none !important; }
    /* Show mobile controls */
    .td-mobile-controls { display: flex !important; }

    /* Asset panel on mobile: full-width dropdown */
    .td-asset-panel {
      width: 90vw !important;
      max-width: 320px !important;
      max-height: 70vh !important;
    }

    /* Bottom nav: pure black */
    .td-bottom-nav {
      background: #000000 !important;
      border-top: 1px solid #1a1a1a !important;
      height: 52px !important;
    }
  }

  /* ── Very small screens ── */
  @media (max-width: 374px) {
    .td-chart-area { min-height: 200px !important; }
  }

  /* ── Landscape mobile ── */
  @media (orientation: landscape) and (max-width: 900px) {
    .td-chart-area { min-height: 150px !important; }
  }
`;

// ─── Active Trade Row Component ───────────────────────────────────────────────
function ActiveTradeRow({ trade }: { trade: Trade }) {
  const [remaining, setRemaining] = React.useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(trade.opened_at).getTime()) / 1000);
    return Math.max(0, trade.duration_seconds - elapsed);
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        const elapsed = Math.floor((Date.now() - new Date(trade.opened_at).getTime()) / 1000);
        return Math.max(0, trade.duration_seconds - elapsed);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [trade.opened_at, trade.duration_seconds, remaining]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="bg-zinc-800 rounded-xl p-3 mb-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">{trade.asset_symbol}</span>
          <span
            className={`text-white text-xs px-2 py-0.5 rounded-full font-semibold ${
              trade.direction === 'buy' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {trade.direction.toUpperCase()}
          </span>
        </div>
        <span className="text-white text-sm">${trade.amount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs">Entry: ${trade.entry_price}</span>
        {remaining === 0 ? (
          <span className="text-yellow-400 text-xs font-semibold">Settling...</span>
        ) : (
          <span className="text-blue-400 font-mono text-sm">{mm}:{ss}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradeDashboardPage() {
  const { t } = useLanguage();
  const { user, session: authSession } = useAuth();

  // ── Auth & Profile ──
  const userId = user?.id ?? null;
  const [demoBalance, setDemoBalance] = useState(10000);
  const [realBalance, setRealBalance] = useState(0);
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [copyTradeActive, setCopyTradeActive] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // ── Asset & Price ──
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [assetCategory, setAssetCategory] = useState<string>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [tvPrice, setTvPrice] = useState(0);
  const [priceTimestamps, setPriceTimestamps] = useState<Record<string, any>>({});
  const [priceMovementAlerts, setPriceMovementAlerts] = useState<PriceMovementAlert[]>([]);
  const tvPriceRef = useRef<number>(0);
  const prevTvPriceRef = useRef<number>(0);
  const [priceFlashColor, setPriceFlashColor] = useState<'#10b981' | '#ef4444' | '#ffffff'>('#ffffff');
  const accountTypeRef = useRef<'demo' | 'real'>(accountType);
  const currentBalanceRef = useRef<number>(0);

  // ── Trade Form ──
  const [amount, setAmount] = useState(1);
  const [amountInput, setAmountInput] = useState('1');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  // FIX 7: default duration 60s (1m), min 5s
  const [duration, setDuration] = useState(60);
  const [durationInput, setDurationInput] = useState('60');
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<'buy' | 'sell' | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Trades & History ──
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showActiveTradesPanel, setShowActiveTradesPanel] = useState(false);

  // ── Notifications ──
  const [tradeNotification, setTradeNotification] = useState<TradeNotification>({
    visible: false, result: null, amount: 0, profit: 0, countdown: 0,
  });
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Settings ──
  const [showSettings, setShowSettings] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [defaultAmount, setDefaultAmount] = useState(10);
  const [defaultTimeframe, setDefaultTimeframe] = useState('1m');
  const [priceAlertThreshold, setPriceAlertThreshold] = useState(5);

  // ── UI ──
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositStep, setDepositStep] = useState<'amount' | 'method' | 'confirm'>('amount');
  const [selectedDepositMethod, setSelectedDepositMethod] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState<'trade' | 'history' | 'account' | 'copytrade'>('trade');
  const [showDepositCurrencyDropdown, setShowDepositCurrencyDropdown] = useState(false);
  const [depositCurrency, setDepositCurrency] = useState<Currency>(CURRENCIES[0]);

  // ── Account Tab: Edit Profile ──
  const [profileFullName, setProfileFullName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Account Tab: Change Password ──
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Account Tab: Accordion ──
  const [accExpandedSection, setAccExpandedSection] = useState<string | null>(null);

  // ── Account Tab: Transaction History ──
  const [txHistory, setTxHistory] = useState<TxItem[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<HTMLIFrameElement>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);

  const currentBalance = accountType === 'demo' ? demoBalance : realBalance;
  const isPriceKadaluarsa = tvPrice <= 0;

  // ── Sync auth state from AuthContext user ──
  useEffect(() => {
    if (user) {
      setIsEmailVerified(!!user.email_confirmed_at);
      setUserEmail(user.email || '');
      fetchProfile(user.id);
      fetchAlerts(user.id);
      fetchTrades(user.id);
    } else {
      setIsEmailVerified(false);
      setUserEmail('');
    }
  }, [user?.id]);

  useEffect(() => { accountTypeRef.current = accountType; }, [accountType]);
  useEffect(() => { currentBalanceRef.current = currentBalance; }, [currentBalance]);

  // ── Sync prices to tvPrice ──
  useEffect(() => {
    const p = prices[selectedAsset.symbol]?.price;
    console.log(`[tvPrice] selectedAsset=${selectedAsset.symbol} | prices[symbol]=${p} | setting tvPrice=${p && p > 0 ? p : '(skipped, keeping current)'}`);
    if (p && p > 0) {
      setTvPrice(p);
      tvPriceRef.current = p;
      if (prevTvPriceRef.current > 0 && p !== prevTvPriceRef.current) {
        const color = p > prevTvPriceRef.current ? '#10b981' : '#ef4444';
        setPriceFlashColor(color);
        setTimeout(() => setPriceFlashColor('#ffffff'), 300);
      }
      prevTvPriceRef.current = p;
    }
  }, [prices, selectedAsset.symbol]);

  // ── Forex/commodity/stock symbol key mapping ──
  const FOREX_KEY_MAP: Record<string, string> = {
    'XAU/USD': 'Gold',
    'XAG/USD': 'Silver',
    'OIL/USD': 'Crude Oil',
    'XPT/USD': 'Platinum',
    'COPPER': 'Copper',
    'NATGAS': 'Natural Gas',
    'WHEAT': 'Wheat',
    'CORN': 'Corn',
  };

  // ── Fetch all asset prices ──
  const fetchAllPrices = useCallback(async () => {
    const cryptoAssets = ASSETS.filter(a => a.binanceSymbol);
    const forexAssets = ASSETS.filter(a => !a.binanceSymbol);

    // Fetch crypto prices in parallel
    const cryptoResults = await Promise.allSettled(
      cryptoAssets.map(async (asset) => {
        try {
          const res = await fetch(`/api/prices/binance?symbol=${asset.binanceSymbol}`);
          const data = await res.json();
          console.log(`[fetchAllPrices] symbol=${asset.symbol} | status=${res.status} | price=${data?.price}`);
          if (!res.ok || !data.price || data.price <= 0) return null;
          return { symbol: asset.symbol, price: parseFloat(data.price), change24h: parseFloat(data.change24h) || 0 };
        } catch (e: any) {
          console.log(`[fetchAllPrices] symbol=${asset.symbol} | fetch error: ${e?.message}`);
          return null;
        }
      })
    );

    // Fetch forex/commodity/stock prices in bulk
    let forexData: Record<string, { price: number; change: number }> = {};
    try {
      const res = await fetch('/api/prices/forex');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) forexData = json.data;
      }
    } catch {}

    setPrices(prev => {
      const updated = { ...prev };

      // Apply crypto results
      cryptoResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          const { symbol, price, change24h } = result.value;
          updated[symbol] = {
            price,
            change24h,
            prevPrice: prev[symbol]?.price || price,
          };
        }
      });

      // Apply forex/commodity/stock results
      forexAssets.forEach(asset => {
        const key = FOREX_KEY_MAP[asset.symbol] || asset.symbol;
        const d = forexData[key];
        if (d && d.price > 0) {
          updated[asset.symbol] = {
            price: d.price,
            change24h: d.change || 0,
            prevPrice: prev[asset.symbol]?.price || d.price,
          };
        }
      });

      return updated;
    });
  }, []);

  // ── Start price polling on mount ──
  useEffect(() => {
    fetchAllPrices();
    priceIntervalRef.current = setInterval(fetchAllPrices, 10000);
    return () => {
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    };
  }, [fetchAllPrices]);

  // ── Direct session recovery fallback (independent of AuthContext) ──
  useEffect(() => {
    const recoverSession = async () => {
      if (user?.id) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          accountTypeRef.current = session.user.id;
          fetchProfile(session.user.id);
          fetchTrades(session.user.id);
          fetchAlerts(session.user.id);
          setIsEmailVerified(!!session.user.email_confirmed_at);
          setUserEmail(session.user.email || '');
        }
      } catch (e) {
        console.error('[TradePage] session recovery error:', e);
      }
    };
    recoverSession();
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    // Fetch copy_trade_active and currency from user_profiles (using correct PK 'id')
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('currency, copy_trade_active')
      .eq('id', uid)
      .single();
    if (profileData) {
      if (profileData.currency) {
        const found = CURRENCIES.find(c => c.code === profileData.currency);
        if (found) setCurrency(found);
      }
      setCopyTradeActive(profileData.copy_trade_active ?? false);
    }
    // Fetch demo balance from demo_accounts
    const { data: demoData } = await supabase
      .from('demo_accounts')
      .select('balance')
      .eq('user_id', uid)
      .single();
    if (demoData && demoData.balance != null && Number(demoData.balance) > 0) {
      setDemoBalance(Number(demoData.balance));
    } else {
      setDemoBalance(10000);
    }
    // Fetch real balance from real_accounts
    const { data: realData } = await supabase
      .from('real_accounts')
      .select('balance')
      .eq('user_id', uid)
      .single();
    if (realData) setRealBalance(Number(realData.balance) || 0);
  }, []);

  const fetchAlerts = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('trade_alerts')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setAlerts(data as TradeAlert[]);
      setUnreadCount(data.filter((a: TradeAlert) => !a.read).length);
    }
  }, []);

  const fetchTrades = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', uid)
      .order('opened_at', { ascending: false })
      .limit(100);
    if (data) {
      const active = (data as Trade[]).filter(t => t.status === 'active' || t.status === 'pending');
      const history = (data as Trade[]).filter(t => t.status === 'won' || t.status === 'lost' || t.status === 'cancelled');
      setActiveTrades(active);
      setTradeHistory(history);
    }
  }, []);

  const fetchBinancePrice = useCallback(async (symbol: string): Promise<number> => {
    try {
      const res = await fetch(`/api/prices/binance?symbol=${symbol}`);
      if (!res.ok) return 0;
      const data = await res.json();
      return parseFloat(data.price) || 0;
    } catch { return 0; }
  }, []);

  const fetchForexPrice = useCallback(async (symbol: string): Promise<number> => {
    try {
      const res = await fetch(`/api/prices/forex?symbol=${symbol}`);
      if (!res.ok) return 0;
      const data = await res.json();
      return parseFloat(data.price) || 0;
    } catch { return 0; }
  }, []);

  const fetchCurrentPrice = useCallback(async (asset: Asset): Promise<number> => {
    let price = 0;
    if (asset.binanceSymbol) {
      price = await fetchBinancePrice(asset.binanceSymbol);
    } else if (asset.category === 'forex') {
      price = await fetchForexPrice(asset.symbol);
    }
    if (price > 0 && validatePrice(price, asset.category)) return price;
    return prices[asset.symbol]?.price || 0;
  }, [fetchBinancePrice, fetchForexPrice, prices]);

  const addToast = useCallback((type: ToastAlert['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, visible: true }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const executeTrade = useCallback(async (direction: 'buy' | 'sell') => {
    // ── Ensure the singleton Supabase client has an active session ──────────
    let { data: { session: execSession } } = await supabase.auth.getSession();

    if (!execSession && authSession?.access_token && authSession?.refresh_token) {
      try {
        const { data: restored, error: setErr } = await supabase.auth.setSession({
          access_token: authSession.access_token,
          refresh_token: authSession.refresh_token,
        });
        if (!setErr && restored?.session) {
          execSession = restored.session;
        } else {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) execSession = refreshed.session;
        }
      } catch (e) {
        console.warn('[executeTrade] session restore failed:', e);
      }
    }

    if (!execSession) {
      addToast('error', 'Silakan login untuk melakukan trade');
      setIsPlacingTrade(false);
      return;
    }

    const currentUserId = userId ?? user?.id ?? null;
    if (!currentUserId) {
      console.error('[executeTrade] userId is null — user not authenticated');
      addToast('error', 'Please sign in to trade');
      return;
    }
    setIsPlacingTrade(true);
    try {
      const profit = amount * 0.95;
      const totalReturn = amount + profit;
      // Use server-side API route to insert trade (avoids client JWT propagation issues)
      const res = await fetch('/api/trades/insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${execSession.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: currentUserId,
          asset_symbol: selectedAsset.symbol,
          asset_name: selectedAsset.name,
          direction,
          amount,
          entry_price: tvPrice,
          duration_seconds: duration,
          account_type: accountTypeRef.current,
          opened_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw errJson;
      }
      const data = await res.json();
      const balanceTable = accountTypeRef.current === 'demo' ? 'demo_accounts' : 'real_accounts';
      const newBalance = currentBalanceRef.current - amount;
      const { error: balanceError } = await supabase.from(balanceTable).update({ balance: newBalance }).eq('user_id', currentUserId);
      if (balanceError) {
        console.error('[executeTrade] Balance update error:', JSON.stringify(balanceError));
      }
      if (accountTypeRef.current === 'demo') setDemoBalance(newBalance);
      else setRealBalance(newBalance);
      if (data) {
        setActiveTrades(prev => {
          const updated = [data as Trade, ...prev];
          if (prev.length === 0) setShowActiveTradesPanel(true);
          return updated;
        });
        addToast('success', `Trade opened: ${direction.toUpperCase()} ${selectedAsset.symbol} $${amount}`);
        setTimeout(async () => {
          const closePrice = tvPriceRef.current;
          const won = Math.random() > 0.5;
          const result = won ? 'won' : 'lost';
          const pl = won ? profit : -amount;
          const finalBalance = won ? newBalance + totalReturn : newBalance;
          await supabase.from('trades').update({ status: result, profit_loss: pl, closed_at: new Date().toISOString(), close_price: closePrice }).eq('id', data.id);
          await supabase.from(balanceTable).update({ balance: finalBalance }).eq('user_id', currentUserId);
          if (accountTypeRef.current === 'demo') setDemoBalance(finalBalance);
          else setRealBalance(finalBalance);
          setActiveTrades(prev => prev.filter(t => t.id !== data.id));
          setTradeHistory(prev => [{ ...data, status: result, profit_loss: pl, close_price: closePrice } as Trade, ...prev]);
          if (notificationsEnabled) {
            setTradeNotification({ visible: true, result, amount, profit: pl, countdown: 5 });
            const cd = setInterval(() => {
              setTradeNotification(prev => {
                if (prev.countdown <= 1) { clearInterval(cd); return { ...prev, visible: false }; }
                return { ...prev, countdown: prev.countdown - 1 };
              });
            }, 1000);
          }
          if (currentUserId) fetchAlerts(currentUserId);
        }, duration * 1000);
      }
    } catch (err: any) {
      console.error('[executeTrade] Trade error:', err?.message || err, '| code:', err?.code);
      addToast('error', 'Failed to place trade. Please try again.');
    } finally {
      setIsPlacingTrade(false);
    }
  }, [selectedAsset, amount, tvPrice, duration, accountTypeRef, currentBalanceRef, notificationsEnabled, fetchAlerts, addToast, authSession, user?.id]);

  const handleTrade = useCallback(async (direction: 'buy' | 'sell') => {
    const currentUserId = userId ?? user?.id ?? null;
    if (!currentUserId) { addToast('error', 'Please sign in to trade'); return; }
    if (copyTradeActive) { addToast('warning', 'Copy Trade is active. Stop following to trade manually.'); return; }
    if (!isEmailVerified && accountType === 'real') { addToast('warning', t('tradePanel.emailVerificationRequired')); return; }
    if (amount < 1 || amount > 10000) { addToast('error', 'Amount must be between $1 and $10,000'); return; }
    if (amount > currentBalance) { addToast('error', 'Insufficient balance'); return; }
    if (tvPrice <= 0) { addToast('error', t('tradePanel.priceUnavailable')); return; }
    executeTrade(direction);
  }, [copyTradeActive, isEmailVerified, accountType, amount, currentBalance, tvPrice, t, executeTrade, user?.id]);

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: userEmail });
    if (!error) {
      addToast('success', 'Verification email sent!');
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
      }, 1000);
    } else {
      addToast('error', 'Failed to send verification email');
    }
  }, [resendCooldown, userEmail, addToast]);

  const markAllAlertsRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('trade_alerts').update({ read: true }).eq('user_id', userId).eq('read', false);
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    setUnreadCount(0);
  }, [userId]);

  const filteredAssets = useMemo(() => {
    return ASSETS.filter(a => {
      const matchCategory = assetCategory === 'all' || a.category === assetCategory;
      const matchSearch = !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.symbol.toLowerCase().includes(assetSearch.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [assetCategory, assetSearch]);

  const handleAmountBlur = useCallback(() => {
    setIsEditingAmount(false);
    const val = parseFloat(amountInput);
    if (!isNaN(val)) {
      const clamped = Math.max(1, Math.min(10000, val));
      setAmount(clamped);
      setAmountInput(clamped.toString());
    } else {
      setAmountInput(amount.toString());
    }
  }, [amountInput, amount]);

  // FIX 7: min duration 5s
  const handleDurationBlur = useCallback(() => {
    setIsEditingDuration(false);
    const val = parseInt(durationInput);
    if (!isNaN(val)) {
      const clamped = Math.max(5, Math.min(3600, val));
      setDuration(clamped);
      setDurationInput(clamped.toString());
    } else {
      setDurationInput(duration.toString());
    }
  }, [durationInput, duration]);

  const handleDeposit = useCallback(async () => {
    if (!userId) return;
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) { addToast('error', 'Invalid deposit amount'); return; }
    const minDeposit = CURRENCY_MIN_DEPOSITS[currency.code] || 100;
    if (amt < minDeposit) { addToast('error', `Minimum deposit is ${currency.symbol}${minDeposit}`); return; }
    try {
      addToast('info', 'Redirecting to payment...');
      setShowDepositModal(false);
      setDepositAmount('');
      setDepositStep('amount');
      setSelectedDepositMethod('');
      const supabaseClient = createClient();
      const { data: { session } } = await supabaseClient.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: amt, currency: currency.code, depositTab: selectedDepositMethod || 'card' }),
      });
      const data = await res.json();
      if (!res.ok) { addToast('error', data.error || 'Payment failed. Please try again.'); return; }
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      addToast('error', 'Failed to initiate payment. Please try again.');
    }
  }, [userId, depositAmount, currency, selectedDepositMethod, addToast]);

  const handleWithdraw = useCallback(async () => {
    if (!userId) return;
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) { addToast('error', 'Invalid withdrawal amount'); return; }
    if (amt > realBalance) { addToast('error', 'Insufficient real balance'); return; }
    const { error } = await supabase.from('withdrawal_requests').insert({
      user_id: userId, amount: amt, currency: currency.code, status: 'pending', created_at: new Date().toISOString(),
    });
    if (error) { addToast('error', 'Failed to submit withdrawal'); return; }
    addToast('success', `Withdrawal request of ${currency.symbol}${amt} submitted`);
    setShowWithdrawModal(false);
    setWithdrawAmount('');
  }, [userId, withdrawAmount, realBalance, currency, addToast]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }, []);

  // ── Account Tab Handlers ──
  const handleProfileSave = useCallback(async () => {
    if (!userId) return;
    setProfileSaving(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: profileFullName.trim(), phone: profilePhone.trim() })
      .eq('id', userId);
    setProfileSaving(false);
    if (error) {
      setProfileMsg({ type: 'error', text: 'Failed to update profile' });
    } else {
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' });
      setTimeout(() => setProfileMsg(null), 3000);
    }
  }, [userId, profileFullName, profilePhone]);

  const handlePasswordChange = useCallback(async () => {
    setPasswordMismatch(false);
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) { setPasswordMismatch(true); return; }
    if (newPassword.length < 8) { setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters' }); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message || 'Failed to update password' });
    } else {
      setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 3000);
    }
  }, [newPassword, confirmPassword]);

  const fetchTxHistory = useCallback(async () => {
    if (!userId) return;
    setTxLoading(true);
    const [depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('deposit_requests').select('id, amount, currency, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('withdrawal_requests').select('id, amount, currency, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ]);
    const deposits: TxItem[] = (depositsRes.data || []).map((d: any) => ({ ...d, type: 'deposit' as const }));
    const withdrawals: TxItem[] = (withdrawalsRes.data || []).map((w: any) => ({ ...w, type: 'withdrawal' as const }));
    const combined = [...deposits, ...withdrawals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
    setTxHistory(combined);
    setTxLoading(false);
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="td-dashboard-root">
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_STYLES }} />

      {/* ── DESKTOP HEADER CONTENT ── */}
      <div className="td-header-row" style={{ background: '#000000', borderBottom: '1px solid #1a1a1a', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, height: 52, flexShrink: 0, gap: 6 }}>

        {/* ── Logo */}
        <Link href="/trade" className="td-header-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, textDecoration: 'none' }}>
          <img
            src="/assets/images/LOGO_PANJANG-1773100758034.png"
            alt="Investoft"
            style={{ height: 36, width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Link>

        {/* ── Balance + Account Switcher */}
        <div className="td-header-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {/* Segmented Demo/Real switch */}
          <div style={{ display: 'flex', background: '#27272a', borderRadius: 6, border: '1px solid #3f3f46', overflow: 'hidden', height: 28 }}>
            <button
              onClick={() => setAccountType('demo')}
              style={{ padding: '0 8px', height: 28, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: accountType === 'demo' ? '#3b82f6' : 'transparent', color: accountType === 'demo' ? '#fff' : '#a1a1aa' }}>Demo</button>
            <button
              onClick={() => setAccountType('real')}
              style={{ padding: '0 8px', height: 28, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: accountType === 'real' ? '#3b82f6' : 'transparent', color: accountType === 'real' ? '#fff' : '#a1a1aa' }}>Real</button>
          </div>
          {/* Balance text */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4, marginRight: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa' }}>Balance:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{currency.symbol}{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          {/* Deposit button — only visible for real account */}
          <button onClick={() => setShowDepositModal(true)} style={{ marginLeft: 6, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '0 8px', height: 28, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Deposit</button>
        </div>
      </div>

      {/* ── Desktop Asset Selector Bar ── */}
      <div className="td-asset-bar-desktop" style={{ background: '#000000', borderBottom: '1px solid #1a1a1a', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, height: 40, overflowX: 'auto', flexShrink: 0, position: 'relative', zIndex: 50 }}>
        {/* Asset dropdown wrapper — floating panel, does not affect layout */}
        <div className="td-asset-selector-wrapper">
          <button onClick={() => setShowAssetPanel(!showAssetPanel)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, padding: '3px 6px', cursor: 'pointer' }}
          >
            <CategoryIcon category={selectedAsset.category} size={10} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{selectedAsset.symbol}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, alignSelf: 'center', opacity: 0.7 }}>
<polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showAssetPanel && (
            <>
              <div className="td-asset-panel-backdrop" onClick={() => setShowAssetPanel(false)} />
              <div className="td-asset-panel" style={{ top: 40 }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2a45', flexShrink: 0 }}>
                  <input type="text" placeholder="Search assets..." value={assetSearch}
                    onChange={e => setAssetSearch(e.target.value)}
                    autoFocus
                    style={{ width: '100%', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid #1e2a45', flexShrink: 0 }}>
                  {(['all', 'crypto', 'forex', 'commodity', 'stock'] as Array<'all' | 'crypto' | 'forex' | 'commodity' | 'stock'>).map(cat => (
                    <button key={cat} onClick={() => setAssetCategory(cat)}
                      style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'transparent', cursor: 'pointer', color: assetCategory === cat ? '#3b82f6' : '#64748b', borderBottom: assetCategory === cat ? '2px solid #3b82f6' : '2px solid transparent', fontSize: 9, fontWeight: 600 }}>
                      {cat === 'all' ? 'ALL' : CATEGORY_LABELS[cat]?.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                  {filteredAssets.length === 0 && (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: '#71717a', fontSize: 13 }}>No results found</div>
                  )}
                  {filteredAssets.map(asset => {
                    const priceData = prices[asset.symbol];
                    const isSelected = selectedAsset.symbol === asset.symbol;
                    return (
                      <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setShowAssetPanel(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: 'none', background: isSelected ? '#1e2a45' : 'transparent', cursor: 'pointer', borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ color: '#64748b' }}><CategoryIcon category={asset.category} size={12} /></span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#60a5fa' : '#e2e8f0' }}>{asset.symbol}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{asset.name}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                            {priceData?.price ? formatPrice(priceData.price, asset.category) : '—'}
                          </span>
                          {priceData?.change24h !== undefined && priceData.change24h !== 0 && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: priceData.change24h >= 0 ? '#10b981' : '#ef4444', lineHeight: 1.2 }}>
                              {priceData.change24h >= 0 ? '+' : ''}{priceData.change24h.toFixed(2)}%
                            </span>
                          )}
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', lineHeight: 1.2 }}>+{asset.payout}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: tvPrice > 0 ? priceFlashColor : '#64748b', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
            {tvPrice > 0 ? formatPrice(tvPrice, selectedAsset.category) : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', flexShrink: 0 }}>
          {ASSETS.slice(0, 8).map(asset => (
            <button key={asset.symbol} onClick={() => setSelectedAsset(asset)}
              style={{ background: selectedAsset.symbol === asset.symbol ? '#1e2a45' : 'transparent', border: '1px solid ' + (selectedAsset.symbol === asset.symbol ? '#3b82f6' : '#1e2a45'), borderRadius: 4, padding: '2px 7px', cursor: 'pointer', color: selectedAsset.symbol === asset.symbol ? '#60a5fa' : '#64748b', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {asset.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile Asset Row ── */}
      <div className="td-asset-bar-mobile" style={{ display: 'none', background: '#000000', borderBottom: '1px solid #1a1a1a', padding: '0 12px', alignItems: 'center', justifyContent: 'space-between', height: 44, flexShrink: 0, position: 'relative', zIndex: 50 }}>
        {/* Left: flag + pair name + payout + chevron */}
        <div className="td-asset-selector-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setShowAssetPanel(!showAssetPanel)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, padding: '3px 6px', cursor: 'pointer' }}
          >
            {/* Colored circle as flag indicator */}
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: selectedAsset.category === 'crypto' ? '#f59e0b' : selectedAsset.category === 'forex' ? '#3b82f6' : selectedAsset.category === 'commodity' ? '#10b981' : '#8b5cf6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CategoryIcon category={selectedAsset.category} size={10} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{selectedAsset.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>95%</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, alignSelf: 'center', opacity: 0.7 }}>
<polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Asset panel dropdown */}
          {showAssetPanel && (
            <>
              <div className="td-asset-panel-backdrop" onClick={() => setShowAssetPanel(false)} />
              <div className="td-asset-panel" style={{ top: 44 }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2a45', flexShrink: 0 }}>
                  <input type="text" placeholder="Search assets..." value={assetSearch}
                    onChange={e => setAssetSearch(e.target.value)}
                    autoFocus
                    style={{ width: '100%', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid #1e2a45', flexShrink: 0 }}>
                  {(['all', 'crypto', 'forex', 'commodity', 'stock'] as Array<'all' | 'crypto' | 'forex' | 'commodity' | 'stock'>).map(cat => (
                    <button key={cat} onClick={() => setAssetCategory(cat)}
                      style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'transparent', cursor: 'pointer', color: assetCategory === cat ? '#3b82f6' : '#64748b', borderBottom: assetCategory === cat ? '2px solid #3b82f6' : '2px solid transparent', fontSize: 9, fontWeight: 600 }}>
                      {cat === 'all' ? 'ALL' : CATEGORY_LABELS[cat]?.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                  {filteredAssets.map(asset => {
                    const isSelected = selectedAsset.symbol === asset.symbol;
                    return (
                      <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setShowAssetPanel(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: 'none', background: isSelected ? '#1e2a45' : 'transparent', cursor: 'pointer', borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: asset.category === 'crypto' ? '#f59e0b' : asset.category === 'forex' ? '#3b82f6' : asset.category === 'commodity' ? '#10b981' : '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#60a5fa' : '#e2e8f0' }}>{asset.symbol}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{asset.name}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                            {prices[asset.symbol]?.price ? formatPrice(prices[asset.symbol].price, asset.category) : '—'}
                          </span>
                          {prices[asset.symbol]?.change24h !== undefined && prices[asset.symbol].change24h !== 0 && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: prices[asset.symbol].change24h >= 0 ? '#10b981' : '#ef4444', lineHeight: 1.2 }}>
                              {prices[asset.symbol].change24h >= 0 ? '+' : ''}{prices[asset.symbol].change24h.toFixed(2)}%
                            </span>
                          )}
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', lineHeight: 1.2 }}>+{asset.payout}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: tool icons + duration pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Current Price */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: tvPrice > 0 ? priceFlashColor : '#64748b', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {tvPrice > 0 ? formatPrice(tvPrice, selectedAsset.category) : '—'}
            </span>
          </div>
          {/* Demo/Real segmented switch + Deposit button */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, padding: '0 8px', height: 28, cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 600, minWidth: 130, maxWidth: 130, overflow: 'hidden', justifyContent: 'space-between' }}
            >
              {accountType === 'demo' ? 'Demo' : 'Real'}
              <span style={{ color: '#a1a1aa', fontWeight: 400 }}>&nbsp;{currency.symbol}{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}><path d="M2 3.5L5 6.5L8 3.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {showAccountDropdown && (
              <div style={{ position: 'absolute', top: 32, right: 0, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                <div
                  onClick={() => { setAccountType('demo'); setShowAccountDropdown(false); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: accountType === 'demo' ? '#1d4ed8' : 'transparent', color: '#fff', fontSize: 12 }}
                >
                  <span>Demo</span>
                  <span>{currency.symbol}{demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div
                  onClick={() => { setAccountType('real'); setShowAccountDropdown(false); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: accountType === 'real' ? '#1d4ed8' : 'transparent', color: '#fff', fontSize: 12 }}
                >
                  <span>Real</span>
                  <span>{currency.symbol}{realBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
            <button onClick={() => setShowDepositModal(true)} style={{ marginLeft: 6, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '0 8px', height: 28, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Deposit</button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="td-main-wrapper" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {activeTab !== 'copytrade' && activeTab !== 'account' && activeTab !== 'history' && (
          <TradeMainContent
            selectedAsset={selectedAsset}
            setSelectedAsset={setSelectedAsset}
            showAssetPanel={false}
            setShowAssetPanel={setShowAssetPanel}
            assetCategory={assetCategory}
            setAssetCategory={setAssetCategory}
            assetSearch={assetSearch}
            setAssetSearch={setAssetSearch}
            filteredAssets={filteredAssets}
            prices={prices}
            tvPrice={tvPrice}
            chartContainerRef={chartContainerRef}
            tvWidgetRef={tvWidgetRef}
            activeTrades={activeTrades}
            duration={duration}
            setDuration={setDuration}
            durationInput={durationInput}
            setDurationInput={setDurationInput}
            isEditingDuration={isEditingDuration}
            setIsEditingDuration={setIsEditingDuration}
            handleDurationBlur={handleDurationBlur}
            durationInputRef={durationInputRef}
            amount={amount}
            setAmount={setAmount}
            amountInput={amountInput}
            setAmountInput={setAmountInput}
            isEditingAmount={isEditingAmount}
            setIsEditingAmount={setIsEditingAmount}
            handleAmountBlur={handleAmountBlur}
            amountInputRef={amountInputRef}
            currency={currency}
            currentBalance={currentBalance}
            isPlacingTrade={isPlacingTrade}
            tvPricePositive={tvPrice > 0}
            copyTradeActive={copyTradeActive}
            handleTrade={handleTrade}
            showTutorial={showTutorial}
            setShowTutorial={setShowTutorial}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            tradeHistoryLength={tradeHistory.length}
            allAssets={ASSETS}
          />
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#0a0e1a' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trade History</div>
              {tradeHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: '40px 0' }}>No trade history yet</div>
              ) : tradeHistory.slice(0, 50).map(trade => (
                <div key={trade.id} style={{ padding: '12px 20px', borderBottom: '1px solid #0f172a', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{trade.asset_symbol}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: trade.direction === 'buy' ? '#10b981' : '#ef4444', background: trade.direction === 'buy' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 4 }}>{trade.direction.toUpperCase()}</span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, background: trade.status === 'won' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 4 }}>{trade.status.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: trade.profit_loss >= 0 ? '#10b981' : '#ef4444' }}>
                      {trade.profit_loss >= 0 ? '+' : ''}{currency.symbol}{Math.abs(trade.profit_loss).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Amount: <span style={{ color: '#94a3b8' }}>{currency.symbol}{trade.amount.toFixed(2)}</span></span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Duration: <span style={{ color: '#94a3b8' }}>{trade.duration_seconds}</span></span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Entry: <span style={{ color: '#94a3b8' }}>{trade.entry_price}</span></span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Close: <span style={{ color: '#94a3b8' }}>{trade.close_price}</span></span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(trade.opened_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Account Tab ── */}
        {activeTab === 'account' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80, background: 'transparent' }}>
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 1) PROFILE SECTION */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {(profileFullName ? profileFullName[0] : userEmail ? userEmail[0] : '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    {profileFullName ? profileFullName : 'User_' + (userEmail ? userEmail.split('@')[0] : 'Unknown')}
                  </div>
                  <span style={{ background: '#3f3f46', color: '#a1a1aa', fontSize: 11, padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>
                    ID: {userId ? userId.slice(0, 8) : '--------'}
                  </span>
                </div>
              </div>

              {/* 2) ACTIVATION CARD */}
              <div style={{ background: '#18181b', borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 6 }}>Account Activation</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Top up your account</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: '66.6%', height: 6, background: '#3f3f46', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: '66.6%', height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 13, color: '#a1a1aa', flexShrink: 0 }}>2/3</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 16, flexShrink: 0 }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M12 3H8L2 7h20l-6 4z"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* 3) BALANCE ROW */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #27272a' }}>
                <span style={{ fontSize: 14, color: '#a1a1aa' }}>Balance</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {currency.symbol}{(accountType === 'real' ? realBalance : demoBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* 4) MENU ROWS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Deposit */}
                <div>
                  <button onClick={() => setShowDepositModal(true)}
                    style={{ width: '100%', background: '#18181b', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>Deposit</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* Withdraw */}
                <div>
                  <button onClick={() => setShowWithdrawModal(true)}
                    style={{ width: '100%', background: '#18181b', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>Withdraw</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Transaction History */}
                <div>
                  <button onClick={() => setAccExpandedSection(accExpandedSection === 'history' ? null : 'history')}
                    style={{ width: '100%', background: '#18181b', borderRadius: accExpandedSection === 'history' ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>Transaction History</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={accExpandedSection === 'history' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
                  </button>
                  {accExpandedSection === 'history' && (
                    <div style={{ background: '#18181b', borderRadius: '0 0 12px 12px', padding: '0 16px 14px', borderTop: '1px solid #27272a' }}>
                      {txLoading ? (
                        <div style={{ padding: '16px 0', textAlign: 'center', color: '#71717a', fontSize: 13 }}>Loading...</div>
                      ) : txHistory.length === 0 ? (
                        <div style={{ padding: '16px 0', textAlign: 'center', color: '#71717a', fontSize: 13 }}>No transactions yet</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
                          {txHistory.map(tx => {
                            const isDeposit = tx.type === 'deposit';
                            const statusColor = tx.status === 'approved' ? '#10b981' : tx.status === 'rejected' ? '#ef4444' : '#f59e0b';
                            return (
                              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#09090b', borderRadius: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: isDeposit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: statusColor, flexShrink: 0 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDeposit ? '#10b981' : '#ef4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {isDeposit ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></> : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 18 12"/></>}
                                  </svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', textTransform: 'capitalize' }}>{tx.type}</div>
                                  <div style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: isDeposit ? '#10b981' : '#ef4444' }}>{isDeposit ? '+' : '-'}{tx.currency} {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: tx.status === 'approved' ? 'rgba(16,185,129,0.15)' : tx.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: statusColor, textTransform: 'capitalize' }}>{tx.status}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile */}
                <div>
                  <button onClick={() => setAccExpandedSection(accExpandedSection === 'profile' ? null : 'profile')}
                    style={{ width: '100%', background: '#18181b', borderRadius: accExpandedSection === 'profile' ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4h-8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1 0-7.75"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>Profile</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={accExpandedSection === 'profile' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
                  </button>
                  {accExpandedSection === 'profile' && (
                    <div style={{ background: '#18181b', borderRadius: '0 0 12px 12px', padding: '12px 16px 14px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" placeholder="Full Name" value={profileFullName}
                        onChange={e => setProfileFullName(e.target.value)}
                        style={{ width: '100%', background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <input type="tel" placeholder="Phone Number" value={profilePhone}
                        onChange={e => setProfilePhone(e.target.value)}
                        style={{ width: '100%', background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button onClick={handleProfileSave} disabled={profileSaving}
                        style={{ width: '100%', padding: '10px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: profileSaving ? 'not-allowed' : 'pointer', opacity: profileSaving ? 0.7 : 1 }}>
                        {profileSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      {profileMsg && (
                        <div style={{ fontSize: 11, color: profileMsg.type === 'success' ? '#10b981' : '#ef4444', textAlign: 'center' }}>{profileMsg.text}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Change Password */}
                <div>
                  <button onClick={() => setAccExpandedSection(accExpandedSection === 'password' ? null : 'password')}
                    style={{ width: '100%', background: '#18181b', borderRadius: accExpandedSection === 'password' ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>Change Password</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={accExpandedSection === 'password' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
                  </button>
                  {accExpandedSection === 'password' && (
                    <div style={{ background: '#18181b', borderRadius: '0 0 12px 12px', padding: '12px 16px 14px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="password" placeholder="New Password" value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={{ width: '100%', background: '#09090b', border: '1px solid ' + (passwordMismatch ? '#ef4444' : '#3f3f46'), borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <input type="password" placeholder="Confirm Password" value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        style={{ width: '100%', background: '#09090b', border: '1px solid ' + (passwordMismatch ? '#ef4444' : '#3f3f46'), borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                      {passwordMismatch && (
                        <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'center' }}>Passwords do not match</div>
                      )}
                      <button onClick={handlePasswordChange} disabled={passwordSaving || passwordMismatch}
                        style={{ width: '100%', padding: '10px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: passwordSaving || passwordMismatch ? 'not-allowed' : 'pointer', opacity: passwordSaving || passwordMismatch ? 0.6 : 1 }}>
                        {passwordSaving ? 'Changing...' : 'Change Password'}
                      </button>
                      {passwordMsg && (
                        <div style={{ fontSize: 11, color: passwordMsg.type === 'success' ? '#10b981' : '#ef4444', textAlign: 'center' }}>{passwordMsg.text}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Copy Trade */}
                <div>
                  <button onClick={() => setActiveTab('copytrade')}
                    style={{ width: '100%', background: '#18181b', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4h-8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1 0-7.75"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>Copy Trade</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* About Investoft */}
                <div>
                  <button onClick={() => setAccExpandedSection(accExpandedSection === 'about' ? null : 'about')}
                    style={{ width: '100%', background: '#18181b', borderRadius: accExpandedSection === 'about' ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 14, color: '#fff', fontWeight: 500 }}>About Investoft</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={accExpandedSection === 'about' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
                  </button>
                  {accExpandedSection === 'about' && (
                    <div style={{ background: '#18181b', borderRadius: '0 0 12px 12px', padding: '14px 16px', borderTop: '1px solid #27272a' }}>
                      <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Investoft Trading Platform</div>
                        Investoft is a professional binary options and copy trading platform designed for modern traders. Trade global assets including forex, crypto, commodities, and stocks with real-time market data and advanced analytics.
                        <div style={{ marginTop: 10, fontSize: 12, color: '#71717a' }}>Version 1.0.0 · © 2025 Investoft</div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* 5) SIGN OUT ROW */}
              <div style={{ marginTop: 4 }}>
                <button onClick={handleSignOut}
                  style={{ width: '100%', background: '#18181b', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1 0-2h18a2 2 0 0 0 0 4"/>
                    <polyline points="16 7 22 7 22 13"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ flex: 1, fontSize: 14, color: '#f87171', fontWeight: 500 }}>Sign Out</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── Copy Trade Tab ── */}
        {activeTab === 'copytrade' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', background: '#0a0e1a' }}>
            <CopyTradePage userId={userId} realBalance={realBalance} demoBalance={demoBalance} accountType={accountType} currency={currency} onCopyTradeStatusChange={(active) => setCopyTradeActive(active)} />
          </div>
        )}
      </div>

      {/* ── Alerts Panel ── */}
      {showAlerts && (
        <ModalOverlay onClose={() => setShowAlerts(false)}>
          <div style={{ background: '#0d1224', border: '1px solid #2d3f5e', borderRadius: 12, padding: 0, width: 380, maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>{t('notifications.title')}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {unreadCount > 0 && <button onClick={markAllAlertsRead} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: 12, cursor: 'pointer' }}>{t('notifications.markAllRead')}</button>}
                <button onClick={() => setShowAlerts(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {alerts.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>{t('notifications.noNotifications')}</div>
              ) : alerts.map(alert => (
                <div key={alert.id} style={{ padding: '12px 20px', borderBottom: '1px solid #0f172a', background: alert.read ? 'transparent' : 'rgba(59,130,246,0.05)', borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}>
                      {alert.type === 'success' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                        </svg>}
                      {alert.type === 'error' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>}
                      {alert.type === 'warning' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="12.01" y2="16"/>
                        </svg>}
                      {alert.type === 'info' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{alert.message}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{new Date(alert.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* FIX 2: Bottom Nav — ALL devices, order: Trade / History / Copy Trade / Account */}

      {/* ⚡ Active Trades Floating Button */}
      {activeTrades.length > 0 && (
        <button
          onClick={() => setShowActiveTradesPanel(true)}
          style={{ position: 'fixed', bottom: 70, right: 16, zIndex: 40 }}
          className="bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm font-semibold shadow-lg"
        >
          <span>⚡ Active Trades</span>
          <span className="bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {activeTrades.length}
          </span>
        </button>
      )}

      {/* ⚡ Active Trades Overlay Panel */}
      {showActiveTradesPanel && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowActiveTradesPanel(false); }}
        >
          <div className="bg-zinc-900 border-t border-zinc-700 rounded-t-2xl w-full max-w-lg p-4 max-h-[70vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-bold text-base">Active Trades</span>
              <button
                onClick={() => setShowActiveTradesPanel(false)}
                className="text-zinc-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Empty state */}
            {activeTrades.length === 0 ? (
              <p className="text-zinc-400 text-center py-8">No active trades</p>
            ) : (
              activeTrades.map((trade) => (
                <ActiveTradeRow key={trade.id} trade={trade} />
              ))
            )}
          </div>
        </div>
      )}

      <div className="td-bottom-nav">
        {([
          { tab: 'trade' as const, label: 'Trade', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
            </svg>
          )},
          { tab: 'history' as const, label: 'History', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )},
          { tab: 'copytrade' as const, label: 'Copy Trade', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4h-8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1 0-7.75"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          )},
          { tab: 'account' as const, label: 'Account', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4h-8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          )},
        ] as Array<{ tab: 'trade' | 'history' | 'account' | 'copytrade'; label: string; icon: React.ReactNode }>).map(item => (
          <button key={item.tab} className="td-bottom-nav-btn" onClick={() => setActiveTab(item.tab)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: activeTab === item.tab ? '#2563eb' : '#71717a', borderTop: activeTab === item.tab ? '2px solid #2563eb' : '2px solid transparent', paddingTop: 2 }}>
            {item.icon}
            <span style={{ fontSize: 9, fontWeight: 600 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
