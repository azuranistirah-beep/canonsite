'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Eye, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';

interface TradeRow {
  id: string;
  user_email: string;
  pair: string;
  type: 'buy' | 'sell';
  amount: number;
  entry_price: number;
  pnl: number;
  status: 'pending' | 'active' | 'won' | 'lost' | 'cancelled';
  date: string;
  duration: string;
  account_type: 'demo' | 'real';
}

const PAGE_SIZE = 20;

const PAIR_COLORS: Record<string, string> = {
  'BTC/USD': 'bg-orange-500/20 text-orange-400',
  'ETH/USD': 'bg-blue-500/20 text-blue-400',
  'EUR/USD': 'bg-green-500/20 text-green-400',
  'XAU/USD': 'bg-yellow-500/20 text-yellow-400',
  'GBP/USD': 'bg-purple-500/20 text-purple-400',
  'SOL/USD': 'bg-cyan-500/20 text-cyan-400',
  'BNB/USD': 'bg-amber-500/20 text-amber-400',
  'USD/JPY': 'bg-red-500/20 text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    won: 'bg-green-500/20 text-green-400',
    lost: 'bg-red-500/20 text-red-400',
    active: 'bg-blue-500/20 text-blue-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };
  const labels: Record<string, string> = { won: 'Menang', lost: 'Kalah', active: 'Aktif', pending: 'Pending', cancelled: 'Dibatalkan' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-500/20 text-gray-400'}`}>{labels[status] || status}</span>;
}

export default function AdminTradesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost' | 'active'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [page, setPage] = useState(0);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewTrade, setViewTrade] = useState<TradeRow | null>(null);

  const fetchTrades = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('trades')
        .select('id, asset_symbol, direction, amount, entry_price, profit_loss, status, account_type, duration_seconds, opened_at, created_at, user_id, user_profiles!trades_user_id_fkey(email)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (err) throw err;

      const rows: TradeRow[] = (data || []).map((t: any) => ({
        id: t.id,
        user_email: (t.user_profiles as any)?.email || 'Unknown',
        pair: t.asset_symbol || '-',
        type: t.direction || 'buy',
        amount: Number(t.amount),
        entry_price: Number(t.entry_price),
        pnl: Number(t.profit_loss || 0),
        status: t.status || 'pending',
        date: t.created_at,
        duration: t.duration_seconds ? `${t.duration_seconds}s` : '-',
        account_type: t.account_type || 'demo',
      }));

      setTrades(rows);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data trade');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const filtered = useMemo(() => {
    let list = trades;
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);
    if (search) list = list.filter(t => t.user_email.toLowerCase().includes(search.toLowerCase()) || t.pair.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [trades, statusFilter, typeFilter, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const analytics = useMemo(() => {
    const won = trades.filter(t => t.status === 'won').length;
    const total = trades.filter(t => t.status === 'won' || t.status === 'lost').length;
    const winRate = total > 0 ? (won / total * 100).toFixed(1) : '0';
    const totalVolume = trades.reduce((s, t) => s + t.amount, 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    return { winRate, totalVolume, totalPnl, totalTrades: trades.length };
  }, [trades]);

  const pairStats = useMemo(() => {
    const counts: Record<string, number> = {};
    trades.forEach(t => { counts[t.pair] = (counts[t.pair] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pair, count]) => ({ pair, count }));
  }, [trades]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-zinc-800 rounded w-20 mb-2" />
              <div className="h-7 bg-zinc-800 rounded w-16" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total Trades</p>
              <p className="text-xl font-bold text-white">{analytics.totalTrades}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Win Rate</p>
              <p className="text-xl font-bold text-green-400">{analytics.winRate}%</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total Volume</p>
              <p className="text-xl font-bold text-white">${analytics.totalVolume.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total P&L</p>
              <p className={`text-xl font-bold ${analytics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {analytics.totalPnl >= 0 ? '+' : ''}${analytics.totalPnl.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Pair Chart */}
      {!loading && pairStats.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Aset Paling Banyak Diperdagangkan</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pairStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="pair" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              <Bar dataKey="count" name="Jumlah" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Cari email atau pair..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as 'all' | 'buy' | 'sell'); setPage(0); }}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="all">Semua Tipe</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <div className="flex gap-2">
          {(['all', 'won', 'lost', 'active'] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white'
              }`}>
              {s === 'all' ? 'Semua' : s === 'won' ? 'Menang' : s === 'lost' ? 'Kalah' : 'Aktif'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Pair</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tipe</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Jumlah</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Entry</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">P&L</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tanggal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-8 bg-zinc-800 rounded animate-pulse" /></td></tr>
                ))
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-500">Tidak ada trade ditemukan</td></tr>
              ) : (
                paginated.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white text-xs">{t.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAIR_COLORS[t.pair] || 'bg-gray-500/20 text-gray-400'}`}>{t.pair}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        t.type === 'buy' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {t.type === 'buy' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white">${t.amount}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{t.entry_price.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      t.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewTrade(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"><Eye size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <p className="text-xs text-gray-500">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} dari {filtered.length}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Detail Trade</h3>
              <button onClick={() => setViewTrade(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-xs text-gray-500">Pengguna</p>
                <p className="text-sm text-white">{viewTrade.user_email}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Pair</p>
                  <p className="text-sm font-medium text-white">{viewTrade.pair}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Tipe</p>
                  <p className={`text-sm font-medium ${viewTrade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{viewTrade.type.toUpperCase()}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Jumlah</p>
                  <p className="text-sm font-bold text-white">${viewTrade.amount}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">P&L</p>
                  <p className={`text-sm font-bold ${viewTrade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {viewTrade.pnl >= 0 ? '+' : ''}${viewTrade.pnl}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Akun</p>
                  <p className="text-sm text-white capitalize">{viewTrade.account_type}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Durasi</p>
                  <p className="text-sm text-white">{viewTrade.duration}</p>
                </div>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={viewTrade.status} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
