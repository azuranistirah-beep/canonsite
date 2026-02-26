'use client';
import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TickerTape from '@/components/TickerTape';

interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  source: string;
  time: string;
  category: string;
  imageUrl: string;
}

const newsArticles: NewsArticle[] = [
{ id: 1, title: 'Bitcoin Surges Past $69,000 as Institutional Demand Grows', summary: 'Bitcoin has broken through the $69,000 resistance level as major institutional investors continue to accumulate the leading cryptocurrency amid growing ETF inflows.', source: 'CoinDesk', time: '2 hours ago', category: 'Crypto', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1cf599911-1771082008843.png" },
{ id: 2, title: 'Federal Reserve Signals Potential Rate Cuts in 2024', summary: 'Fed Chair Jerome Powell hinted at possible interest rate reductions later this year as inflation continues to moderate toward the 2% target.', source: 'Reuters', time: '4 hours ago', category: 'Economy', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1f91332bf-1765703342999.png" },
{ id: 3, title: 'NVIDIA Reports Record Q4 Earnings, Stock Hits All-Time High', summary: 'NVIDIA Corporation reported record quarterly revenue of $22.1 billion, driven by unprecedented demand for AI chips and data center solutions.', source: 'Bloomberg', time: '6 hours ago', category: 'Stocks', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1b89b8cc0-1765241695350.png" },
{ id: 4, title: 'EUR/USD Climbs as ECB Holds Rates Steady', summary: 'The Euro strengthened against the US Dollar after the European Central Bank maintained its benchmark interest rates, signaling a cautious approach to monetary policy.', source: 'FX Street', time: '8 hours ago', category: 'Forex', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1358c8a4a-1768855583419.png" },
{ id: 5, title: 'Gold Prices Rise Amid Geopolitical Tensions', summary: 'Gold futures climbed to $2,345 per ounce as investors sought safe-haven assets amid escalating geopolitical tensions in the Middle East.', source: 'MarketWatch', time: '10 hours ago', category: 'Commodities', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1571599f9-1772055716868.png" },
{ id: 6, title: 'S&P 500 Reaches New Record High on Strong Jobs Data', summary: 'The S&P 500 index hit a new all-time high after the US Labor Department reported stronger-than-expected job creation numbers for January.', source: 'CNBC', time: '12 hours ago', category: 'Stocks', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1463ceadf-1765424448972.png" },
{ id: 7, title: 'Ethereum ETF Approval Could Trigger Major Rally', summary: 'Analysts predict that SEC approval of spot Ethereum ETFs could trigger a significant price rally similar to what was seen with Bitcoin ETFs earlier this year.', source: 'The Block', time: '1 day ago', category: 'Crypto', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1f6548682-1766305819081.png" },
{ id: 8, title: 'Oil Prices Stabilize After OPEC+ Production Cut Extension', summary: 'Crude oil prices found support after OPEC+ members agreed to extend voluntary production cuts through the second quarter of 2024.', source: 'Reuters', time: '1 day ago', category: 'Commodities', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1914c2e96-1771109986987.png" },
{ id: 9, title: 'Apple Announces New AI Features for iPhone', summary: 'Apple unveiled a suite of artificial intelligence features for its iPhone lineup, sending shares up 2% in after-hours trading.', source: 'TechCrunch', time: '2 days ago', category: 'Stocks', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_177c87ef5-1769233350641.png" },
{ id: 10, title: 'USD/JPY Hits 34-Year High as BOJ Maintains Ultra-Low Rates', summary: 'The US Dollar surged to its highest level against the Japanese Yen in 34 years after the Bank of Japan kept its ultra-loose monetary policy unchanged.', source: 'FX Street', time: '2 days ago', category: 'Forex', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_16c1690f9-1771578105837.png" },
{ id: 11, title: 'Global GDP Growth Forecast Revised Upward by IMF', summary: 'The International Monetary Fund raised its global growth forecast for 2024 to 3.2%, citing resilient consumer spending and easing inflation pressures.', source: 'Financial Times', time: '3 days ago', category: 'Economy', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_157d7d30a-1768683531387.png" },
{ id: 12, title: 'Solana Ecosystem Sees Record DeFi Activity', summary: 'Decentralized finance activity on the Solana blockchain reached record levels, with total value locked surpassing $5 billion for the first time.', source: 'Decrypt', time: '3 days ago', category: 'Crypto', imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1804a69c4-1772055717594.png" }];


const tabs = ['All News', 'Stocks', 'Forex', 'Crypto', 'Commodities', 'Economy'];

export default function NewsPage() {
  const [activeTab, setActiveTab] = useState('All News');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = newsArticles.filter((article) => {
    const matchesTab = activeTab === 'All News' || article.category === activeTab;
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0b1e' }}>
      <Navbar />
      <TickerTape />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Market News</h1>
              <p className="text-slate-400 text-sm">Latest financial updates from trusted sources</p>
            </div>
            <div className="relative w-full md:w-72">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-white placeholder-slate-400"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Search news..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} />
              
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {tabs.map((tab) =>
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab ?
              'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-white'}`
              }>
              
                {tab}
              </button>
            )}
          </div>

          {/* News grid */}
          {filtered.length === 0 ?
          <div className="text-center py-20">
              <div className="text-6xl mb-4">📰</div>
              <h3 className="text-xl font-bold text-white mb-2">No articles found</h3>
              <p className="text-slate-400">Try adjusting your filters or search query</p>
            </div> :

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((article) =>
            <div
              key={article.id}
              className="rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.01]"
              style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}>
              
                  <div className="relative overflow-hidden h-48">
                    <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  article.category === 'Crypto' ? 'bg-orange-500/30 text-orange-300' :
                  article.category === 'Stocks' ? 'bg-blue-500/30 text-blue-300' :
                  article.category === 'Forex' ? 'bg-purple-500/30 text-purple-300' :
                  article.category === 'Commodities' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-green-500/30 text-green-300'}`
                  }>
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-white mb-2 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
                      {article.summary}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-300">{article.source}</span>
                      <span>{article.time}</span>
                    </div>
                  </div>
                </div>
            )}
            </div>
          }
        </div>
      </main>
      <Footer />
    </div>);

}