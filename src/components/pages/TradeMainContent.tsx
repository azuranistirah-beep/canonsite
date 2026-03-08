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
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
];

const AMOUNT_PRESETS = [10, 50, 100, 500];

function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  return Math.floor(seconds / 3600) + 'h';
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

// Category color dot for suggestion items
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

  // Filter suggestions from allAssets based on searchQuery
  const suggestions = React.useMemo(() => {
    const safeAssets = Array.isArray(allAssets) ? allAssets : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      // Show top 10 default assets when empty
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

  return (
    <div
      className="td-main-content td-main-wrapper"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
    >
      {/* Chart Area — fills all remaining flex space */}
      <div
        className="td-chart-area"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
      >
        {/* Search bar toolbar — sits above chart */}
        <div
          className="td-search-toolbar"
          style={{ background: '#0d1224', borderBottom: '1px solid #1e2a45', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative', zIndex: 200 }}
        >
          {/* Search with suggestions */}
          <div ref={searchRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 6, padding: '3px 8px', gap: 5 }}>
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
                  background: '#0d1117',
                  border: '1px solid #2d3748',
                  borderRadius: 8,
                  zIndex: 9999,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
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
                        {/* Colored dot indicator */}
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

        {/* Chart Container — absolutely positioned iframe fills 100% */}
        <div
          ref={chartContainerRef}
          className="td-chart-container"
          style={{ flex: 1, position: 'relative', background: '#0a0e1a', width: '100%', minHeight: 0 }}
        >
          <iframe
            ref={tvWidgetRef}
            key={selectedAsset.tvSymbol}
            src={'https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=' + encodeURIComponent(selectedAsset.tvSymbol) + '&interval=1&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=1&saveimage=0&toolbarbg=0d1224&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&allow_symbol_change=1&calendar=0&hotlist=0&details=0&news=0'}
            className="td-chart-iframe"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        </div>

        {activeTrades.length > 0 && (
          <div style={{ background: '#0d1224', borderTop: '1px solid #1e2a45', padding: '5px 12px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center' }}>ACTIVE:</span>
            {activeTrades.map(trade => (
              <div key={trade.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2035', borderRadius: 6, padding: '3px 10px', border: '1px solid ' + (trade.direction === 'buy' ? '#065f46' : '#7f1d1d'), whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: trade.direction === 'buy' ? '#10b981' : '#ef4444' }}>{trade.direction.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{trade.asset_symbol}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>${trade.amount}</span>
              </div>
            ))}
          </div>
        )}

        {/* Trade Panel — fixed height, does NOT stretch */}
        <div className="td-trade-panel">
          <div className="td-controls-grid">
            {/* Duration Column */}
            <div className="td-control-col">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="td-control-label" style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</span>
                {isEditingDuration ? (
                  <input ref={durationInputRef} type="number" value={durationInput}
                    onChange={e => setDurationInput(e.target.value)}
                    onBlur={handleDurationBlur}
                    onKeyDown={e => { if (e.key === 'Enter') handleDurationBlur(); }}
                    autoFocus min={5} max={3600} step={5}
                    style={{ width: 52, background: '#1a2035', border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 5px', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'right', outline: 'none' }}
                  />
                ) : (
                  <button className="td-control-value-btn" onClick={() => { setIsEditingDuration(true); setDurationInput(duration.toString()); }}
                    style={{ background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 4, padding: '2px 7px', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {formatDuration(duration)}
                  </button>
                )}
              </div>
              <input className="td-range-input" type="range" min={5} max={3600} step={5} value={duration}
                onChange={e => { const v = parseInt(e.target.value); setDuration(v); setDurationInput(v.toString()); }}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer', height: 4 }}
              />
              <div className="td-range-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
                <span>5s</span><span>1h</span>
              </div>
              <div className="td-duration-presets" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 6 }}>
                {DURATION_PRESETS.map(preset => (
                  <button key={preset.seconds} className="td-preset-btn"
                    onClick={() => { setDuration(preset.seconds); setDurationInput(preset.seconds.toString()); }}
                    style={{ padding: '4px 2px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: duration === preset.seconds ? '#3b82f6' : '#1a2035', color: duration === preset.seconds ? '#fff' : '#64748b', textAlign: 'center' }}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <button className="td-sell-btn td-trade-btn" onClick={() => handleTrade('sell')}
                  disabled={isPlacingTrade || tvPrice <= 0 || copyTradeActive}
                  style={{ width: '100%', height: 44, padding: '0 6px', border: 'none', borderRadius: 8, cursor: isPlacingTrade || tvPrice <= 0 || copyTradeActive ? 'not-allowed' : 'pointer', background: isPlacingTrade || tvPrice <= 0 || copyTradeActive ? '#374151' : 'linear-gradient(135deg, #dc2626, #b91c1c)', opacity: isPlacingTrade || tvPrice <= 0 || copyTradeActive ? 0.6 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, boxShadow: tvPricePositive && !copyTradeActive ? '0 4px 12px rgba(220,38,38,0.3)' : 'none', transition: 'all 0.15s', marginTop: 0 }}>
                  <span className="td-trade-btn" style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 19 2 5 22 5"/></svg>
                    <span>SELL</span>
                  </span>
                  <span className="td-trade-btn-payout" style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>Payout {selectedAsset?.payout ?? 95}%</span>
                </button>
                {isPriceKadaluarsa && (
                  <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: 'rgba(239,68,68,0.95)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                    {t('tradePanel.priceUnavailable')}
                  </div>
                )}
              </div>
            </div>

            {/* Amount Column */}
            <div className="td-control-col">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="td-control-label" style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</span>
                {isEditingAmount ? (
                  <input ref={amountInputRef} type="number" value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    onBlur={handleAmountBlur}
                    onKeyDown={e => { if (e.key === 'Enter') handleAmountBlur(); }}
                    autoFocus min={1} max={10000}
                    style={{ width: 64, background: '#1a2035', border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 5px', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'right', outline: 'none' }}
                  />
                ) : (
                  <button className="td-control-value-btn" onClick={() => { setIsEditingAmount(true); setAmountInput(amount.toString()); }}
                    style={{ background: '#1a2035', border: '1px solid #2d3f5e', borderRadius: 4, padding: '2px 7px', color: '#10b981', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {currency.symbol}{amount.toLocaleString()}
                  </button>
                )}
              </div>
              <input className="td-range-input" type="range" min={1} max={10000} step={1} value={amount}
                onChange={e => { const v = parseInt(e.target.value); setAmount(v); setAmountInput(v.toString()); }}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer', height: 4 }}
              />
              <div className="td-range-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
                <span>{currency.symbol}1</span><span>{currency.symbol}10k</span>
              </div>
              <div className="td-amount-presets" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginTop: 6 }}>
                {AMOUNT_PRESETS.map(preset => (
                  <button key={preset} className="td-preset-btn"
                    onClick={() => { setAmount(preset); setAmountInput(preset.toString()); }}
                    style={{ padding: '4px 2px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: amount === preset ? '#10b981' : '#1a2035', color: amount === preset ? '#fff' : '#64748b', textAlign: 'center' }}>
                    {currency.symbol}{preset}
                  </button>
                ))}
                <button className="td-preset-btn"
                  onClick={() => { const max = Math.min(currentBalance, 10000); setAmount(max); setAmountInput(max.toString()); }}
                  style={{ padding: '4px 2px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: '#1a2035', color: '#64748b', textAlign: 'center' }}>
                  MAX
                </button>
              </div>
              <div className="td-balance-text" style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                Bal: {currency.symbol}{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <button className="td-buy-btn td-trade-btn" onClick={() => handleTrade('buy')}
                  disabled={isPlacingTrade || tvPrice <= 0 || copyTradeActive}
                  style={{ width: '100%', height: 44, padding: '0 6px', border: 'none', borderRadius: 8, cursor: isPlacingTrade || tvPrice <= 0 || copyTradeActive ? 'not-allowed' : 'pointer', background: isPlacingTrade || tvPrice <= 0 || copyTradeActive ? '#374151' : 'linear-gradient(135deg, #059669, #047857)', opacity: isPlacingTrade || tvPrice <= 0 || copyTradeActive ? 0.6 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, boxShadow: tvPricePositive && !copyTradeActive ? '0 4px 12px rgba(5,150,105,0.3)' : 'none', transition: 'all 0.15s', marginTop: 0 }}>
                  <span className="td-trade-btn" style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 5 22 19 2 19"/></svg>
                    <span>BUY</span>
                  </span>
                  <span className="td-trade-btn-payout" style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>Payout {selectedAsset?.payout ?? 95}%</span>
                </button>
                {isPriceKadaluarsa && (
                  <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: 'rgba(239,68,68,0.95)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                    {t('tradePanel.priceUnavailable')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {copyTradeActive && (
            <div style={{ padding: '0 10px 8px', background: '#0d1224' }}>
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
