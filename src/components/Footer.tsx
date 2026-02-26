import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0b1e] pt-12 sm:pt-16 pb-8 text-slate-400">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 sm:gap-10 md:gap-12 mb-10 sm:mb-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <div className="flex items-center gap-2 mb-4 sm:mb-6 cursor-pointer">
              <div className="bg-blue-600 rounded p-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white">
                  <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
              </div>
              <span className="text-lg sm:text-xl font-bold text-white">Investoft</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">Advanced trading platform for everyone. Trade with confidence and precision.</p>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Products</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-blue-400 text-left transition-colors">Chart</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Screener</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Trading Platform</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Indicators</button></li>
            </ul>
          </div>

          {/* Markets */}
          <div>
            <h4 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Markets</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-blue-400 text-left transition-colors">Stocks</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Forex</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Crypto</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Commodities</button></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Community</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-blue-400 text-left transition-colors">Trading Ideas</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Scripts</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Education</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Blog</button></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-blue-400 text-left transition-colors">About</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Careers</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Contact</button></li>
              <li><button className="hover:text-blue-400 text-left transition-colors">Support</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm gap-3 sm:gap-0">
          <p>© 2026 Investoft. All rights reserved.</p>
          <div className="flex gap-4 sm:gap-6">
            <button className="hover:text-blue-400 transition-colors">Terms</button>
            <button className="hover:text-blue-400 transition-colors">Privacy</button>
            <button className="hover:text-blue-400 transition-colors">Risk Disclosure</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
