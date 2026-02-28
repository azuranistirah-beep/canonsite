'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, RefreshCw, X, Check } from 'lucide-react';

const supabase = createClient();

interface Setting {
  key: string;
  value: string;
}

const SETTING_GROUPS = [
  {
    title: 'Pengaturan Trading',
    settings: [
      { key: 'min_deposit_usd', label: 'Minimum Deposit (USD)', type: 'number' },
      { key: 'max_deposit_usd', label: 'Maksimum Deposit (USD)', type: 'number' },
      { key: 'min_withdrawal_usd', label: 'Minimum Penarikan (USD)', type: 'number' },
      { key: 'max_withdrawal_usd', label: 'Maksimum Penarikan (USD)', type: 'number' },
      { key: 'trade_durations', label: 'Durasi Trade (detik, pisahkan koma)', type: 'text' },
      { key: 'trading_weekends', label: 'Trading Akhir Pekan', type: 'toggle' },
    ],
  },
  {
    title: 'Payout per Aset (%)',
    settings: [
      { key: 'payout_btc', label: 'Bitcoin (BTC)', type: 'number' },
      { key: 'payout_eth', label: 'Ethereum (ETH)', type: 'number' },
      { key: 'payout_gold', label: 'Gold (XAU)', type: 'number' },
      { key: 'payout_eurusd', label: 'EUR/USD', type: 'number' },
    ],
  },
  {
    title: 'Pengaturan Biaya',
    settings: [
      { key: 'deposit_fee_percent', label: 'Biaya Deposit (%)', type: 'number' },
      { key: 'withdrawal_fee_percent', label: 'Biaya Penarikan (%)', type: 'number' },
      { key: 'trading_fee_percent', label: 'Biaya Trading (%)', type: 'number' },
    ],
  },
  {
    title: 'Mode Pemeliharaan',
    settings: [
      { key: 'maintenance_mode', label: 'Aktifkan Mode Pemeliharaan', type: 'toggle' },
      { key: 'maintenance_message', label: 'Pesan Pemeliharaan', type: 'textarea' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.from('platform_settings').select('key, value');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s: Setting) => { map[s.key] = s.value; });
      setSettings(map);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const upserts = Object.entries(settings).map(([key, value]) => ({ key, value }));
      const { error } = await supabase
        .from('platform_settings')
        .upsert(upserts, { onConflict: 'key' });
      if (error) throw error;
      setSuccess('Pengaturan berhasil disimpan');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
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

      {SETTING_GROUPS.map((group) => (
        <div key={group.title} className="bg-[#111111] border border-white/10 rounded-xl">
          <div className="px-5 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">{group.title}</h3>
          </div>
          <div className="p-5 space-y-4">
            {group.settings.map((setting) => (
              <div key={setting.key}>
                {setting.type === 'toggle' ? (
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">{setting.label}</label>
                    <button
                      onClick={() => updateSetting(setting.key, settings[setting.key] === 'true' ? 'false' : 'true')}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        settings[setting.key] === 'true' ? 'bg-blue-500' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${
                        settings[setting.key] === 'true' ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ) : setting.type === 'textarea' ? (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{setting.label}</label>
                    <textarea
                      value={settings[setting.key] || ''}
                      onChange={(e) => updateSetting(setting.key, e.target.value)}
                      rows={3}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{setting.label}</label>
                    <input
                      type={setting.type}
                      value={settings[setting.key] || ''}
                      onChange={(e) => updateSetting(setting.key, e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm text-white font-medium transition-colors disabled:opacity-50"
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </button>
    </div>
  );
}
