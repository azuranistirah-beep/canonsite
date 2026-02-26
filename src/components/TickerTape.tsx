'use client';
import React, { useEffect, useRef } from 'react';

export default function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef?.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    containerRef?.current?.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
        { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
        { proName: 'BINANCE:SOLUSDT', title: 'Solana' },
        { proName: 'BINANCE:BNBUSDT', title: 'BNB' },
        { proName: 'BITSTAMP:XRPUSD', title: 'XRP' },
        { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
        { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
        { proName: 'FX_IDC:EURUSD', title: 'EUR/USD' },
        { proName: 'FX_IDC:GBPUSD', title: 'GBP/USD' },
        { proName: 'FX_IDC:USDJPY', title: 'USD/JPY' },
        { proName: 'OANDA:XAUUSD', title: 'Gold' },
        { proName: 'TVC:USOIL', title: 'Crude Oil' },
        { proName: 'NASDAQ:AAPL', title: 'Apple' },
        { proName: 'NASDAQ:NVDA', title: 'NVIDIA' },
        { proName: 'NASDAQ:TSLA', title: 'Tesla' },
        { proName: 'NASDAQ:MSFT', title: 'Microsoft' },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en',
    });

    containerRef?.current?.appendChild(script);

    return () => {
      if (containerRef?.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      style={{
        width: '100%',
        background: '#0d0e24',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        height: '52px',
        minHeight: '52px',
        maxHeight: '52px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ width: '100%', height: '52px' }}
      />
    </div>
  );
}
