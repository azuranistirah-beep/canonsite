'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

export default function CTASection() {
  const router = useRouter();
  return (
    <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24 text-center">
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 lg:p-20 relative overflow-hidden shadow-2xl">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        {/* Glow effects */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-800/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-800/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8 tracking-tight">
            Ready to Start Your Trading Journey?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 mb-8 sm:mb-10 leading-relaxed">
            Join over 50,000 traders who trust Investoft for their daily trading needs. Open your account today in less than 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <button
              onClick={() => router?.push('/auth')}
              className="bg-white text-slate-900 hover:bg-slate-100 text-base sm:text-lg px-8 sm:px-10 h-13 sm:h-16 rounded-full w-full sm:w-auto shadow-xl font-medium inline-flex items-center justify-center transition-all py-3 sm:py-0"
            >
              Create Account
            </button>
          </div>
          <p className="mt-6 sm:mt-8 text-slate-500 text-xs sm:text-sm">No credit card required for demo account.</p>
        </div>
      </div>
    </section>
  );
}
