import React from 'react';

export default function FeaturesSection() {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24 bg-white" id="features">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        {/* Left: Stats card */}
        <div className="order-2 md:order-1">
          <div className="bg-slate-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 text-center py-8 sm:py-12">
              <div className="text-5xl sm:text-6xl font-bold text-slate-900 mb-2 tracking-tighter">50K+</div>
              <div className="text-blue-600 font-medium mb-6 sm:mb-8 uppercase tracking-widest text-xs sm:text-sm">Active Traders</div>
              <p className="text-slate-600 mb-6 sm:mb-8 max-w-xs mx-auto text-sm sm:text-base">
                Join a global community of successful traders. Start your journey with zero risk.
              </p>
              <button className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 sm:h-12 rounded-xl text-sm font-medium transition-all">
                Join the Community
              </button>
            </div>
          </div>
        </div>

        {/* Right: Features list */}
        <div className="order-1 md:order-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 sm:mb-8 leading-tight">
            Why Traders Choose <br />
            <span className="text-blue-600">Investoft</span>
          </h2>
          <div className="space-y-6 sm:space-y-8">
            {/* Feature 1 */}
            <div className="flex gap-4 sm:gap-5 group">
              <div className="mt-1 flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors duration-300">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                  <polyline points="16 7 22 7 22 13"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">Maximum Profit</h3>
                <p className="text-slate-500 leading-relaxed text-sm sm:text-base">Industry-leading payouts up to 95% on successful trades.</p>
              </div>
            </div>
            {/* Feature 2 */}
            <div className="flex gap-4 sm:gap-5 group">
              <div className="mt-1 flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors duration-300">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">Advanced Technology</h3>
                <p className="text-slate-500 leading-relaxed text-sm sm:text-base">Ultra-low latency execution with professional charting tools.</p>
              </div>
            </div>
            {/* Feature 3 */}
            <div className="flex gap-4 sm:gap-5 group">
              <div className="mt-1 flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors duration-300">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">Secure &amp; Regulated</h3>
                <p className="text-slate-500 leading-relaxed text-sm sm:text-base">Your funds are protected with bank-grade security and segregated accounts.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
