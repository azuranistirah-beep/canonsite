'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
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
  Legend,
} from 'recharts';
import Icon from '@/components/ui/AppIcon';


const supabase = createClient();

interface Stats {
  totalUsers: number;
  totalDeposits: number;
  pendingDeposits: number;
  approvedDeposits: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  completedWithdrawals: number;
  totalTrades: number;
  todayTrades: number;
  totalDemoBalance: number;
  totalRealBalance: number;
}

interface ChartData {
  month: string;
  deposits: number;
  withdrawals: number;
}

interface RecentActivity {
  id: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'signup';
  description: string;
  amount?: number;
  status: string;
  created_at: string;
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDeposits: 0,
    pendingDeposits: 0,
    approvedDeposits: 0,
    totalWithdrawals: 0,
    pendingWithdrawals: 0,
    completedWithdrawals: 0,
    totalTrades: 0,
    todayTrades: 0,
    totalDemoBalance: 0,
    totalRealBalance: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [usersRes, depositsRes, withdrawalsRes, tradesRes, demoRes, realRes] =
        await Promise.all([
          supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
          supabase.from('deposit_requests').select('id, status, amount, created_at'),
          supabase.from('withdrawal_requests').select('id, status, amount, created_at'),
          supabase.from('trades').select('id, status, created_at'),
          supabase.from('demo_accounts').select('balance'),
          supabase.from('real_accounts').select('balance'),
        ]);

      const deposits = depositsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];
      const trades = tradesRes.data || [];

      const todayStr = today.toISOString();
      const todayTrades = trades.filter((t) => t.created_at >= todayStr).length;

      const totalDemoBalance = (demoRes.data || []).reduce(
        (sum, a) => sum + parseFloat(a.balance || '0'),
        0
      );
      const totalRealBalance = (realRes.data || []).reduce(
        (sum, a) => sum + parseFloat(a.balance || '0'),
        0
      );

      setStats({
        totalUsers: usersRes.count || 0,
        totalDeposits: deposits.length,
        pendingDeposits: deposits.filter((d) => d.status === 'pending').length,
        approvedDeposits: deposits.filter((d) => d.status === 'approved').length,
        totalWithdrawals: withdrawals.length,
        pendingWithdrawals: withdrawals.filter((w) => w.status === 'pending').length,
        completedWithdrawals: withdrawals.filter((w) => w.status === 'completed').length,
        totalTrades: trades.length,
        todayTrades,
        totalDemoBalance,
        totalRealBalance,
      });

      // Build chart data (last 6 months)
      const months: ChartData[] = [];
      for (let i = 5; i >= 0; i--) {
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

        months.push({ month: monthStr, deposits: monthDeposits, withdrawals: monthWithdrawals });
      }
      setChartData(months);

      // Recent activities
      const activities: RecentActivity[] = [];
      deposits.slice(-5).forEach((d) => {
        activities.push({
          id: d.id,
          type: 'deposit',
          description: `Deposit ${d.status}`,
          amount: parseFloat(d.amount || '0'),
          status: d.status,
          created_at: d.created_at,
        });
      });
      withdrawals.slice(-3).forEach((w) => {
        activities.push({
          id: w.id,
          type: 'withdrawal',
          description: `Penarikan ${w.status}`,
          amount: parseFloat(w.amount || '0'),
          status: w.status,
          created_at: w.created_at,
        });
      });
      trades.slice(-2).forEach((t) => {
        activities.push({
          id: t.id,
          type: 'trade',
          description: `Trade ${t.status}`,
          status: t.status,
          created_at: t.created_at,
        });
      });

      activities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecentActivities(activities.slice(0, 10));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statusColor = (status: string) => {
    if (status === 'approved' || status === 'completed' || status === 'won') return 'text-green-400';
    if (status === 'rejected' || status === 'lost') return 'text-red-400';
    if (status === 'pending' || status === 'processing') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const activityTypeLabel = (type: string) => {
    if (type === 'deposit') return 'Deposit';
    if (type === 'withdrawal') return 'Penarikan';
    if (type === 'trade') return 'Trade';
    return 'Pendaftaran';
  };

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
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total Pengguna"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          color="bg-blue-600"
        />
        <StatCard
          title="Total Deposit"
          value={stats.totalDeposits.toLocaleString()}
          sub={`${stats.pendingDeposits} pending · ${stats.approvedDeposits} disetujui`}
          icon={ArrowDownCircle}
          color="bg-green-600"
        />
        <StatCard
          title="Total Penarikan"
          value={stats.totalWithdrawals.toLocaleString()}
          sub={`${stats.pendingWithdrawals} pending · ${stats.completedWithdrawals} selesai`}
          icon={ArrowUpCircle}
          color="bg-orange-600"
        />
        <StatCard
          title="Total Trade"
          value={stats.totalTrades.toLocaleString()}
          sub={`${stats.todayTrades} hari ini`}
          icon={TrendingUp}
          color="bg-purple-600"
        />
        <StatCard
          title="Total Saldo Real"
          value={`$${stats.totalRealBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`Demo: $${stats.totalDemoBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          color="bg-cyan-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tren Deposit vs Penarikan (6 Bulan)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="deposits" name="Deposit" stroke="#3b82f6" fill="url(#colorDeposits)" strokeWidth={2} />
              <Area type="monotone" dataKey="withdrawals" name="Penarikan" stroke="#ef4444" fill="url(#colorWithdrawals)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Volume Bulanan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deposits" name="Deposit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="withdrawals" name="Penarikan" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-[#111111] border border-white/10 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Aktivitas Terbaru</h3>
          </div>
          <button
            onClick={loadDashboard}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {recentActivities.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">Belum ada aktivitas</div>
          ) : (
            recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  {activity.type === 'deposit' && <ArrowDownCircle size={14} className="text-green-400" />}
                  {activity.type === 'withdrawal' && <ArrowUpCircle size={14} className="text-orange-400" />}
                  {activity.type === 'trade' && <TrendingUp size={14} className="text-blue-400" />}
                  {activity.type === 'signup' && <Users size={14} className="text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{activityTypeLabel(activity.type)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
                {activity.amount !== undefined && (
                  <p className="text-sm font-medium text-white">
                    ${activity.amount.toFixed(2)}
                  </p>
                )}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 ${
                    statusColor(activity.status)
                  }`}
                >
                  {activity.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
