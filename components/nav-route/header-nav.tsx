'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, Megaphone, Settings } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';

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
 * 2. Action buttons (Announcements with red unacknowledged indicator, Settings - RBAC gated)
 * 3. User status pill with live indicator and role display
 */
export function HeaderNav({
  title = 'MLS Terminal',
  subtitle = 'Monitoring Logging System',
  user: propUser,
  onSettingsClick,
  className,
}: HeaderNavProps) {
  const { user: authUser, profile, currentRole, canAccess } = useAuth();
  const currentUserId = authUser?.id || profile?.id || '';

  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  // Check if there are any announcements not created by and not yet acknowledged by the current user
  const checkUnacknowledgedAnnouncements = useCallback(async () => {
    if (!currentUserId) {
      setUnacknowledgedCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          id,
          created_by,
          acknowledgments:announcement_acknowledgments(user_id)
        `);

      if (error || !data) {
        return;
      }

      const count = data.filter((row: any) => {
        const isCreator =
          row.created_by === currentUserId ||
          row.created_by === authUser?.id ||
          row.created_by === profile?.id;
        if (isCreator) return false;

        const acks = Array.isArray(row.acknowledgments) ? row.acknowledgments : [];
        const hasAcked = acks.some(
          (a: any) =>
            a.user_id === currentUserId ||
            a.user_id === authUser?.id ||
            a.user_id === profile?.id
        );
        return !hasAcked;
      }).length;

      setUnacknowledgedCount(count);
    } catch {
      // Gracefully ignore if table is not yet migrated
    }
  }, [currentUserId, authUser?.id, profile?.id]);

  useEffect(() => {
    checkUnacknowledgedAnnouncements();

    const channel = supabase
      .channel(`header-announcements-badge-${currentUserId || 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          checkUnacknowledgedAnnouncements();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcement_acknowledgments' },
        () => {
          checkUnacknowledgedAnnouncements();
        }
      )
      .subscribe();

    const handleCustomSync = () => {
      checkUnacknowledgedAnnouncements();
    };

    window.addEventListener('pdrrmo:announcement-ack-changed', handleCustomSync);

    return () => {
      window.removeEventListener('pdrrmo:announcement-ack-changed', handleCustomSync);
      supabase.removeChannel(channel);
    };
  }, [checkUnacknowledgedAnnouncements, currentUserId]);

  const hasUnacknowledged = unacknowledgedCount > 0;

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
        'w-full bg-[#F8FAFC]/85 backdrop-blur-md border-b border-[#E2E8F0] pl-15 sm:pl-16 lg:px-8 pr-4 sm:pr-8 py-3.5 sm:py-4',
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

          {/* Announcements (Red when user has unacknowledged announcements) */}
          <Link
            href="/announcements"
            aria-label={
              hasUnacknowledged
                ? `Announcements (${unacknowledgedCount} unacknowledged)`
                : 'Announcements'
            }
            title={
              hasUnacknowledged
                ? `${unacknowledgedCount} unacknowledged announcement${unacknowledgedCount > 1 ? 's' : ''}`
                : 'Announcements'
            }
            className={twMerge(
              'relative w-10 h-10 flex items-center justify-center rounded-full border transition-all cursor-pointer',
              hasUnacknowledged
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 hover:text-rose-700 shadow-xs'
                : 'text-[#505F76] hover:bg-white hover:text-[#1E293B] hover:shadow-sm border-transparent hover:border-[#E2E8F0]'
            )}
          >
            <Megaphone
              className={twMerge(
                'w-4 h-4 transition-colors',
                hasUnacknowledged && 'text-rose-600'
              )}
            />
            {hasUnacknowledged && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600 border-2 border-white" />
              </span>
            )}
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
