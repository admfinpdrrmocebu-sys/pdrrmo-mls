'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Radio,
  Users,
  Archive,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/lib/auth';

export interface NavItemDef {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export const defaultNavItems: NavItemDef[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Logs', href: '/logs', icon: FileText },
  { label: 'Roll Call', href: '/roll-call', icon: Radio },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Archives', href: '/archives', icon: Archive },
];

export interface VerticalNavProps {
  user?: {
    name: string;
    role: string;
    division?: string;
    initials?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
  };
  items?: NavItemDef[];
  className?: string;
}

/**
 * VerticalNav Component
 * =====================
 * Floating, expandable Desktop SideNav and Vertical Mobile Drawer with Hamburger Toggle.
 * Dynamically filtered by Role-Based Access Control (RBAC) permissions.
 */
export function VerticalNav({
  user: propUser,
  items = defaultNavItems,
  className,
}: VerticalNavProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { profile, currentRole, signOut, canAccess } = useAuth();

  // Close mobile navigation drawer on route navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile navigation drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dynamic user data from Supabase Auth profile
  const user = profile
    ? {
        name: profile.full_name,
        role:
          currentRole?.name ||
          (profile.role === 'admin'
            ? 'System Administrator'
            : profile.position_title || 'Monitoring Officer'),
        division: profile.division,
        initials: profile.full_name
          ? profile.full_name
              .split(' ')
              .filter(Boolean)
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
          : 'MO',
        avatarUrl: profile.avatar_url,
        isOnline: true,
      }
    : propUser || {
        name: 'Monitoring Officer',
        role: 'Operations',
        division: 'Provincial Disaster Risk Reduction Management Office',
        initials: 'MO',
        isOnline: true,
      };

  // Filter navigation items by active officer's clearance
  const accessibleItems = items.filter(
    (item) => canAccess(item.label) || canAccess(item.href)
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP FLOATING EXPANDABLE SIDEBAR (Visible on lg+ screens) */}
      {/* ========================================================================= */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={twMerge(
          'fixed left-4 top-4 bottom-4 z-40 hidden lg:flex flex-col justify-between',
          'bg-white border border-[#E2E8F0] rounded-2xl shadow-lg shadow-slate-200/50 py-6 px-3',
          'transition-all duration-300 ease-in-out select-none',
          isHovered ? 'w-64 shadow-xl' : 'w-20',
          className
        )}
      >
        {/* Top Section: User Profile Card */}
        <div>
          <Link
            href="/profile"
            className="flex items-center mb-7 px-1.5 cursor-pointer group"
          >
            {/* Avatar Circle */}
            <div className="w-11 h-11 rounded-full bg-[#004AC6] text-white shrink-0 flex items-center justify-center font-bold text-sm shadow-sm border border-[#004AC6]/10 group-hover:scale-105 transition-transform overflow-hidden">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.initials || user.name.slice(0, 2).toUpperCase()
              )}
            </div>

            {/* Expanded User Details */}
            <div
              className={twMerge(
                'flex flex-col ml-3 overflow-hidden transition-all duration-300',
                isHovered ? 'opacity-100 max-w-[170px]' : 'opacity-0 max-w-0 pointer-events-none'
              )}
            >
              <span className="text-sm font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors truncate">
                {user.name}
              </span>
              <span className="text-[11px] font-medium text-[#505F76] truncate">
                {user.role}
              </span>
              {user.division && (
                <span className="text-[10px] text-[#757680] truncate">
                  {user.division}
                </span>
              )}
            </div>
          </Link>

          {/* Navigation Links List */}
          <nav className="flex flex-col gap-1.5">
            {accessibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={twMerge(
                    'group relative flex items-center h-12 px-3.5 rounded-xl transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-[#004AC6]/10 text-[#004AC6] font-semibold'
                      : 'text-[#505F76] hover:bg-[#F8FAFC] hover:text-[#1E293B]'
                  )}
                >
                  <div className="flex items-center justify-center w-5 shrink-0">
                    <Icon
                      className={twMerge(
                        'w-5 h-5 transition-colors',
                        isActive ? 'text-[#004AC6]' : 'text-[#757680] group-hover:text-[#1E293B]'
                      )}
                    />
                  </div>

                  <span
                    className={twMerge(
                      'text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300',
                      isHovered
                        ? 'opacity-100 ml-3 max-w-[150px]'
                        : 'opacity-0 ml-0 max-w-0 pointer-events-none'
                    )}
                  >
                    {item.label}
                  </span>

                  {item.badge !== undefined && isHovered && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#004AC6] text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Sign Out */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center h-12 px-3.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors group cursor-pointer text-left"
          >
            <div className="flex items-center justify-center w-5 shrink-0">
              <LogOut className="w-5 h-5 text-rose-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <span
              className={twMerge(
                'text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300',
                isHovered ? 'opacity-100 ml-3 max-w-[150px]' : 'opacity-0 ml-0 max-w-0 pointer-events-none'
              )}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE HAMBURGER BUTTON (Visible on screens < lg when drawer is closed) */}
      {/* ========================================================================= */}
      {!isMobileOpen && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open Navigation Menu"
          aria-expanded={false}
          className={twMerge(
            'fixed top-3 left-3 sm:left-4 z-40 lg:hidden flex items-center justify-center',
            'w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] shadow-sm',
            'text-[#1E293B] hover:text-[#004AC6] hover:bg-slate-50 active:scale-95 transition-all cursor-pointer'
          )}
        >
          <Menu className="w-5 h-5 text-[#1E293B]" />
        </button>
      )}

      {/* ========================================================================= */}
      {/* 3. MOBILE BACKDROP OVERLAY */}
      {/* ========================================================================= */}
      <div
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
        className={twMerge(
          'fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 lg:hidden',
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* ========================================================================= */}
      {/* 4. MOBILE VERTICAL EXPANDABLE DRAWER (Visible on screens < lg) */}
      {/* ========================================================================= */}
      <aside
        aria-label="Mobile Navigation"
        className={twMerge(
          'fixed top-0 bottom-0 left-0 z-50 w-72 sm:w-80 bg-white border-r border-[#E2E8F0] shadow-2xl',
          'flex flex-col justify-between py-4 px-4 transition-transform duration-300 ease-in-out lg:hidden select-none',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Top Section: Close Button & User Profile Card */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Top Control Bar: Clean Close Button following navbar layout */}
          <div className="flex items-center justify-end pb-3 mb-2">
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close Navigation Menu"
              className={twMerge(
                'w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center',
                'text-[#1E293B] hover:text-[#004AC6] hover:bg-slate-50 active:scale-95 transition-all cursor-pointer'
              )}
            >
              <X className="w-5 h-5 text-[#1E293B]" />
            </button>
          </div>

          {/* User Profile Card */}
          <Link
            href="/profile"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 p-2.5 mb-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-slate-100/70 transition-all group cursor-pointer"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#004AC6] text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.initials || user.name.slice(0, 2).toUpperCase()
                )}
              </div>
              {user.isOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#16A34A] border-2 border-white rounded-full shadow-xs" />
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors truncate">
                {user.name}
              </span>
              <span className="text-[11px] font-medium text-[#505F76] truncate">
                {user.role}
              </span>
              {user.division && (
                <span className="text-[10px] text-[#757680] truncate">
                  {user.division}
                </span>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#004AC6] group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Section Label */}
          <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider px-2 mb-2 block">
            Navigation Menu
          </span>

          {/* Navigation Links (Scrollable for infinite scalability as features grow) */}
          <nav className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {accessibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={twMerge(
                    'flex items-center h-12 px-3.5 rounded-xl transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-[#004AC6]/10 text-[#004AC6] font-semibold shadow-2xs'
                      : 'text-[#505F76] hover:bg-[#F8FAFC] hover:text-[#1E293B]'
                  )}
                >
                  <div className="flex items-center justify-center w-5 shrink-0">
                    <Icon
                      className={twMerge(
                        'w-5 h-5 transition-colors',
                        isActive ? 'text-[#004AC6]' : 'text-[#757680]'
                      )}
                    />
                  </div>

                  <span className="text-sm font-medium ml-3 truncate flex-1">
                    {item.label}
                  </span>

                  {item.badge !== undefined && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#004AC6] text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Sign Out */}
        <div className="pt-4 mt-2 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => {
              setIsMobileOpen(false);
              signOut();
            }}
            className="w-full flex items-center h-12 px-3.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors group cursor-pointer text-left"
          >
            <div className="flex items-center justify-center w-5 shrink-0">
              <LogOut className="w-5 h-5 text-rose-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <span className="text-sm font-semibold ml-3">
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default VerticalNav;
