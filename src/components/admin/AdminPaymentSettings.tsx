'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  QrCode,
} from 'lucide-react';

const supabase = createClient();

interface BankAccount {
  id: string;
  currency: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  swift_code: string;
  status: string;
  created_at: string;
}

interface InstantAccount {
  id: string;
  method: string;
  account_info: string;
  currencies: string[];
  status: string;
  created_at: string;
}

interface CryptoWallet {
  id: string;
  crypto: string;
  network: string;
  wallet_address: string;
  qr_code_url: string;
  status: string;
  created_at: string;
}

const CURRENCIES = ['MYR', 'USD', 'SGD', 'THB', 'PHP', 'IDR', 'VND', 'EUR', 'GBP'];
const INSTANT_METHODS = ['Touch n Go', 'GrabPay', 'PayNow', 'PromptPay', 'GCash', 'OVO', 'GoPay', 'DANA'];
const CRYPTOS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'TRX'];
const NETWORKS = ['Bitcoin', 'ERC20', 'TRC20', 'BEP20', 'Solana'];

export default function AdminPaymentSettingsPage() {
  const [activeTab, setActiveTab] = useState<'bank' | 'instant' | 'crypto'>('bank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankModal, setBankModal] = useState<Partial<BankAccount> | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  // Instant Accounts
  const [instantAccounts, setInstantAccounts] = useState<InstantAccount[]>([]);
  const [instantModal, setInstantModal] = useState<Partial<InstantAccount> | null>(null);
  const [instantLoading, setInstantLoading] = useState(false);

  // Crypto Wallets
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([]);
  const [cryptoModal, setCryptoModal] = useState<Partial<CryptoWallet> | null>(null);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [viewQR, setViewQR] = useState<CryptoWallet | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const loadBankAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('payment_bank_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat akun bank');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInstantAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('payment_instant_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setInstantAccounts(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat akun instant');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCryptoWallets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('payment_crypto_wallets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCryptoWallets(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dompet crypto');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBankAccounts();
    loadInstantAccounts();
    loadCryptoWallets();
  }, [loadBankAccounts, loadInstantAccounts, loadCryptoWallets]);

  // Bank CRUD
  const saveBankAccount = async () => {
    if (!bankModal) return;
    setBankLoading(true);
    try {
      if (bankModal.id) {
        const { error } = await supabase.from('payment_bank_accounts').update({
          currency: bankModal.currency,
          bank_name: bankModal.bank_name,
          account_number: bankModal.account_number,
          account_holder: bankModal.account_holder,
          swift_code: bankModal.swift_code || '',
          status: bankModal.status || 'active',
        }).eq('id', bankModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_bank_accounts').insert({
          currency: bankModal.currency || 'USD',
          bank_name: bankModal.bank_name || '',
          account_number: bankModal.account_number || '',
          account_holder: bankModal.account_holder || '',
          swift_code: bankModal.swift_code || '',
          status: 'active',
        });
        if (error) throw error;
      }
      setBankModal(null);
      showSuccess('Akun bank berhasil disimpan');
      loadBankAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan akun bank');
    } finally {
      setBankLoading(false);
    }
  };

  const deleteBankAccount = async (id: string) => {
    if (!confirm('Hapus akun bank ini?')) return;
    try {
      const { error } = await supabase.from('payment_bank_accounts').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Akun bank dihapus');
      loadBankAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus akun bank');
    }
  };

  const toggleBankStatus = async (acc: BankAccount) => {
    try {
      const { error } = await supabase.from('payment_bank_accounts').update({ status: acc.status === 'active' ? 'inactive' : 'active' }).eq('id', acc.id);
      if (error) throw error;
      loadBankAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  // Instant CRUD
  const saveInstantAccount = async () => {
    if (!instantModal) return;
    setInstantLoading(true);
    try {
      const currencies = typeof instantModal.currencies === 'string' ? (instantModal.currencies as string).split(',').map((c) => c.trim())
        : instantModal.currencies || ['USD'];
      if (instantModal.id) {
        const { error } = await supabase.from('payment_instant_accounts').update({
          method: instantModal.method,
          account_info: instantModal.account_info,
          currencies,
          status: instantModal.status || 'active',
        }).eq('id', instantModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_instant_accounts').insert({
          method: instantModal.method || '',
          account_info: instantModal.account_info || '',
          currencies,
          status: 'active',
        });
        if (error) throw error;
      }
      setInstantModal(null);
      showSuccess('Akun instant berhasil disimpan');
      loadInstantAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan akun instant');
    } finally {
      setInstantLoading(false);
    }
  };

  const deleteInstantAccount = async (id: string) => {
    if (!confirm('Hapus akun instant ini?')) return;
    try {
      const { error } = await supabase.from('payment_instant_accounts').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Akun instant dihapus');
      loadInstantAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus akun instant');
    }
  };

  const toggleInstantStatus = async (acc: InstantAccount) => {
    try {
      const { error } = await supabase.from('payment_instant_accounts').update({ status: acc.status === 'active' ? 'inactive' : 'active' }).eq('id', acc.id);
      if (error) throw error;
      loadInstantAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  // Crypto CRUD
  const saveCryptoWallet = async () => {
    if (!cryptoModal) return;
    setCryptoLoading(true);
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cryptoModal.wallet_address || '')}`;
      if (cryptoModal.id) {
        const { error } = await supabase.from('payment_crypto_wallets').update({
          crypto: cryptoModal.crypto,
          network: cryptoModal.network,
          wallet_address: cryptoModal.wallet_address,
          qr_code_url: qrUrl,
          status: cryptoModal.status || 'active',
        }).eq('id', cryptoModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_crypto_wallets').insert({
          crypto: cryptoModal.crypto || 'USDT',
          network: cryptoModal.network || 'TRC20',
          wallet_address: cryptoModal.wallet_address || '',
          qr_code_url: qrUrl,
          status: 'active',
        });
        if (error) throw error;
      }
      setCryptoModal(null);
      showSuccess('Dompet crypto berhasil disimpan');
      loadCryptoWallets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan dompet crypto');
    } finally {
      setCryptoLoading(false);
    }
  };

  const deleteCryptoWallet = async (id: string) => {
    if (!confirm('Hapus dompet crypto ini?')) return;
    try {
      const { error } = await supabase.from('payment_crypto_wallets').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Dompet crypto dihapus');
      loadCryptoWallets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus dompet crypto');
    }
  };

  const toggleCryptoStatus = async (w: CryptoWallet) => {
    try {
      const { error } = await supabase.from('payment_crypto_wallets').update({ status: w.status === 'active' ? 'inactive' : 'active' }).eq('id', w.id);
      if (error) throw error;
      loadCryptoWallets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  const statusBadge = (status: string) => (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
    }`}>
      {status === 'active' ? 'Aktif' : 'Nonaktif'}
    </span>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span><button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm flex items-center gap-2">
          <Check size={14} /><span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111111] border border-white/10 rounded-xl p-1 w-fit">
        {(['bank', 'instant', 'crypto'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {tab === 'bank' ? 'Akun Bank' : tab === 'instant' ? 'Instant Payment' : 'Crypto Wallet'}
          </button>
        ))}
      </div>

      {/* Bank Accounts Tab */}
      {activeTab === 'bank' && (
        <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Akun Bank</h3>
            <div className="flex gap-2">
              <button onClick={loadBankAccounts} className="p-2 text-gray-400 hover:text-white">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setBankModal({ currency: 'MYR', bank_name: '', account_number: '', account_holder: '', swift_code: '', status: 'active' })}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors">
                <Plus size={14} /> Tambah
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Mata Uang</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Bank</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">No. Rekening</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Pemilik</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">SWIFT</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bankAccounts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">Belum ada akun bank</td></tr>
                ) : (
                  bankAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{acc.currency}</td>
                      <td className="px-4 py-3 text-gray-300">{acc.bank_name}</td>
                      <td className="px-4 py-3 text-gray-300">{acc.account_number}</td>
                      <td className="px-4 py-3 text-gray-300">{acc.account_holder}</td>
                      <td className="px-4 py-3 text-gray-400">{acc.swift_code || '-'}</td>
                      <td className="px-4 py-3">{statusBadge(acc.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleBankStatus(acc)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                            {acc.status === 'active' ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => setBankModal(acc)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => deleteBankAccount(acc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
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
        </div>
      )}

      {/* Instant Payment Tab */}
      {activeTab === 'instant' && (
        <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Instant Payment</h3>
            <div className="flex gap-2">
              <button onClick={loadInstantAccounts} className="p-2 text-gray-400 hover:text-white">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setInstantModal({ method: 'Touch n Go', account_info: '', currencies: ['MYR'], status: 'active' })}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors">
                <Plus size={14} /> Tambah
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Metode</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Info Akun</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Mata Uang</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {instantAccounts.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500">Belum ada akun instant payment</td></tr>
                ) : (
                  instantAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{acc.method}</td>
                      <td className="px-4 py-3 text-gray-300">{acc.account_info}</td>
                      <td className="px-4 py-3 text-gray-400">{(acc.currencies || []).join(', ')}</td>
                      <td className="px-4 py-3">{statusBadge(acc.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleInstantStatus(acc)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                            {acc.status === 'active' ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => setInstantModal({ ...acc, currencies: acc.currencies })} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => deleteInstantAccount(acc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
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
        </div>
      )}

      {/* Crypto Wallets Tab */}
      {activeTab === 'crypto' && (
        <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Crypto Wallet</h3>
            <div className="flex gap-2">
              <button onClick={loadCryptoWallets} className="p-2 text-gray-400 hover:text-white">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setCryptoModal({ crypto: 'USDT', network: 'TRC20', wallet_address: '', status: 'active' })}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors">
                <Plus size={14} /> Tambah
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Crypto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Network</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Alamat Wallet</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">QR</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cryptoWallets.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">Belum ada dompet crypto</td></tr>
                ) : (
                  cryptoWallets.map((w) => (
                    <tr key={w.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{w.crypto}</td>
                      <td className="px-4 py-3 text-gray-300">{w.network}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs max-w-[160px] truncate">{w.wallet_address}</td>
                      <td className="px-4 py-3">
                        {w.qr_code_url ? (
                          <button onClick={() => setViewQR(w)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                            <QrCode size={14} />
                          </button>
                        ) : <span className="text-gray-600 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3">{statusBadge(w.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleCryptoStatus(w)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                            {w.status === 'active' ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => setCryptoModal(w)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => deleteCryptoWallet(w.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
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
        </div>
      )}

      {/* Bank Account Modal */}
      {bankModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">{bankModal.id ? 'Edit' : 'Tambah'} Akun Bank</h3>
              <button onClick={() => setBankModal(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Mata Uang</label>
                <select value={bankModal.currency || 'MYR'} onChange={(e) => setBankModal((m) => ({ ...m, currency: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {[['bank_name', 'Nama Bank'], ['account_number', 'Nomor Rekening'], ['account_holder', 'Nama Pemilik'], ['swift_code', 'Kode SWIFT (opsional)']].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input type="text" value={(bankModal as Record<string, string>)[field] || ''}
                    onChange={(e) => setBankModal((m) => ({ ...m, [field]: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Status Aktif</label>
                <button onClick={() => setBankModal((m) => ({ ...m, status: m?.status === 'active' ? 'inactive' : 'active' }))}
                  className={`w-10 h-5 rounded-full transition-colors ${bankModal.status === 'active' ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${bankModal.status === 'active' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button onClick={() => setBankModal(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white">Batal</button>
              <button onClick={saveBankAccount} disabled={bankLoading} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium disabled:opacity-50">
                {bankLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Account Modal */}
      {instantModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">{instantModal.id ? 'Edit' : 'Tambah'} Instant Payment</h3>
              <button onClick={() => setInstantModal(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Metode</label>
                <select value={instantModal.method || ''} onChange={(e) => setInstantModal((m) => ({ ...m, method: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {INSTANT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Info Akun (nomor/email/ID)</label>
                <input type="text" value={instantModal.account_info || ''} onChange={(e) => setInstantModal((m) => ({ ...m, account_info: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Mata Uang (pisahkan dengan koma)</label>
                <input type="text" value={Array.isArray(instantModal.currencies) ? instantModal.currencies.join(', ') : (instantModal.currencies as unknown as string) || ''}
                  onChange={(e) => setInstantModal((m) => ({ ...m, currencies: e.target.value.split(',').map((c) => c.trim()) }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="MYR, SGD, USD" />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button onClick={() => setInstantModal(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white">Batal</button>
              <button onClick={saveInstantAccount} disabled={instantLoading} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium disabled:opacity-50">
                {instantLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crypto Wallet Modal */}
      {cryptoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">{cryptoModal.id ? 'Edit' : 'Tambah'} Crypto Wallet</h3>
              <button onClick={() => setCryptoModal(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Crypto</label>
                  <select value={cryptoModal.crypto || 'USDT'} onChange={(e) => setCryptoModal((m) => ({ ...m, crypto: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    {CRYPTOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Network</label>
                  <select value={cryptoModal.network || 'TRC20'} onChange={(e) => setCryptoModal((m) => ({ ...m, network: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Alamat Wallet</label>
                <input type="text" value={cryptoModal.wallet_address || ''} onChange={(e) => setCryptoModal((m) => ({ ...m, wallet_address: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  placeholder="Masukkan alamat wallet..." />
              </div>
              <p className="text-xs text-gray-500">QR Code akan dibuat otomatis saat menyimpan</p>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button onClick={() => setCryptoModal(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white">Batal</button>
              <button onClick={saveCryptoWallet} disabled={cryptoLoading} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium disabled:opacity-50">
                {cryptoLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View QR Modal */}
      {viewQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">{viewQR.crypto} ({viewQR.network}) QR Code</h3>
              <button onClick={() => setViewQR(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              <img src={viewQR.qr_code_url} alt={`QR Code ${viewQR.crypto}`} className="w-48 h-48 rounded-lg bg-white p-2" />
              <p className="text-xs text-gray-400 font-mono text-center break-all">{viewQR.wallet_address}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
