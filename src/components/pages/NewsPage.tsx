'use client';
import React, { useState } from 'react';
import TickerTape from '@/components/TickerTape';

interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  source: string;
  time: string;
  category: string;
  imageUrl: string;
  url: string;
}

const newsArticles: NewsArticle[] = [
{
  id: 1,
  title: 'Bitcoin Surges Past $69,000 as Institutional Demand Grows',
  summary: 'Bitcoin has broken through the $69,000 resistance level as major institutional investors continue to accumulate the leading cryptocurrency amid growing ETF inflows.',
  source: 'CoinDesk',
  time: '2 hours ago',
  category: 'Crypto',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1cf599911-1771082008843.png",
  url: '#'
},
{
  id: 2,
  title: 'Federal Reserve Signals Potential Rate Cuts in 2024',
  summary: 'Fed Chair Jerome Powell hinted at possible interest rate reductions later this year as inflation continues to moderate toward the 2% target.',
  source: 'Reuters',
  time: '4 hours ago',
  category: 'Economy',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_12e642b8a-1772057581366.png",
  url: '#'
},
{
  id: 3,
  title: 'NVIDIA Reports Record Q4 Earnings, Stock Hits All-Time High',
  summary: 'NVIDIA Corporation reported record quarterly revenue of $22.1 billion, driven by unprecedented demand for AI chips and data center solutions.',
  source: 'Bloomberg',
  time: '6 hours ago',
  category: 'Stocks',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1b89b8cc0-1765241695350.png",
  url: '#'
},
{
  id: 4,
  title: 'EUR/USD Climbs as ECB Holds Rates Steady',
  summary: 'The Euro strengthened against the US Dollar after the European Central Bank maintained its benchmark interest rates, signaling a cautious approach to monetary policy.',
  source: 'FX Street',
  time: '8 hours ago',
  category: 'Forex',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1358c8a4a-1768855583419.png",
  url: '#'
},
{
  id: 5,
  title: 'Gold Prices Rise Amid Geopolitical Tensions',
  summary: 'Gold futures climbed to $2,345 per ounce as investors sought safe-haven assets amid escalating geopolitical tensions in the Middle East.',
  source: 'MarketWatch',
  time: '10 hours ago',
  category: 'Commodities',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1c0d03ee7-1772057581604.png",
  url: '#'
},
{
  id: 6,
  title: 'S&P 500 Reaches New Record High on Strong Jobs Data',
  summary: 'The S&P 500 index hit a new all-time high after the US Labor Department reported stronger-than-expected job creation numbers for January.',
  source: 'CNBC',
  time: '12 hours ago',
  category: 'Stocks',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1463ceadf-1765424448972.png",
  url: '#'
},
{
  id: 7,
  title: 'Ethereum ETF Approval Could Trigger Major Rally',
  summary: 'Analysts predict that SEC approval of spot Ethereum ETFs could trigger a significant price rally similar to what was seen with Bitcoin ETFs earlier this year.',
  source: 'The Block',
  time: '1 day ago',
  category: 'Crypto',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1f6548682-1766305819081.png",
  url: '#'
},
{
  id: 8,
  title: 'Oil Prices Stabilize After OPEC+ Production Cut Extension',
  summary: 'Crude oil prices found support after OPEC+ members agreed to extend voluntary production cuts through the second quarter of 2024.',
  source: 'Reuters',
  time: '1 day ago',
  category: 'Commodities',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1914c2e96-1771109986987.png",
  url: '#'
},
{
  id: 9,
  title: 'Apple Announces New AI Features for iPhone',
  summary: 'Apple unveiled a suite of artificial intelligence features for its iPhone lineup, sending shares up 2% in after-hours trading.',
  source: 'TechCrunch',
  time: '2 days ago',
  category: 'Stocks',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_177c87ef5-1769233350641.png",
  url: '#'
},
{
  id: 10,
  title: 'USD/JPY Hits 34-Year High as BOJ Maintains Ultra-Low Rates',
  summary: 'The US Dollar surged to its highest level against the Japanese Yen in 34 years after the Bank of Japan kept its ultra-loose monetary policy unchanged.',
  source: 'FX Street',
  time: '2 days ago',
  category: 'Forex',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_16c1690f9-1771578105837.png",
  url: '#'
},
{
  id: 11,
  title: 'Global GDP Growth Forecast Revised Upward by IMF',
  summary: 'The International Monetary Fund raised its global growth forecast for 2024 to 3.2%, citing resilient consumer spending and easing inflation pressures.',
  source: 'Financial Times',
  time: '3 days ago',
  category: 'Economy',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_157d7d30a-1768683531387.png",
  url: '#'
},
{
  id: 12,
  title: 'Solana Ecosystem Sees Record DeFi Activity',
  summary: 'Decentralized finance activity on the Solana blockchain reached record levels, with total value locked surpassing $5 billion for the first time.',
  source: 'Decrypt',
  time: '3 days ago',
  category: 'Crypto',
  imageUrl: "https://img.rocket.new/generatedImages/rocket_gen_img_1de99562f-1764668558407.png",
  url: '#'
}];


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
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 md:mb-6 gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Market News</h1>
            <p className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Latest financial updates from trusted sources</p>
          </div>
          <div className="relative w-full sm:w-56 md:w-72">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="w-full pl-8 pr-3 rounded-lg text-xs sm:text-sm outline-none transition-colors min-h-[44px]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
            
          </div>
        </div>

        {/* Tabs - scrollable on mobile */}
        <div className="flex gap-0.5 sm:gap-1 overflow-x-auto pb-1 mb-3 sm:mb-4 md:mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {tabs.map((tab) =>
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 sm:px-4 min-h-[44px] text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 inline-flex items-center"
            style={activeTab === tab ?
            { color: '#818cf8', borderBottom: '2px solid #6366f1', marginBottom: '-1px' } :
            { color: 'rgba(255,255,255,0.4)', borderBottom: '2px solid transparent', marginBottom: '-1px' }
            }>
              {tab}
            </button>
          )}
        </div>

        {/* News grid - 1 col mobile, 2 col tablet, 3 col desktop */}
        {filtered.length === 0 ?
        <div className="text-center py-10 sm:py-16 md:py-20">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">📰</div>
            <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-2">No articles found</h3>
            <p className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Try adjusting your filters or search query</p>
          </div> :

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {filtered.map((article) =>
          <div
            key={article.id}
            className="rounded-2xl overflow-hidden cursor-pointer group transition-all"
            style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={(e) => e.currentTarget.style.border = '1px solid rgba(99,102,241,0.4)'}
            onMouseLeave={(e) => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'}>
            
                <div className="relative overflow-hidden h-36 sm:h-40 md:h-48">
                  <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              
                  <div className="absolute top-2 sm:top-3 left-2 sm:left-3">
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-bold ${
                article.category === 'Crypto' ? 'bg-orange-500/80 text-white' :
                article.category === 'Stocks' ? 'bg-blue-500/80 text-white' :
                article.category === 'Forex' ? 'bg-purple-500/80 text-white' :
                article.category === 'Commodities' ? 'bg-yellow-500/80 text-white' : 'bg-green-500/80 text-white'}`
                }>
                      {article.category}
                    </span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 md:p-5">
                  <h3 className="font-bold text-white mb-1.5 sm:mb-2 leading-snug line-clamp-2 text-xs sm:text-sm md:text-base group-hover:text-indigo-400 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-xs leading-relaxed mb-2 sm:mb-3 md:mb-4 line-clamp-2 sm:line-clamp-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {article.summary}
                  </p>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <span className="font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{article.source}</span>
                    <span>{article.time}</span>
                  </div>
                </div>
              </div>
          )}
          </div>
        }
      </div>
    </div>);

}