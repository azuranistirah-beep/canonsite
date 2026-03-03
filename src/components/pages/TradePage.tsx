'use client';
import React, { useState } from 'react';
import TickerTape from '@/components/TickerTape';
import { ALL_ASSETS, CATEGORY_COLORS, Asset } from '@/data/assets';
import AssetIcon from '@/components/AssetIcon';

const TRADE_ASSETS: Asset[] = [
  ...ALL_ASSETS.filter(a => a.category === 'crypto').slice(0, 20),
  ...ALL_ASSETS.filter(a => a.category === 'stocks').slice(0, 20),
  ...ALL_ASSETS.filter(a => a.category === 'forex').slice(0, 15),
  ...ALL_ASSETS.filter(a => a.category === 'commodities').slice(0, 10),
  ...ALL_ASSETS.filter(a => a.category === 'indices').slice(0, 10),
];

type TradeCategory = 'all' | 'crypto' | 'stocks' | 'forex' | 'commodities' | 'indices';

interface FormErrors {
  amount?: string;
  stopLoss?: string;
  takeProfit?: string;
}

export default function TradePage() {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(TRADE_ASSETS[0]);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('1000');
  const [leverage, setLeverage] = useState('1x');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TradeCategory>('all');

  const leverageOptions = ['1x', '2x', '5x', '10x', '20x', '50x', '100x'];

  const cardStyle = { background: '#0d0e23', border: '1px solid #1e293b' };
  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid #1e293b', color: '#f1f5f9' };
  const inputErrorStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid #ef4444', color: '#f1f5f9' };
  const labelStyle = { color: '#64748b' };

  const filteredAssets = TRADE_ASSETS.filter(a => {
    const matchCat = categoryFilter === 'all' || a.category === categoryFilter;
    const matchSearch = !assetSearch.trim() ||
      a.symbol.toLowerCase().includes(assetSearch.toLowerCase()) ||
      a.name.toLowerCase().includes(assetSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const amountVal = parseFloat(amount);
    if (!amount || isNaN(amountVal)) {
      newErrors.amount = 'Amount is required.';
    } else if (amountVal < 1) {
      newErrors.amount = 'Minimum amount is $1.';
    } else if (amountVal > 1000000) {
      newErrors.amount = 'Maximum amount is $1,000,000.';
    }
    if (stopLoss) {
      const slVal = parseFloat(stopLoss);
      if (isNaN(slVal) || slVal <= 0) {
        newErrors.stopLoss = 'Stop loss must be a positive number.';
      }
    }
    if (takeProfit) {
      const tpVal = parseFloat(takeProfit);
      if (isNaN(tpVal) || tpVal <= 0) {
        newErrors.takeProfit = 'Take profit must be a positive number.';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    setSuccessMsg('');
    if (!validateForm()) return;
    setSuccessMsg(`${side === 'buy' ? 'Buy' : 'Sell'} order for ${selectedAsset.symbol} placed successfully!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const categories: TradeCategory[] = ['all', 'crypto', 'stocks', 'forex', 'commodities', 'indices'];
  const categoryLabels: Record<TradeCategory, string> = {
    all: 'All', crypto: 'Crypto', stocks: 'Stocks', forex: 'Forex', commodities: 'Commod.', indices: 'Indices'
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
        <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-[260px_1fr_280px] xl:grid-cols-[280px_1fr_300px]">
          {/* Asset list */}
          <div className="rounded-2xl overflow-hidden flex flex-col" style={cardStyle}>
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid #1e293b' }}>
              <h2 className="font-semibold text-white text-sm mb-2">Markets</h2>
              {/* Search */}
              <div className="relative mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #1e293b', color: '#f1f5f9' }}
                />
              </div>
              {/* Category filter */}
              <div className="flex flex-wrap gap-1">
                {categories.map(cat => {
                  const colors = cat !== 'all' ? CATEGORY_COLORS[cat] : null;
                  const isActive = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                      style={isActive
                        ? colors
                          ? { background: colors.bg, color: colors.text }
                          : { background: 'rgba(99,102,241,0.2)', color: '#818cf8' }
                        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }
                      }
                    >
                      {categoryLabels[cat]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-hidden overflow-y-hidden lg:overflow-y-auto" style={{ maxHeight: '500px' }}>
              {filteredAssets.length === 0 && (
                <div className="p-4 text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>No assets found</div>
              )}
              {filteredAssets.map((asset) => {
                const colors = CATEGORY_COLORS[asset.category];
                const isSelected = selectedAsset.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="px-3 sm:px-4 py-3 cursor-pointer transition-colors flex-shrink-0 lg:flex-shrink min-h-[44px] flex items-center hover:bg-slate-800/50"
                    style={{
                      borderBottom: '1px solid #1e293b',
                      borderRight: '1px solid #1e293b',
                      borderLeft: `3px solid ${isSelected ? colors.text : 'transparent'}`,
                      background: isSelected ? colors.bg : 'transparent',
                      minWidth: '130px',
                    }}
                  >
                    <div className="flex flex-col sm:flex-row lg:flex-row justify-between items-start sm:items-center gap-1 w-full">
                      <div className="flex items-center gap-2">
                        <AssetIcon symbol={asset.symbol} name={asset.name} category={asset.category} size={28} />
                        <div>
                          <div className="font-semibold text-xs sm:text-sm" style={{ color: isSelected ? colors.text : '#f1f5f9' }}>{asset.symbol}</div>
                          <div className="text-[10px] sm:text-xs truncate max-w-[100px] font-medium" style={{ color: '#64748b' }}>{asset.name}</div>
                        </div>
                      </div>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {asset.exchange}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-2xl overflow-hidden flex flex-col" style={cardStyle}>
            <div className="flex items-center justify-between p-3 sm:p-4 flex-wrap gap-2" style={{ borderBottom: '1px solid #1e293b' }}>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-sm sm:text-base" style={{ color: '#f1f5f9' }}>{selectedAsset.symbol}</div>
                  <div className="text-xs font-medium" style={{ color: '#64748b' }}>{selectedAsset.name} · {selectedAsset.exchange}</div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: CATEGORY_COLORS[selectedAsset.category].bg, color: CATEGORY_COLORS[selectedAsset.category].text }}
                >
                  {selectedAsset.category.charAt(0).toUpperCase() + selectedAsset.category.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">LIVE</span>
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: '260px', height: '420px' }}>
              <iframe
                title="advanced chart TradingView widget"
                lang="en"
                frameBorder={0}
                allowTransparency={true}
                scrolling="no"
                allowFullScreen={true}
                src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({
                  symbol: selectedAsset.tvSymbol,
                  interval: '15',
                  hide_side_toolbar: '0',
                  allow_symbol_change: '0',
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

          {/* Order panel */}
          <div className="rounded-2xl overflow-hidden flex flex-col" style={cardStyle}>
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid #1e293b' }}>
              <h2 className="font-semibold text-sm sm:text-base" style={{ color: '#f1f5f9' }}>Place Order</h2>
              <p className="text-xs font-medium" style={{ color: '#64748b' }}>{selectedAsset.symbol} · {selectedAsset.exchange}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Buy/Sell toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSide('buy')}
                  className={`min-h-[44px] rounded-xl font-bold text-sm transition-all ${
                    side === 'buy' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-white'
                  }`}
                  style={side !== 'buy' ? { background: 'rgba(255,255,255,0.06)', border: '1px solid #1e293b' } : {}}
                >
                  BUY
                </button>
                <button
                  onClick={() => setSide('sell')}
                  className={`min-h-[44px] rounded-xl font-bold text-sm transition-all ${
                    side === 'sell' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-white'
                  }`}
                  style={side !== 'sell' ? { background: 'rgba(255,255,255,0.06)', border: '1px solid #1e293b' } : {}}
                >
                  SELL
                </button>
              </div>

              {/* Order type */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: '#94a3b8' }}>Order Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['market', 'limit', 'stop'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className="min-h-[44px] rounded-lg text-xs font-medium capitalize transition-all"
                      style={orderType === type
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid #1e293b' }
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: '#94a3b8' }}>Amount (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrors(prev => ({ ...prev, amount: undefined })); setSuccessMsg(''); }}
                  className="w-full px-3 rounded-xl text-sm outline-none transition-colors min-h-[44px] font-semibold"
                  style={errors.amount ? inputErrorStyle : inputStyle}
                  placeholder="Enter amount"
                />
                {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
              </div>

              {/* Leverage */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: '#94a3b8' }}>Leverage</label>
                <div className="grid grid-cols-4 gap-1">
                  {leverageOptions.map((lev) => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className="min-h-[44px] rounded-lg text-xs font-medium transition-all"
                      style={leverage === lev
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid #1e293b' }
                      }
                    >
                      {lev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: '#94a3b8' }}>Stop Loss</label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => { setStopLoss(e.target.value); setErrors(prev => ({ ...prev, stopLoss: undefined })); setSuccessMsg(''); }}
                  className="w-full px-3 rounded-xl text-sm outline-none transition-colors min-h-[44px] font-semibold"
                  style={errors.stopLoss ? inputErrorStyle : inputStyle}
                  placeholder="Optional"
                />
                {errors.stopLoss && <p className="text-red-400 text-xs mt-1">{errors.stopLoss}</p>}
              </div>

              {/* Take Profit */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: '#94a3b8' }}>Take Profit</label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => { setTakeProfit(e.target.value); setErrors(prev => ({ ...prev, takeProfit: undefined })); setSuccessMsg(''); }}
                  className="w-full px-3 rounded-xl text-sm outline-none transition-colors min-h-[44px] font-semibold"
                  style={errors.takeProfit ? inputErrorStyle : inputStyle}
                  placeholder="Optional"
                />
                {errors.takeProfit && <p className="text-red-400 text-xs mt-1">{errors.takeProfit}</p>}
              </div>

              {/* Order summary */}
              <div className="rounded-xl p-3 sm:p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b' }}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: '#64748b' }}>Asset</span>
                  <span className="font-semibold" style={{ color: '#f1f5f9' }}>{selectedAsset.symbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: '#64748b' }}>Side</span>
                  <span className={`font-bold uppercase ${side === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>{side}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: '#64748b' }}>Amount</span>
                  <span className="font-semibold" style={{ color: '#f1f5f9' }}>${parseFloat(amount || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: '#64748b' }}>Leverage</span>
                  <span className="font-semibold" style={{ color: '#f1f5f9' }}>{leverage}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: '#64748b' }}>Est. Position</span>
                  <span className="font-semibold" style={{ color: '#f1f5f9' }}>${(parseFloat(amount || '0') * parseInt(leverage)).toLocaleString()}</span>
                </div>
              </div>

              {/* Success message */}
              {successMsg && (
                <div className="rounded-xl px-3 py-2.5 bg-green-500/15 border border-green-500/30">
                  <p className="text-green-400 text-xs font-medium">{successMsg}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                className={`w-full min-h-[44px] rounded-xl font-bold text-white text-sm sm:text-base transition-all shadow-lg ${
                  side === 'buy' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                }`}
              >
                {side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
              </button>

              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>Trading involves risk. Only trade what you can afford to lose.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
