'use client';
import React, { useState } from 'react';
import TickerTape from '@/components/TickerTape';

const tradeAssets = [
  { symbol: 'BTCUSD', name: 'Bitcoin / USD', tvSymbol: 'BITSTAMP:BTCUSD', price: '$64,775.65', change: '+8.21%', positive: true },
  { symbol: 'ETHUSD', name: 'Ethereum / USD', tvSymbol: 'BITSTAMP:ETHUSD', price: '$2,074.60', change: '+12.03%', positive: true },
  { symbol: 'EURUSD', name: 'EUR / USD', tvSymbol: 'FX:EURUSD', price: '$1.18073', change: '+0.30%', positive: true },
  { symbol: 'GBPUSD', name: 'GBP / USD', tvSymbol: 'FX:GBPUSD', price: '$1.3551', change: '+0.46%', positive: true },
  { symbol: 'XAUUSD', name: 'Gold / USD', tvSymbol: 'OANDA:XAUUSD', price: '$2,345.60', change: '+0.52%', positive: true },
  { symbol: 'AAPL', name: 'Apple Inc.', tvSymbol: 'NASDAQ:AAPL', price: '$273.77', change: '+0.60%', positive: true },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', tvSymbol: 'NASDAQ:NVDA', price: '$196.97', change: '+2.14%', positive: true },
  { symbol: 'TSLA', name: 'Tesla Inc.', tvSymbol: 'NASDAQ:TSLA', price: '$415.20', change: '+1.42%', positive: true },
];

interface FormErrors {
  amount?: string;
  stopLoss?: string;
  takeProfit?: string;
}

export default function TradePage() {
  const [selectedAsset, setSelectedAsset] = useState(tradeAssets[0]);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('1000');
  const [leverage, setLeverage] = useState('1x');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMsg, setSuccessMsg] = useState('');

  const leverageOptions = ['1x', '2x', '5x', '10x', '20x', '50x', '100x'];

  const cardStyle = { background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' };
  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' };
  const inputErrorStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid #ef4444', color: '#fff' };
  const labelStyle = { color: 'rgba(255,255,255,0.5)' };

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

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
        <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-[240px_1fr_260px] xl:grid-cols-[260px_1fr_280px]">
          {/* Asset list */}
          <div className="rounded-2xl overflow-hidden flex flex-col" style={cardStyle}>
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="font-bold text-white text-sm">Markets</h2>
            </div>
            <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-hidden overflow-y-hidden lg:overflow-y-auto">
              {tradeAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset)}
                  className="px-3 sm:px-4 py-3 cursor-pointer transition-colors flex-shrink-0 lg:flex-shrink min-h-[44px] flex items-center"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: `4px solid ${selectedAsset.symbol === asset.symbol ? '#6366f1' : 'transparent'}`,
                    background: selectedAsset.symbol === asset.symbol ? 'rgba(99,102,241,0.1)' : 'transparent',
                    minWidth: '130px',
                  }}
                >
                  <div className="flex flex-col sm:flex-row lg:flex-row justify-between items-start sm:items-center gap-1 w-full">
                    <div>
                      <div className="font-bold text-xs sm:text-sm" style={{ color: selectedAsset.symbol === asset.symbol ? '#818cf8' : '#fff' }}>{asset.symbol}</div>
                      <div className="text-[10px] sm:text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{asset.name}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-mono font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{asset.price}</div>
                      <div className={`text-[10px] font-bold ${asset.positive ? 'text-green-400' : 'text-red-400'}`}>{asset.change}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-2xl overflow-hidden flex flex-col" style={cardStyle}>
            <div className="flex items-center justify-between p-3 sm:p-4 flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-white text-sm sm:text-base">{selectedAsset.symbol}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedAsset.name}</div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-sm sm:text-base md:text-xl font-bold text-white">{selectedAsset.price}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    selectedAsset.positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>{selectedAsset.change}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">LIVE</span>
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: '260px', height: '380px' }}>
              <iframe
                title="advanced chart TradingView widget"
                lang="en"
                frameBorder={0}
                allowtransparency="true"
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
            <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 className="font-bold text-white text-sm sm:text-base">Place Order</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedAsset.symbol} · {selectedAsset.price}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Buy/Sell toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSide('buy')}
                  className={`min-h-[44px] rounded-xl font-bold text-sm transition-all ${
                    side === 'buy' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-white'
                  }`}
                  style={side !== 'buy' ? { background: 'rgba(255,255,255,0.06)' } : {}}
                >
                  BUY
                </button>
                <button
                  onClick={() => setSide('sell')}
                  className={`min-h-[44px] rounded-xl font-bold text-sm transition-all ${
                    side === 'sell' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-white'
                  }`}
                  style={side !== 'sell' ? { background: 'rgba(255,255,255,0.06)' } : {}}
                >
                  SELL
                </button>
              </div>

              {/* Order type */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={labelStyle}>Order Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['market', 'limit', 'stop'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className="min-h-[44px] rounded-lg text-xs font-medium capitalize transition-all"
                      style={orderType === type
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={labelStyle}>Amount (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrors(prev => ({ ...prev, amount: undefined })); setSuccessMsg(''); }}
                  className="w-full px-3 rounded-xl text-sm outline-none transition-colors min-h-[44px]"
                  style={errors.amount ? inputErrorStyle : inputStyle}
                  placeholder="Enter amount"
                />
                {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
              </div>

              {/* Leverage */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={labelStyle}>Leverage</label>
                <div className="grid grid-cols-4 gap-1">
                  {leverageOptions.map((lev) => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className="min-h-[44px] rounded-lg text-xs font-medium transition-all"
                      style={leverage === lev
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }
                      }
                    >
                      {lev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={labelStyle}>Stop Loss</label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => { setStopLoss(e.target.value); setErrors(prev => ({ ...prev, stopLoss: undefined })); setSuccessMsg(''); }}
                  className="w-full px-3 rounded-xl text-sm outline-none transition-colors min-h-[44px]"
                  style={errors.stopLoss ? inputErrorStyle : inputStyle}
                  placeholder="Optional"
                />
                {errors.stopLoss && <p className="text-red-400 text-xs mt-1">{errors.stopLoss}</p>}
              </div>

              {/* Take Profit */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={labelStyle}>Take Profit</label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => { setTakeProfit(e.target.value); setErrors(prev => ({ ...prev, takeProfit: undefined })); setSuccessMsg(''); }}
                  className="w-full px-3 rounded-xl text-sm outline-none transition-colors min-h-[44px]"
                  style={errors.takeProfit ? inputErrorStyle : inputStyle}
                  placeholder="Optional"
                />
                {errors.takeProfit && <p className="text-red-400 text-xs mt-1">{errors.takeProfit}</p>}
              </div>

              {/* Order summary */}
              <div className="rounded-xl p-3 sm:p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex justify-between text-xs">
                  <span style={labelStyle}>Asset</span>
                  <span className="font-bold text-white">{selectedAsset.symbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={labelStyle}>Side</span>
                  <span className={`font-bold uppercase ${side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{side}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={labelStyle}>Amount</span>
                  <span className="font-bold text-white">${parseFloat(amount || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={labelStyle}>Leverage</span>
                  <span className="font-bold text-white">{leverage}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={labelStyle}>Est. Position</span>
                  <span className="font-bold text-white">${(parseFloat(amount || '0') * parseInt(leverage)).toLocaleString()}</span>
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
