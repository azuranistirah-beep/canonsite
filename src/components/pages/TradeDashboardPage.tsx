'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';



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
// ... existing code ...
<span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>Payout {selectedAsset?.payout ?? 95}%</span>
            </button>
            {isPriceKadaluarsa && tvPrice === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: 'rgba(239,68,68,0.95)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{t('tradePanel.priceUnavailable')}</div>
            )}
          </div>
// ... existing code ...
<span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>Payout {selectedAsset?.payout ?? 95}%</span>
            </button>
            {isPriceKadaluarsa && tvPrice === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: 'rgba(239,68,68,0.95)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{t('tradePanel.priceUnavailable')}</div>
            )}
          </div>
// ... existing code ...
