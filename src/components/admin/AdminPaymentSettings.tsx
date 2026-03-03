'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Check, ToggleLeft, ToggleRight, Building2, Smartphone, Bitcoin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface BankAccount {
  id: string;
  currency: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  swift_code: string;
  status: 'active' | 'inactive';
}

interface InstantAccount {
  id: string;
  method: string;
  account_info: string;
  currencies: string[];
  status: 'active' | 'inactive';
}

interface CryptoWallet {
  id: string;
  crypto: string;
  network: string;
  wallet_address: string;
  qr_code_url: string;
  status: 'active' | 'inactive';
}

function StatusToggle({ status, onToggle }: { status: 'active' | 'inactive'; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
      status === 'active' ? 'text-green-400' : 'text-gray-500'
    }`}>
      {status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
      {status === 'active' ? 'Aktif' : 'Nonaktif'}
    </button>
  );
}

export default function AdminPaymentSettingsPage() {
  const [activeTab, setActiveTab] = useState<'bank' | 'instant' | 'crypto'>('bank');
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [instants, setInstants] = useState<InstantAccount[]>([]);
  const [cryptos, setCryptos] = useState<CryptoWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const [bankModal, setBankModal] = useState<Partial<BankAccount> | null>(null);
  const [instantModal, setInstantModal] = useState<Partial<InstantAccount> | null>(null);
  const [cryptoModal, setCryptoModal] = useState<Partial<CryptoWallet> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const [bankRes, instantRes, cryptoRes] = await Promise.all([
        supabase.from('payment_bank_accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_instant_accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_crypto_wallets').select('*').order('created_at', { ascending: false }),
      ]);
      if (bankRes.error) throw bankRes.error;
      if (instantRes.error) throw instantRes.error;
      if (cryptoRes.error) throw cryptoRes.error;
      setBanks(bankRes.data || []);
      setInstants(instantRes.data || []);
      setCryptos(cryptoRes.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Bank handlers
  const saveBank = async () => {
    if (!bankModal) return;
    const supabase = createClient();
    setActionLoading(true);
    try {
      if (bankModal.id) {
        const { error } = await supabase.from('payment_bank_accounts')
          .update({ currency: bankModal.currency, bank_name: bankModal.bank_name, account_number: bankModal.account_number, account_holder: bankModal.account_holder, swift_code: bankModal.swift_code || '', status: bankModal.status, updated_at: new Date().toISOString() })
          .eq('id', bankModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_bank_accounts')
          .insert({ currency: bankModal.currency, bank_name: bankModal.bank_name, account_number: bankModal.account_number, account_holder: bankModal.account_holder, swift_code: bankModal.swift_code || '', status: 'active' });
        if (error) throw error;
      }
      await fetchAll();
      setBankModal(null);
      showToast('Akun bank disimpan');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteBank = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('payment_bank_accounts').delete().eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setBanks(prev => prev.filter(b => b.id !== id));
    showToast('Akun bank dihapus');
  };

  const toggleBank = async (id: string) => {
    const supabase = createClient();
    const bank = banks.find(b => b.id === id);
    if (!bank) return;
    const newStatus = bank.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('payment_bank_accounts').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setBanks(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
  };

  // Instant handlers
  const saveInstant = async () => {
    if (!instantModal) return;
    const supabase = createClient();
    setActionLoading(true);
    try {
      if (instantModal.id) {
        const { error } = await supabase.from('payment_instant_accounts')
          .update({ method: instantModal.method, account_info: instantModal.account_info, status: instantModal.status, updated_at: new Date().toISOString() })
          .eq('id', instantModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_instant_accounts')
          .insert({ method: instantModal.method, account_info: instantModal.account_info, currencies: ['USD'], status: 'active' });
        if (error) throw error;
      }
      await fetchAll();
      setInstantModal(null);
      showToast('Akun instant disimpan');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteInstant = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('payment_instant_accounts').delete().eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setInstants(prev => prev.filter(i => i.id !== id));
    showToast('Akun instant dihapus');
  };

  const toggleInstant = async (id: string) => {
    const supabase = createClient();
    const inst = instants.find(i => i.id === id);
    if (!inst) return;
    const newStatus = inst.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('payment_instant_accounts').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setInstants(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
  };

  // Crypto handlers
  const saveCrypto = async () => {
    if (!cryptoModal) return;
    const supabase = createClient();
    setActionLoading(true);
    try {
      if (cryptoModal.id) {
        const { error } = await supabase.from('payment_crypto_wallets')
          .update({ crypto: cryptoModal.crypto, network: cryptoModal.network, wallet_address: cryptoModal.wallet_address, status: cryptoModal.status, updated_at: new Date().toISOString() })
          .eq('id', cryptoModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_crypto_wallets')
          .insert({ crypto: cryptoModal.crypto, network: cryptoModal.network, wallet_address: cryptoModal.wallet_address, qr_code_url: '', status: 'active' });
        if (error) throw error;
      }
      await fetchAll();
      setCryptoModal(null);
      showToast('Dompet crypto disimpan');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCrypto = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('payment_crypto_wallets').delete().eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setCryptos(prev => prev.filter(c => c.id !== id));
    showToast('Dompet crypto dihapus');
  };

  const toggleCrypto = async (id: string) => {
    const supabase = createClient();
    const crypto = cryptos.find(c => c.id === id);
    if (!crypto) return;
    const newStatus = crypto.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('payment_crypto_wallets').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setCryptos(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const TABS = [
    { key: 'bank', label: 'Bank Accounts', icon: Building2, count: banks.length },
    { key: 'instant', label: 'Instant Payment', icon: Smartphone, count: instants.length },
    { key: 'crypto', label: 'Crypto Wallets', icon: Bitcoin, count: cryptos.length },
  ] as const;

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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === key ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            <Icon size={15} />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === key ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Bank Accounts Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={() => setBankModal({ currency: 'USD', status: 'active' })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors">
                  <Plus size={14} /> Tambah Bank
                </button>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Bank</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">No. Rekening</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Mata Uang</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {banks.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-500">Belum ada akun bank</td></tr>
                      ) : banks.map(b => (
                        <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-white text-sm font-medium">{b.bank_name}</p>
                            <p className="text-gray-500 text-xs">{b.account_holder}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs">{b.account_number}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{b.currency}</span>
                          </td>
                          <td className="px-4 py-3"><StatusToggle status={b.status} onToggle={() => toggleBank(b.id)} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setBankModal({ ...b })} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"><Edit2 size={14} /></button>
                              <button onClick={() => deleteBank(b.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Instant Payment Tab */}
          {activeTab === 'instant' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={() => setInstantModal({ status: 'active' })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors">
                  <Plus size={14} /> Tambah Instant
                </button>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Provider</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Info Akun</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {instants.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-500">Belum ada akun instant</td></tr>
                      ) : instants.map(i => (
                        <tr key={i.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{i.method}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{i.account_info}</td>
                          <td className="px-4 py-3"><StatusToggle status={i.status} onToggle={() => toggleInstant(i.id)} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setInstantModal({ ...i })} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"><Edit2 size={14} /></button>
                              <button onClick={() => deleteInstant(i.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Crypto Wallets Tab */}
          {activeTab === 'crypto' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={() => setCryptoModal({ status: 'active' })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors">
                  <Plus size={14} /> Tambah Wallet
                </button>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Crypto</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Network</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Alamat Wallet</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cryptos.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-500">Belum ada wallet crypto</td></tr>
                      ) : cryptos.map(c => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{c.crypto}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">{c.network}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[180px]">{c.wallet_address}</td>
                          <td className="px-4 py-3"><StatusToggle status={c.status} onToggle={() => toggleCrypto(c.id)} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setCryptoModal({ ...c })} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"><Edit2 size={14} /></button>
                              <button onClick={() => deleteCrypto(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bank Modal */}
      {bankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{bankModal.id ? 'Edit' : 'Tambah'} Akun Bank</h3>
              <button onClick={() => setBankModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[['bank_name', 'Nama Bank'], ['account_number', 'No. Rekening'], ['account_holder', 'Nama Pemilik'], ['currency', 'Mata Uang'], ['swift_code', 'SWIFT Code (opsional)']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    value={(bankModal as any)[key] || ''}
                    onChange={(e) => setBankModal(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveBank} disabled={actionLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                {actionLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setBankModal(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-gray-400 font-medium transition-colors">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Modal */}
      {instantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{instantModal.id ? 'Edit' : 'Tambah'} Instant Payment</h3>
              <button onClick={() => setInstantModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[['method', 'Provider (e.g. Touch n Go)'], ['account_info', 'Info Akun / No. HP']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    value={(instantModal as any)[key] || ''}
                    onChange={(e) => setInstantModal(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveInstant} disabled={actionLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                {actionLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setInstantModal(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-gray-400 font-medium transition-colors">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Crypto Modal */}
      {cryptoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{cryptoModal.id ? 'Edit' : 'Tambah'} Crypto Wallet</h3>
              <button onClick={() => setCryptoModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[['crypto', 'Nama Crypto (e.g. USDT)'], ['network', 'Network (e.g. TRC20)'], ['wallet_address', 'Alamat Wallet']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    value={(cryptoModal as any)[key] || ''}
                    onChange={(e) => setCryptoModal(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveCrypto} disabled={actionLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
                {actionLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setCryptoModal(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-gray-400 font-medium transition-colors">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
