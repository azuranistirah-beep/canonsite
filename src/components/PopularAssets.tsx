import React from 'react';

const popularAssets = [
  { symbol: 'FX:EURUSD', label: 'EUR/USD' },
  { symbol: 'NASDAQ:AAPL', label: 'Apple' },
  { symbol: 'BINANCE:BTCUSDT', label: 'Bitcoin' },
  { symbol: 'NASDAQ:TSLA', label: 'Tesla' },
  { symbol: 'NASDAQ:NVDA', label: 'NVIDIA' },
  { symbol: 'BINANCE:ETHUSDT', label: 'Ethereum' },
  { symbol: 'BINANCE:BNBUSDT', label: 'BNB' },
  { symbol: 'BINANCE:SOLUSDT', label: 'Solana' },
  { symbol: 'BINANCE:XRPUSDT', label: 'XRP' },
  { symbol: 'BINANCE:ADAUSDT', label: 'Cardano' },
  { symbol: 'BINANCE:DOGEUSDT', label: 'Dogecoin' },
  { symbol: 'BINANCE:DOTUSDT', label: 'Polkadot' },
  { symbol: 'BINANCE:MATICUSDT', label: 'Polygon' },
  { symbol: 'BINANCE:LINKUSDT', label: 'Chainlink' },
  { symbol: 'BINANCE:AVAXUSDT', label: 'Avalanche' },
  { symbol: 'BINANCE:UNIUSDT', label: 'Uniswap' },
  { symbol: 'BINANCE:ATOMUSDT', label: 'Cosmos' },
  { symbol: 'BINANCE:LTCUSDT', label: 'Litecoin' },
  { symbol: 'BINANCE:ETCUSDT', label: 'Ethereum Classic' },
  { symbol: 'BINANCE:XLMUSDT', label: 'Stellar' },
  { symbol: 'BINANCE:ALGOUSDT', label: 'Algorand' },
  { symbol: 'BINANCE:VETUSDT', label: 'VeChain' },
  { symbol: 'BINANCE:FILUSDT', label: 'Filecoin' },
  { symbol: 'BINANCE:TRXUSDT', label: 'TRON' },
  { symbol: 'BINANCE:EOSUSDT', label: 'EOS' },
];

export default function PopularAssets() {
  return (
    <section id="markets">
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Popular Assets</h2>
          <p className="text-slate-500">Track and trade the most popular stocks and cryptocurrencies</p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {popularAssets?.map((asset) => {
            const widgetConfig = JSON.stringify({
              symbol: asset?.symbol,
              width: '100%',
              height: '100%',
              dateRange: '12M',
              colorTheme: 'dark',
              isTransparent: true,
              autosize: true,
              largeChartUrl: '',
            });
            return (
              <div
                key={asset?.symbol}
                className="rounded-lg border border-slate-200 bg-white p-2 h-[140px] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="tradingview-widget-container h-full w-full" style={{ width: '100%', height: '100%' }}>
                  <iframe
                    scrolling="no"
                    allowTransparency={true}
                    frameBorder={0}
                    src={`https://www.tradingview-widget.com/embed-widget/mini-symbol-overview/?locale=en#${encodeURIComponent(widgetConfig)}`}
                    title={`${asset?.label} TradingView widget`}
                    lang="en"
                    style={{ userSelect: 'none', boxSizing: 'border-box', display: 'block', height: '100%', width: '100%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="text-center pb-20 bg-slate-50">
        <button className="rounded-md text-sm font-medium h-9 px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-blue-600 hover:text-blue-600 min-w-[200px] transition-all">
          View All Markets
        </button>
      </div>
    </section>
  );
}
