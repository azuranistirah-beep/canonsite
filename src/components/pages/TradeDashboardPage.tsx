'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
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

// ─── Duration Presets (FIX 7: start from 5s) ─────────────────────────────────
const DURATION_PRESETS = [
  { label: '5s', seconds: 5 },
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
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
    background: #0a0e1a;
    color: #e2e8f0;
    font-family: Inter, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
  }

  /* ── Controls Grid ── */
  .td-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 10px;
    background: #0d1224;
    border-top: 1px solid #1e2a45;
    flex-shrink: 0;
  }
  .td-control-col {
    display: flex;
    flex-direction: column;
    background: #111827;
    border-radius: 8px;
    padding: 10px 12px;
    border: 1px solid #1e2a45;
  }

  /* ── Trade Buttons ── */
  .td-trade-btn {
    width: 100%;
    padding: 12px 6px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-top: 8px;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .td-trade-btn:not(:disabled):active {
    transform: scale(0.97);
    filter: brightness(0.9);
  }
  .td-trade-panel {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: #0d1224;
  }

  /* ── Asset Panel (floating dropdown overlay) ── */
  .td-asset-panel {
    position: absolute;
    top: 40px;
    left: 0;
    width: 300px;
    max-height: 420px;
    background: #0d1224;
    border: 1px solid #2d3f5e;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
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
    background: #0d1224;
    border-top: 1px solid #1e2a45;
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .td-main-wrapper {
    padding-bottom: 52px;
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
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }
    .td-chart-container {
      flex: 1;
      position: relative;
      background: #0a0e1a;
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
    }
  }

  /* ── Tablet (768-1279px) ── */
  @media (min-width: 769px) and (max-width: 1279px) {
    .td-controls-grid { gap: 8px !important; padding: 8px !important; }
    .td-control-col { padding: 8px 10px !important; }
    .td-preset-btn { font-size: 10px !important; }
  }

  /* ── Mobile (<768px) ── */
  @media (max-width: 768px) {
    .td-dashboard-root { height: 100vh; overflow: hidden; }
    .td-header-row {
      flex-wrap: nowrap !important;
      gap: 6px !important;
      padding: 0 10px !important;
      min-height: 48px !important;
      height: 48px !important;
    }
    .td-logo-text { font-size: 13px !important; }
    .td-header-balance-text { font-size: 9px !important; }
    .td-header-balance-amount { font-size: 13px !important; }
    .td-header-deposit-btn { font-size: 11px !important; padding: 4px 8px !important; }
    .td-header-icon-btn { padding: 2px !important; }

    /* Mobile main wrapper: scrollable, no fixed height that creates black space */
    .td-main-wrapper {
      padding-bottom: 52px !important;
    }

    /* Mobile main content: column layout, auto height — no fixed height */
    .td-main-content {
      flex-direction: column !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      flex: 1 !important;
      min-height: 0 !important;
      display: flex !important;
      height: auto !important;
    }

    /* Chart area: bigger on mobile, calc-based height */
    .td-chart-area {
      flex: none !important;
      width: 100% !important;
      height: calc(100vh - 340px) !important;
      min-height: 240px !important;
      max-height: 380px !important;
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

    /* Trade panel: auto height, no overflow that creates empty space */
    .td-trade-panel {
      flex: none !important;
      height: auto !important;
      overflow: visible !important;
    }

    /* Asset panel on mobile: full-width dropdown */
    .td-asset-panel {
      width: 90vw !important;
      max-width: 320px !important;
      max-height: 70vh !important;
    }

    /* Controls grid: compact 2-col */
    .td-controls-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 4px !important;
      padding: 4px !important;
    }
    .td-control-col { padding: 5px 7px !important; }
    .td-control-label { font-size: 10px !important; }
    .td-control-value-btn { font-size: 11px !important; padding: 2px 6px !important; }
    .td-range-input { height: 3px !important; }
    .td-range-labels { font-size: 9px !important; }
    .td-duration-presets { grid-template-columns: repeat(4, 1fr) !important; gap: 3px !important; }
    .td-amount-presets { grid-template-columns: repeat(5, 1fr) !important; gap: 3px !important; }
    .td-preset-btn { font-size: 10px !important; padding: 3px 2px !important; }
    .td-sell-btn.td-trade-btn { height: 40px !important; font-size: 13px !important; margin-top: 4px !important; }
    .td-buy-btn.td-trade-btn { height: 40px !important; font-size: 13px !important; margin-top: 4px !important; }
    .td-trade-btn-payout { font-size: 9px !important; }
    .td-balance-text { font-size: 9px !important; margin-top: 2px !important; }
  }

  /* ── Very small screens ── */
  @media (max-width: 374px) {
    .td-chart-area { min-height: 200px !important; max-height: 280px !important; height: calc(100vh - 360px) !important; }
    .td-controls-grid { gap: 3px !important; padding: 3px !important; }
    .td-control-col { padding: 4px 5px !important; }
    .td-preset-btn { font-size: 9px !important; padding: 2px 1px !important; }
    .td-sell-btn.td-trade-btn { height: 36px !important; font-size: 12px !important; }
    .td-buy-btn.td-trade-btn { height: 36px !important; font-size: 12px !important; }
  }

  /* ── Landscape mobile ── */
  @media (orientation: landscape) and (max-width: 900px) {
    .td-chart-area { min-height: 150px !important; max-height: 180px !important; height: 45% !important; }
  }
`;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradeDashboardPage() {
  const { t } = useLanguage();

  // ── Auth & Profile ──
  const [userId, setUserId] = useState<string | null>(null);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [realBalance, setRealBalance] = useState(0);
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [copyTradeActive, setCopyTradeActive] = useState(false);

  // ── Asset & Price ──
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [assetCategory, setAssetCategory] = useState<string>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [tvPrice, setTvPrice] = useState(0);
  const [priceTimestamps, setPriceTimestamps] = useState<Record<string, any>>({});
  const [priceMovementAlerts, setPriceMovementAlerts] = useState<PriceMovementAlert[]>([]);

  // ── Trade Form ──
  const [amount, setAmount] = useState(10);
  const [amountInput, setAmountInput] = useState('10');
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
  const [autoConfirm, setAutoConfirm] = useState(false);
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

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<HTMLIFrameElement>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);

  const currentBalance = accountType === 'demo' ? demoBalance : realBalance;
  const isPriceKadaluarsa = tvPrice <= 0;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        setIsEmailVerified(!!data.user.email_confirmed_at);
        setUserEmail(data.user.email || '');
        fetchProfile(data.user.id);
        fetchAlerts(data.user.id);
        fetchTrades(data.user.id);
      }
    });
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('demo_balance, real_balance, currency, copy_trade_active')
      .eq('user_id', uid)
      .single();
    if (data) {
      setDemoBalance(data.demo_balance ?? 10000);
      setRealBalance(data.real_balance ?? 0);
      if (data.currency) {
        const found = CURRENCIES.find(c => c.code === data.currency);
        if (found) setCurrency(found);
      }
      setCopyTradeActive(data.copy_trade_active ?? false);
    }
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

  useEffect(() => {
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    const updatePrice = async () => {
      const p = await fetchCurrentPrice(selectedAsset);
      if (p > 0) {
        setTvPrice(p);
        setPrices(prev => ({
          ...prev,
          [selectedAsset.symbol]: {
            price: p,
            change24h: prev[selectedAsset.symbol]?.change24h || 0,
            prevPrice: prev[selectedAsset.symbol]?.price || p,
          },
        }));
      }
    };
    updatePrice();
    priceIntervalRef.current = setInterval(updatePrice, 3000);
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [selectedAsset, fetchCurrentPrice]);

  const addToast = useCallback((type: ToastAlert['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, visible: true }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const handleTrade = useCallback(async (direction: 'buy' | 'sell') => {
    if (!userId) { addToast('error', 'Please sign in to trade'); return; }
    if (copyTradeActive) { addToast('warning', 'Copy Trade is active. Stop following to trade manually.'); return; }
    if (!isEmailVerified && accountType === 'real') { addToast('warning', t('tradePanel.emailVerificationRequired')); return; }
    if (amount < 1 || amount > 10000) { addToast('error', 'Amount must be between $1 and $10,000'); return; }
    if (amount > currentBalance) { addToast('error', 'Insufficient balance'); return; }
    if (tvPrice <= 0) { addToast('error', t('tradePanel.priceUnavailable')); return; }
    if (!autoConfirm) { setPendingDirection(direction); setShowConfirm(true); return; }
    await executeTrade(direction);
  }, [userId, copyTradeActive, isEmailVerified, accountType, amount, currentBalance, tvPrice, autoConfirm, t]);

  const executeTrade = useCallback(async (direction: 'buy' | 'sell') => {
    if (!userId) return;
    setIsPlacingTrade(true);
    try {
      const payout = selectedAsset.payout;
      const profit = amount * (payout / 100);
      const { data, error } = await supabase.from('trades').insert({
        user_id: userId,
        asset_symbol: selectedAsset.symbol,
        asset_name: selectedAsset.name,
        direction,
        amount,
        entry_price: tvPrice,
        duration_seconds: duration,
        status: 'active',
        profit_loss: 0,
        account_type: accountType,
        opened_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      const balanceField = accountType === 'demo' ? 'demo_balance' : 'real_balance';
      const newBalance = currentBalance - amount;
      await supabase.from('user_profiles').update({ [balanceField]: newBalance }).eq('user_id', userId);
      if (accountType === 'demo') setDemoBalance(newBalance);
      else setRealBalance(newBalance);
      if (data) {
        setActiveTrades(prev => [data as Trade, ...prev]);
        addToast('success', `Trade opened: ${direction.toUpperCase()} ${selectedAsset.symbol} $${amount}`);
        setTimeout(async () => {
          const won = Math.random() > 0.45;
          const result = won ? 'won' : 'lost';
          const pl = won ? profit : -amount;
          const finalBalance = newBalance + (won ? amount + profit : 0);
          await supabase.from('trades').update({ status: result, profit_loss: pl, closed_at: new Date().toISOString() }).eq('id', data.id);
          await supabase.from('user_profiles').update({ [balanceField]: finalBalance }).eq('user_id', userId);
          if (accountType === 'demo') setDemoBalance(finalBalance);
          else setRealBalance(finalBalance);
          setActiveTrades(prev => prev.filter(t => t.id !== data.id));
          setTradeHistory(prev => [{ ...data, status: result, profit_loss: pl } as Trade, ...prev]);
          if (notificationsEnabled) {
            setTradeNotification({ visible: true, result, amount, profit: pl, countdown: 5 });
            const cd = setInterval(() => {
              setTradeNotification(prev => {
                if (prev.countdown <= 1) { clearInterval(cd); return { ...prev, visible: false }; }
                return { ...prev, countdown: prev.countdown - 1 };
              });
            }, 1000);
          }
          if (userId) fetchAlerts(userId);
        }, duration * 1000);
      }
    } catch (err) {
      console.error('Trade error:', err);
      addToast('error', 'Failed to place trade. Please try again.');
    } finally {
      setIsPlacingTrade(false);
      setShowConfirm(false);
      setPendingDirection(null);
    }
  }, [userId, selectedAsset, amount, tvPrice, duration, accountType, currentBalance, notificationsEnabled, fetchAlerts, addToast]);

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

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="td-dashboard-root">
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_STYLES }} />

      {/* ── Toast Notifications ── */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: toast.type === 'success' ? '#065f46' : toast.type === 'error' ? '#7f1d1d' : toast.type === 'warning' ? '#78350f' : '#1e3a5f',
            color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', maxWidth: 320,
            borderLeft: '3px solid ' + (toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#3b82f6'),
          }}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── Trade Result Notification ── */}
      {tradeNotification.visible && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9998, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{
            background: tradeNotification.result === 'won' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
            color: '#fff', padding: '24px 40px', borderRadius: 16, fontSize: 28, fontWeight: 800,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div>{tradeNotification.result === 'won' ? t('trade.won') : t('trade.lost')}</div>
            <div style={{ fontSize: 20, marginTop: 4 }}>
              {tradeNotification.profit >= 0 ? '+' : ''}${Math.abs(tradeNotification.profit).toFixed(2)}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>Closing in {tradeNotification.countdown}s</div>
          </div>
        </div>
      )}

      {/* ── Email Verification Banner ── */}
      {!isEmailVerified && userId && (
        <div style={{ background: '#78350f', color: '#fef3c7', padding: '6px 16px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{t('emailVerification.banner')}</span>
          <button onClick={handleResendVerification} disabled={resendCooldown > 0}
            style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', opacity: resendCooldown > 0 ? 0.6 : 1 }}>
            {resendCooldown > 0 ? `${resendCooldown}s` : t('emailVerification.resend')}
          </button>
        </div>
      )}

      {/* ── Copy Trade Active Banner ── */}
      {copyTradeActive && (
        <div style={{ background: 'rgba(16,185,129,0.15)', borderBottom: '1px solid rgba(16,185,129,0.3)', padding: '6px 16px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, background: '#10b981', borderRadius: '50%' }} />
          <span style={{ color: '#10b981', fontWeight: 600 }}>Copy Trade Active — Manual trading is disabled</span>
          <Link href="/copy-trade" style={{ color: '#3b82f6', fontSize: 11, textDecoration: 'underline' }}>Manage</Link>
        </div>
      )}

      {/* ── Top Header ── FIX 1 (balance label), FIX 2 (no top nav tabs), FIX 3 (settings icon), FIX 8 (logo) */}
      <div className="td-header-row" style={{ background: '#0d1224', borderBottom: '1px solid #1e2a45', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, height: 52, flexShrink: 0, gap: 4 }}>
        {/* FIX 8: Logo — consistent gradient mark + bold Investoft text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: '-0.03em' }}>I</div>
          <span className="td-logo-text" style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.03em' }}>Investoft</span>
        </div>

        {/* FIX 2: NO desktop nav tabs in header — removed completely */}

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Demo/Real Toggle */}
          <div style={{ display: 'flex', background: '#1a2035', borderRadius: 6, padding: 2, gap: 2 }}>
            <button onClick={() => setAccountType('demo')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: accountType === 'demo' ? '#1e3a5f' : 'transparent', border: accountType === 'demo' ? '1px solid #3b82f6' : '1px solid transparent', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', color: accountType === 'demo' ? '#60a5fa' : '#64748b', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span>Demo</span>
            </button>
            <button onClick={() => setAccountType('real')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: accountType === 'real' ? '#1e3a5f' : 'transparent', border: accountType === 'real' ? '1px solid #10b981' : '1px solid transparent', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', color: accountType === 'real' ? '#10b981' : '#64748b', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9 8h4a2 2 0 0 1 0 4H9v4h4a2 2 0 0 0 0-4"/><line x1="9" y1="8" x2="9" y2="12"/></svg>
              <span>Real</span>
            </button>
          </div>

          {/* Currency Selector */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#e2e8f0', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>{currency.code}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showCurrencyPicker && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, minWidth: 160 }}>
                {CURRENCIES.map(c => (
                  <button key={c.code} onClick={() => { setCurrency(c); setShowCurrencyPicker(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', background: currency.code === c.code ? '#1e3a5f' : 'transparent', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{c.code}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{c.name}</div>
                    </div>
                    {currency.code === c.code && <span style={{ color: '#3b82f6', fontSize: 12, marginLeft: 'auto' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FIX 1: Balance — plain "Balance" label, no translation key */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2035', borderRadius: 6, padding: '4px 10px', border: '1px solid #2d3f5e' }}>
            <div style={{ textAlign: 'right' }}>
              <div className="td-header-balance-text" style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>Balance</div>
              <div className="td-header-balance-amount" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{currency.symbol}{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <button className="td-header-deposit-btn" onClick={() => setShowDepositModal(true)} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Deposit</button>
          </div>

          {/* Icon Buttons */}
          <button className="td-header-icon-btn" onClick={() => setShowAlerts(true)} style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {unreadCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {/* FIX 3: Clean settings icon — SlidersHorizontal style */}
          <button className="td-header-icon-btn" onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
              <circle cx="8" cy="6" r="2" fill="#0d1117"/>
              <circle cx="16" cy="12" r="2" fill="#0d1117"/>
              <circle cx="10" cy="18" r="2" fill="#0d1117"/>
            </svg>
          </button>
          <button className="td-header-icon-btn" onClick={handleSignOut} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1 0-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* FIX 4: Asset Selector Bar — uses floating dropdown, does NOT replace chart */}
      <div style={{ background: '#0d1224', borderBottom: '1px solid #1e2a45', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, height: 40, overflowX: 'auto', flexShrink: 0, position: 'relative', zIndex: 50 }}>
        {/* Asset dropdown wrapper — floating panel, does not affect layout */}
        <div className="td-asset-selector-wrapper">
          <button onClick={() => setShowAssetPanel(!showAssetPanel)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 5, padding: '4px 9px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <CategoryIcon category={selectedAsset.category} size={12} />
            <span>{selectedAsset.symbol}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {/* FIX 4: Floating dropdown panel — does NOT replace chart layout */}
          {showAssetPanel && (
            <>
              <div className="td-asset-panel-backdrop" onClick={() => setShowAssetPanel(false)} />
              <div className="td-asset-panel">
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
                      style={{ flex: 1, padding: '6px 2px', border: 'none', background: 'transparent', cursor: 'pointer', color: assetCategory === cat ? '#3b82f6' : '#64748b', borderBottom: assetCategory === cat ? '2px solid #3b82f6' : '2px solid transparent', fontSize: 9, fontWeight: 600, transition: 'all 0.15s' }}>
                      {cat === 'all' ? 'ALL' : CATEGORY_LABELS[cat]?.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                  {filteredAssets.length === 0 && (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>No results found</div>
                    </div>
                  )}
                  {filteredAssets.map(asset => {
                    const priceData = prices[asset.symbol];
                    const isSelected = selectedAsset.symbol === asset.symbol;
                    return (
                      <button key={asset.symbol} onClick={() => { setSelectedAsset(asset); setShowAssetPanel(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: 'none', background: isSelected ? '#1e2a45' : 'transparent', cursor: 'pointer', borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent', transition: 'all 0.1s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ color: '#64748b' }}><CategoryIcon category={asset.category} size={12} /></span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#60a5fa' : '#e2e8f0' }}>{asset.symbol}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{asset.name}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                            {priceData?.price ? formatPrice(priceData.price, asset.category) : '—'}
                          </div>
                          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>+{asset.payout}%</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: tvPrice > 0 ? '#fff' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            {tvPrice > 0 ? formatPrice(tvPrice, selectedAsset.category) : '—'}
          </span>
          {prices[selectedAsset.symbol] && prices[selectedAsset.symbol].change24h !== 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: prices[selectedAsset.symbol].change24h >= 0 ? '#10b981' : '#ef4444' }}>
              {prices[selectedAsset.symbol].change24h >= 0 ? '+' : ''}{prices[selectedAsset.symbol].change24h.toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', flexShrink: 0 }}>
          {ASSETS.slice(0, 8).map(asset => (
            <button key={asset.symbol} onClick={() => setSelectedAsset(asset)}
              style={{ background: selectedAsset.symbol === asset.symbol ? '#1e3a5f' : 'transparent', border: '1px solid ' + (selectedAsset.symbol === asset.symbol ? '#3b82f6' : '#1e2a45'), borderRadius: 4, padding: '2px 7px', cursor: 'pointer', color: selectedAsset.symbol === asset.symbol ? '#60a5fa' : '#64748b', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {asset.symbol}
            </button>
          ))}
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
                <div key={trade.id} style={{ background: '#0d1224', border: '1px solid #1e2a45', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{trade.asset_symbol}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{trade.direction.toUpperCase()} · {formatDuration(trade.duration_seconds)} · {new Date(trade.opened_at).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: trade.status === 'won' ? '#10b981' : '#ef4444' }}>
                      {trade.profit_loss >= 0 ? '+' : ''}{currency.symbol}{Math.abs(trade.profit_loss).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: trade.status === 'won' ? '#10b981' : '#ef4444', marginTop: 2 }}>{trade.status.toUpperCase()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Account Tab ── */}
        {activeTab === 'account' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', background: '#0a0e1a' }}>
            <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0d1224', border: '1px solid #1e2a45', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {userEmail ? userEmail[0].toUpperCase() : '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail || 'Loading...'}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Member Account</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isEmailVerified ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: '1px solid ' + (isEmailVerified ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'), borderRadius: 8, padding: '8px 12px' }}>
                  {isEmailVerified
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isEmailVerified ? '#10b981' : '#f59e0b' }}>{isEmailVerified ? 'Email Verified' : 'Email Not Verified'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{userEmail}</div>
                  </div>
                  {!isEmailVerified && (
                    <button onClick={handleResendVerification} disabled={resendCooldown > 0}
                      style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', opacity: resendCooldown > 0 ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {resendCooldown > 0 ? `${resendCooldown}s` : 'Verify'}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ background: '#0d1224', border: '1px solid #1e2a45', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Balance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#1a2035', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Demo Balance</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{currency.symbol}{demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Practice account</div>
                  </div>
                  <div style={{ background: '#1a2035', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Real Balance</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{currency.symbol}{realBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Live account</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowDepositModal(true)} style={{ flex: 1, padding: '9px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Deposit</button>
                  <button onClick={() => setShowWithdrawModal(true)} style={{ flex: 1, padding: '9px', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 8, color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Withdraw</button>
                </div>
              </div>
              <div style={{ background: '#0d1224', border: '1px solid #1e2a45', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Type</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: accountType === 'demo' ? '#3b82f6' : '#10b981' }} />
                    <span style={{ fontSize: 13, color: accountType === 'demo' ? '#3b82f6' : '#10b981', fontWeight: 600 }}>{accountType === 'demo' ? 'Demo' : 'Real'}</span>
                  </div>
                  <button onClick={() => setActiveTab('copytrade')} style={{ background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, padding: '6px 12px', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Manage</button>
                </div>
              </div>
              <div style={{ background: '#0d1224', border: '1px solid #1e2a45', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Copy Trade</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: copyTradeActive ? '#10b981' : '#475569' }} />
                    <span style={{ fontSize: 13, color: copyTradeActive ? '#10b981' : '#94a3b8', fontWeight: 600 }}>{copyTradeActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <button onClick={() => setActiveTab('copytrade')} style={{ background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, padding: '6px 12px', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Manage</button>
                </div>
              </div>
              <button onClick={handleSignOut} style={{ width: '100%', padding: '11px', background: '#7f1d1d', border: 'none', borderRadius: 8, color: '#fca5a5', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign Out</button>
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
                <div key={alert.id} style={{ padding: '12px 20px', borderBottom: '1px solid #0f172a', background: alert.read ? 'transparent' : 'rgba(59,130,246,0.05)', borderLeft: alert.read ? 'none' : '3px solid #3b82f6' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}>
                      {alert.type === 'success' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
                      {alert.type === 'error' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
                      {alert.type === 'warning' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                      {alert.type === 'info' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
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

      {/* FIX 5: Settings Modal — compact, max-width 400px, professional */}
      {showSettings && (
        <ModalOverlay onClose={() => setShowSettings(false)}>
          <div style={{ background: '#0d1117', border: '1px solid #1e2a45', borderRadius: 12, width: 380, maxWidth: '92vw', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e2a45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/>
                  <line x1="4" y1="12" x2="20" y2="12"/>
                  <line x1="4" y1="18" x2="20" y2="18"/>
                  <circle cx="8" cy="6" r="2" fill="#0d1117"/>
                  <circle cx="16" cy="12" r="2" fill="#0d1117"/>
                  <circle cx="10" cy="18" r="2" fill="#0d1117"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Settings</span>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Currency */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Currency</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                  {CURRENCIES.map(c => (
                    <button key={c.code} onClick={() => { setCurrency(c); }}
                      style={{ padding: '5px 4px', borderRadius: 6, border: '1px solid ' + (currency.code === c.code ? '#3b82f6' : '#1e2a45'), cursor: 'pointer', fontSize: 11, fontWeight: 600, background: currency.code === c.code ? 'rgba(59,130,246,0.15)' : '#111827', color: currency.code === c.code ? '#60a5fa' : '#64748b', textAlign: 'center' }}>
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
              {/* Divider */}
              <div style={{ height: 1, background: '#1e2a45' }} />
              {/* Auto Confirm */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Auto Confirm Trades</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Skip confirmation dialog</div>
                </div>
                <button onClick={() => setAutoConfirm(!autoConfirm)}
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: autoConfirm ? '#3b82f6' : '#1e2a45', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: autoConfirm ? 21 : 3, transition: 'left 0.2s' }} />
                </button>
              </div>
              {/* Trade Notifications */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Trade Notifications</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Show result popups</div>
                </div>
                <button onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: notificationsEnabled ? '#3b82f6' : '#1e2a45', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: notificationsEnabled ? 21 : 3, transition: 'left 0.2s' }} />
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Deposit Modal ── */}
      {showDepositModal && (
        <ModalOverlay onClose={() => { setShowDepositModal(false); setDepositStep('amount'); }}>
          <div style={{ background: '#0d1224', border: '1px solid #2d3f5e', borderRadius: 12, padding: 0, width: 400, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2a45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>Deposit Funds</h3>
              <button onClick={() => { setShowDepositModal(false); setDepositStep('amount'); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>Currency</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CURRENCIES.map(c => (
                    <button key={c.code} onClick={() => setDepositCurrency(c)}
                      style={{ flex: '1 1 auto', padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: depositCurrency.code === c.code ? '#3b82f6' : '#1a2035', color: depositCurrency.code === c.code ? '#fff' : '#94a3b8' }}>
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>Amount ({depositCurrency.code})</label>
                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                  placeholder={`Min. ${depositCurrency.symbol}${CURRENCY_MIN_DEPOSITS[depositCurrency.code] || 100}`}
                  style={{ width: '100%', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {(CURRENCY_QUICK_AMOUNTS[depositCurrency.code] || [100, 250, 500, 1000]).map(amt => (
                  <button key={amt} onClick={() => setDepositAmount(amt.toString())}
                    style={{ flex: '1 1 auto', padding: '8px', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {depositCurrency.symbol}{amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <button onClick={handleDeposit}
                style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Proceed to Payment
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Withdraw Modal ── */}
      {showWithdrawModal && (
        <ModalOverlay onClose={() => setShowWithdrawModal(false)}>
          <div style={{ background: '#0d1224', border: '1px solid #2d3f5e', borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#fff' }}>Withdraw Funds</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Available Real Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{currency.symbol}{realBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount"
              style={{ width: '100%', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowWithdrawModal(false)} style={{ flex: 1, padding: '10px', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 8, color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleWithdraw} style={{ flex: 1, padding: '10px', background: '#059669', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Submit</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* FIX 2: Bottom Nav — ALL devices, order: Trade / History / Copy Trade / Account */}
      <div className="td-bottom-nav">
        {([
          { tab: 'trade' as const, label: 'Trade', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          )},
          { tab: 'history' as const, label: 'History', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          )},
          { tab: 'copytrade' as const, label: 'Copy Trade', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          )},
          { tab: 'account' as const, label: 'Account', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          )},
        ] as Array<{ tab: 'trade' | 'history' | 'account' | 'copytrade'; label: string; icon: React.ReactNode }>).map(item => (
          <button key={item.tab} className="td-bottom-nav-btn" onClick={() => setActiveTab(item.tab)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: activeTab === item.tab ? (item.tab === 'copytrade' ? '#10b981' : '#3b82f6') : '#64748b', borderTop: activeTab === item.tab ? ('2px solid ' + (item.tab === 'copytrade' ? '#10b981' : '#3b82f6')) : '2px solid transparent', paddingTop: 2 }}>
            {item.icon}
            <span style={{ fontSize: 9, fontWeight: 600 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
