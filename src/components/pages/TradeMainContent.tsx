'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

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
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  return Math.floor(seconds / 86400) + 'd';
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

const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#f59e0b',
  forex: '#3b82f6',
  commodity: '#10b981',
  stock: '#8b5cf6',
};

interface TradeMainContentProps {
  selectedAsset: Asset;
  setSelectedAsset: (asset: Asset) => void;
  showAssetPanel: boolean;
  setShowAssetPanel: (v: boolean) => void;
  assetCategory: string;
  setAssetCategory: (v: string) => void;
  assetSearch: string;
  setAssetSearch: (v: string) => void;
  filteredAssets: Asset[];
  prices: Record<string, PriceData>;
  tvPrice: number;
  chartContainerRef: React.RefObject<HTMLDivElement>;
  tvWidgetRef: React.RefObject<HTMLIFrameElement>;
  activeTrades: Array<{ id: string; direction: string; asset_symbol: string; amount: number }>;
  duration: number;
  setDuration: (v: number) => void;
  durationInput: string;
  setDurationInput: (v: string) => void;
  isEditingDuration: boolean;
  setIsEditingDuration: (v: boolean) => void;
  handleDurationBlur: () => void;
  durationInputRef: React.RefObject<HTMLInputElement>;
  amount: number;
  setAmount: (v: number) => void;
  amountInput: string;
  setAmountInput: (v: string) => void;
  isEditingAmount: boolean;
  setIsEditingAmount: (v: boolean) => void;
  handleAmountBlur: () => void;
  amountInputRef: React.RefObject<HTMLInputElement>;
  currency: Currency;
  currentBalance: number;
  isPlacingTrade: boolean;
  tvPricePositive: boolean;
  copyTradeActive: boolean;
  handleTrade: (direction: 'buy' | 'sell') => void;
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  tradeHistoryLength: number;
  allAssets?: Asset[];
}

const STEPPER_STYLES = `
  /* ── Stepper controls ── */
  .td-stepper-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #fff;
    font-size: 20px;
    font-weight: 400;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: all 0.15s;
  }
  .td-stepper-btn:active {
    background: #3f3f46;
    transform: scale(0.92);
  }
  .td-stepper-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .td-stepper-value {
    flex: 1;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    min-width: 60px;
  }
  .td-stepper-amount-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    min-width: 60px;
    width: 80px;
    -webkit-appearance: none;
    -moz-appearance: textfield;
  }
  .td-stepper-amount-input::-webkit-outer-spin-button,
  .td-stepper-amount-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Mobile/Desktop unified stepper controls — shown on ALL screen sizes */
  .td-mobile-controls {
    display: flex !important;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    background: #000000;
    flex-shrink: 0;
  }
  .td-controls-grid-desktop {
    display: none !important;
  }
  .td-mobile-stepper-row {
    display: flex;
    gap: 8px;
  }
  .td-mobile-stepper-col {
    flex: 1;
    background: #18181b;
    border-radius: 12px;
    padding: 7px 10px;
    border: 1px solid #27272a;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .td-mobile-stepper-label {
    font-size: 10px;
    color: #a1a1aa;
    font-weight: 500;
  }
  .td-mobile-stepper-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .td-mobile-stepper-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #fff;
    font-size: 18px;
    font-weight: 400;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }
  .td-mobile-stepper-btn:active {
    background: #3f3f46;
    transform: scale(0.92);
  }
  .td-mobile-stepper-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .td-mobile-stepper-value {
    flex: 1;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    min-width: 60px;
  }
  .td-mobile-amount-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    min-width: 60px;
    width: 80px;
    -webkit-appearance: none;
    -moz-appearance: textfield;
  }
  .td-mobile-amount-input::-webkit-outer-spin-button,
  .td-mobile-amount-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .td-mobile-trade-btns {
    display: flex;
    gap: 8px;
  }
  .td-mobile-sell-btn {
    flex: 1;
    height: 72px;
    background: #ef4444;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .td-mobile-sell-btn:not(:disabled):active {
    transform: scale(0.96);
    filter: brightness(0.9);
  }
  .td-mobile-sell-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .td-mobile-buy-btn {
    flex: 1;
    height: 72px;
    background: #22c55e;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .td-mobile-buy-btn:not(:disabled):active {
    transform: scale(0.96);
    filter: brightness(0.9);
  }
  .td-mobile-buy-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default function TradeMainContent({
  selectedAsset,
  setSelectedAsset,
  showAssetPanel,
  setShowAssetPanel,
  assetCategory,
  setAssetCategory,
  assetSearch,
  setAssetSearch,
  filteredAssets,
  prices,
  tvPrice,
  chartContainerRef,
  tvWidgetRef,
  activeTrades,
  duration,
  setDuration,
  durationInput,
  setDurationInput,
  isEditingDuration,
  setIsEditingDuration,
  handleDurationBlur,
  durationInputRef,
  amount,
  setAmount,
  amountInput,
  setAmountInput,
  isEditingAmount,
  setIsEditingAmount,
  handleAmountBlur,
  amountInputRef,
  currency,
  currentBalance,
  isPlacingTrade,
  tvPricePositive,
  copyTradeActive,
  handleTrade,
  showTutorial,
  setShowTutorial,
  showHistory,
  setShowHistory,
  tradeHistoryLength,
  allAssets,
}: TradeMainContentProps) {
  const { t } = useLanguage();
  const isPriceKadaluarsa = tvPrice <= 0;

  // ── Search suggestion state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Manual amount input state
  const [manualAmountValue, setManualAmountValue] = useState(amount.toString());
  const [amountInputInvalid, setAmountInputInvalid] = useState(false);

  // Mobile amount input state
  const [mobileAmountValue, setMobileAmountValue] = useState(amount.toString());

  // Sync manual input when amount changes externally
  useEffect(() => {
    setManualAmountValue(amount.toString());
    setMobileAmountValue(amount.toString());
    setAmountInputInvalid(false);
  }, [amount]);

  const handleManualAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setManualAmountValue(raw);
    const val = parseFloat(raw);
    if (!raw || isNaN(val) || val <= 0 || val > currentBalance) {
      setAmountInputInvalid(true);
    } else {
      setAmountInputInvalid(false);
      setAmount(val);
      setAmountInput(val.toString());
    }
  }, [currentBalance, setAmount, setAmountInput]);

  const handleManualAmountBlur = useCallback(() => {
    const val = parseFloat(manualAmountValue);
    if (!manualAmountValue || isNaN(val) || val <= 0) {
      setManualAmountValue(amount.toString());
      setAmountInputInvalid(false);
    } else {
      const clamped = Math.min(val, currentBalance, 10000);
      setAmount(clamped);
      setAmountInput(clamped.toString());
      setManualAmountValue(clamped.toString());
      setAmountInputInvalid(false);
    }
  }, [manualAmountValue, amount, currentBalance, setAmount, setAmountInput]);

  // Mobile amount handlers
  const handleMobileAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setMobileAmountValue(raw);
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 10 && val <= Math.min(currentBalance, 10000)) {
      setAmount(val);
      setAmountInput(val.toString());
      setManualAmountValue(val.toString());
    }
  }, [currentBalance, setAmount, setAmountInput]);

  const handleMobileAmountBlur = useCallback(() => {
    const val = parseFloat(mobileAmountValue);
    if (isNaN(val) || val < 10) {
      setMobileAmountValue('10');
      setAmount(10);
      setAmountInput('10');
      setManualAmountValue('10');
    } else {
      const clamped = Math.min(val, currentBalance, 10000);
      setMobileAmountValue(clamped.toString());
      setAmount(clamped);
      setAmountInput(clamped.toString());
      setManualAmountValue(clamped.toString());
    }
  }, [mobileAmountValue, currentBalance, setAmount, setAmountInput]);

  // Duration stepper
  const currentDurationIndex = DURATION_PRESETS.findIndex(p => p.seconds === duration);
  const handleDurationDecrease = useCallback(() => {
    const idx = DURATION_PRESETS.findIndex(p => p.seconds === duration);
    const newIdx = Math.max(0, idx === -1 ? 0 : idx - 1);
    setDuration(DURATION_PRESETS[newIdx].seconds);
    setDurationInput(DURATION_PRESETS[newIdx].seconds.toString());
  }, [duration, setDuration, setDurationInput]);

  const handleDurationIncrease = useCallback(() => {
    const idx = DURATION_PRESETS.findIndex(p => p.seconds === duration);
    const newIdx = Math.min(DURATION_PRESETS.length - 1, idx === -1 ? 0 : idx + 1);
    setDuration(DURATION_PRESETS[newIdx].seconds);
    setDurationInput(DURATION_PRESETS[newIdx].seconds.toString());
  }, [duration, setDuration, setDurationInput]);

  // Amount stepper
  const handleAmountDecrease = useCallback(() => {
    const newVal = Math.max(1, amount - 1);
    setAmount(newVal);
    setAmountInput(newVal.toString());
    setManualAmountValue(newVal.toString());
    setMobileAmountValue(newVal.toString());
  }, [amount, setAmount, setAmountInput]);

  const handleAmountIncrease = useCallback(() => {
    const newVal = Math.min(Math.min(currentBalance, 10000), amount + 1);
    setAmount(newVal);
    setAmountInput(newVal.toString());
    setManualAmountValue(newVal.toString());
    setMobileAmountValue(newVal.toString());
  }, [amount, currentBalance, setAmount, setAmountInput]);

  // Get current duration label
  const currentDurationLabel = useMemo(() => {
    const preset = DURATION_PRESETS.find(p => p.seconds === duration);
    return preset ? preset.label : formatDuration(duration);
  }, [duration]);

  // Filter suggestions from allAssets based on searchQuery
  const suggestions = React.useMemo(() => {
    const safeAssets = Array.isArray(allAssets) ? allAssets : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return safeAssets.slice(0, 10);
    }
    return safeAssets.filter(a =>
      a.symbol.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.symbol.replace('/', '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [searchQuery, allAssets]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    setSearchQuery(asset.symbol);
    setShowSuggestions(false);
  }, [setSelectedAsset]);

  // Sync search query when selected asset changes externally
  useEffect(() => {
    setSearchQuery(selectedAsset.symbol);
  }, [selectedAsset.symbol]);

  const isTradeDisabled = isPlacingTrade || copyTradeActive;

  return (
    <div
      className="td-main-content"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <style dangerouslySetInnerHTML={{ __html: STEPPER_STYLES }} />

      {/* Chart Area */}
      <div
        className="td-chart-area"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
      >
        {/* Search bar toolbar */}
        <div
          className="td-search-toolbar"
          style={{ background: '#000000', borderBottom: '1px solid #1a1a1a', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative', zIndex: 200 }}
        >
          {/* Search with suggestions */}
          <div ref={searchRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#111111', border: '1px solid #27272a', borderRadius: 6, padding: '3px 8px', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search asset..."
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 12, fontWeight: 600, width: 90, minWidth: 60 }}
              />
            </div>

            {/* Suggestion Dropdown */}
            {showSuggestions && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  width: 260,
                  maxHeight: 320,
                  overflowY: 'auto',
                  background: '#111111',
                  border: '1px solid #27272a',
                  borderRadius: 8,
                  zIndex: 9999,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                  WebkitOverflowScrolling: 'touch',
                } as React.CSSProperties}
              >
                {suggestions.length === 0 ? (
                  <div style={{ padding: '14px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>No results found</div>
                ) : suggestions.map(asset => {
                  const isSelected = selectedAsset.symbol === asset.symbol;
                  return (
                    <button
                      key={asset.symbol}
                      onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(asset); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        border: 'none',
                        background: isSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
                        cursor: 'pointer',
                        borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[asset.category] || '#64748b', flexShrink: 0 }} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#60a5fa' : '#e2e8f0' }}>{asset.symbol}</div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{asset.name}</div>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: '#10b981', flexShrink: 0 }}>
                        +{asset.payout}%
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chart Container */}
        <div
          ref={chartContainerRef}
          className="td-chart-container"
          style={{ flex: 1, position: 'relative', background: '#000000', width: '100%', minHeight: 0 }}
        >
          <iframe
            ref={tvWidgetRef}
            key={selectedAsset.tvSymbol}
            src={'https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=' + encodeURIComponent(selectedAsset.tvSymbol) + '&interval=1&hidesidetoolbar=0&hidetoptoolbar=1&toolbar=0&symboledit=1&saveimage=0&toolbarbg=000000&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=0&showpopupbutton=1&allow_symbol_change=1&calendar=0&hotlist=0&details=0&news=0'}
            className="td-chart-iframe"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        </div>

        {activeTrades.length > 0 && (
          <div style={{ background: '#000000', borderTop: '1px solid #1a1a1a', padding: '5px 12px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center' }}>ACTIVE:</span>
            {activeTrades.map(trade => (
              <div key={trade.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111111', borderRadius: 6, padding: '3px 10px', border: '1px solid ' + (trade.direction === 'buy' ? '#065f46' : '#7f1d1d'), whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: trade.direction === 'buy' ? '#10b981' : '#ef4444' }}>{trade.direction.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{trade.asset_symbol}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>${trade.amount}</span>
              </div>
            ))}
          </div>
        )}

        {/* Trade Panel */}
        <div className="td-trade-panel">

          {/* ── MOBILE CONTROLS (hidden on desktop) ── */}
          <div className="td-mobile-controls">
            {/* Stepper row */}
            <div className="td-mobile-stepper-row">
              {/* Duration stepper */}
              <div className="td-mobile-stepper-col">
                <span className="td-mobile-stepper-label">Duration</span>
                <div className="td-mobile-stepper-controls">
                  <button
                    className="td-mobile-stepper-btn"
                    onClick={handleDurationDecrease}
                    disabled={currentDurationIndex <= 0}
                  >
                    −
                  </button>
                  <span className="td-mobile-stepper-value">{currentDurationLabel}</span>
                  <button
                    className="td-mobile-stepper-btn"
                    onClick={handleDurationIncrease}
                    disabled={currentDurationIndex >= DURATION_PRESETS.length - 1}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Amount stepper */}
              <div className="td-mobile-stepper-col">
                <span className="td-mobile-stepper-label">Amount</span>
                <div className="td-mobile-stepper-controls">
                  <button
                    className="td-mobile-stepper-btn"
                    onClick={handleAmountDecrease}
                    disabled={amount <= 1}
                  >
                    −
                  </button>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#71717a' }}>{currency.symbol}</span>
                    <input
                      type="number"
                      className="td-mobile-amount-input"
                      value={mobileAmountValue}
                      onChange={handleMobileAmountChange}
                      onBlur={handleMobileAmountBlur}
                      min={10}
                      step={10}
                    />
                  </div>
                  <button
                    className="td-mobile-stepper-btn"
                    onClick={handleAmountIncrease}
                    disabled={amount >= Math.min(currentBalance, 10000)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile SELL / BUY buttons */}
            <div className="td-mobile-trade-btns">
              <button
                className="td-mobile-sell-btn"
                onClick={() => handleTrade('sell')}
                disabled={isPlacingTrade || copyTradeActive}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <polyline points="19 12 12 19 5 12"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>SELL</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>95%</span>
                </div>
              </button>
              <button
                className="td-mobile-buy-btn"
                onClick={() => handleTrade('buy')}
                disabled={isPlacingTrade || copyTradeActive}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/>
                    <polyline points="5 12 12 5 19 12"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>BUY</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>95%</span>
                </div>
              </button>
            </div>

            {copyTradeActive && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '7px 10px', fontSize: 11, color: '#10b981', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Copy Trade Active
              </div>
            )}
          </div>

          {/* ── DESKTOP/TABLET CONTROLS (hidden on mobile) ── */}
          <div className="td-controls-grid-desktop td-controls-grid">

            {/* Duration Column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: '#18181b',
                borderRadius: 12,
                padding: 12,
                border: '1px solid #27272a',
                gap: 8,
                flexShrink: 0,
              }}
            >
              {/* Label */}
              <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>Duration</span>

              {/* Duration Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="td-stepper-btn"
                  onClick={handleDurationDecrease}
                  disabled={currentDurationIndex <= 0}
                >
                  −
                </button>
                <span className="td-stepper-value">{currentDurationLabel}</span>
                <button
                  className="td-stepper-btn"
                  onClick={handleDurationIncrease}
                  disabled={currentDurationIndex >= DURATION_PRESETS.length - 1}
                >
                  +
                </button>
              </div>

              {/* SELL button — down arrow icon ONLY, no text, no payout */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => handleTrade('sell')}
                  disabled={isPlacingTrade || copyTradeActive}
                  style={{
                    width: '100%',
                    height: 72,
                    padding: 0,
                    border: 'none',
                    borderRadius: 12,
                    cursor: (isPlacingTrade || copyTradeActive) ? 'not-allowed' : 'pointer',
                    background: '#ef4444',
                    opacity: (isPlacingTrade || copyTradeActive) ? 0.5 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <polyline points="19 12 12 19 5 12"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>SELL</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>95%</span>
                </button>
              </div>
            </div>

            {/* Amount Column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: '#18181b',
                borderRadius: 12,
                padding: 12,
                border: '1px solid #27272a',
                gap: 8,
                flexShrink: 0,
              }}
            >
              {/* Label */}
              <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>Amount</span>

              {/* Amount Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="td-stepper-btn"
                  onClick={handleAmountDecrease}
                  disabled={amount <= 1}
                >
                  −
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#71717a', flexShrink: 0 }}>{currency.symbol}</span>
                  <input
                    type="number"
                    className="td-stepper-amount-input"
                    value={manualAmountValue}
                    onChange={handleManualAmountChange}
                    onBlur={handleManualAmountBlur}
                    onKeyDown={e => { if (e.key === 'Enter') handleManualAmountBlur(); }}
                    min={10}
                    step={10}
                  />
                </div>
                <button
                  className="td-stepper-btn"
                  onClick={handleAmountIncrease}
                  disabled={amount >= Math.min(currentBalance, 10000)}
                >
                  +
                </button>
              </div>

              {/* BUY button — up arrow icon ONLY, no text, no payout */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => handleTrade('buy')}
                  disabled={isPlacingTrade || copyTradeActive}
                  style={{
                    width: '100%',
                    height: 72,
                    padding: 0,
                    border: 'none',
                    borderRadius: 12,
                    cursor: (isPlacingTrade || copyTradeActive) ? 'not-allowed' : 'pointer',
                    background: '#22c55e',
                    opacity: (isPlacingTrade || copyTradeActive) ? 0.5 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/>
                    <polyline points="5 12 12 5 19 12"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>BUY</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>95%</span>
                </button>
              </div>
            </div>

          </div>

          {copyTradeActive && (
            <div style={{ padding: '0 10px 8px', background: '#000000' }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '7px 10px', fontSize: 11, color: '#10b981', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Copy Trade Active — <span style={{ color: '#64748b', fontSize: 10 }}>Manual trading disabled</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
