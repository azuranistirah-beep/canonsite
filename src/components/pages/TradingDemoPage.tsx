'use client';
import React, { useState } from 'react';
import TickerTape from '@/components/TickerTape';

interface Trade {
  id: number;
  symbol: string;
  direction: 'UP' | 'DOWN';
  amount: number;
  openPrice: number;
  openTime: string;
  duration: string;
  status: 'open' | 'won' | 'lost';
  profit?: number;
}

const investmentAmounts = [1, 2, 5, 10, 20, 30, 40, 50, 100, 250, 500, 1000, 3000, 5000, 10000, 25000, 50000, 100000];
const durations = ['5 Sec', '15 Sec', '30 Sec', '1 Min', '5 Min', '15 Min', '30 Min', '1 Hour', '4 Hour', '1 Day'];

export default function TradingDemoPage() {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [selectedDuration, setSelectedDuration] = useState('1 Min');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [historyTrades, setHistoryTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [balance, setBalance] = useState(200000);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');

  const totalTrades = historyTrades.length;
  const wonTrades = historyTrades.filter(t => t.status === 'won').length;
  const winRate = totalTrades > 0 ? ((wonTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalProfit = historyTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

  const handleTrade = (direction: 'UP' | 'DOWN') => {
    setTradeError('');
    setTradeSuccess('');
    if (selectedAmount < 1) {
      setTradeError('Minimum investment amount is $1.');
      return;
    }
    if (selectedAmount > balance) {
      setTradeError(`Insufficient balance. Maximum is $${balance.toLocaleString()}.`);
      return;
    }
    if (!selectedDuration) {
      setTradeError('Please select a trade duration.');
      return;
    }
    const newTrade: Trade = {
      id: Date.now(),
      symbol: 'BTCUSD',
      direction,
      amount: selectedAmount,
      openPrice: 64775.65,
      openTime: new Date().toLocaleTimeString(),
      duration: selectedDuration,
      status: 'open',
    };
    setTrades(prev => [...prev, newTrade]);
    setTradeSuccess(`${direction} trade placed: $${selectedAmount} for ${selectedDuration}`);
    setTimeout(() => setTradeSuccess(''), 4000);
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const cardStyle = { background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' };
  const labelStyle = { color: 'rgba(255,255,255,0.5)' };

  return (
    <div className="min-h-screen pb-8 sm:pb-12" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="pt-3 sm:pt-4">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 md:mb-6 gap-3">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Trading Demo</h1>
              <p className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Practice trading with virtual funds</p>
            </div>
            <div className="text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg w-full sm:w-auto" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <div className="text-xs opacity-90 mb-0.5">Demo Account Balance</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold">${balance.toLocaleString()}</div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6">
            <div className="rounded-xl p-3 sm:p-4" style={cardStyle}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-5 sm:w-5" style={{ color: '#818cf8' }}>
                    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
                  </svg>
                </div>
                <div>
                  <div className="text-xs" style={labelStyle}>Total Trades</div>
                  <div className="text-lg sm:text-xl font-bold text-white">{totalTrades}</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4" style={cardStyle}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-5 sm:w-5 text-green-400">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-xs" style={labelStyle}>Win Rate</div>
                  <div className="text-lg sm:text-xl font-bold text-white">{winRate}%</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4" style={cardStyle}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-5 sm:w-5 text-emerald-400">
                    <line x1="12" x2="12" y1="2" y2="22"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div>
                  <div className="text-xs" style={labelStyle}>Total Profit</div>
                  <div className={`text-lg sm:text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${totalProfit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4" style={cardStyle}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-5 sm:w-5 text-orange-400">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                </div>
                <div>
                  <div className="text-xs" style={labelStyle}>Open Positions</div>
                  <div className="text-lg sm:text-xl font-bold text-white">{trades.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart + Trading panel */}
          <div className="flex flex-col lg:grid lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] gap-3 sm:gap-4 md:gap-6 mb-3 sm:mb-4 md:mb-6">
            {/* Chart */}
            <div className="rounded-2xl overflow-hidden" style={cardStyle}>
              <div className="flex items-center justify-between p-3 sm:p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div className="text-xs" style={labelStyle}>Current Price</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">$64775.65</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white">BTCUSD</span>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>Live</span>
                </div>
              </div>
              <div style={{ height: '260px', minHeight: '220px' }}>
                <iframe
                  title="advanced chart TradingView widget"
                  lang="en"
                  frameBorder={0}
                  allowtransparency="true"
                  scrolling="no"
                  allowFullScreen={true}
                  src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({
                    symbol: 'BITSTAMP:BTCUSD',
                    interval: 'D',
                    hide_side_toolbar: '0',
                    allow_symbol_change: '1',
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

            {/* Trading panel */}
            <div className="space-y-2 sm:space-y-3">
              {/* Investment Amount */}
              <div className="rounded-2xl p-3 sm:p-4 md:p-5" style={cardStyle}>
                <h3 className="font-bold text-white text-sm sm:text-base mb-3">Investment Amount</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-3 gap-1.5">
                  {investmentAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      className="min-h-[44px] px-1 sm:px-2 rounded-lg text-xs font-medium transition-all"
                      style={selectedAmount === amount
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: '1px solid transparent' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }
                      }
                    >
                      {formatAmount(amount)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trade Duration */}
              <div className="rounded-2xl p-3 sm:p-4 md:p-5" style={cardStyle}>
                <h3 className="font-bold text-white text-sm sm:text-base mb-3">Trade Duration</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-2 gap-1.5">
                  {durations.map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setSelectedDuration(dur)}
                      className="min-h-[44px] px-1 sm:px-2 rounded-lg text-xs font-medium transition-all"
                      style={selectedDuration === dur
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: '1px solid transparent' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }
                      }
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trade Summary */}
              <div className="rounded-2xl p-3 sm:p-4 md:p-5" style={cardStyle}>
                <h3 className="font-bold text-white text-sm sm:text-base mb-3">Trade Summary</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm" style={labelStyle}>Market Status</span>
                    <span className="text-xs sm:text-sm font-bold text-green-400">Open</span>
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Market Open 24/7</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm" style={labelStyle}>Investment</span>
                    <span className="text-xs sm:text-sm font-bold text-white">${selectedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm" style={labelStyle}>Potential Profit</span>
                    <span className="text-xs sm:text-sm font-bold text-green-400">+${(selectedAmount * 0.95).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm" style={labelStyle}>Payout</span>
                    <span className="text-xs sm:text-sm font-bold text-white">95%</span>
                  </div>
                </div>
              </div>

              {/* Trade buttons */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => handleTrade('UP')}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-base sm:text-lg transition-all shadow-lg shadow-green-500/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6"/>
                  </svg>
                  UP
                </button>
                <button
                  onClick={() => handleTrade('DOWN')}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-base sm:text-lg transition-all shadow-lg shadow-red-500/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                  DOWN
                </button>
              </div>
              {tradeError && (
                <div className="rounded-xl px-3 py-2.5 bg-red-500/15 border border-red-500/30">
                  <p className="text-red-400 text-xs font-medium">{tradeError}</p>
                </div>
              )}
              {tradeSuccess && (
                <div className="rounded-xl px-3 py-2.5 bg-green-500/15 border border-green-500/30">
                  <p className="text-green-400 text-xs font-medium">{tradeSuccess}</p>
                </div>
              )}
            </div>
          </div>

          {/* Positions table */}
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            {/* Tabs */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }} className="flex">
              <button
                onClick={() => setActiveTab('open')}
                className="px-4 sm:px-6 min-h-[44px] text-xs sm:text-sm font-medium transition-colors"
                style={activeTab === 'open'
                  ? { color: '#818cf8', borderBottom: '2px solid #6366f1' }
                  : { color: 'rgba(255,255,255,0.4)' }
                }
              >
                Open Positions ({trades.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className="px-4 sm:px-6 min-h-[44px] text-xs sm:text-sm font-medium transition-colors"
                style={activeTab === 'history'
                  ? { color: '#818cf8', borderBottom: '2px solid #6366f1' }
                  : { color: 'rgba(255,255,255,0.4)' }
                }
              >
                History ({historyTrades.length})
              </button>
            </div>

            {/* Tab content */}
            <div className="p-3 sm:p-4 md:p-6">
              {activeTab === 'open' ? (
                trades.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No open positions. Start trading to see your positions here.
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {trades.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            trade.direction === 'UP' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>{trade.direction}</span>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm">{trade.symbol}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{trade.openTime} · {trade.duration}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white text-sm">${trade.amount}</div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>@ ${trade.openPrice.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                historyTrades.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No trade history yet.
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {historyTrades.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            trade.status === 'won' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>{trade.status === 'won' ? 'WON' : 'LOST'}</span>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm">{trade.symbol}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{trade.direction} · {trade.duration}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-sm ${
                            (trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>{(trade.profit || 0) >= 0 ? '+' : ''}${trade.profit?.toFixed(2)}</div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>${trade.amount} invested</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
