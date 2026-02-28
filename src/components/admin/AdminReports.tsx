'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, Download } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const supabase = createClient();

interface MonthlyData {
  month: string;
  deposits: number;
  withdrawals: number;
  revenue: number;
  signups: number;
  trades: number;
}

export default function AdminReportsPage() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const months = period === '6m' ? 6 : 12;
      const [depositsRes, withdrawalsRes, usersRes, tradesRes] = await Promise.all([
        supabase.from('deposit_requests').select('amount, status, created_at'),
        supabase.from('withdrawal_requests').select('amount, status, created_at'),
        supabase.from('user_profiles').select('created_at'),
        supabase.from('trades').select('created_at, status'),
      ]);

      const deposits = depositsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];
      const users = usersRes.data || [];
      const trades = tradesRes.data || [];

      const result: MonthlyData[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const monthDeposits = deposits
          .filter((dep) => dep.created_at >= monthStart && dep.created_at <= monthEnd && dep.status === 'approved')
          .reduce((sum, dep) => sum + parseFloat(dep.amount || '0'), 0);

        const monthWithdrawals = withdrawals
          .filter((w) => w.created_at >= monthStart && w.created_at <= monthEnd && w.status === 'completed')
          .reduce((sum, w) => sum + parseFloat(w.amount || '0'), 0);

        const monthSignups = users.filter((u) => u.created_at >= monthStart && u.created_at <= monthEnd).length;
        const monthTrades = trades.filter((t) => t.created_at >= monthStart && t.created_at <= monthEnd).length;

        result.push({
          month: monthStr,
          deposits: monthDeposits,
          withdrawals: monthWithdrawals,
          revenue: monthDeposits - monthWithdrawals,
          signups: monthSignups,
          trades: monthTrades,
        });
      }
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const exportCSV = () => {
    const headers = ['Bulan', 'Deposit', 'Penarikan', 'Revenue', 'Pendaftar Baru', 'Total Trade'];
    const rows = data.map((d) => [d.month, d.deposits.toFixed(2), d.withdrawals.toFixed(2), d.revenue.toFixed(2), d.signups, d.trades]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartTooltipStyle = { background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['6m', '12m'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                period === p ? 'bg-blue-600 text-white' : 'bg-[#111111] border border-white/10 text-gray-400 hover:text-white'
              }`}>
              {p === '6m' ? '6 Bulan' : '12 Bulan'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={loadReports} className="p-2 bg-[#111111] border border-white/10 rounded-lg text-gray-400 hover:text-white">
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Financial Reports */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Laporan Keuangan</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-3">Total Deposit (Disetujui)</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="deposits" name="Deposit" stroke="#3b82f6" fill="url(#gDeposit)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-3">Total Penarikan (Selesai)</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="gWithdraw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="withdrawals" name="Penarikan" stroke="#f97316" fill="url(#gWithdraw)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-3">Revenue (Deposit - Penarikan)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-400 mb-3">Pendaftar Baru & Total Trade</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="signups" name="Pendaftar" stroke="#a855f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="trades" name="Trade" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Ringkasan Data</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Bulan</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Deposit</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Penarikan</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Pendaftar</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row) => (
                <tr key={row.month} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{row.month}</td>
                  <td className="px-4 py-3 text-right text-green-400">${row.deposits.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-orange-400">${row.withdrawals.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.revenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${row.revenue.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{row.signups}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{row.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
