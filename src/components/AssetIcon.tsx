'use client';
import React, { useState } from 'react';

// CoinGecko image IDs for crypto assets
const CRYPTO_COINGECKO_IDS: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'XLM': 'stellar',
  'LTC': 'litecoin',
  'ETC': 'ethereum-classic',
  'TRX': 'tron',
  'SHIB': 'shiba-inu',
  'NEAR': 'near',
  'ALGO': 'algorand',
  'ICP': 'internet-computer',
  'FIL': 'filecoin',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'SUI': 'sui',
  'SEI': 'sei-network',
  'INJ': 'injective-protocol',
  'TON': 'the-open-network',
  'HBAR': 'hedera-hashgraph',
  'VET': 'vechain',
  'GRT': 'the-graph',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AXS': 'axie-infinity',
  'AAVE': 'aave',
  'MKR': 'maker',
  'COMP': 'compound-governance-token',
  'CRV': 'curve-dao-token',
  'SNX': 'havven',
  'LDO': 'lido-dao',
  'FTM': 'fantom',
  'EGLD': 'elrond-erd-2',
  'FLOW': 'flow',
  'THETA': 'theta-token',
  'XTZ': 'tezos',
  'EOS': 'eos',
  'ZEC': 'zcash',
  'XMR': 'monero',
  'DASH': 'dash',
  'BAT': 'basic-attention-token',
  'CHZ': 'chiliz',
  'ZIL': 'zilliqa',
  'IOTA': 'iota',
  'NEO': 'neo',
  'WAVES': 'waves',
  'CRO': 'crypto-com-chain',
  'FET': 'fetch-ai',
  'OCEAN': 'ocean-protocol',
  'RNDR': 'render-token',
  'WLD': 'worldcoin-wld',
  'PEPE': 'pepe',
  'FLOKI': 'floki',
  'BONK': 'bonk',
  'JUP': 'jupiter-exchange-solana',
  'PYTH': 'pyth-network',
  'TIA': 'celestia',
  'STRK': 'starknet',
  'ORDI': 'ordinals',
  'LUNC': 'terra-luna',
  'LUNA': 'terra-luna-2',
};

// Clearbit logo domains for stocks
const STOCK_LOGO_DOMAINS: Record<string, string> = {
  'AAPL': 'apple.com',
  'MSFT': 'microsoft.com',
  'GOOGL': 'google.com',
  'AMZN': 'amazon.com',
  'NVDA': 'nvidia.com',
  'TSLA': 'tesla.com',
  'META': 'meta.com',
  'JPM': 'jpmorganchase.com',
  'V': 'visa.com',
  'JNJ': 'jnj.com',
  'WMT': 'walmart.com',
  'PG': 'pg.com',
  'HD': 'homedepot.com',
  'CVX': 'chevron.com',
  'MRK': 'merck.com',
  'LLY': 'lilly.com',
  'ABBV': 'abbvie.com',
  'PEP': 'pepsico.com',
  'KO': 'coca-cola.com',
  'CSCO': 'cisco.com',
  'ADBE': 'adobe.com',
  'NKE': 'nike.com',
  'CRM': 'salesforce.com',
  'INTC': 'intel.com',
  'AMD': 'amd.com',
  'QCOM': 'qualcomm.com',
  'AVGO': 'broadcom.com',
  'ORCL': 'oracle.com',
  'IBM': 'ibm.com',
  'NFLX': 'netflix.com',
  'DIS': 'disney.com',
  'CMCSA': 'comcast.com',
  'VZ': 'verizon.com',
  'T': 'att.com',
  'BAC': 'bankofamerica.com',
  'WFC': 'wellsfargo.com',
  'GS': 'goldmansachs.com',
  'MS': 'morganstanley.com',
  'C': 'citigroup.com',
  'AXP': 'americanexpress.com',
  'MA': 'mastercard.com',
  'PYPL': 'paypal.com',
  'SQ': 'block.xyz',
  'SHOP': 'shopify.com',
  'UBER': 'uber.com',
  'LYFT': 'lyft.com',
  'ABNB': 'airbnb.com',
  'BKNG': 'booking.com',
  'MRNA': 'modernatx.com',
  'PFE': 'pfizer.com',
  'AMGN': 'amgen.com',
  'GILD': 'gilead.com',
  'UNH': 'unitedhealthgroup.com',
  'CVS': 'cvshealth.com',
  'XOM': 'exxonmobil.com',
  'COP': 'conocophillips.com',
  'BA': 'boeing.com',
  'LMT': 'lockheedmartin.com',
  'CAT': 'caterpillar.com',
  'DE': 'deere.com',
  'HON': 'honeywell.com',
  'GE': 'ge.com',
  'F': 'ford.com',
  'GM': 'gm.com',
  'RIVN': 'rivian.com',
  'NIO': 'nio.com',
  'SNOW': 'snowflake.com',
  'PLTR': 'palantir.com',
  'DDOG': 'datadoghq.com',
  'NET': 'cloudflare.com',
  'CRWD': 'crowdstrike.com',
  'PANW': 'paloaltonetworks.com',
  'MU': 'micron.com',
  'ASML': 'asml.com',
  'ARM': 'arm.com',
  'DELL': 'dell.com',
  'WDAY': 'workday.com',
  'NOW': 'servicenow.com',
  'INTU': 'intuit.com',
  'SPOT': 'spotify.com',
  'COIN': 'coinbase.com',
  'HOOD': 'robinhood.com',
  'SOFI': 'sofi.com',
  'BABA': 'alibaba.com',
  'TSM': 'tsmc.com',
  'SONY': 'sony.com',
  'TM': 'toyota.com',
  'SAP': 'sap.com',
  'AZN': 'astrazeneca.com',
  'MELI': 'mercadolibre.com',
  'SE': 'sea.com',
  'GRAB': 'grab.com',
  'MCD': 'mcdonalds.com',
  'SBUX': 'starbucks.com',
  'COST': 'costco.com',
  'TGT': 'target.com',
  'EBAY': 'ebay.com',
  'ETSY': 'etsy.com',
  'PDD': 'pinduoduo.com',
  'BIDU': 'baidu.com',
  'NTES': 'netease.com',
  'MAR': 'marriott.com',
  'HLT': 'hilton.com',
};

// Commodity icons
const COMMODITY_ICONS: Record<string, { emoji: string; bg: string; color: string }> = {
  'XAU': { emoji: '🥇', bg: 'rgba(234,179,8,0.2)', color: '#eab308' },
  'GOLD': { emoji: '🥇', bg: 'rgba(234,179,8,0.2)', color: '#eab308' },
  'XAG': { emoji: '🥈', bg: 'rgba(148,163,184,0.2)', color: '#94a3b8' },
  'SILVER': { emoji: '🥈', bg: 'rgba(148,163,184,0.2)', color: '#94a3b8' },
  'XPT': { emoji: '⚪', bg: 'rgba(226,232,240,0.2)', color: '#e2e8f0' },
  'XPD': { emoji: '⚫', bg: 'rgba(100,116,139,0.2)', color: '#64748b' },
  'WTI': { emoji: '🛢️', bg: 'rgba(30,41,59,0.6)', color: '#94a3b8' },
  'OIL': { emoji: '🛢️', bg: 'rgba(30,41,59,0.6)', color: '#94a3b8' },
  'BRENT': { emoji: '🛢️', bg: 'rgba(30,41,59,0.6)', color: '#94a3b8' },
  'NATGAS': { emoji: '🔥', bg: 'rgba(249,115,22,0.2)', color: '#f97316' },
  'COPPER': { emoji: '🔶', bg: 'rgba(217,119,6,0.2)', color: '#d97706' },
  'ALUMINUM': { emoji: '🔷', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'NICKEL': { emoji: '⬜', bg: 'rgba(100,116,139,0.2)', color: '#64748b' },
  'ZINC': { emoji: '🔘', bg: 'rgba(100,116,139,0.2)', color: '#64748b' },
  'WHEAT': { emoji: '🌾', bg: 'rgba(234,179,8,0.2)', color: '#eab308' },
  'CORN': { emoji: '🌽', bg: 'rgba(234,179,8,0.2)', color: '#eab308' },
  'SOYBEAN': { emoji: '🫘', bg: 'rgba(101,163,13,0.2)', color: '#65a30d' },
  'COFFEE': { emoji: '☕', bg: 'rgba(120,53,15,0.3)', color: '#92400e' },
  'SUGAR': { emoji: '🍬', bg: 'rgba(236,72,153,0.2)', color: '#ec4899' },
  'COTTON': { emoji: '🤍', bg: 'rgba(226,232,240,0.2)', color: '#e2e8f0' },
  'COCOA': { emoji: '🍫', bg: 'rgba(120,53,15,0.3)', color: '#92400e' },
  'LUMBER': { emoji: '🪵', bg: 'rgba(120,53,15,0.2)', color: '#92400e' },
  'RICE': { emoji: '🍚', bg: 'rgba(226,232,240,0.2)', color: '#e2e8f0' },
  'URANIUM': { emoji: '☢️', bg: 'rgba(234,179,8,0.2)', color: '#eab308' },
  'LITHIUM': { emoji: '🔋', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'COBALT': { emoji: '🔵', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'GASOLINE': { emoji: '⛽', bg: 'rgba(249,115,22,0.2)', color: '#f97316' },
  'HEATING OIL': { emoji: '🔥', bg: 'rgba(249,115,22,0.2)', color: '#f97316' },
  'LEAN HOGS': { emoji: '🐷', bg: 'rgba(236,72,153,0.2)', color: '#ec4899' },
  'CATTLE': { emoji: '🐄', bg: 'rgba(101,163,13,0.2)', color: '#65a30d' },
  'FEEDER': { emoji: '🐂', bg: 'rgba(101,163,13,0.2)', color: '#65a30d' },
};

// Forex currency flag emojis
const CURRENCY_FLAGS: Record<string, string> = {
  'USD': '🇺🇸',
  'EUR': '🇪🇺',
  'GBP': '🇬🇧',
  'JPY': '🇯🇵',
  'AUD': '🇦🇺',
  'CAD': '🇨🇦',
  'CHF': '🇨🇭',
  'NZD': '🇳🇿',
  'TRY': '🇹🇷',
  'ZAR': '🇿🇦',
  'MXN': '🇲🇽',
  'BRL': '🇧🇷',
  'SGD': '🇸🇬',
  'HKD': '🇭🇰',
  'CNH': '🇨🇳',
  'INR': '🇮🇳',
  'KRW': '🇰🇷',
  'RUB': '🇷🇺',
  'PLN': '🇵🇱',
  'CZK': '🇨🇿',
  'HUF': '🇭🇺',
  'NOK': '🇳🇴',
  'SEK': '🇸🇪',
  'DKK': '🇩🇰',
};

// Index icons
const INDEX_ICONS: Record<string, { emoji: string; bg: string; color: string }> = {
  'S&P 500': { emoji: '📊', bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
  'NASDAQ 100': { emoji: '💹', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'DOW JONES': { emoji: '🏛️', bg: 'rgba(99,102,241,0.2)', color: '#6366f1' },
  'RUSSELL 2000': { emoji: '📈', bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
  'VIX': { emoji: '⚡', bg: 'rgba(234,179,8,0.2)', color: '#eab308' },
  'DAX': { emoji: '🇩🇪', bg: 'rgba(99,102,241,0.2)', color: '#6366f1' },
  'FTSE 100': { emoji: '🇬🇧', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'CAC 40': { emoji: '🇫🇷', bg: 'rgba(99,102,241,0.2)', color: '#6366f1' },
  'NIKKEI 225': { emoji: '🇯🇵', bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
  'HANG SENG': { emoji: '🇭🇰', bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
  'SSE COMP': { emoji: '🇨🇳', bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
  'KOSPI': { emoji: '🇰🇷', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'SENSEX': { emoji: '🇮🇳', bg: 'rgba(249,115,22,0.2)', color: '#f97316' },
  'NIFTY 50': { emoji: '🇮🇳', bg: 'rgba(249,115,22,0.2)', color: '#f97316' },
  'ASX 200': { emoji: '🇦🇺', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
  'BOVESPA': { emoji: '🇧🇷', bg: 'rgba(34,197,94,0.2)', color: '#22c55e' },
  'TASI': { emoji: '🇸🇦', bg: 'rgba(34,197,94,0.2)', color: '#22c55e' },
  'MOEX': { emoji: '🇷🇺', bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
};

function getCryptoImageUrl(symbol: string): string | null {
  // Extract base symbol (remove /USD, USDT etc)
  const base = symbol.replace(/\/USD.*|USDT.*|USD.*/i, '').replace(/[^A-Z]/g, '').toUpperCase();
  const coinId = CRYPTO_COINGECKO_IDS[base];
  if (!coinId) return null;
  return `https://assets.coingecko.com/coins/images/thumb/${coinId}.png`;
}

function getStockLogoUrl(symbol: string): string | null {
  const clean = symbol.replace(/[^A-Z]/g, '').toUpperCase();
  const domain = STOCK_LOGO_DOMAINS[clean];
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}`;
}

function getForexEmoji(symbol: string): { base: string; quote: string } {
  // Parse forex pair like EUR/USD, EURUSD
  const normalized = symbol.replace('/', '').toUpperCase();
  const base = normalized.slice(0, 3);
  const quote = normalized.slice(3, 6);
  return { base, quote };
}

interface AssetIconProps {
  symbol: string;
  name?: string;
  category?: 'crypto' | 'stocks' | 'forex' | 'commodities' | 'indices' | 'commodity' | 'stock';
  coinId?: string;
  size?: number;
  className?: string;
}

export default function AssetIcon({ symbol, name, category, coinId, size = 32, className = '' }: AssetIconProps) {
  const [imgError, setImgError] = useState(false);
  const [img2Error, setImg2Error] = useState(false);

  const borderRadius = Math.round(size * 0.28);
  const fontSize = Math.round(size * 0.44);
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  // Normalize category
  const cat = category === 'commodity' ? 'commodities' : category === 'stock' ? 'stocks' : category;

  // ── CRYPTO ──────────────────────────────────────────────────────────────────
  if (cat === 'crypto') {
    // Try coinId first, then symbol lookup
    const resolvedCoinId = coinId || CRYPTO_COINGECKO_IDS[symbol.replace(/\/USD.*|USDT.*/i, '').toUpperCase()];
    const imgUrl = resolvedCoinId
      ? `https://assets.coingecko.com/coins/images/thumb/${resolvedCoinId}.png`
      : null;

    if (imgUrl && !imgError) {
      return (
        <div style={containerStyle} className={className}>
          <img
            src={imgUrl}
            alt={name || symbol}
            width={size}
            height={size}
            style={{ width: size, height: size, objectFit: 'contain', borderRadius }}
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    // Fallback: colored circle with symbol initial
    const cryptoColors: Record<string, string> = {
      'BTC': '#F7931A', 'ETH': '#627EEA', 'SOL': '#9945FF', 'BNB': '#F3BA2F',
      'XRP': '#00AAE4', 'ADA': '#0033AD', 'DOGE': '#C2A633', 'AVAX': '#E84142',
      'DOT': '#E6007A', 'MATIC': '#8247E5', 'LINK': '#2A5ADA', 'UNI': '#FF007A',
      'ATOM': '#2E3148', 'LTC': '#BFBBBB', 'SHIB': '#FFA409', 'NEAR': '#00C08B',
      'APT': '#00D4AA', 'ARB': '#28A0F0', 'OP': '#FF0420', 'SUI': '#6FBCF0',
      'INJ': '#00F2FE', 'TON': '#0098EA', 'TRX': '#EF0027', 'XLM': '#14B6E7',
    };
    const base = symbol.replace(/\/USD.*|USDT.*/i, '').toUpperCase();
    const bg = cryptoColors[base] || '#374151';
    return (
      <div style={{ ...containerStyle, background: bg }} className={className}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize, lineHeight: 1 }}>
          {base[0] || '?'}
        </span>
      </div>
    );
  }

  // ── STOCKS ──────────────────────────────────────────────────────────────────
  if (cat === 'stocks') {
    const clean = symbol.replace(/[^A-Z.]/g, '').toUpperCase();
    const domain = STOCK_LOGO_DOMAINS[clean];
    const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

    if (logoUrl && !imgError) {
      return (
        <div style={{ ...containerStyle, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }} className={className}>
          <img
            src={logoUrl}
            alt={name || symbol}
            width={size - 4}
            height={size - 4}
            style={{ width: size - 4, height: size - 4, objectFit: 'contain', borderRadius: borderRadius - 2 }}
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    // Fallback: blue circle with letter
    return (
      <div style={{ ...containerStyle, background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.4)' }} className={className}>
        <span style={{ color: '#3b82f6', fontWeight: 700, fontSize, lineHeight: 1 }}>
          {(symbol[0] || '?').toUpperCase()}
        </span>
      </div>
    );
  }

  // ── COMMODITIES ─────────────────────────────────────────────────────────────
  if (cat === 'commodities') {
    // Try to match commodity by symbol or name
    const upperSym = symbol.toUpperCase().replace('/USD', '').replace('USD', '');
    const upperName = (name || '').toUpperCase();

    let commodityData = COMMODITY_ICONS[upperSym];
    if (!commodityData) {
      // Try partial match
      for (const key of Object.keys(COMMODITY_ICONS)) {
        if (upperSym.includes(key) || upperName.includes(key)) {
          commodityData = COMMODITY_ICONS[key];
          break;
        }
      }
    }

    if (commodityData) {
      return (
        <div style={{ ...containerStyle, background: commodityData.bg }} className={className}>
          <span style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }}>{commodityData.emoji}</span>
        </div>
      );
    }

    // Generic commodity fallback
    return (
      <div style={{ ...containerStyle, background: 'rgba(249,115,22,0.2)' }} className={className}>
        <span style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }}>📦</span>
      </div>
    );
  }

  // ── FOREX ────────────────────────────────────────────────────────────────────
  if (cat === 'forex') {
    const { base, quote } = getForexEmoji(symbol);
    const baseFlag = CURRENCY_FLAGS[base];
    const quoteFlag = CURRENCY_FLAGS[quote];

    if (baseFlag) {
      return (
        <div style={{ ...containerStyle, background: 'rgba(16,185,129,0.15)', position: 'relative' }} className={className}>
          {quoteFlag && size >= 28 ? (
            <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: Math.round(size * 0.42), lineHeight: 1, position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)' }}>{baseFlag}</span>
              <span style={{ fontSize: Math.round(size * 0.32), lineHeight: 1, position: 'absolute', right: '1px', bottom: '2px', opacity: 0.85 }}>{quoteFlag}</span>
            </div>
          ) : (
            <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{baseFlag}</span>
          )}
        </div>
      );
    }

    // Fallback: green circle with FX
    return (
      <div style={{ ...containerStyle, background: 'rgba(16,185,129,0.2)' }} className={className}>
        <span style={{ color: '#10b981', fontWeight: 700, fontSize: Math.round(size * 0.3), lineHeight: 1 }}>FX</span>
      </div>
    );
  }

  // ── INDICES ──────────────────────────────────────────────────────────────────
  if (cat === 'indices') {
    const upperName = (name || symbol).toUpperCase();
    let indexData: { emoji: string; bg: string; color: string } | undefined;

    for (const key of Object.keys(INDEX_ICONS)) {
      if (upperName.includes(key.toUpperCase()) || symbol.toUpperCase().includes(key.toUpperCase())) {
        indexData = INDEX_ICONS[key];
        break;
      }
    }

    if (indexData) {
      return (
        <div style={{ ...containerStyle, background: indexData.bg }} className={className}>
          <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{indexData.emoji}</span>
        </div>
      );
    }

    // Generic index fallback
    return (
      <div style={{ ...containerStyle, background: 'rgba(139,92,246,0.2)' }} className={className}>
        <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>📊</span>
      </div>
    );
  }

  // ── UNKNOWN / FALLBACK ───────────────────────────────────────────────────────
  return (
    <div style={{ ...containerStyle, background: 'rgba(100,116,139,0.2)' }} className={className}>
      <span style={{ color: '#94a3b8', fontWeight: 700, fontSize, lineHeight: 1 }}>
        {(symbol[0] || '?').toUpperCase()}
      </span>
    </div>
  );
}
