'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Eye, Check, Filter, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface WithdrawalRow {
  id: string;
  user_email: string;
  amount: number;
  currency: string;
  method: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  date: string;
  notes: string;
  user_id: string;
}

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<string, string> = { pending: 'Pending', processing: 'Diproses', completed: 'Selesai', rejected: 'Ditolak' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-500/20 text-gray-400'}`}>{labels[status] || status}</span>;
}

export default function AdminWithdrawalsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'rejected'>('all');
  const [page, setPage] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<WithdrawalRow | null>(null);
  const [rejectModal, setRejectModal] = useState<WithdrawalRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchWithdrawals = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('withdrawal_requests')
        .select('id, amount, currency, withdrawal_method, bank_name, bank_account_number, bank_account_holder, status, notes, created_at, user_id, user_profiles!withdrawal_requests_user_id_fkey(email)')
        .order('created_at', { ascending: false });

      if (err) throw err;

      const rows: WithdrawalRow[] = (data || []).map((w: any) => ({
        id: w.id,
        user_email: (w.user_profiles as any)?.email || 'Unknown',
        amount: Number(w.amount),
        currency: w.currency || 'USD',
        method: w.withdrawal_method || '-',
        bank_name: w.bank_name || '-',
        account_number: w.bank_account_number || '-',
        account_holder: w.bank_account_holder || '-',
        status: w.status,
        date: w.created_at,
        notes: w.notes || '',
        user_id: w.user_id,
      }));

      setWithdrawals(rows);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data penarikan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const filtered = useMemo(() => {
    let list = withdrawals;
    if (statusFilter !== 'all') list = list.filter(w => w.status === statusFilter);
    if (search) list = list.filter(w => w.user_email.toLowerCase().includes(search.toLowerCase()) || w.id.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [withdrawals, statusFilter, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const updateStatus = async (id: string, status: string, notes?: string) => {
    const supabase = createClient();
    setActionLoading(true);
    try {
      const update: any = { status, updated_at: new Date().toISOString() };
      if (notes !== undefined) update.notes = notes;
      const { error: err } = await supabase
        .from('withdrawal_requests')
        .update(update)
        .eq('id', id);
      if (err) throw err;
      setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: status as any, notes: notes ?? w.notes } : w));
      return true;
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (w: WithdrawalRow) => {
    const ok = await updateStatus(w.id, 'processing');
    if (ok) showToast(`${w.id.slice(0, 8)}... disetujui, status: Diproses`);
  };

  const handleComplete = async (w: WithdrawalRow) => {
    const ok = await updateStatus(w.id, 'completed');
    if (ok) showToast(`${w.id.slice(0, 8)}... ditandai selesai`);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const ok = await updateStatus(rejectModal.id, 'rejected', rejectReason);
    if (ok) {
      setRejectModal(null);
      setRejectReason('');
      showToast(`Penarikan ditolak`);
    }
  };

  const counts = useMemo(() => ({
    all: withdrawals.length,
    pending: withdrawals.filter(w => w.status === 'pending').length,
    processing: withdrawals.filter(w => w.status === 'processing').length,
    completed: withdrawals.filter(w => w.status === 'completed').length,
    rejected: withdrawals.filter(w => w.status === 'rejected').length,
  }), [withdrawals]);

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
          <input type="text" placeholder="Cari email atau ID..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-500" />
          {(['all', 'pending', 'processing', 'completed', 'rejected'] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white'
              }`}>
              {s === 'all' ? 'Semua' : s === 'pending' ? 'Pending' : s === 'processing' ? 'Diproses' : s === 'completed' ? 'Selesai' : 'Ditolak'}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === s ? 'bg-white/20' : 'bg-white/10'}`}>{counts[s]}</span>
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Email</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Jumlah</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Bank / Tujuan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tanggal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-8 bg-zinc-800 rounded animate-pulse" /></td></tr>
                ))
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Tidak ada penarikan ditemukan</td></tr>
              ) : (
                paginated.map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{w.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-white text-sm">{w.user_email}</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">${w.amount.toLocaleString()} {w.currency}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-xs font-medium">{w.bank_name}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[120px]">{w.account_number}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(w.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewDetail(w)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"><Eye size={14} /></button>
                        {w.status === 'pending' && (
                          <button onClick={() => handleApprove(w)} disabled={actionLoading} className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 text-xs font-medium transition-all disabled:opacity-50">Proses</button>
                        )}
                        {w.status === 'processing' && (
                          <button onClick={() => handleComplete(w)} disabled={actionLoading} className="px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 text-xs font-medium transition-all disabled:opacity-50">Selesai</button>
                        )}
                        {(w.status === 'pending' || w.status === 'processing') && (
                          <button onClick={() => { setRejectModal(w); setRejectReason(''); }} className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 text-xs font-medium transition-all">Tolak</button>
                        )}
                      </div>
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

      {/* Detail Drawer */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setViewDetail(null)} />
          <div className="w-full max-w-sm bg-[#111111] border-l border-white/10 overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Detail Penarikan</h3>
              <button onClick={() => setViewDetail(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">ID Transaksi</p>
                <p className="text-sm font-mono text-white">{viewDetail.id}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Pengguna</p>
                <p className="text-sm text-white">{viewDetail.user_email}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Jumlah</p>
                <p className="text-xl font-bold text-white">${viewDetail.amount.toLocaleString()} {viewDetail.currency}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4 space-y-2">
                <p className="text-xs text-gray-500">Detail Bank</p>
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-gray-400" />
                  <span className="text-sm text-white">{viewDetail.bank_name}</span>
                </div>
                <p className="text-sm text-gray-300">{viewDetail.account_number}</p>
                <p className="text-sm text-gray-300">{viewDetail.account_holder}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <StatusBadge status={viewDetail.status} />
              </div>
              {viewDetail.notes && (
                <div className="bg-[#0a0a0a] rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Catatan</p>
                  <p className="text-sm text-gray-300">{viewDetail.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {viewDetail.status === 'pending' && (
                  <button onClick={() => { handleApprove(viewDetail); setViewDetail(null); }} disabled={actionLoading}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                    Proses
                  </button>
                )}
                {viewDetail.status === 'processing' && (
                  <button onClick={() => { handleComplete(viewDetail); setViewDetail(null); }} disabled={actionLoading}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                    Selesai
                  </button>
                )}
                {(viewDetail.status === 'pending' || viewDetail.status === 'processing') && (
                  <button onClick={() => { setRejectModal(viewDetail); setViewDetail(null); setRejectReason(''); }}
                    className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 rounded-lg text-sm text-red-400 font-medium transition-colors">
                    Tolak
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-2">Tolak Penarikan</h3>
            <p className="text-sm text-gray-400 mb-3">{rejectModal.user_email} — ${rejectModal.amount.toLocaleString()}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan..."
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={actionLoading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                {actionLoading ? 'Memproses...' : 'Tolak'}
              </button>
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-gray-400 font-medium transition-colors">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
