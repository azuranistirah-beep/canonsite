'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Eye, Edit2, Ban, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'member';
  balance_real: number;
  is_active: boolean;
  created_at: string;
}

const PAGE_SIZE = 20;

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
    }`}>
      {role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'admin'>('all');
  const [page, setPage] = useState(0);
  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [editModal, setEditModal] = useState<UserRow | null>(null);
  const [toast, setToast] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchUsers = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data: profiles, error: profilesErr } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (profilesErr) throw profilesErr;

      // Fetch real account balances
      const { data: realAccounts } = await supabase
        .from('real_accounts')
        .select('user_id, balance');

      const balanceMap: Record<string, number> = {};
      (realAccounts || []).forEach((ra: any) => {
        balanceMap[ra.user_id] = Number(ra.balance);
      });

      const rows: UserRow[] = (profiles || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name || p.email?.split('@')[0] || 'Unknown',
        role: p.role || 'member',
        balance_real: balanceMap[p.id] || 0,
        is_active: p.is_active !== false,
        created_at: p.created_at,
      }));

      setUsers(rows);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = useMemo(() => {
    let list = users;
    if (search) list = list.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.full_name.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'active') list = list.filter(u => u.is_active);
    if (filter === 'inactive') list = list.filter(u => !u.is_active);
    if (filter === 'admin') list = list.filter(u => u.role === 'admin');
    return list;
  }, [users, search, filter]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleToggleStatus = async (user: UserRow) => {
    const supabase = createClient();
    const newActive = !user.is_active;
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newActive } : u));
    showToast(newActive ? `${user.full_name} diaktifkan` : `${user.full_name} dinonaktifkan`);
  };

  const handleEditRole = async (user: UserRow, role: 'admin' | 'member') => {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u));
    setEditModal(null);
    showToast(`Role ${user.full_name} diubah ke ${role}`);
  };

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <Check size={14} />{toast}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Cari email atau nama..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'inactive', 'admin'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : f === 'inactive' ? 'Nonaktif' : 'Admin'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total Users</p>
          <p className="text-lg font-bold text-white">{loading ? '...' : users.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Aktif</p>
          <p className="text-lg font-bold text-green-400">{loading ? '...' : users.filter(u => u.is_active).length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Nonaktif</p>
          <p className="text-lg font-bold text-red-400">{loading ? '...' : users.filter(u => !u.is_active).length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Pengguna</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Role</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Saldo Real</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Terdaftar</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-8 bg-zinc-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">Tidak ada pengguna ditemukan</td></tr>
              ) : (
                paginated.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setViewUser(user)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {initials(user.full_name)}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{user.full_name}</p>
                          <p className="text-gray-500 text-xs">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3 text-right font-medium text-white">${user.balance_real.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3"><StatusBadge active={user.is_active} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setViewUser(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" title="Detail">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => setEditModal(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Edit Role">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleStatus(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title={user.is_active ? 'Block' : 'Unblock'}>
                          <Ban size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <p className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} dari {filtered.length} pengguna
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {viewUser && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setViewUser(null)} />
          <div className="w-full max-w-md bg-[#111111] border-l border-white/10 overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Detail Pengguna</h3>
              <button onClick={() => setViewUser(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
                  {initials(viewUser.full_name)}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{viewUser.full_name}</p>
                  <p className="text-sm text-gray-400">{viewUser.email}</p>
                  <div className="flex gap-2 mt-1">
                    <RoleBadge role={viewUser.role} />
                    <StatusBadge active={viewUser.is_active} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Saldo Real</p>
                  <p className="text-base font-bold text-white mt-0.5">${viewUser.balance_real.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3">
                  <p className="text-xs text-gray-500">Terdaftar</p>
                  <p className="text-xs text-white mt-0.5">{new Date(viewUser.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setEditModal(viewUser); setViewUser(null); }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  Edit Role
                </button>
                <button
                  onClick={() => { handleToggleStatus(viewUser); setViewUser(null); }}
                  className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 rounded-lg text-sm text-red-400 font-medium transition-colors"
                >
                  {viewUser.is_active ? 'Block' : 'Unblock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-4">Edit Role — {editModal.full_name}</h3>
            <div className="space-y-2">
              {(['member', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleEditRole(editModal, r)}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                    editModal.role === r
                      ? 'bg-blue-600 text-white' :'bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {r === 'admin' ? 'Admin' : 'Member'}
                </button>
              ))}
            </div>
            <button onClick={() => setEditModal(null)} className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
