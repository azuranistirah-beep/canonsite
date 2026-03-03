'use client';
import React, { useState, useMemo } from 'react';
import TickerTape from '@/components/TickerTape';
import { ALL_ASSETS, CATEGORY_LABELS, CATEGORY_COLORS, Asset } from '@/data/assets';
import AssetIcon from '@/components/AssetIcon';

const PAGE_SIZE = 50;

type CategoryFilter = 'all' | 'crypto' | 'stocks' | 'forex' | 'commodities' | 'indices';

const TYPE_LABEL: Record<string, string> = {
  crypto: 'Crypto',
  stocks: 'Stock',
  forex: 'Forex',
  commodities: 'Commodity',
  indices: 'Index',
};

const SECTOR_LABEL: Record<string, string> = {
  crypto: 'Cryptocurrency',
  stocks: 'Equities',
  forex: 'Foreign Exchange',
  commodities: 'Commodities',
  indices: 'Global Indices',
};

export default function ScreenerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  const filtered = useMemo(() => {
    let data: Asset[] = ALL_ASSETS;
    if (categoryFilter !== 'all') {
      data = data.filter(a => a.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        a =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.exchange.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }
    if (sortField) {
      data = [...data].sort((a, b) => {
        let aVal = '';
        let bVal = '';
        if (sortField === 'Symbol') { aVal = a.symbol; bVal = b.symbol; }
        else if (sortField === 'Name') { aVal = a.name; bVal = b.name; }
        else if (sortField === 'Type') { aVal = a.category; bVal = b.category; }
        else if (sortField === 'Exchange') { aVal = a.exchange; bVal = b.exchange; }
        const cmp = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [searchQuery, categoryFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchSubmitted(true);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSearchSubmitted(false);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: CategoryFilter) => {
    setCategoryFilter(cat);
    setCurrentPage(1);
    setSearchSubmitted(false);
  };

  const cardStyle = { background: '#0d0e23', border: '1px solid rgba(255,255,255,0.08)' };

  const categories: CategoryFilter[] = ['all', 'crypto', 'stocks', 'forex', 'commodities', 'indices'];

  return (
    <div className="min-h-screen" style={{ background: '#0a0b1e' }}>
      <TickerTape />
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Market Screener</h1>
            <p className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {ALL_ASSETS.length}+ tradeable assets — stocks, crypto, forex, indices, and commodities
            </p>
          </div>
          <div className="relative w-full sm:w-56 md:w-72">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  className="w-full pl-8 pr-3 rounded-lg text-xs sm:text-sm outline-none transition-colors min-h-[44px]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: searchSubmitted && searchQuery.trim() && filtered.length === 0
                      ? '1px solid #ef4444'
                      : searchSubmitted && searchQuery.trim() && filtered.length > 0
                      ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.12)',
                    color: '#fff'
                  }}
                  placeholder="Search symbol, name, exchange..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              {searchSubmitted && searchQuery.trim() && filtered.length === 0 && (
                <p className="text-red-400 text-xs mt-1">No results found for &quot;{searchQuery}&quot;.</p>
              )}
              {searchSubmitted && searchQuery.trim() && filtered.length > 0 && (
                <p className="text-green-400 text-xs mt-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''} found.</p>
              )}
            </form>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(cat => {
            const colors = cat !== 'all' ? CATEGORY_COLORS[cat] : null;
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px]"
                style={isActive
                  ? colors
                    ? { background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }
                    : { background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {CATEGORY_LABELS[cat] || cat}
                {cat !== 'all' && (
                  <span className="ml-1.5 opacity-70">
                    ({cat === 'crypto' ? '100' : cat === 'stocks' ? '150+' : cat === 'forex' ? '50' : cat === 'commodities' ? '30' : '50'})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Symbol', 'Name', 'Type', 'Exchange', 'Description'].map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-3 sm:px-4 text-left text-xs font-bold uppercase tracking-wide cursor-pointer select-none"
                      style={{ color: 'rgba(255,255,255,0.5)', height: '44px' }}
                    >
                      <div className="flex items-center gap-1">
                        {col}
                        {sortField === col && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {sortDir === 'asc' ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                          </svg>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 sm:px-4 text-left text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)', height: '44px' }}>Live Chart</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((asset, i) => {
                  const colors = CATEGORY_COLORS[asset.category];
                  return (
                    <tr
                      key={asset.id}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                    >
                      <td className="px-3 sm:px-4" style={{ height: '48px' }}>
                        <div className="flex items-center gap-2">
                          <AssetIcon symbol={asset.symbol} name={asset.name} category={asset.category} size={28} />
                          <span className="font-bold text-white text-xs sm:text-sm">{asset.symbol}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4" style={{ height: '48px' }}>
                        <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.7)' }}>{asset.name}</span>
                      </td>
                      <td className="px-3 sm:px-4" style={{ height: '48px' }}>
                        <span
                          className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {TYPE_LABEL[asset.category]}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4" style={{ height: '48px' }}>
                        <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.5)' }}>{asset.exchange}</span>
                      </td>
                      <td className="px-3 sm:px-4 max-w-[200px]" style={{ height: '48px' }}>
                        <span className="text-xs truncate block" style={{ color: 'rgba(255,255,255,0.4)' }}>{asset.description}</span>
                      </td>
                      <td className="px-3 sm:px-4" style={{ height: '48px' }}>
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(asset.tvSymbol)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          View Chart ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-10 sm:py-12 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              No results found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} assets
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (currentPage <= 4) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                      style={currentPage === page
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
                      }
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
        {totalPages <= 1 && (
          <div className="mt-2 sm:mt-3 md:mt-4 text-xs sm:text-sm text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Showing {filtered.length} of {ALL_ASSETS.length} assets
          </div>
        )}
      </div>
    </div>
  );
}
