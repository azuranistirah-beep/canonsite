import React from 'react';

export default function PromoSection() {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12" id="promo">
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl min-h-[400px] sm:min-h-[500px] flex items-center group">
        {/* Background image */}
        <img
          src="https://images.unsplash.com/photo-1762279389083-abf71f22d338?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhYnN0cmFjdCUyMGZpbmFuY2lhbCUyMHRlY2hub2xvZ3klMjBibHVlJTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3NzAzNzYyNjZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Trading Background"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/95 via-blue-900/80 to-blue-900/30" />
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full p-6 sm:p-10 md:p-16">
          <div className="max-w-2xl">
            <div className="inline-block bg-yellow-400 text-blue-950 text-xs font-bold px-3 py-1 rounded-full mb-4 sm:mb-6 shadow-lg shadow-yellow-400/20">
              LIMITED TIME OFFER
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Double Your Capital<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
                100% Deposit Bonus
              </span>
            </h2>
            <p className="text-blue-100 text-sm sm:text-base md:text-lg mb-6 sm:mb-10 leading-relaxed max-w-xl">
              Start your trading journey with a massive advantage. Deposit $500 and trade with $1,000 instantly. Available exclusively for new accounts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button className="bg-yellow-400 text-blue-950 hover:bg-yellow-300 font-bold h-12 sm:h-14 px-6 sm:px-8 rounded-full text-base sm:text-lg shadow-lg shadow-yellow-400/20 inline-flex items-center justify-center gap-2 transition-all w-full sm:w-auto">
                Claim Bonus Now
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-5 sm:w-5">
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
              </button>
              <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 h-12 sm:h-14 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white justify-center sm:justify-start">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
                  <rect x="3" y="8" width="18" height="4" rx="1"/>
                  <path d="M12 8v13"/>
                  <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
                  <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
                </svg>
                <span className="font-mono font-bold tracking-wider text-sm sm:text-base">WELCOME100</span>
              </div>
            </div>
            <p className="mt-4 sm:mt-6 text-blue-200/60 text-xs sm:text-sm">*Terms and conditions apply. Minimum deposit required.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
