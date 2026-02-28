'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  account_type: string;
  status: string;
  notes: string | null;
  proof_url: string | null;
  stripe_session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  withdrawal_method: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  bank_swift_code: string | null;
  crypto_wallet_address: string | null;
  crypto_network: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

type Transaction = (DepositRequest & { type: 'deposit' }) | (WithdrawalRequest & { type: 'withdrawal' });

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Menunggu' },
    approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Disetujui' },
    completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Selesai' },
    rejected: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Ditolak' },
    processing: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Diproses' },
  };
  const c = config[status] || config.pending;
  return (
    <span style={{ padding: '4px 12px', borderRadius: 20, background: c.bg, color: c.color, fontSize: 12, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}

export default function ReceiptPage({ id }: { id: string }) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransaction = async () => {
      setLoading(true);
      try {
        // Try deposit first
        const { data: deposit, error: dErr } = await supabase
          .from('deposit_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (deposit && !dErr) {
          setTransaction({ ...deposit, type: 'deposit' });
          setLoading(false);
          return;
        }

        // Try withdrawal
        const { data: withdrawal, error: wErr } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (withdrawal && !wErr) {
          setTransaction({ ...withdrawal, type: 'withdrawal' });
          setLoading(false);
          return;
        }

        setError('Transaksi tidak ditemukan.');
      } catch {
        setError('Gagal memuat data transaksi.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [id]);

  const formatMethod = (method: string) => {
    const map: Record<string, string> = {
      bank_transfer: 'Transfer Bank',
      crypto: 'Cryptocurrency',
      stripe_stripe: 'Kartu Kredit / Debit',
      stripe_card: 'Kartu Kredit / Debit',
      credit_card: 'Kartu Kredit / Debit',
    };
    return map[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const getCurrencySymbol = (currency: string) => {
    const map: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', MYR: 'RM', SGD: 'S$',
      THB: '฿', PHP: '₱', JPY: '¥', AUD: 'A$', CNY: '¥',
    };
    return map[currency] || currency;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: '#ef4444', fontSize: 16, fontWeight: 600 }}>{error || 'Transaksi tidak ditemukan.'}</div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 24px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Kembali ke Dashboard</button>
      </div>
    );
  }

  const isDeposit = transaction.type === 'deposit';
  const currency = transaction.currency || 'USD';
  const symbol = getCurrencySymbol(currency);
  const method = isDeposit
    ? formatMethod((transaction as DepositRequest).payment_method)
    : formatMethod((transaction as WithdrawalRequest).withdrawal_method);

  let parsedNotes: Record<string, string> = {};
  try {
    if (transaction.notes) parsedNotes = JSON.parse(transaction.notes);
  } catch {}

  return (
    <div style={{ minHeight: '100vh', background: '#000', fontFamily: 'Inter, -apple-system, sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Kembali
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Cetak
            </button>
          </div>
        </div>

        {/* Receipt Card */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}>
          {/* Top Status Bar */}
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: transaction.status === 'completed' || transaction.status === 'approved' ? 'rgba(34,197,94,0.1)' : transaction.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `2px solid ${transaction.status === 'completed' || transaction.status === 'approved' ? 'rgba(34,197,94,0.3)' : transaction.status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              {transaction.status === 'completed' || transaction.status === 'approved' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
              ) : transaction.status === 'rejected' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              )}
            </div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              {isDeposit ? 'Bukti Deposit' : 'Bukti Penarikan'}
            </div>
            <StatusBadge status={transaction.status} />
          </div>

          {/* Amount */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Jumlah</div>
            <div style={{ color: '#fff', fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
              {symbol}{Number(transaction.amount).toLocaleString('id-ID', { minimumFractionDigits: 2 })} {currency}
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: '20px 24px' }}>
            {[
              { label: 'ID Transaksi', value: transaction.id.slice(0, 8).toUpperCase() + '...' + transaction.id.slice(-4).toUpperCase() },
              { label: 'Jenis', value: isDeposit ? 'Deposit' : 'Penarikan' },
              { label: 'Metode', value: method },
              { label: 'Akun', value: isDeposit ? 'Real Account' : 'Real Account' },
              { label: 'Tanggal', value: formatDate(transaction.created_at) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{label}</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}

            {/* Bank details for withdrawal */}
            {!isDeposit && (transaction as WithdrawalRequest).bank_name && (
              <>
                {[
                  { label: 'Bank', value: (transaction as WithdrawalRequest).bank_name },
                  { label: 'No. Rekening', value: (transaction as WithdrawalRequest).bank_account_number },
                  { label: 'Nama Pemilik', value: (transaction as WithdrawalRequest).bank_account_holder },
                  { label: 'SWIFT/BIC', value: (transaction as WithdrawalRequest).bank_swift_code },
                ].filter(i => i.value).map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{label}</span>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}
              </>
            )}

            {/* Crypto details for withdrawal */}
            {!isDeposit && (transaction as WithdrawalRequest).crypto_wallet_address && (
              <>
                {[
                  { label: 'Jaringan', value: (transaction as WithdrawalRequest).crypto_network },
                  { label: 'Alamat Wallet', value: (transaction as WithdrawalRequest).crypto_wallet_address },
                ].filter(i => i.value).map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{label}</span>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all', fontFamily: 'monospace' }}>{value}</span>
                  </div>
                ))}
              </>
            )}

            {/* Notes from parsed JSON */}
            {parsedNotes.bank && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Bank</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{parsedNotes.bank}</span>
              </div>
            )}
            {parsedNotes.crypto && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Cryptocurrency</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{parsedNotes.crypto}</span>
              </div>
            )}

            {/* Proof URL */}
            {isDeposit && (transaction as DepositRequest).proof_url && (
              <div style={{ marginTop: 16, padding: '12px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bukti Transfer</div>
                <a
                  href={(transaction as DepositRequest).proof_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                >
                  Lihat Bukti Transfer
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Investoft International Ltd · Dokumen ini adalah bukti transaksi resmi</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          button { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
