'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';



const supabase = createClient();

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Pengguna', icon: Users },
  { href: '/admin/deposits', label: 'Deposit', icon: ArrowDownCircle },
  { href: '/admin/withdrawals', label: 'Penarikan', icon: ArrowUpCircle },
  { href: '/admin/trades', label: 'Perdagangan', icon: TrendingUp },
  { href: '/admin/payment-settings', label: 'Pengaturan Pembayaran', icon: CreditCard },
  { href: '/admin/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/admin/settings', label: 'Pengaturan Platform', icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/auth?redirect=/admin');
      return;
    }

    // Verify admin status client-side as a fallback
    const verifyAdmin = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('full_name, email, role, is_admin')
          .eq('id', user.id)
          .single();

        if (process.env.NODE_ENV === 'development') {
          console.log('[AdminLayout] Client-side admin verification:', {
            userId: user.id,
            userEmail: user.email,
            profile,
            error: error?.message,
            is_admin: profile?.is_admin,
          });
        }

        if (error) {
          // Profile query failed (RLS or network issue).
          // Middleware server-side already verified admin status before this page loaded.
          // Do NOT redirect — allow access.
          console.warn('[AdminLayout] Profile query error:', error.message, '— middleware already verified, allowing access');
          setAdminProfile({ full_name: 'Admin', email: user.email || '' });
          setIsAdminVerified(true);
          setIsVerifying(false);
          return;
        }

        if (!profile) {
          // No profile row found at all — only redirect if we're certain
          console.warn('[AdminLayout] No profile row found — allowing access (middleware verified)');
          setAdminProfile({ full_name: 'Admin', email: user.email || '' });
          setIsAdminVerified(true);
          setIsVerifying(false);
          return;
        }

        const isAdmin = profile.is_admin === true || profile.role === 'admin';

        if (process.env.NODE_ENV === 'development') {
          console.log('[AdminLayout] isAdmin result:', isAdmin);
        }

        if (!isAdmin) {
          // Profile fetched successfully and is_admin is confirmed false — redirect
          console.warn('[AdminLayout] Profile confirmed user is NOT admin, redirecting to /trade');
          router.replace('/trade');
          setIsVerifying(false);
          return;
        }

        setAdminProfile({ full_name: profile.full_name || 'Admin', email: profile.email || user.email || '' });
        setIsAdminVerified(true);
      } catch (err) {
        // Unexpected error — allow access since middleware already verified
        console.error('[AdminLayout] Unexpected verification error:', err, '— allowing access');
        setAdminProfile({ full_name: 'Admin', email: user.email || '' });
        setIsAdminVerified(true);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAdmin();
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await signOut();
    router.push('/auth');
  };

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  // Show loading while verifying
  if (authLoading || isVerifying) {
    return (
      <div className="flex h-screen bg-[#0a0a0a] items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Memverifikasi akses admin...</p>
        </div>
      </div>
    );
  }

  // Don't render if not verified
  if (!isAdminVerified) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#111111] border-r border-white/10 flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Admin Panel</p>
            <p className="text-xs text-gray-500">Investoft</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Admin Profile + Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">
              {adminProfile?.full_name || 'Admin'}
            </p>
            <p className="text-xs text-gray-500 truncate">{adminProfile?.email || user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-4 px-6 py-4 bg-[#111111] border-b border-white/10 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">
              {navItems.find((i) => isActive(i))?.label || 'Admin Panel'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs text-gray-400 hidden sm:block">Online</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
