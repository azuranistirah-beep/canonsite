'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Types ───────────────────────────────────────────────────────────────────
interface ClosedTrade {
  id: string;
  asset_symbol: string;
  asset_name: string;
  direction: 'buy' | 'sell';
  amount: number;
  entry_price: number;
  close_price: number | null;
  duration_seconds: number;
  status: 'won' | 'lost' | 'cancelled' | 'pending' | 'active';
  profit_loss: number;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  account_type: 'demo' | 'real';
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  symbol: string;
  direction: 'all' | 'buy' | 'sell';
  status: 'all' | 'won' | 'lost' | 'cancelled';
  search: string;
}

const PAGE_SIZE = 20;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '—';
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price > 1) return price.toFixed(4);
  return price.toFixed(6);
}

function calcPnL(trade: ClosedTrade): number {
  // Use stored profit_loss if available
  if (trade.profit_loss !== 0 && trade.profit_loss !== null) return trade.profit_loss;
  if (!trade.close_price || !trade.entry_price) return 0;
  if (trade.direction === 'buy') {
    return (trade.close_price - trade.entry_price) * trade.amount;
  } else {
    return (trade.entry_price - trade.close_price) * trade.amount;
  }
}

function calcPnLPercent(trade: ClosedTrade): number {
  if (!trade.amount || trade.amount === 0) return 0;
  const pnl = calcPnL(trade);
  return (pnl / trade.amount) * 100;
}

function getCloseReason(trade: ClosedTrade): string {
  if (trade.status === 'won') return 'Take Profit';
  if (trade.status === 'lost') return 'Stop Loss';
  if (trade.status === 'cancelled') return 'Cancelled';
  return '—';
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)', width: i === 0 ? 120 : i === 1 ? 80 : 60 }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'error' ? '#7f1d1d' : '#14532d',
      border: `1px solid ${type === 'error' ? '#ef4444' : '#22c55e'}`,
      color: '#fff', borderRadius: 12, padding: '12px 20px',
      fontSize: 14, fontWeight: 600, maxWidth: 360,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'slideUpPanel 0.25s ease-out',
    }}>
      {message}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrderHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    dateFrom: '', dateTo: '', symbol: '', direction: 'all', status: 'all', search: '',
  });

  // Fetch all closed trades
  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['won', 'lost', 'cancelled'])
        .order('closed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrades((data as ClosedTrade[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load trade history';
      setToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user) fetchTrades();
  }, [authLoading, user, fetchTrades]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth');
  }, [authLoading, user, router]);

  // Unique symbols for filter dropdown
  const symbols = useMemo(() => {
    const s = new Set(trades.map(t => t.asset_symbol));
    return Array.from(s).sort();
  }, [trades]);

  // Apply filters
  const filtered = useMemo(() => {
    return trades.filter(t => {
      if (filters.search && !t.asset_symbol.toLowerCase().includes(filters.search.toLowerCase()) &&
        !t.asset_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.symbol && t.asset_symbol !== filters.symbol) return false;
      if (filters.direction !== 'all' && t.direction !== filters.direction) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        const tradeDate = new Date(t.closed_at || t.created_at);
        if (tradeDate < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        const tradeDate = new Date(t.closed_at || t.created_at);
        if (tradeDate > to) return false;
      }
      return true;
    });
  }, [trades, filters]);

  // Summary stats
  const summary = useMemo(() => {
    const total = filtered.length;
    const wins = filtered.filter(t => t.status === 'won').length;
    const totalPnL = filtered.reduce((sum, t) => sum + calcPnL(t), 0);
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, totalPnL, winRate };
  }, [filtered]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // CSV Export
  const exportCSV = () => {
    const headers = ['Date', 'Symbol', 'Type', 'Entry Price', 'Exit Price', 'Amount', 'P&L', 'P&L %', 'Close Reason', 'Status', 'Account'];
    const rows = filtered.map(t => [
      formatDate(t.closed_at || t.created_at),
      t.asset_symbol,
      t.direction.toUpperCase(),
      formatPrice(t.entry_price),
      formatPrice(t.close_price),
      t.amount.toFixed(2),
      calcPnL(t).toFixed(2),
      calcPnLPercent(t).toFixed(2) + '%',
      getCloseReason(t),
      t.status,
      t.account_type,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', symbol: '', direction: 'all', status: 'all', search: '' });
    setPage(0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b1e' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d0e23', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" /></svg>
          Back
        </button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Order History</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>All your executed trades</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={exportCSV}
            style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 8, color: '#60a5fa', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
          <button
            onClick={fetchTrades}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            {
              label: 'Total Trades',
              value: summary.total.toString(),
              color: '#60a5fa',
              icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>),
            },
            {
              label: 'Total P&L',
              value: `${summary.totalPnL >= 0 ? '+' : ''}$${summary.totalPnL.toFixed(2)}`,
              color: summary.totalPnL >= 0 ? '#22c55e' : '#ef4444',
              icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
            },
            {
              label: 'Win Rate',
              value: `${summary.winRate.toFixed(1)}%`,
              color: summary.winRate >= 50 ? '#22c55e' : '#f97316',
              icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>),
            },
            {
              label: 'Winning Trades',
              value: `${summary.wins} / ${summary.total}`,
              color: '#a78bfa',
              icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>),
            },
          ].map(card => (
            <div key={card.label} style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: card.color, flexShrink: 0 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            {/* Search */}
            <div style={{ flex: '1 1 180px', minWidth: 140 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>SEARCH</label>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={filters.search}
                  onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 10px 8px 30px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Date From */}
            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>FROM</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(0); }}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }}
              />
            </div>

            {/* Date To */}
            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>TO</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(0); }}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }}
              />
            </div>

            {/* Symbol */}
            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>SYMBOL</label>
              <select
                value={filters.symbol}
                onChange={e => { setFilters(f => ({ ...f, symbol: e.target.value })); setPage(0); }}
                style={{ width: '100%', background: '#1a1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="">All Symbols</option>
                {symbols.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Direction */}
            <div style={{ flex: '1 1 120px', minWidth: 100 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>TYPE</label>
              <select
                value={filters.direction}
                onChange={e => { setFilters(f => ({ ...f, direction: e.target.value as Filters['direction'] })); setPage(0); }}
                style={{ width: '100%', background: '#1a1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="all">All Types</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>

            {/* Status */}
            <div style={{ flex: '1 1 120px', minWidth: 100 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, display: 'block', marginBottom: 4 }}>STATUS</label>
              <select
                value={filters.status}
                onChange={e => { setFilters(f => ({ ...f, status: e.target.value as Filters['status'] })); setPage(0); }}
                style={{ width: '100%', background: '#1a1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="all">All Status</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Reset */}
            <button
              onClick={resetFilters}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Date / Time', 'Symbol', 'Type', 'Entry Price', 'Exit Price', 'Amount', 'P&L', 'Close Reason', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 600 }}>No trade history yet.</div>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Start trading to see your history here.</div>
                        <button
                          onClick={() => router.push('/dashboard')}
                          style={{ marginTop: 8, background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                        >
                          Go to Trading
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((trade, idx) => {
                    const pnl = calcPnL(trade);
                    const pnlPct = calcPnLPercent(trade);
                    const isProfit = pnl > 0;
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={trade.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isEven ? 'transparent' : 'rgba(255,255,255,0.02)',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'transparent' : 'rgba(255,255,255,0.02)')}
                      >
                        {/* Date */}
                        <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                          {formatDate(trade.closed_at || trade.created_at)}
                        </td>
                        {/* Symbol */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            background: 'rgba(37,99,235,0.15)', color: '#60a5fa',
                            border: '1px solid rgba(37,99,235,0.25)', borderRadius: 6,
                            padding: '3px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                          }}>
                            {trade.asset_symbol}
                          </span>
                        </td>
                        {/* Type */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            background: trade.direction === 'buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: trade.direction === 'buy' ? '#22c55e' : '#ef4444',
                            border: `1px solid ${trade.direction === 'buy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700,
                          }}>
                            {trade.direction.toUpperCase()}
                          </span>
                        </td>
                        {/* Entry Price */}
                        <td style={{ padding: '12px 14px', color: '#fff', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                          ${formatPrice(trade.entry_price)}
                        </td>
                        {/* Exit Price */}
                        <td style={{ padding: '12px 14px', color: '#fff', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {trade.close_price ? `$${formatPrice(trade.close_price)}` : '—'}
                        </td>
                        {/* Amount */}
                        <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: 12 }}>
                          ${trade.amount.toFixed(2)}
                        </td>
                        {/* P&L */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ color: isProfit ? '#22c55e' : pnl < 0 ? '#ef4444' : 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                            {isProfit ? '+' : ''}{pnl.toFixed(2)}
                          </div>
                          <div style={{ color: isProfit ? 'rgba(34,197,94,0.7)' : pnl < 0 ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                            {isProfit ? '+' : ''}{pnlPct.toFixed(1)}%
                          </div>
                        </td>
                        {/* Close Reason */}
                        <td style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                          {getCloseReason(trade)}
                        </td>
                        {/* Status */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            background: trade.status === 'won' ? 'rgba(34,197,94,0.15)' : trade.status === 'lost' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                            color: trade.status === 'won' ? '#22c55e' : trade.status === 'lost' ? '#ef4444' : '#eab308',
                            border: `1px solid ${trade.status === 'won' ? 'rgba(34,197,94,0.3)' : trade.status === 'lost' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                          }}>
                            {trade.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} trades
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ background: page === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: page === 0 ? 'rgba(255,255,255,0.25)' : '#fff', padding: '7px 14px', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      style={{ background: pageNum === page ? '#2563eb' : 'rgba(255,255,255,0.06)', border: `1px solid ${pageNum === page ? '#2563eb' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: '#fff', padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: pageNum === page ? 700 : 500, minWidth: 36 }}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{ background: page >= totalPages - 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: page >= totalPages - 1 ? 'rgba(255,255,255,0.25)' : '#fff', padding: '7px 14px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`
        @keyframes slideUpPanel { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.5); }
      `}</style>
    </div>
  );
}
