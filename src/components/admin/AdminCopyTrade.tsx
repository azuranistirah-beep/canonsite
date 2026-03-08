'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, TrendingUp, Bell, RefreshCw, ToggleLeft, ToggleRight, UserX } from 'lucide-react';

const supabase = createClient();

interface CopyTradeNotification {
  id: string;
  user_id: string;
  user_email: string;
  action: 'follow' | 'unfollow';
  balance_at_join: number;
  currency: string;
  created_at: string;
}

interface CopyTradeFollower {
  user_id: string;
  email: string;
  copy_trade_joined_at: string;
  real_balance: number;
  currency: string;
  copy_trade_active: boolean;
}

export default function AdminCopyTrade() {
  const [notifications, setNotifications] = useState<CopyTradeNotification[]>([]);
  const [followers, setFollowers] = useState<CopyTradeFollower[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, newToday: 0, totalAUM: 0, avgBalance: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch notifications
      const { data: notifData } = await supabase
        .from('copy_trade_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (notifData) setNotifications(notifData as CopyTradeNotification[]);

      // Fetch active followers from user_profiles
      const { data: followerData } = await supabase
        .from('user_profiles')
        .select('user_id, email, copy_trade_joined_at, real_balance, currency, copy_trade_active')
        .eq('copy_trade_active', true)
        .order('copy_trade_joined_at', { ascending: false });
      if (followerData) {
        setFollowers(followerData as CopyTradeFollower[]);
        const total = followerData.length;
        const totalAUM = followerData.reduce((sum: number, f: CopyTradeFollower) => sum + (f.real_balance || 0), 0);
        const avgBalance = total > 0 ? totalAUM / total : 0;

        // New today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newToday = followerData.filter((f: CopyTradeFollower) =>
          f.copy_trade_joined_at && new Date(f.copy_trade_joined_at) >= today
        ).length;

        setStats({ total, newToday, totalAUM, avgBalance });
      }

      // Fetch global setting
      const { data: setting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'copy_trade_enabled')
        .single();
      if (setting) setGlobalEnabled(setting.value === 'true');
    } catch (err) {
      console.error('Error fetching copy trade data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleGlobal = async () => {
    setTogglingGlobal(true);
    try {
      const newValue = !globalEnabled;
      await supabase
        .from('platform_settings')
        .upsert({ key: 'copy_trade_enabled', value: newValue.toString() }, { onConflict: 'key' });
      setGlobalEnabled(newValue);
    } catch (err) {
      console.error('Error toggling global copy trade:', err);
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleRemoveFollower = async (userId: string) => {
    setActionLoading(userId + '_remove');
    try {
      await supabase
        .from('user_profiles')
        .update({ copy_trade_active: false })
        .eq('user_id', userId);
      setFollowers(prev => prev.filter(f => f.user_id !== userId));
      setStats(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (err) {
      console.error('Error removing follower:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Copy Trade Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor and manage Investoft Copy Trade followers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {/* Global Toggle */}
          <button
            onClick={handleToggleGlobal}
            disabled={togglingGlobal}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              globalEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' :'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
            }`}
          >
            {globalEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            Copy Trade: {globalEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-emerald-400" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Total Followers</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-gray-600 mt-1">Active copy traders</div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-400" />
            </div>
            <span className="text-xs text-gray-500 font-medium">New Today</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.newToday}</div>
          <div className="text-xs text-gray-600 mt-1">Joined today</div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-purple-400" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Total AUM</span>
          </div>
          <div className="text-2xl font-bold text-white">${stats.totalAUM.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-gray-600 mt-1">Assets under management</div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-amber-400" />
            </div>
            <span className="text-xs text-gray-500 font-medium">Avg Balance</span>
          </div>
          <div className="text-2xl font-bold text-white">${stats.avgBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-gray-600 mt-1">Per follower</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Notifications */}
        <div className="bg-[#111111] border border-white/10 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Live Activity</h2>
            </div>
            <span className="text-xs text-gray-500">{notifications.length} events</span>
          </div>
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-600 text-sm">No activity yet</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/2 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    notif.action === 'follow' ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-white font-medium truncate">{notif.user_email || 'Unknown'}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        notif.action === 'follow' ?'bg-emerald-500/15 text-emerald-400' :'bg-red-500/15 text-red-400'
                      }`}>
                        {notif.action === 'follow' ? 'FOLLOWED' : 'UNFOLLOWED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">${(notif.balance_at_join || 0).toFixed(2)} balance</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-600">{formatTimeAgo(notif.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Stats Summary */}
        <div className="bg-[#111111] border border-white/10 rounded-xl">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Copy Trade Overview</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-gray-400">Provider</span>
              <span className="text-sm font-semibold text-white">Investoft</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-gray-400">Win Ratio</span>
              <span className="text-sm font-bold text-emerald-400">90%</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-gray-400">Min Balance</span>
              <span className="text-sm font-semibold text-white">$1,500 / RM 5,000</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-gray-400">Guarantee</span>
              <span className="text-sm font-bold text-emerald-400">100% Balance</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-400">Status</span>
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                globalEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}>
                {globalEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Followers Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Active Followers</h2>
            <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-medium">{stats.total}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Member Email</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Join Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Balance</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-600 text-sm">Loading...</td>
                </tr>
              ) : followers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-600 text-sm">No active followers yet</td>
                </tr>
              ) : (
                followers.map((follower) => (
                  <tr key={follower.user_id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm text-white">{follower.email || '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-400">{formatDate(follower.copy_trade_joined_at)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-white">${(follower.real_balance || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleRemoveFollower(follower.user_id)}
                        disabled={actionLoading === follower.user_id + '_remove'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all disabled:opacity-50"
                      >
                        <UserX size={12} />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
