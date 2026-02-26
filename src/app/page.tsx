'use client';
import React from 'react';
import Navbar from '@/components/Navbar';
import TickerTape from '@/components/TickerTape';
import HeroSection from '@/components/HeroSection';
import CryptoCards from '@/components/CryptoCards';
import TopMovers from '@/components/TopMovers';
import AllMarkets from '@/components/AllMarkets';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0b1e]">
      <Navbar />
      <TickerTape />
      <HeroSection />
      <CryptoCards />
      <TopMovers />
      <AllMarkets />
      <Footer />
    </div>
  );
}
