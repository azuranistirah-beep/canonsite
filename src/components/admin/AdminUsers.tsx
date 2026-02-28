'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  DollarSign,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Ban,
} from 'lucide-react';

const supabase = createClient();
const PAGE_SIZE = 20;

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  demo_balance?: number;
  real_balance?: number;
}

interface EditUserForm {
  full_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

interface AdjustBalanceForm {
  account_type: 'demo' | 'real';
  operation: 'add' | 'subtract';
  amount: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified' | 'active' | 'blocked'>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Modals
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({ full_name: '', email: '', is_active: true, is_admin: false });
  const [editLoading, setEditLoading] = useState(false);

  const [adjustUser, setAdjustUser] = useState<UserRow | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustBalanceForm>({ account_type: 'real', operation: 'add', amount: '' });
  const [adjustLoading, setAdjustLoading] = useState(false);

  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [viewUser, setViewUser] = useState<UserRow | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_active, is_admin, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      if (filter === 'active') query = query.eq('is_active', true);
      if (filter === 'blocked') query = query.eq('is_active', false);

      const { data, count, error: qErr } = await query;
      if (qErr) throw qErr;

      const userIds = (data || []).map((u) => u.id);
      let demoMap: Record<string, number> = {};
      let realMap: Record<string, number> = {};

      if (userIds.length > 0) {
        const [demoRes, realRes] = await Promise.all([
          supabase.from('demo_accounts').select('user_id, balance').in('user_id', userIds),
          supabase.from('real_accounts').select('user_id, balance').in('user_id', userIds),
        ]);
        (demoRes.data || []).forEach((d) => { demoMap[d.user_id] = parseFloat(d.balance || '0'); });
        (realRes.data || []).forEach((r) => { realMap[r.user_id] = parseFloat(r.balance || '0'); });
      }

      setUsers(
        (data || []).map((u) => ({
          ...u,
          demo_balance: demoMap[u.id] ?? 0,
          real_balance: realMap[u.id] ?? 0,
        }))
      );
      setTotal(count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setEditForm({ full_name: user.full_name, email: user.email, is_active: user.is_active, is_admin: user.is_admin || false });
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: editForm.full_name, email: editForm.email, is_active: editForm.is_active, is_admin: editForm.is_admin })
        .eq('id', editUser.id);
      if (error) throw error;
      setEditUser(null);
      showSuccess('Pengguna berhasil diperbarui');
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui pengguna');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleBlock = async (user: UserRow) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      if (error) throw error;
      showSuccess(user.is_active ? 'Pengguna diblokir' : 'Pengguna diaktifkan');
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status pengguna');
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustUser || !adjustForm.amount) return;
    setAdjustLoading(true);
    try {
      const table = adjustForm.account_type === 'demo' ? 'demo_accounts' : 'real_accounts';
      const { data: acc } = await supabase
        .from(table)
        .select('id, balance')
        .eq('user_id', adjustUser.id)
        .single();

      if (!acc) throw new Error('Akun tidak ditemukan');
      const current = parseFloat(acc.balance || '0');
      const delta = parseFloat(adjustForm.amount);
      const newBalance = adjustForm.operation === 'add' ? current + delta : Math.max(0, current - delta);

      const { error } = await supabase
        .from(table)
        .update({ balance: newBalance })
        .eq('id', acc.id);
      if (error) throw error;

      setAdjustUser(null);
      setAdjustForm({ account_type: 'real', operation: 'add', amount: '' });
      showSuccess('Saldo berhasil disesuaikan');
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyesuaikan saldo');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', deleteUser.id);
      if (error) throw error;
      setDeleteUser(null);
      showSuccess('Pengguna berhasil dihapus');
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pengguna');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm flex items-center gap-2">
          <Check size={14} />
          <span>{success}</span>
        </div>
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
            className="w-full bg-[#111111] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'blocked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-[#111111] border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Diblokir'}
            </button>
          ))}
        </div>
        <button
          onClick={loadUsers}
          className="p-2 bg-[#111111] border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Saldo Demo</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Saldo Real</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Terdaftar</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <RefreshCw size={20} className="animate-spin text-blue-500 mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">Tidak ada pengguna ditemukan</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{user.email}</span>
                        {user.is_admin && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Admin</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{user.full_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          user.is_active
                            ? 'bg-green-500/20 text-green-400' :'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {user.is_active ? 'Aktif' : 'Diblokir'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      ${(user.demo_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      ${(user.real_balance || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewUser(user)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                          title="Lihat Detail"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => { setAdjustUser(user); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all"
                          title="Sesuaikan Saldo"
                        >
                          <DollarSign size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleBlock(user)}
                          className={`p-1.5 rounded-lg transition-all ${
                            user.is_active
                              ? 'text-gray-400 hover:text-orange-400 hover:bg-orange-500/10' :'text-orange-400 hover:text-green-400 hover:bg-green-500/10'
                          }`}
                          title={user.is_active ? 'Blokir' : 'Aktifkan'}
                        >
                          <Ban size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteUser(user)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
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
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Edit Pengguna</h3>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Status Aktif</label>
                <button
                  onClick={() => setEditForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    editForm.is_active ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${
                      editForm.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Hak Admin</label>
                <button
                  onClick={() => setEditForm((f) => ({ ...f, is_admin: !f.is_admin }))}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    editForm.is_admin ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${
                      editForm.is_admin ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors disabled:opacity-50"
              >
                {editLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {adjustUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Sesuaikan Saldo</h3>
              <button onClick={() => setAdjustUser(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400">{adjustUser.email}</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Jenis Akun</label>
                <select
                  value={adjustForm.account_type}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, account_type: e.target.value as 'demo' | 'real' }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="real">Real</option>
                  <option value="demo">Demo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Operasi</label>
                <select
                  value={adjustForm.operation}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, operation: e.target.value as 'add' | 'subtract' }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="add">Tambah</option>
                  <option value="subtract">Kurangi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Jumlah (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setAdjustUser(null)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={adjustLoading || !adjustForm.amount}
                className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-sm text-white font-medium transition-colors disabled:opacity-50"
              >
                {adjustLoading ? 'Memproses...' : 'Terapkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-sm">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-white mb-2">Hapus Pengguna</h3>
              <p className="text-sm text-gray-400">
                Apakah Anda yakin ingin menghapus <strong className="text-white">{deleteUser.email}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setDeleteUser(null)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm text-white font-medium transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Detail Pengguna</h3>
              <button onClick={() => setViewUser(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['ID', viewUser.id],
                ['Email', viewUser.email],
                ['Nama', viewUser.full_name || '-'],
                ['Role', viewUser.role],
                ['Status', viewUser.is_active ? 'Aktif' : 'Diblokir'],
                ['Admin', viewUser.is_admin ? 'Ya' : 'Tidak'],
                ['Saldo Demo', `$${(viewUser.demo_balance || 0).toFixed(2)}`],
                ['Saldo Real', `$${(viewUser.real_balance || 0).toFixed(2)}`],
                ['Terdaftar', new Date(viewUser.created_at).toLocaleString('id-ID')],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs text-white text-right break-all">{val}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setViewUser(null)}
                className="w-full py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
