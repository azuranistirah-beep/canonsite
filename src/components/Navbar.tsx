'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navLinks: { label: string; href: string; highlight?: boolean; protected?: boolean }[] = [
  { label: 'Markets', href: '/markets' },
  { label: 'Cryptocurrency', href: '/cryptocurrency' },
  { label: 'Screener', href: '/screener' },
  { label: 'Deposit', href: '/trading-demo', protected: true },
  { label: 'Trade', href: '/trade', highlight: true, protected: true },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchSuccess, setSearchSuccess] = useState('');
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSearchError, setMobileSearchError] = useState('');
  const [mobileSearchSuccess, setMobileSearchSuccess] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setSearchSuccess('');
    if (!searchQuery.trim()) {
      setSearchError('Please enter a search term.');
      return;
    }
    setSearchSuccess(`Searching for "${searchQuery.trim()}"...`);
    setTimeout(() => setSearchSuccess(''), 3000);
  };

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileSearchError('');
    setMobileSearchSuccess('');
    if (!mobileSearchQuery.trim()) {
      setMobileSearchError('Please enter a search term.');
      return;
    }
    setMobileSearchSuccess(`Searching for "${mobileSearchQuery.trim()}"...`);
    setTimeout(() => setMobileSearchSuccess(''), 3000);
  };

  const handleNavClick = (link: typeof navLinks[0]) => {
    if (link.protected && !user) {
      router.push('/auth');
    } else if (link.label === 'Trade' && user) {
      router.push('/dashboard');
    } else {
      router.push(link.href);
    }
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    router.push('/');
  };

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header ref={menuRef} className="border-b border-white/10 bg-[#0a0b1e]/95 sticky top-0 z-50 backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 flex items-center gap-2 sm:gap-4 xl:gap-6 min-h-[56px]">
        {/* Logo */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 sm:gap-2 cursor-pointer flex-shrink-0 min-h-[44px] py-1"
        >
          <div className="bg-blue-600 rounded p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 sm:h-5 sm:w-5 text-white">
              <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
              <path d="M18 17V9"/>
              <path d="M13 17V5"/>
              <path d="M8 17v-3"/>
            </svg>
          </div>
          <span className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight">Investoft</span>
        </button>

        {/* Nav Links - desktop only */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-sm font-medium text-slate-300 flex-shrink-0">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNavClick(link)}
              className={`px-3 xl:px-4 min-h-[44px] rounded-md hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap text-xs xl:text-sm inline-flex items-center ${
                pathname === link.href
                  ? 'font-bold text-white bg-white/10'
                  : link.highlight
                  ? 'font-semibold text-blue-400' : ''
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Search Bar - tablet and up */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 max-w-[200px] lg:max-w-xs xl:max-w-sm">
          <form onSubmit={handleSearch} className="w-full relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchError(''); setSearchSuccess(''); }}
              className={`w-full rounded-md border px-3 py-2.5 text-xs sm:text-sm pl-8 bg-white/10 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white/15 transition-colors outline-none min-h-[44px] ${
                searchError ? 'border-red-500' : searchSuccess ? 'border-green-500' : 'border-white/20'
              }`}
              placeholder="Search stocks, forex, crypto..."
            />
          </form>
          {searchError && <p className="text-red-400 text-[10px] mt-0.5 px-1">{searchError}</p>}
          {searchSuccess && <p className="text-green-400 text-[10px] mt-0.5 px-1">{searchSuccess}</p>}
        </div>

        {/* Auth Buttons - tablet and up */}
        <div className="hidden md:flex items-center gap-2 lg:gap-2.5 flex-shrink-0 ml-auto">
          {loading ? (
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 min-h-[44px] rounded-md hover:bg-white/10 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {userInitial}
                </div>
                <span className="text-sm text-slate-300 max-w-[100px] truncate">{user?.email?.split('@')[0]}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50"
                  style={{ background: '#0d0e23', border: '1px solid rgba(255,255,255,0.12)', minWidth: '160px' }}
                >
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard'); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Dashboard
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => router.push('/auth')}
                className="inline-flex items-center justify-center rounded-md text-xs lg:text-sm font-medium min-h-[44px] px-4 lg:px-5 text-slate-300 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/auth')}
                className="inline-flex items-center justify-center rounded-md text-xs lg:text-sm font-medium min-h-[44px] px-4 lg:px-5 bg-blue-600 text-white hover:bg-blue-700 transition-all whitespace-nowrap"
              >
                Get Started
              </button>
            </>
          )}
        </div>

        {/* Mobile: Sign In + Hamburger */}
        <div className="md:hidden flex items-center gap-2 ml-auto flex-shrink-0">
          {!loading && (
            user ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold"
              >
                {userInitial}
              </button>
            ) : (
              <button
                onClick={() => router.push('/auth')}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium min-h-[44px] px-3 bg-blue-600 text-white hover:bg-blue-700 transition-all whitespace-nowrap"
              >
                Sign In
              </button>
            )
          )}
          <button
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-white hover:bg-white/10 transition-all flex-shrink-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12"/>
                <line x1="4" x2="20" y1="6" y2="6"/>
                <line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0d0e24] shadow-xl">
          <div className="container mx-auto px-3 sm:px-4 py-3 space-y-2">
            {/* Mobile Search */}
            <form onSubmit={handleMobileSearch}>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  value={mobileSearchQuery}
                  onChange={(e) => { setMobileSearchQuery(e.target.value); setMobileSearchError(''); setMobileSearchSuccess(''); }}
                  className={`w-full pl-8 pr-3 py-3 bg-white/10 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400 min-h-[44px] ${
                    mobileSearchError ? 'border-red-500' : mobileSearchSuccess ? 'border-green-500' : 'border-white/20'
                  }`}
                  placeholder="Search stocks, forex, crypto..."
                />
              </div>
              {mobileSearchError && <p className="text-red-400 text-xs mt-1 px-1">{mobileSearchError}</p>}
              {mobileSearchSuccess && <p className="text-green-400 text-xs mt-1 px-1">{mobileSearchSuccess}</p>}
            </form>
            {/* Mobile Nav Links */}
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => { handleNavClick(link); setMobileOpen(false); }}
                  className={`text-left px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors flex items-center ${
                    pathname === link.href
                      ? 'text-white bg-white/10 font-bold'
                      : link.highlight
                      ? 'text-blue-400 font-semibold hover:bg-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>
            {/* Mobile Auth Buttons */}
            <div className="flex gap-2 pt-1 border-t border-white/10">
              {user ? (
                <>
                  <button
                    onClick={() => { router.push('/dashboard'); setMobileOpen(false); }}
                    className="flex-1 min-h-[44px] text-sm font-medium text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="flex-1 min-h-[44px] text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { router.push('/auth'); setMobileOpen(false); }}
                    className="flex-1 min-h-[44px] text-sm font-medium text-slate-300 border border-white/20 rounded-lg hover:bg-white/10 transition-all"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { router.push('/auth'); setMobileOpen(false); }}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
