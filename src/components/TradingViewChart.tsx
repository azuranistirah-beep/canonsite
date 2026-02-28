'use client';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface TradingViewChartHandle {
  setSymbol: (symbol: string, interval: string) => void;
}

interface TradingViewChartProps {
  tvSymbol: string;
  interval: string;
  theme: 'dark' | 'light';
  onPriceUpdate: (price: number, change?: number, changePercent?: number) => void;
}

const TradingViewChart = forwardRef<TradingViewChartHandle, TradingViewChartProps>(
  function TradingViewChart({ tvSymbol, interval, theme, onPriceUpdate }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const onPriceUpdateRef = useRef(onPriceUpdate);
    const lastPriceRef = useRef<number>(0);
    const widgetReadyRef = useRef(false);
    const pendingSymbolRef = useRef<{ symbol: string; interval: string } | null>(null);
    const currentSymbolRef = useRef(tvSymbol);
    const currentIntervalRef = useRef(interval);

    // Keep callback ref up to date without triggering re-renders
    useEffect(() => {
      onPriceUpdateRef.current = onPriceUpdate;
    }, [onPriceUpdate]);

    // Expose setSymbol method via ref
    useImperativeHandle(ref, () => ({
      setSymbol: (symbol: string, newInterval: string) => {
        if (symbol === currentSymbolRef.current && newInterval === currentIntervalRef.current) return;
        currentSymbolRef.current = symbol;
        currentIntervalRef.current = newInterval;
        // Reset last price when symbol changes
        lastPriceRef.current = 0;

        if (widgetReadyRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { name: 'set-symbol', data: { symbol, interval: newInterval } },
            '*'
          );
        } else {
          // Widget not ready yet, queue the symbol change
          pendingSymbolRef.current = { symbol, interval: newInterval };
        }
      },
    }));

    // Listen for postMessage from TradingView iframe
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        try {
          if (!event.data) return;
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data || typeof data !== 'object') return;

          // Widget ready signal
          if (data.name === 'tv-widget-load') {
            widgetReadyRef.current = true;
            // Apply any pending symbol change
            if (pendingSymbolRef.current && iframeRef.current?.contentWindow) {
              const { symbol, interval: pendingInterval } = pendingSymbolRef.current;
              pendingSymbolRef.current = null;
              iframeRef.current.contentWindow.postMessage(
                { name: 'set-symbol', data: { symbol, interval: pendingInterval } },
                '*'
              );
            }
          }

          // Extract price from various TradingView message formats
          let price: number | null = null;
          let change: number | null = null;
          let changePercent: number | null = null;

          if (data.name === 'quoteUpdate' && data.data) {
            // lp = last price, ch = change, chp = change percent
            price = data.data.lp ?? data.data.last_price ?? data.data.close ?? null;
            change = data.data.ch ?? null;
            changePercent = data.data.chp ?? null;
          } else if (data.name === 'symbolInfo' && data.data) {
            price = data.data.last_price ?? data.data.lp ?? null;
          } else if (data.type === 'price' && typeof data.price === 'number') {
            price = data.price;
          } else if (data.type === 'tick' && data.data) {
            price = data.data.price ?? data.data.lp ?? null;
          } else if (typeof data.lp === 'number') {
            price = data.lp;
            change = data.ch ?? null;
            changePercent = data.chp ?? null;
          } else if (typeof data.last_price === 'number') {
            price = data.last_price;
          }

          if (price !== null && typeof price === 'number' && price > 0 && price !== lastPriceRef.current) {
            lastPriceRef.current = price;
            onPriceUpdateRef.current(
              price,
              change ?? undefined,
              changePercent ?? undefined
            );
          }
        } catch {
          // Not a relevant message
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Build the TradingView widget URL — mount ONCE, never change src
    const widgetConfig = {
      symbol: tvSymbol,
      interval: interval,
      hide_side_toolbar: '0',
      allow_symbol_change: '0',
      save_image: '0',
      theme: theme,
      style: '1',
      timezone: 'Etc/UTC',
      show_popup_button: '0',
      withdateranges: '0',
      hide_top_toolbar: '0',
      hideideas: '1',
      locale: 'en',
    };

    const src = `https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en#${encodeURIComponent(JSON.stringify(widgetConfig))}`;

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <iframe
          ref={iframeRef}
          title="TradingView Chart"
          frameBorder={0}
          allowFullScreen
          src={src}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>
    );
  }
);

export default TradingViewChart;
