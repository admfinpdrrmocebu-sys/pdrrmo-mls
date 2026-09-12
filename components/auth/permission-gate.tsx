'use client';

import React from 'react';
import { Eye, Lock } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/lib/auth';
import { ScreenName, PermissionLevel } from '@/lib/auth/rbac';

export interface PermissionGateProps {
  screen?: ScreenName | string;
  level?: 'Full Access' | 'View Only';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * PermissionGate Component
 * ========================
 * Conditionally renders children if the authenticated user has the required permission level
 * on the specified screen. Renders optional fallback otherwise.
 */
export function PermissionGate({
  screen,
  level = 'Full Access',
  children,
  fallback = null,
}: PermissionGateProps) {
  const { canWrite, canAccess } = useAuth();

  if (!screen) return <>{children}</>;

  const hasPermission =
    level === 'Full Access' ? canWrite(screen) : canAccess(screen);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export interface ViewOnlyNoticeProps {
  screen: ScreenName | string;
  message?: string;
  className?: string;
}

/**
 * ViewOnlyNotice Component
 * ========================
 * Renders an alert pill/banner informing the officer when they are operating
 * in View-Only read mode on the active terminal screen.
 */
export function ViewOnlyNotice({
  screen,
  message = 'Operational record mutations and dispatch actions are restricted under View-Only clearance.',
  className,
}: ViewOnlyNoticeProps) {
  const { isViewOnly } = useAuth();

  if (!isViewOnly(screen)) return null;

  return (
    <div
      className={twMerge(
        'mb-4 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-950 shadow-xs',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 border border-amber-200/60">
          <Eye className="w-3.5 h-3.5" />
        </div>
        <div className="truncate">
          <span className="font-bold text-amber-900">View-Only Terminal Clearance: </span>
          <span className="text-amber-800">{message}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-200/70 text-amber-950 font-bold text-[10px] uppercase tracking-wider shrink-0">
        <Lock className="w-3 h-3 text-amber-800" />
        <span>Read-Only</span>
      </div>
    </div>
  );
}
