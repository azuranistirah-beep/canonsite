'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface CopyTradePageProps {
  userId: string | null;
  realBalance: number;
  demoBalance: number;
  accountType: 'demo' | 'real';
  currency: { code: string; symbol: string };
  onCopyTradeStatusChange?: (active: boolean) => void;
}

const RATING_SCORES = [
  { label: 'Activity', score: 10, color: '#10b981' },
  { label: 'Probability', score: 10, color: '#10b981' },
  { label: 'Instrument', score: 10, color: '#10b981' },
  { label: 'Popularity', score: 10, color: '#10b981' },
  { label: 'Experience', score: 10, color: '#10b981' },
  { label: 'Reliability', score: 10, color: '#10b981' },
];

function useCountUp(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target, duration]);
  return count;
}

export default function CopyTradePage({
  userId,
  realBalance,
  demoBalance,
  accountType,
  currency,
  onCopyTradeStatusChange,
}: CopyTradePageProps) {
  const [copyTradeActive, setCopyTradeActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totalFollowers, setTotalFollowers] = useState(100000);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  const followerCount = useCountUp(totalFollowers, 2000);

  // Minimum balance in USD
  const MIN_BALANCE_USD = 1500;
  const CURRENCY_MIN: Record<string, number> = {
    USD: 1500, MYR: 5000, EUR: 1380, GBP: 1185, SGD: 2010,
    THB: 52500, PHP: 84750, JPY: 224250, AUD: 2295, CNY: 10860,
  };

  const minBalance = CURRENCY_MIN[currency.code] || MIN_BALANCE_USD;
  const currentBalance = accountType === 'real' ? realBalance : demoBalance;
  const hasEnoughBalance = realBalance >= MIN_BALANCE_USD;

  const fetchStatus = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('copy_trade_active')
        .eq('user_id', userId)
        .single();
      if (data) {
        setCopyTradeActive(data.copy_trade_active ?? false);
        onCopyTradeStatusChange?.(data.copy_trade_active ?? false);
      }

      // Fetch total active followers count
      const { count } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('copy_trade_active', true);
      if (count !== null) setTotalFollowers(100000 + count);

      // Check global setting
      const { data: setting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'copy_trade_enabled')
        .single();
      if (setting) setGlobalEnabled(setting.value === 'true');
    } catch (err) {
      console.error('Error fetching copy trade status:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, onCopyTradeStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleFollow = useCallback(async () => {
    if (!userId) { setError('Please sign in to follow Copy Trade'); return; }
    if (!hasEnoughBalance) {
      setError(`Insufficient balance. Minimum $${MIN_BALANCE_USD.toLocaleString()} (or ${currency.symbol}${minBalance.toLocaleString()}) required to follow Copy Trade.`);
      return;
    }
    if (!globalEnabled) {
      setError('Copy Trade is currently disabled by the administrator.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      // Get user email
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';

      // Update user profile
      await supabase.from('user_profiles').update({
        copy_trade_active: true,
        copy_trade_joined_at: new Date().toISOString(),
      }).eq('user_id', userId);

      // Insert notification
      await supabase.from('copy_trade_notifications').insert({
        user_id: userId,
        user_email: userEmail,
        action: 'follow',
        balance_at_join: realBalance,
        currency: currency.code,
      });

      setCopyTradeActive(true);
      onCopyTradeStatusChange?.(true);
      setSuccess('You are now following Copy Trade by Investoft! Manual trading has been disabled.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to follow Copy Trade. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }, [userId, hasEnoughBalance, globalEnabled, realBalance, currency, minBalance, onCopyTradeStatusChange]);

  const handleUnfollow = useCallback(async () => {
    if (!userId) return;
    setActionLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';

      await supabase.from('user_profiles').update({
        copy_trade_active: false,
      }).eq('user_id', userId);

      await supabase.from('copy_trade_notifications').insert({
        user_id: userId,
        user_email: userEmail,
        action: 'unfollow',
        balance_at_join: realBalance,
        currency: currency.code,
      });

      setCopyTradeActive(false);
      onCopyTradeStatusChange?.(false);
      setSuccess('You have stopped following Copy Trade. Manual trading is now enabled.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to stop following Copy Trade. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }, [userId, realBalance, currency, onCopyTradeStatusChange]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1e2a45', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>Loading Copy Trade...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 900, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ct-card { background: #0d1224; border: 1px solid #1e2a45; border-radius: 12px; padding: 20px; }
        .ct-progress-bar { height: 6px; background: #1e2a45; border-radius: 3px; overflow: hidden; }
        .ct-progress-fill { height: 100%; border-radius: 3px; transition: width 1.5s ease; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24, animation: 'fadeIn 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Copy Trade by Investoft</h1>
          <span style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px',
            borderRadius: 4, fontWeight: 600 }}>OFFICIAL PROVIDER</span>
        </div>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Automated trading system powered by Investoft's proprietary AI signals</p>
      </div>

      {/* Status Banner */}
      {copyTradeActive && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          <div>
            <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>Copy Trade Active</span>
            <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>Manual trading is disabled while Copy Trade is active</span>
          </div>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#f87171', fontSize: 13,
          animation: 'fadeIn 0.3s ease'
        }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#10b981', fontSize: 13,
          animation: 'fadeIn 0.3s ease'
        }}>
          ✅ {success}
        </div>
      )}

      {/* Provider Card */}
      <div className="ct-card" style={{ marginBottom: 16, animation: 'fadeIn 0.5s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Provider Logo */}
          <div style={{
            width: 64, height: 64, background: 'linear-gradient(135deg, #10b981, #059669)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 4px 20px rgba(16,185,129,0.3)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Investoft</h2>
              <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>VERIFIED</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Investoft's automated trading system — professional AI-driven signals with 90%+ win ratio</p>
          </div>
          {/* Followers Counter */}
          <div style={{ textAlign: 'center', padding: '8px 16px', background: '#0a0e1a', borderRadius: 10, border: '1px solid #1e2a45' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
              {followerCount >= 100000 ? '100,000+' : followerCount.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Active Followers</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Win Ratio - Large */}
        <div className="ct-card" style={{ animation: 'fadeIn 0.6s ease' }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Win Ratio</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: '#10b981', lineHeight: 1, marginBottom: 4 }}>90%</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Based on historical performance</div>
            <div style={{ marginTop: 12 }}>
              <div className="ct-progress-bar">
                <div className="ct-progress-fill" style={{ width: '90%', background: 'linear-gradient(90deg, #10b981, #059669)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Rating Scores */}
        <div className="ct-card" style={{ animation: 'fadeIn 0.7s ease' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Trading Scores</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RATING_SCORES.map((item) => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.score}/10</span>
                </div>
                <div className="ct-progress-bar">
                  <div className="ct-progress-fill" style={{ width: `${item.score * 10}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Minimum Balance */}
        <div className="ct-card" style={{ animation: 'fadeIn 0.8s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(245,158,11,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>Minimum Balance Required</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ background: '#0a0e1a', borderRadius: 8, padding: '8px 14px', border: '1px solid #1e2a45' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>USD</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>$1,500</div>
            </div>
            <div style={{ background: '#0a0e1a', borderRadius: 8, padding: '8px 14px', border: '1px solid #1e2a45' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>MYR</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>RM 5,000</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>* Other currencies equivalent to USD $1,500</p>
          {!hasEnoughBalance && (
            <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 10px' }}>
              <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>⚠️ Your real balance (${realBalance.toFixed(2)}) is below the minimum requirement.</p>
            </div>
          )}
        </div>

        {/* Guarantee */}
        <div className="ct-card" style={{ animation: 'fadeIn 0.9s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(16,185,129,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>100% Balance Guarantee</span>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px' }}>If Copy Trade results in a loss, your full balance will be returned — guaranteed.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Zero risk to your capital</span>
          </div>
        </div>

        {/* Automation */}
        <div className="ct-card" style={{ animation: 'fadeIn 1s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>Automation Entry</span>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 8px' }}>Trades are executed automatically based on Investoft's AI signals.</p>
          <div style={{ background: '#0a0e1a', borderRadius: 6, padding: '8px 10px', border: '1px solid #1e2a45' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Trading Ratio</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>1:1 Mirror Trading</div>
          </div>
        </div>
      </div>

      {/* Follow / Stop Follow Button */}
      <div className="ct-card" style={{ animation: 'fadeIn 1.1s ease' }}>
        {!globalEnabled && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#f59e0b', fontSize: 13 }}>
            ⚠️ Copy Trade is currently disabled by the administrator.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
              {copyTradeActive ? 'Currently Following Copy Trade' : 'Start Following Copy Trade'}
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              {copyTradeActive
                ? 'Your account is actively copying Investoft trades' :'Follow Investoft to automatically copy all trades'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {copyTradeActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '4px 12px' }}>
                <div style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>ACTIVE</span>
              </div>
            )}
            {copyTradeActive ? (
              <button
                onClick={handleUnfollow}
                disabled={actionLoading}
                style={{
                  background: actionLoading ? '#374151' : 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#f87171', borderRadius: 8, padding: '10px 24px',
                  fontSize: 13, fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', opacity: actionLoading ? 0.7 : 1,
                  boxShadow: actionLoading || !globalEnabled ? 'none' : '0 4px 15px rgba(16,185,129,0.3)',
                }}
              >
                {actionLoading ? 'Processing...' : 'Stop Follow'}
              </button>
            ) : (
              <button
                onClick={handleFollow}
                disabled={actionLoading || !globalEnabled}
                style={{
                  background: actionLoading || !globalEnabled
                    ? '#374151' :'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: '#fff', borderRadius: 8, padding: '10px 28px',
                  fontSize: 13, fontWeight: 700, cursor: actionLoading || !globalEnabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', opacity: actionLoading || !globalEnabled ? 0.7 : 1,
                  boxShadow: actionLoading || !globalEnabled ? 'none' : '0 4px 15px rgba(16,185,129,0.3)',
                }}
              >
                {actionLoading ? 'Processing...' : '⚡ Follow Copy Trade'}
              </button>
            )}
          </div>
        </div>
        {copyTradeActive && (
          <div style={{ marginTop: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 12, color: '#f59e0b' }}>Manual trading (Buy/Sell) is disabled while Copy Trade is active. Stop following to trade manually.</span>
          </div>
        )}
      </div>
    </div>
  );
}
