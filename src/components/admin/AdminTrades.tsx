'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const supabase = createClient();
const PAGE_SIZE = 20;

interface TradeRow {
  id: string;
  user_id: string;
  asset_symbol: string;
  asset_name: string;
  direction: string;
  amount: number;
  entry_price: number;
  close_price: number | null;
  duration_seconds: number;
  status: string;
  profit_loss: number;
  opened_at: string;
  closed_at: string | null;
  account_type: string;
  user_email?: string;
}

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [viewTrade, setViewTrade] = useState<TradeRow | null>(null);
  const [assetStats, setAssetStats] = useState<{ asset: string; count: number }[]>([]);
  const [analytics, setAnalytics] = useState({ todayTrades: 0, winRate: 0, totalVolume: 0 });

  const loadTrades = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('trades')
        .select('id, user_id, asset_symbol, asset_name, direction, amount, entry_price, close_price, duration_seconds, status, profit_loss, opened_at, closed_at, account_type', { count: 'exact' })
        .order('opened_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, count, error: qErr } = await query;
      if (qErr) throw qErr;

      const userIds = [...new Set((data || []).map((t) => t.user_id))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, email').in('id', userIds);
        (profiles || []).forEach((p) => { emailMap[p.id] = p.email; });
      }

      let rows = (data || []).map((t) => ({
        ...t,
        amount: parseFloat(t.amount || '0'),
        entry_price: parseFloat(t.entry_price || '0'),
        close_price: t.close_price ? parseFloat(t.close_price) : null,
        profit_loss: parseFloat(t.profit_loss || '0'),
        user_email: emailMap[t.user_id] || t.user_id,
      }));

      if (search) {
        rows = rows.filter((r) =>
          r.user_email?.toLowerCase().includes(search.toLowerCase()) ||
          r.asset_symbol.toLowerCase().includes(search.toLowerCase())
        );
      }

      setTrades(rows);
      setTotal(count || 0);

      // Analytics
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      const allTrades = rows;
      const todayTrades = allTrades.filter((t) => t.opened_at >= todayStr).length;
      const finishedTrades = allTrades.filter((t) => t.status === 'won' || t.status === 'lost');
      const wonTrades = finishedTrades.filter((t) => t.status === 'won').length;
      const winRate = finishedTrades.length > 0 ? (wonTrades / finishedTrades.length) * 100 : 0;
      const totalVolume = allTrades.reduce((sum, t) => sum + t.amount, 0);
      setAnalytics({ todayTrades, winRate, totalVolume });

      // Asset stats
      const assetCount: Record<string, number> = {};
      allTrades.forEach((t) => { assetCount[t.asset_symbol] = (assetCount[t.asset_symbol] || 0) + 1; });
      const sorted = Object.entries(assetCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([asset, count]) => ({ asset, count }));
      setAssetStats(sorted);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data trade');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      won: 'bg-green-500/20 text-green-400',
      lost: 'bg-red-500/20 text-red-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      active: 'bg-blue-500/20 text-blue-400',
    };
    const labels: Record<string, string> = { won: 'Menang', lost: 'Kalah', pending: 'Pending', active: 'Aktif' };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-500/20 text-gray-400'}`}>{labels[status] || status}</span>;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span><button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Trade Hari Ini</p>
          <p className="text-xl font-bold text-white">{analytics.todayTrades}</p>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Win Rate</p>
          <p className="text-xl font-bold text-green-400">{analytics.winRate.toFixed(1)}%</p>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Volume</p>
          <p className="text-xl font-bold text-white">${analytics.totalVolume.toFixed(0)}</p>
        </div>
      </div>

      {/* Asset Chart */}
      {assetStats.length > 0 && (
        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Aset Paling Banyak Diperdagangkan</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={assetStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="asset" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
              <Bar dataKey="count" name="Jumlah Trade" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Cari email atau aset..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-[#111111] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex gap-2">
          {(['all', 'won', 'lost'] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-[#111111] border border-white/10 text-gray-400 hover:text-white'
              }`}>
              {s === 'all' ? 'Semua' : s === 'won' ? 'Menang' : 'Kalah'}
            </button>
          ))}
        </div>
        <button onClick={loadTrades} className="p-2 bg-[#111111] border border-white/10 rounded-lg text-gray-400 hover:text-white">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Aset</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tipe</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Jumlah</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">P/L</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tanggal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><RefreshCw size={20} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Tidak ada trade ditemukan</td></tr>
              ) : (
                trades.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white text-xs">{t.user_email}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-xs font-medium">{t.asset_symbol}</p>
                        <p className="text-gray-500 text-xs">{t.asset_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        t.direction === 'buy' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {t.direction === 'buy' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {t.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white">${t.amount.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      t.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.profit_loss >= 0 ? '+' : ''}${t.profit_loss.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.opened_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewTrade(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <p className="text-xs text-gray-500">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* View Trade Modal */}
      {viewTrade && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Detail Trade</h3>
              <button onClick={() => setViewTrade(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['ID', viewTrade.id],
                ['Email', viewTrade.user_email || '-'],
                ['Aset', `${viewTrade.asset_symbol} - ${viewTrade.asset_name}`],
                ['Tipe', viewTrade.direction.toUpperCase()],
                ['Jumlah', `$${viewTrade.amount.toFixed(2)}`],
                ['Harga Masuk', `$${viewTrade.entry_price.toFixed(8)}`],
                ['Harga Keluar', viewTrade.close_price ? `$${viewTrade.close_price.toFixed(8)}` : '-'],
                ['Durasi', `${viewTrade.duration_seconds}s`],
                ['P/L', `${viewTrade.profit_loss >= 0 ? '+' : ''}$${viewTrade.profit_loss.toFixed(2)}`],
                ['Status', viewTrade.status],
                ['Akun', viewTrade.account_type],
                ['Dibuka', new Date(viewTrade.opened_at).toLocaleString('id-ID')],
                ['Ditutup', viewTrade.closed_at ? new Date(viewTrade.closed_at).toLocaleString('id-ID') : '-'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-xs text-gray-500 shrink-0">{label}</span>
                  <span className="text-xs text-white text-right break-all">{val}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-white/10">
              <button onClick={() => setViewTrade(null)} className="w-full py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
