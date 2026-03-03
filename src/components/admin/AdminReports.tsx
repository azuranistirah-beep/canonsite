'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Download, DollarSign, Users, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface MonthlyData {
  month: string;
  deposits: number;
  withdrawals: number;
  revenue: number;
  signups: number;
  trades: number;
}

interface TopUser {
  rank: number;
  email: string;
  volume: number;
  trades: number;
  pnl: number;
}

const chartTooltipStyle = { background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 };

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const monthsBack = period === '6m' ? 6 : 12;
      const since = new Date();
      since.setMonth(since.getMonth() - monthsBack);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const [depRes, wdRes, signupRes, tradeRes, topTradeRes] = await Promise.all([
        supabase.from('deposit_requests').select('amount, created_at').eq('status', 'approved').gte('created_at', since.toISOString()),
        supabase.from('withdrawal_requests').select('amount, created_at').eq('status', 'completed').gte('created_at', since.toISOString()),
        supabase.from('user_profiles').select('created_at').gte('created_at', since.toISOString()),
        supabase.from('trades').select('amount, profit_loss, created_at').gte('created_at', since.toISOString()),
        supabase.from('trades').select('user_id, amount, profit_loss, user_profiles!trades_user_id_fkey(email)').order('amount', { ascending: false }).limit(100),
      ]);

      // Build monthly buckets
      const months: Record<string, MonthlyData> = {};
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        months[key] = { month: key, deposits: 0, withdrawals: 0, revenue: 0, signups: 0, trades: 0 };
      }

      const getKey = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      };

      (depRes.data || []).forEach((d: any) => {
        const k = getKey(d.created_at);
        if (months[k]) { months[k].deposits += Number(d.amount); months[k].revenue += Number(d.amount) * 0.02; }
      });
      (wdRes.data || []).forEach((w: any) => {
        const k = getKey(w.created_at);
        if (months[k]) months[k].withdrawals += Number(w.amount);
      });
      (signupRes.data || []).forEach((u: any) => {
        const k = getKey(u.created_at);
        if (months[k]) months[k].signups += 1;
      });
      (tradeRes.data || []).forEach((t: any) => {
        const k = getKey(t.created_at);
        if (months[k]) months[k].trades += 1;
      });

      setMonthlyData(Object.values(months));

      // Top users by volume
      const userMap: Record<string, { email: string; volume: number; trades: number; pnl: number }> = {};
      (topTradeRes.data || []).forEach((t: any) => {
        const email = (t.user_profiles as any)?.email || 'Unknown';
        if (!userMap[t.user_id]) userMap[t.user_id] = { email, volume: 0, trades: 0, pnl: 0 };
        userMap[t.user_id].volume += Number(t.amount);
        userMap[t.user_id].trades += 1;
        userMap[t.user_id].pnl += Number(t.profit_loss || 0);
      });

      const sorted = Object.values(userMap).sort((a, b) => b.volume - a.volume).slice(0, 10);
      setTopUsers(sorted.map((u, i) => ({ rank: i + 1, ...u })));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const totals = useMemo(() => ({
    revenue: monthlyData.reduce((s, d) => s + d.revenue, 0),
    deposits: monthlyData.reduce((s, d) => s + d.deposits, 0),
    withdrawals: monthlyData.reduce((s, d) => s + d.withdrawals, 0),
    signups: monthlyData.reduce((s, d) => s + d.signups, 0),
  }), [monthlyData]);

  const handleExportCSV = () => {
    const headers = ['Bulan', 'Deposit', 'Penarikan', 'Revenue', 'Signup', 'Trades'];
    const rows = monthlyData.map(d => [d.month, d.deposits, d.withdrawals, d.revenue.toFixed(2), d.signups, d.trades]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metricCards = [
    { title: 'Total Revenue', value: `$${totals.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-green-400' },
    { title: 'Total Deposits', value: `$${totals.deposits.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: ArrowDownCircle, color: 'text-blue-400' },
    { title: 'Total Withdrawals', value: `$${totals.withdrawals.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: ArrowUpCircle, color: 'text-orange-400' },
    { title: 'New Signups', value: totals.signups.toLocaleString(), icon: Users, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Laporan Platform</h2>
          <p className="text-xs text-gray-500 mt-0.5">Data real dari Supabase</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {(['6m', '12m'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {p === '6m' ? '6 Bulan' : '12 Bulan'}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-zinc-800 rounded w-24 mb-3" />
              <div className="h-7 bg-zinc-800 rounded w-32" />
            </div>
          ))
        ) : (
          metricCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className={card.color} />
                  <p className="text-xs text-gray-400">{card.title}</p>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Deposit & Withdrawal Chart */}
      {!loading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Deposit & Penarikan per Bulan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="rDep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rWd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Area type="monotone" dataKey="deposits" name="Deposit" stroke="#3b82f6" fill="url(#rDep)" strokeWidth={2} />
              <Area type="monotone" dataKey="withdrawals" name="Penarikan" stroke="#f97316" fill="url(#rWd)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Signups & Trades Chart */}
      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Pendaftaran Pengguna Baru</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} />
                <Bar dataKey="signups" name="Signup" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Jumlah Trade per Bulan</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} />
                <Line type="monotone" dataKey="trades" name="Trades" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Users */}
      {!loading && topUsers.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top 10 Pengguna by Volume</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Email</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Volume</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Trades</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topUsers.map((u) => (
                  <tr key={u.rank} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-gray-400 text-xs">{u.rank}</td>
                    <td className="px-3 py-2 text-white text-sm">{u.email}</td>
                    <td className="px-3 py-2 text-right text-white">${u.volume.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{u.trades}</td>
                    <td className={`px-3 py-2 text-right font-medium ${u.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {u.pnl >= 0 ? '+' : ''}${u.pnl.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
