import React from 'react';
import { useRouter } from 'next/navigation';

export default function HeroSection() {
  const router = useRouter();
  return (
    <section className="relative overflow-hidden pt-12 sm:pt-20 md:pt-28 pb-10 sm:pb-16 md:pb-24 bg-[#0a0b1e]">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[200px] sm:h-[400px] bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[200px] sm:w-[400px] h-[150px] sm:h-[300px] bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs sm:text-sm font-medium mb-5 sm:mb-8 backdrop-blur-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 sm:w-3.5 sm:h-3.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          #1 Crypto Trading Platform
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 tracking-tight leading-tight">
          Trade Crypto
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500">
            like a pro
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-sm sm:text-base md:text-lg text-slate-400 mb-6 sm:mb-8 max-w-sm sm:max-w-lg mx-auto leading-relaxed">
          Advanced trading tools, lightning-fast execution, and unmatched security. Join millions of traders worldwide.
        </p>

        {/* 100% Deposit Bonus box */}
        <div className="relative inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl text-white mb-6 sm:mb-8 backdrop-blur-sm overflow-hidden cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(124,58,237,0.25) 50%, rgba(37,99,235,0.25) 100%)',
            border: '1px solid rgba(99,179,237,0.5)',
            boxShadow: '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)',
            animation: 'floatBonus 3s ease-in-out infinite',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 30px rgba(59,130,246,0.6), 0 0 60px rgba(124,58,237,0.3)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)';
          }}
        >
          {/* Shimmer overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerBonus 2.5s linear infinite',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }} />
          {/* Pulse ring */}
          <div style={{
            position: 'absolute',
            inset: '-2px',
            borderRadius: '14px',
            border: '1.5px solid rgba(99,179,237,0.4)',
            animation: 'pulseRing 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-blue-400 flex-shrink-0 sm:w-5 sm:h-5 relative z-10"
            style={{ animation: 'iconBounce 1.5s ease-in-out infinite', filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.8))' }}
          >
            <rect x="3" y="8" width="18" height="4" rx="1"/>
            <path d="M12 8v13"/>
            <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
          </svg>
          <div className="text-left relative z-10">
            <div className="font-bold text-xs sm:text-sm md:text-base"
              style={{
                background: 'linear-gradient(90deg, #93c5fd, #c4b5fd, #93c5fd)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'textShimmer 3s linear infinite',
              }}
            >100% Deposit Bonus</div>
            <div className="text-xs text-slate-300">Deposit $1,000 and trade with $2,000 instantly</div>
          </div>
          <style>{`
            @keyframes floatBonus {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }
            @keyframes shimmerBonus {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes pulseRing {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.02); }
            }
            @keyframes iconBounce {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              25% { transform: translateY(-3px) rotate(-5deg); }
              75% { transform: translateY(2px) rotate(3deg); }
            }
            @keyframes textShimmer {
              0% { background-position: 0% center; }
              100% { background-position: 200% center; }
            }
          `}</style>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6 sm:mb-8">
          <button
            onClick={() => router.push('/auth')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm sm:text-base md:text-lg px-6 sm:px-8 min-h-[44px] rounded-lg transition-all shadow-lg shadow-blue-600/30 w-full sm:w-auto font-semibold inline-flex items-center justify-center gap-2">
Start Trading
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </button>
          <button className="border border-white/30 text-white hover:bg-white/10 text-sm sm:text-base md:text-lg px-6 sm:px-8 min-h-[44px] rounded-lg w-full sm:w-auto transition-all font-semibold inline-flex items-center justify-center gap-2 bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Explore Markets
          </button>
        </div>

        {/* Feature checkmarks */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 md:gap-8 text-slate-400 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 sm:w-4 sm:h-4">
              <circle cx="12" cy="12" r="10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            Secure Trading
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 sm:w-4 sm:h-4">
              <circle cx="12" cy="12" r="10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            Real-time Data
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 sm:w-4 sm:h-4">
              <circle cx="12" cy="12" r="10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            24/7 Support
          </div>
        </div>
      </div>
    </section>
  );
}
