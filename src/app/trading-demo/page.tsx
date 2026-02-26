'use client';
import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
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

  const totalTrades = historyTrades.length;
  const wonTrades = historyTrades.filter(t => t.status === 'won').length;
  const winRate = totalTrades > 0 ? ((wonTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalProfit = historyTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

  const handleTrade = (direction: 'UP' | 'DOWN') => {
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
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0b1e' }}>
      <Navbar />
      <TickerTape />
      <main className="flex-1 pb-20">
        <div className="pt-4">
          <div className="container mx-auto px-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Trading Demo</h1>
                <p className="text-slate-400 text-sm">Practice trading with virtual funds</p>
              </div>
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-xs opacity-90 mb-1">Demo Account Balance</div>
                <div className="text-2xl font-bold">${balance.toLocaleString()}</div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl p-4" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-400">
                      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Total Trades</div>
                    <div className="text-xl font-bold text-white">{totalTrades}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-green-400">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                      <path d="M4 22h16"/>
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Win Rate</div>
                    <div className="text-xl font-bold text-white">{winRate}%</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-400">
                      <line x1="12" x2="12" y1="2" y2="22"/>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Total Profit</div>
                    <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${totalProfit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="bg-orange-500/20 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-orange-400">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="6"/>
                      <circle cx="12" cy="12" r="2"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Open Positions</div>
                    <div className="text-xl font-bold text-white">{trades.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart + Trading panel */}
            <div className="grid lg:grid-cols-[1fr_320px] gap-6 mb-6">
              {/* Chart */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <div className="text-xs text-slate-400">Current Price</div>
                    <div className="text-2xl font-bold text-white">$64775.65</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">BTCUSD</span>
                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full">Live</span>
                  </div>
                </div>
                <div style={{ height: '500px' }}>
                  <iframe
                    title="advanced chart TradingView widget"
                    lang="en"
                    frameBorder={0}
                    allowtransparency="true"
                    scrolling="no"
                    allowFullScreen={true}
                    src={`https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify({ symbol: 'BITSTAMP:BTCUSD', interval: 'D', hide_side_toolbar: '0', allow_symbol_change: '1', save_image: '1', theme: 'dark', style: '1', timezone: 'Etc/UTC', show_popup_button: '1' }))}`}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </div>

              {/* Trading panel */}
              <div className="space-y-4">
                {/* Investment Amount */}
                <div className="rounded-2xl p-5" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 className="font-bold text-white mb-4">Investment Amount</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {investmentAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setSelectedAmount(amount)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          selectedAmount === amount
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        style={selectedAmount !== amount ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : {}}
                      >
                        {formatAmount(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trade Duration */}
                <div className="rounded-2xl p-5" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 className="font-bold text-white mb-4">Trade Duration</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {durations.map((dur) => (
                      <button
                        key={dur}
                        onClick={() => setSelectedDuration(dur)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          selectedDuration === dur
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        style={selectedDuration !== dur ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : {}}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trade Summary */}
                <div className="rounded-2xl p-5" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 className="font-bold text-white mb-4">Trade Summary</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Market Status</span>
                      <span className="text-sm font-bold text-green-400">Open</span>
                    </div>
                    <div className="text-xs text-slate-500">Market Open 24/7</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Investment</span>
                      <span className="text-sm font-bold text-white">${selectedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Potential Profit</span>
                      <span className="text-sm font-bold text-green-400">+${(selectedAmount * 0.95).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Payout</span>
                      <span className="text-sm font-bold text-white">95%</span>
                    </div>
                  </div>
                </div>

                {/* Trade buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleTrade('UP')}
                    className="flex items-center justify-center gap-2 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-green-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m18 15-6-6-6 6"/>
                    </svg>
                    UP
                  </button>
                  <button
                    onClick={() => handleTrade('DOWN')}
                    className="flex items-center justify-center gap-2 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-red-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                    DOWN
                  </button>
                </div>
              </div>
            </div>

            {/* Open Positions / History */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setActiveTab('open')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'open' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Open Positions ({trades.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  History ({historyTrades.length})
                </button>
              </div>
              <div className="p-6">
                {activeTab === 'open' && trades.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30">
                      <path d="M3 3v18h18"/>
                      <path d="m19 9-5 5-4-4-3 3"/>
                    </svg>
                    <p className="text-sm">No open positions. Place a trade to get started.</p>
                  </div>
                )}
                {activeTab === 'open' && trades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between py-3 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        trade.direction === 'UP' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>{trade.direction}</span>
                      <div>
                        <div className="text-sm font-bold text-white">{trade.symbol}</div>
                        <div className="text-xs text-slate-400">{trade.openTime} · {trade.duration}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">${trade.amount}</div>
                      <div className="text-xs text-slate-400">@ ${trade.openPrice.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                {activeTab === 'history' && historyTrades.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-sm">No trade history yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
