'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, ArrowDownCircle, ArrowUpCircle, Activity, CheckCircle, Clock, UserPlus, BarChart3, RefreshCw, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface KpiData {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  activeTrades: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

interface ChartPoint {
  day: string;
  deposits: number;
  withdrawals: number;
}

interface ActivityItem {
  id: string;
  type: 'deposit' | 'withdrawal' | 'signup' | 'trade';
  user: string;
  desc: string;
  amount: number;
  status: string;
  time: string;
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'deposit') return <ArrowDownCircle size={14} className="text-green-400" />;
  if (type === 'withdrawal') return <ArrowUpCircle size={14} className="text-orange-400" />;
  if (type === 'signup') return <UserPlus size={14} className="text-blue-400" />;
  return <Activity size={14} className="text-purple-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    rejected: 'bg-red-500/20 text-red-400',
    active: 'bg-blue-500/20 text-blue-400',
    won: 'bg-green-500/20 text-green-400',
    lost: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<string, string> = {
    approved: 'Disetujui', completed: 'Selesai', pending: 'Pending',
    rejected: 'Ditolak', active: 'Aktif', won: 'Menang', lost: 'Kalah',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {labels[status] || status}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

export default function AdminDashboardPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      // Parallel queries
      const [usersRes, depositsRes, withdrawalsRes, tradesRes, chartDepRes, chartWdRes, actDepRes, actWdRes, actTradeRes] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('deposit_requests').select('amount').eq('status', 'approved'),
        supabase.from('withdrawal_requests').select('amount').eq('status', 'completed'),
        supabase.from('trades').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        // Chart: deposits last 30 days grouped by date
        supabase.from('deposit_requests')
          .select('amount, created_at')
          .eq('status', 'approved')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        // Chart: withdrawals last 30 days
        supabase.from('withdrawal_requests')
          .select('amount, created_at')
          .eq('status', 'completed')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        // Recent activities: deposits
        supabase.from('deposit_requests')
          .select('id, amount, status, created_at, user_id, user_profiles!deposit_requests_user_id_fkey(email)')
          .order('created_at', { ascending: false })
          .limit(5),
        // Recent activities: withdrawals
        supabase.from('withdrawal_requests')
          .select('id, amount, status, created_at, user_id, user_profiles!withdrawal_requests_user_id_fkey(email)')
          .order('created_at', { ascending: false })
          .limit(5),
        // Recent activities: trades
        supabase.from('trades')
          .select('id, amount, status, created_at, user_id, user_profiles!trades_user_id_fkey(email)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // KPI
      const totalDeposits = (depositsRes.data || []).reduce((s: number, d: any) => s + Number(d.amount), 0);
      const totalWithdrawals = (withdrawalsRes.data || []).reduce((s: number, w: any) => s + Number(w.amount), 0);

      // Pending counts
      const [pendingDepRes, pendingWdRes] = await Promise.all([
        supabase.from('deposit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setKpi({
        totalUsers: usersRes.count || 0,
        totalDeposits,
        totalWithdrawals,
        activeTrades: tradesRes.count || 0,
        pendingDeposits: pendingDepRes.count || 0,
        pendingWithdrawals: pendingWdRes.count || 0,
      });

      // Build chart data - group by date
      const dateMap: Record<string, { deposits: number; withdrawals: number }> = {};
      const last30 = Array.from({ length: 15 }, (_, i) => {
        const d = new Date(Date.now() - (29 - i * 2) * 24 * 60 * 60 * 1000);
        const key = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        dateMap[key] = { deposits: 0, withdrawals: 0 };
        return key;
      });

      (chartDepRes.data || []).forEach((d: any) => {
        const key = new Date(d.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        if (dateMap[key]) dateMap[key].deposits += Number(d.amount);
      });
      (chartWdRes.data || []).forEach((w: any) => {
        const key = new Date(w.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        if (dateMap[key]) dateMap[key].withdrawals += Number(w.amount);
      });

      setChartData(last30.map(day => ({ day, ...dateMap[day] })));

      // Build activities
      const acts: ActivityItem[] = [];
      (actDepRes.data || []).forEach((d: any) => {
        acts.push({
          id: d.id,
          type: 'deposit',
          user: (d.user_profiles as any)?.email || 'Unknown',
          desc: d.status === 'approved' ? 'Deposit disetujui' : d.status === 'pending' ? 'Deposit menunggu persetujuan' : 'Deposit ditolak',
          amount: Number(d.amount),
          status: d.status,
          time: d.created_at,
        });
      });
      (actWdRes.data || []).forEach((w: any) => {
        acts.push({
          id: w.id,
          type: 'withdrawal',
          user: (w.user_profiles as any)?.email || 'Unknown',
          desc: w.status === 'completed' ? 'Penarikan selesai' : w.status === 'pending' ? 'Penarikan menunggu' : 'Penarikan ditolak',
          amount: Number(w.amount),
          status: w.status,
          time: w.created_at,
        });
      });
      (actTradeRes.data || []).forEach((t: any) => {
        acts.push({
          id: t.id,
          type: 'trade',
          user: (t.user_profiles as any)?.email || 'Unknown',
          desc: `Trade ${t.status}`,
          amount: Number(t.amount),
          status: t.status,
          time: t.created_at,
        });
      });

      acts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivities(acts.slice(0, 10));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const kpiCards = kpi ? [
    { title: 'Total Users', value: kpi.totalUsers.toLocaleString(), sub: `${kpi.totalUsers} terdaftar`, icon: Users, color: 'bg-blue-600', trend: '', up: true },
    { title: 'Total Deposits', value: `$${kpi.totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, sub: 'deposit disetujui', icon: ArrowDownCircle, color: 'bg-green-600', trend: '', up: true },
    { title: 'Total Withdrawals', value: `$${kpi.totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, sub: 'penarikan selesai', icon: ArrowUpCircle, color: 'bg-orange-600', trend: '', up: true },
    { title: 'Active Trades', value: kpi.activeTrades.toLocaleString(), sub: `${kpi.activeTrades} open sekarang`, icon: Activity, color: 'bg-purple-600', trend: '', up: true },
  ] : [];

  const quickActions = kpi ? [
    { label: 'Approve Pending Deposits', badge: kpi.pendingDeposits, href: '/admin/deposits', color: 'bg-green-600 hover:bg-green-700', icon: CheckCircle },
    { label: 'Process Withdrawals', badge: kpi.pendingWithdrawals, href: '/admin/withdrawals', color: 'bg-blue-600 hover:bg-blue-700', icon: Clock },
    { label: 'View Reports', badge: 0, href: '/admin/reports', color: 'bg-purple-600 hover:bg-purple-700', icon: BarChart3 },
    { label: 'Manage Users', badge: 0, href: '/admin/users', color: 'bg-zinc-700 hover:bg-zinc-600', icon: Users },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">Selamat datang kembali, Admin</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:block">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-24 mb-3" />
              <div className="h-8 bg-zinc-800 rounded w-32 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-20" />
            </div>
          ))
        ) : (
          kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-400">{card.title}</p>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">{card.sub}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Deposit & Withdrawal Trends</h3>
            <p className="text-xs text-gray-500 mt-0.5">30 hari terakhir</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />Deposit</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" />Withdrawal</span>
          </div>
        </div>
        {loading ? (
          <div className="h-60 bg-zinc-800 rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWith" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
              />
              <Area type="monotone" dataKey="deposits" name="Deposit" stroke="#3b82f6" fill="url(#gDep)" strokeWidth={2} />
              <Area type="monotone" dataKey="withdrawals" name="Withdrawal" stroke="#f97316" fill="url(#gWith)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick Actions + Recent Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-zinc-800 rounded-lg animate-pulse" />
              ))
            ) : (
              quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm text-white font-medium transition-all ${action.color}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={16} />
                      {action.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {action.badge > 0 && (
                        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {action.badge}
                        </span>
                      )}
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {/* Summary Stats */}
          {!loading && kpi && (
            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-xs text-gray-500">Net Flow</p>
                <p className={`text-base font-bold mt-0.5 ${kpi.totalDeposits - kpi.totalWithdrawals >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(kpi.totalDeposits - kpi.totalWithdrawals).toLocaleString()}
                </p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Users</p>
                <p className="text-base font-bold text-blue-400 mt-0.5">{kpi.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="xl:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Aktivitas Terbaru</h3>
            <span className="text-xs text-gray-500">10 aktivitas terakhir</span>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-zinc-800" />
                  <div className="flex-1">
                    <div className="h-3 bg-zinc-800 rounded w-32 mb-1" />
                    <div className="h-2 bg-zinc-800 rounded w-24" />
                  </div>
                </div>
              ))
            ) : activities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Belum ada aktivitas</p>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <ActivityIcon type={act.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{act.user}</p>
                    <p className="text-xs text-gray-500">{act.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {act.amount > 0 && (
                      <p className="text-sm font-semibold text-white">${act.amount.toLocaleString()}</p>
                    )}
                    <StatusBadge status={act.status} />
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs text-gray-500">{timeAgo(act.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
