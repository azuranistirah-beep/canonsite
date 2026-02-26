'use client';
import { useState, useEffect, useCallback } from 'react';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  market_cap_rank: number;
  circulating_supply: number;
  high_24h: number;
  low_24h: number;
}

export interface ForexAsset {
  symbol: string;
  price: number;
  change: number;
}

export interface MarketData {
  crypto: CryptoAsset[];
  forex: Record<string, ForexAsset>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const CRYPTO_IDS = 'bitcoin,ethereum,solana,ripple,binancecoin';

export function useMarketPrices(refreshInterval = 30000): MarketData {
  const [crypto, setCrypto] = useState<CryptoAsset[]>([]);
  const [forex, setForex] = useState<Record<string, ForexAsset>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const [cryptoRes, forexRes] = await Promise.all([
        fetch(`/api/prices/crypto?ids=${CRYPTO_IDS}&per_page=5`),
        fetch('/api/prices/forex'),
      ]);

      if (!cryptoRes.ok && !forexRes.ok) {
        throw new Error('Market data endpoints unavailable');
      }

      const cryptoData = cryptoRes.ok ? await cryptoRes.json() : { success: false, data: [] };
      const forexData = forexRes.ok ? await forexRes.json() : { success: false, data: {} };

      if (cryptoData.success && cryptoData.data.length > 0) {
        setCrypto(cryptoData.data);
      }
      if (forexData.success) {
        setForex(forexData.data);
      }
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch market data');
      console.error('Market price fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  return { crypto, forex, loading, error, lastUpdated };
}
