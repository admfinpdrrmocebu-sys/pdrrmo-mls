'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { ScreenName } from '@/lib/auth/rbac';

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
export function ViewOnlyNotice(_props: ViewOnlyNoticeProps) {
  // Access indicator banners are removed for a cleaner, distraction-free UI.
  return null;
}

