'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Save, Check, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SettingGroup {
  title: string;
  description: string;
  settings: SettingItem[];
}

interface SettingItem {
  key: string;
  label: string;
  type: 'toggle' | 'number' | 'text' | 'textarea' | 'select';
  description?: string;
  options?: string[];
  unit?: string;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  trading_enabled: 'true',
  maintenance_mode: 'false',
  maintenance_message: 'Platform sedang dalam pemeliharaan. Silakan coba lagi nanti.',
  min_deposit_usd: '50',
  max_deposit_usd: '50000',
  min_withdrawal_usd: '20',
  max_withdrawal_usd: '10000',
  min_trade_amount: '10',
  max_trade_amount: '5000',
  trading_fee_percent: '0',
  withdrawal_fee_percent: '1.5',
  deposit_fee_percent: '0',
  max_leverage: '100',
  default_payout_percent: '80',
  email_deposit_notification: 'true',
  email_withdrawal_notification: 'true',
  email_new_user_notification: 'true',
  trade_durations: '30,60,120,300,600',
  trading_weekends: 'true',
};

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Trading Settings',
    description: 'Kontrol global untuk aktivitas trading di platform',
    settings: [
      { key: 'trading_enabled', label: 'Enable Trading', type: 'toggle', description: 'Aktifkan atau nonaktifkan trading secara global' },
      { key: 'trade_durations', label: 'Durasi Trade (detik)', type: 'text', description: 'Pisahkan dengan koma. Contoh: 30,60,120,300' },
      { key: 'trading_weekends', label: 'Trading Akhir Pekan', type: 'toggle', description: 'Izinkan trading pada Sabtu dan Minggu' },
    ],
  },
  {
    title: 'Maintenance Mode',
    description: 'Aktifkan mode pemeliharaan untuk menonaktifkan akses pengguna',
    settings: [
      { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'toggle', description: 'Nonaktifkan akses pengguna sementara' },
      { key: 'maintenance_message', label: 'Pesan Pemeliharaan', type: 'textarea', description: 'Pesan yang ditampilkan kepada pengguna saat maintenance' },
    ],
  },
  {
    title: 'Limits',
    description: 'Batas minimum dan maksimum untuk deposit, penarikan, dan trade',
    settings: [
      { key: 'min_deposit_usd', label: 'Minimum Deposit', type: 'number', unit: 'USD' },
      { key: 'max_deposit_usd', label: 'Maksimum Deposit', type: 'number', unit: 'USD' },
      { key: 'min_withdrawal_usd', label: 'Minimum Penarikan', type: 'number', unit: 'USD' },
      { key: 'max_withdrawal_usd', label: 'Maksimum Penarikan', type: 'number', unit: 'USD' },
      { key: 'min_trade_amount', label: 'Minimum Trade', type: 'number', unit: 'USD' },
      { key: 'max_trade_amount', label: 'Maksimum Trade', type: 'number', unit: 'USD' },
    ],
  },
  {
    title: 'Fees',
    description: 'Konfigurasi biaya platform',
    settings: [
      { key: 'trading_fee_percent', label: 'Trading Fee', type: 'number', unit: '%', description: '0 = gratis' },
      { key: 'withdrawal_fee_percent', label: 'Withdrawal Fee', type: 'number', unit: '%' },
      { key: 'deposit_fee_percent', label: 'Deposit Fee', type: 'number', unit: '%', description: '0 = gratis' },
    ],
  },
  {
    title: 'Leverage & Payout',
    description: 'Pengaturan leverage dan persentase payout',
    settings: [
      { key: 'max_leverage', label: 'Max Leverage', type: 'number', unit: 'x' },
      { key: 'default_payout_percent', label: 'Default Payout', type: 'number', unit: '%', description: 'Persentase keuntungan untuk trade yang menang' },
    ],
  },
  {
    title: 'Notifications',
    description: 'Pengaturan notifikasi email untuk admin',
    settings: [
      { key: 'email_deposit_notification', label: 'Notifikasi Deposit Baru', type: 'toggle' },
      { key: 'email_withdrawal_notification', label: 'Notifikasi Penarikan Baru', type: 'toggle' },
      { key: 'email_new_user_notification', label: 'Notifikasi Pengguna Baru', type: 'toggle' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [dirty, setDirty] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchSettings = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('platform_settings')
        .select('key, value');
      if (err) throw err;

      const loaded: Record<string, string> = { ...DEFAULT_SETTINGS };
      (data || []).forEach((row: any) => {
        loaded[row.key] = row.value;
      });
      setSettings(loaded);
      setDirty(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    const supabase = createClient();
    setSaving(true);
    try {
      // Upsert all settings
      const upserts = Object.entries(settings).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
      const { error: err } = await supabase
        .from('platform_settings')
        .upsert(upserts, { onConflict: 'key' });
      if (err) throw err;
      setDirty(false);
      showToast('Pengaturan berhasil disimpan');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
  };

  const renderInput = (item: SettingItem) => {
    const value = settings[item.key] ?? DEFAULT_SETTINGS[item.key] ?? '';

    if (item.type === 'toggle') {
      const isOn = value === 'true';
      return (
        <button
          onClick={() => updateSetting(item.key, isOn ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isOn ? 'bg-blue-600' : 'bg-zinc-700'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isOn ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      );
    }

    if (item.type === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(e) => updateSetting(item.key, e.target.value)}
          rows={3}
          className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
        />
      );
    }

    return (
      <div className="flex items-center gap-2">
        <input
          type={item.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => updateSetting(item.key, e.target.value)}
          className="bg-[#0a0a0a] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-32"
        />
        {item.unit && <span className="text-xs text-gray-500">{item.unit}</span>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <Check size={14} />{toast}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Platform Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Konfigurasi platform dari database</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SETTING_GROUPS.map((group) => (
            <div key={group.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">{group.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
              </div>
              <div className="space-y-4">
                {group.settings.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-white">{item.label}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                    <div className="shrink-0">
                      {renderInput(item)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
