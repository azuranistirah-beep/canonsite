'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Eye, Check, Filter, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DepositRow {
  id: string;
  user_email: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string | null;
  date: string;
  notes: string;
  user_id: string;
}

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<string, string> = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-500/20 text-gray-400'}`}>{labels[status] || status}</span>;
}

function MethodBadge({ method }: { method: string }) {
  const isBank = method.toLowerCase().includes('bank');
  const isCrypto = method.toLowerCase().includes('crypto') || method.toLowerCase().includes('usdt') || method.toLowerCase().includes('btc');
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      isBank ? 'bg-blue-500/20 text-blue-400' : isCrypto ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
    }`}>
      {method}
    </span>
  );
}

export default function AdminDepositsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [page, setPage] = useState(0);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewProof, setViewProof] = useState<DepositRow | null>(null);
  const [rejectModal, setRejectModal] = useState<DepositRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState<DepositRow | null>(null);
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchDeposits = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('deposit_requests')
        .select('id, amount, currency, payment_method, status, proof_url, notes, created_at, user_id, user_profiles!deposit_requests_user_id_fkey(email)')
        .order('created_at', { ascending: false });

      if (err) throw err;

      const rows: DepositRow[] = (data || []).map((d: any) => ({
        id: d.id,
        user_email: (d.user_profiles as any)?.email || 'Unknown',
        amount: Number(d.amount),
        currency: d.currency || 'USD',
        payment_method: d.payment_method || '-',
        status: d.status,
        proof_url: d.proof_url || null,
        date: d.created_at,
        notes: d.notes || '',
        user_id: d.user_id,
      }));

      setDeposits(rows);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data deposit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const filtered = useMemo(() => {
    let list = deposits;
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (search) list = list.filter(d => d.user_email.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [deposits, statusFilter, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleApprove = async (dep: DepositRow) => {
    const supabase = createClient();
    setActionLoading(true);
    try {
      // Update deposit status
      const { error: depErr } = await supabase
        .from('deposit_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', dep.id);
      if (depErr) throw depErr;

      // Update real_accounts balance (upsert)
      const { data: existing } = await supabase
        .from('real_accounts')
        .select('id, balance')
        .eq('user_id', dep.user_id)
        .single();

      if (existing) {
        const { error: balErr } = await supabase
          .from('real_accounts')
          .update({ balance: Number(existing.balance) + dep.amount, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (balErr) throw balErr;
      } else {
        const { error: insErr } = await supabase
          .from('real_accounts')
          .insert({ user_id: dep.user_id, balance: dep.amount, currency: dep.currency });
        if (insErr) throw insErr;
      }

      setDeposits(prev => prev.map(d => d.id === dep.id ? { ...d, status: 'approved' } : d));
      setConfirmApprove(null);
      showToast(`Deposit disetujui & saldo ditambahkan`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const supabase = createClient();
    setActionLoading(true);
    try {
      const { error: err } = await supabase
        .from('deposit_requests')
        .update({ status: 'rejected', notes: rejectReason, updated_at: new Date().toISOString() })
        .eq('id', rejectModal.id);
      if (err) throw err;
      setDeposits(prev => prev.map(d => d.id === rejectModal.id ? { ...d, status: 'rejected', notes: rejectReason } : d));
      setRejectModal(null);
      setRejectReason('');
      showToast(`Deposit ditolak`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const counts = useMemo(() => ({
    all: deposits.length,
    pending: deposits.filter(d => d.status === 'pending').length,
    approved: deposits.filter(d => d.status === 'approved').length,
    rejected: deposits.filter(d => d.status === 'rejected').length,
  }), [deposits]);

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

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Cari email atau ID deposit..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-500" />
          {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white'
              }`}>
              {s === 'all' ? 'Semua' : s === 'pending' ? 'Pending' : s === 'approved' ? 'Disetujui' : 'Ditolak'}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === s ? 'bg-white/20' : 'bg-white/10'
              }`}>{counts[s]}</span>
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
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-8 bg-zinc-800 rounded animate-pulse" /></td></tr>
                ))
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Tidak ada deposit ditemukan</td></tr>
              ) : (
                paginated.map((dep) => (
                  <tr key={dep.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{dep.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-white text-sm">{dep.user_email}</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">${dep.amount.toLocaleString()} {dep.currency}</td>
                    <td className="px-4 py-3"><MethodBadge method={dep.payment_method} /></td>
                    <td className="px-4 py-3">
                      {dep.proof_url ? (
                        <button onClick={() => setViewProof(dep)}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          <ImageIcon size={12} /> Lihat
                        </button>
                      ) : <span className="text-xs text-gray-600">-</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={dep.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(dep.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {dep.status === 'pending' && (
                          <>
                            <button onClick={() => setConfirmApprove(dep)}
                              className="px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 text-xs font-medium transition-all">
                              Setujui
                            </button>
                            <button onClick={() => { setRejectModal(dep); setRejectReason(''); }}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 text-xs font-medium transition-all">
                              Tolak
                            </button>
                          </>
                        )}
                        {dep.status !== 'pending' && dep.proof_url && (
                          <button onClick={() => setViewProof(dep)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
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
            <p className="text-xs text-gray-500">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} dari {filtered.length}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Proof Lightbox */}
      {viewProof && viewProof.proof_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setViewProof(null)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewProof(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300"><X size={20} /></button>
            <div className="bg-zinc-900 rounded-xl overflow-hidden border border-white/10">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm font-medium text-white">Bukti Deposit</p>
                <p className="text-xs text-gray-400">{viewProof.user_email} · ${viewProof.amount} {viewProof.currency}</p>
              </div>
              <img src={viewProof.proof_url} alt={`Bukti deposit`} className="w-full object-cover" />
            </div>
          </div>
        </div>
      )}

      {/* Confirm Approve Modal */}
      {confirmApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-2">Konfirmasi Setujui Deposit</h3>
            <p className="text-sm text-gray-400 mb-4">
              Setujui deposit <span className="text-white font-medium">${confirmApprove.amount.toLocaleString()}</span> dari <span className="text-white">{confirmApprove.user_email}</span>?
              Saldo real akan ditambahkan otomatis.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleApprove(confirmApprove)} disabled={actionLoading}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                {actionLoading ? 'Memproses...' : 'Setujui'}
              </button>
              <button onClick={() => setConfirmApprove(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-gray-400 font-medium transition-colors">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-2">Tolak Deposit</h3>
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
