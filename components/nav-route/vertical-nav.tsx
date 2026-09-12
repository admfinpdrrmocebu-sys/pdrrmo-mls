'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Radio,
  Users,
  Archive,
  LogOut,
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
 * Floating, expandable Desktop SideNav and Mobile BottomNav.
 * Dynamically filtered by Role-Based Access Control (RBAC) permissions.
 */
export function VerticalNav({
  user: propUser,
  items = defaultNavItems,
  className,
}: VerticalNavProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const { profile, currentRole, signOut, canAccess } = useAuth();

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
      {/* 2. MOBILE BOTTOM NAVIGATION BAR (Visible on screens < lg) */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-3 py-2 bg-white/95 backdrop-blur-md rounded-t-[2rem] border-t border-[#E2E8F0] shadow-lg shadow-slate-900/10">
        {accessibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-1 px-2.5 transition-all duration-150"
            >
              <div
                className={twMerge(
                  'flex items-center justify-center rounded-full px-4 py-1 transition-all',
                  isActive
                    ? 'bg-[#004AC6] text-white shadow-sm'
                    : 'text-[#505F76] hover:bg-slate-100'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={twMerge(
                  'text-[10px] mt-1 font-medium',
                  isActive ? 'font-bold text-[#004AC6]' : 'text-[#757680]'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default VerticalNav;
