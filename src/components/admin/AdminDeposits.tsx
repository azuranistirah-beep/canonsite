'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  RefreshCw,
  Check,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

const supabase = createClient();
const PAGE_SIZE = 20;

interface DepositRow {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  proof_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  user_email?: string;
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [viewProof, setViewProof] = useState<DepositRow | null>(null);
  const [rejectModal, setRejectModal] = useState<DepositRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('deposit_requests')
        .select('id, user_id, amount, currency, payment_method, proof_url, status, notes, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, count, error: qErr } = await query;
      if (qErr) throw qErr;

      // Fetch user emails
      const userIds = [...new Set((data || []).map((d) => d.user_id))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('id', userIds);
        (profiles || []).forEach((p) => { emailMap[p.id] = p.email; });
      }

      let rows = (data || []).map((d) => ({
        ...d,
        amount: parseFloat(d.amount || '0'),
        user_email: emailMap[d.user_id] || d.user_id,
      }));

      if (search) {
        rows = rows.filter(
          (r) =>
            r.user_email?.toLowerCase().includes(search.toLowerCase()) ||
            r.id.toLowerCase().includes(search.toLowerCase())
        );
      }

      setDeposits(rows);
      setTotal(count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data deposit');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { loadDeposits(); }, [loadDeposits]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleApprove = async (deposit: DepositRow) => {
    setActionLoading(deposit.id);
    try {
      // Update deposit status
      const { error: depErr } = await supabase
        .from('deposit_requests')
        .update({ status: 'approved' })
        .eq('id', deposit.id);
      if (depErr) throw depErr;

      // Add balance to real account
      const { data: acc } = await supabase
        .from('real_accounts')
        .select('id, balance')
        .eq('user_id', deposit.user_id)
        .single();

      if (acc) {
        const newBalance = parseFloat(acc.balance || '0') + deposit.amount;
        await supabase.from('real_accounts').update({ balance: newBalance }).eq('id', acc.id);
      }

      showSuccess('Deposit berhasil disetujui dan saldo ditambahkan');
      loadDeposits();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyetujui deposit');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      const { error } = await supabase
        .from('deposit_requests')
        .update({ status: 'rejected', notes: rejectReason })
        .eq('id', rejectModal.id);
      if (error) throw error;
      setRejectModal(null);
      setRejectReason('');
      showSuccess('Deposit berhasil ditolak');
      loadDeposits();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menolak deposit');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      approved: 'Disetujui',
      rejected: 'Ditolak',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {labels[status] || status}
      </span>
    );
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
          <Check size={14} /><span>{success}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Cari email atau ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-[#111111] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-[#111111] border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'Semua' : s === 'pending' ? 'Pending' : s === 'approved' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>
        <button onClick={loadDeposits} className="p-2 bg-[#111111] border border-white/10 rounded-lg text-gray-400 hover:text-white">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Email Pengguna</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Jumlah</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Metode</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Bukti</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tanggal</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><RefreshCw size={20} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : deposits.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Tidak ada deposit ditemukan</td></tr>
              ) : (
                deposits.map((dep) => (
                  <tr key={dep.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white">{dep.user_email}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">
                      {dep.amount.toFixed(2)} {dep.currency || 'USD'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{dep.payment_method}</td>
                    <td className="px-4 py-3">
                      {dep.proof_url ? (
                        <button
                          onClick={() => setViewProof(dep)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Eye size={12} /> Lihat
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(dep.status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(dep.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {dep.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(dep)}
                              disabled={actionLoading === dep.id}
                              className="px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 text-xs font-medium transition-all disabled:opacity-50"
                            >
                              {actionLoading === dep.id ? '...' : 'Setujui'}
                            </button>
                            <button
                              onClick={() => { setRejectModal(dep); setRejectReason(''); }}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 text-xs font-medium transition-all"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                        {dep.proof_url && (
                          <button
                            onClick={() => setViewProof(dep)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <Eye size={14} />
                          </button>
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
            <p className="text-xs text-gray-500">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Proof Modal */}
      {viewProof && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Bukti Pembayaran</h3>
              <button onClick={() => setViewProof(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5">
              {viewProof.proof_url?.endsWith('.pdf') ? (
                <iframe src={viewProof.proof_url} className="w-full h-96 rounded-lg" />
              ) : (
                <img src={viewProof.proof_url || ''} alt="Bukti pembayaran" className="w-full max-h-96 object-contain rounded-lg" />
              )}
              <div className="mt-3 flex gap-3">
                <a
                  href={viewProof.proof_url || ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Buka di tab baru
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Tolak Deposit</h3>
              <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5">
              <p className="text-xs text-gray-400 mb-3">
                Deposit ${rejectModal.amount.toFixed(2)} dari {rejectModal.user_email}
              </p>
              <label className="block text-xs text-gray-400 mb-1">Alasan Penolakan</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 resize-none"
                placeholder="Masukkan alasan penolakan..."
              />
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white">
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Memproses...' : 'Tolak Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
