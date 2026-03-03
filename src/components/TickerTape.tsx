'use client';
import React, { useEffect, useRef } from 'react';
import { TICKER_TAPE_SYMBOLS } from '@/data/assets';

export default function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef?.current) return;

    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    containerRef?.current?.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: TICKER_TAPE_SYMBOLS,
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
