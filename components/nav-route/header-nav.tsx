'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays, Megaphone, Settings } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/lib/auth';

export interface HeaderNavProps {
  title?: string;
  subtitle?: string;
  user?: {
    name: string;
    role: string;
    initials?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
  };
  onSettingsClick?: () => void;
  className?: string;
}

/**
 * HeaderNav Component
 * ===================
 * Refined top navigation bar.
 * Features:
 * 1. Title & Subtitle
 * 2. Action buttons (Announcements, Settings - RBAC gated)
 * 3. User status pill with live indicator and role display
 */
export function HeaderNav({
  title = 'MLS Terminal',
  subtitle = 'Monitoring Logging System',
  user: propUser,
  onSettingsClick,
  className,
}: HeaderNavProps) {
  const { profile, currentRole, canAccess } = useAuth();

  const user = profile
    ? {
        name: profile.full_name,
        role:
          currentRole?.name ||
          (profile.role === 'admin'
            ? 'System Admin'
            : profile.position_title || 'Monitoring Officer'),
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
        initials: 'MO',
        isOnline: true,
      };

  return (
    <header
      className={twMerge(
        'w-full bg-[#F8FAFC]/85 backdrop-blur-md border-b border-[#E2E8F0] px-6 sm:px-8 py-4',
        'flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 z-30 gap-4',
        className
      )}
    >
      {/* Left: Terminal Title & Subtitle */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E293B]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] font-semibold text-[#757680] uppercase tracking-widest mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Actions & User Status */}
      <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
        {/* Action Icon Buttons */}
        <div className="flex items-center gap-2">
          {/* Duty Schedule & Shift Dashboard */}
          <Link
            href="/shifts"
            aria-label="Shift Schedule Operations"
            title="Shift Schedule Operations"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#505F76] hover:bg-white hover:text-[#004AC6] hover:shadow-sm border border-transparent hover:border-[#E2E8F0] transition-all cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
          </Link>

          {/* Announcements */}
          <Link
            href="/announcements"
            aria-label="Announcements"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#505F76] hover:bg-white hover:text-[#1E293B] hover:shadow-sm border border-transparent hover:border-[#E2E8F0] transition-all cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
          </Link>

          {/* Settings (Gated by Settings clearance) */}
          {canAccess('Settings') && (
            <Link
              href="/settings"
              aria-label="Settings"
              className="w-10 h-10 flex items-center justify-center rounded-full text-[#505F76] hover:bg-white hover:text-[#1E293B] hover:shadow-sm border border-transparent hover:border-[#E2E8F0] transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* User Identity Info */}
        <Link
          href="/profile"
          className="flex items-center gap-3 pl-4 sm:pl-6 border-l border-[#E2E8F0] group hover:opacity-90 transition-opacity cursor-pointer"
        >
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-[#1E293B] group-hover:text-[#004AC6] transition-colors leading-tight">
              {user.name}
            </span>
            <span className="text-[11px] font-medium text-[#757680] leading-tight mt-0.5">
              {user.role}
            </span>
          </div>

          {/* User Avatar with Live Online Badge */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#004AC6] text-white flex items-center justify-center font-bold text-xs shadow-sm border border-[#004AC6]/10 group-hover:scale-105 transition-transform overflow-hidden">
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
            {user.isOnline && (
              <span
                aria-label="Online"
                className="absolute bottom-0 right-0 w-3 h-3 bg-[#16A34A] border-2 border-white rounded-full shadow-xs"
              />
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}

export default HeaderNav;
