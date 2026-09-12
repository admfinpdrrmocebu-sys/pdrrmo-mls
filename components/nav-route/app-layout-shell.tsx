'use client';

import React from 'react';
import { VerticalNav, NavItemDef } from './vertical-nav';
import { HeaderNav } from './header-nav';
import { ProtectedRoute } from '@/components/auth';
import { useAuth } from '@/lib/auth';
import { ScreenName } from '@/lib/auth/rbac';
import { twMerge } from 'tailwind-merge';

export interface AppLayoutShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  user?: {
    name: string;
    role: string;
    division?: string;
    initials?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
  };
  navItems?: NavItemDef[];
  /** Screen name for RBAC permission check (auto-detected from route if omitted) */
  screen?: ScreenName | string;
  /** Required clearance level ('Full Access' or 'View Only', default: 'View Only') */
  requiredPermission?: 'Full Access' | 'View Only';
  /** Whether to enforce authentication and RBAC clearance on this layout (default: true) */
  requireAuth?: boolean;
  /** Optional specific role requirement (e.g. 'admin') */
  requiredRole?: string;
  className?: string;
}

/**
 * AppLayoutShell Component
 * ========================
 * Standardized layout shell combining the floating VerticalNav and sticky HeaderNav.
 * Integrated with ProtectedRoute guard and dynamic Supabase RBAC profile.
 */
export function AppLayoutShell({
  children,
  title,
  subtitle,
  user: customUser,
  navItems,
  screen,
  requiredPermission,
  requireAuth = true,
  requiredRole,
  className,
}: AppLayoutShellProps) {
  const { profile, currentRole } = useAuth();

  // Compute active user data from Supabase Auth profile (priority) or fallback to custom prop
  const activeUser = profile
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
    : customUser;

  const shellContent = (
    <div className="relative min-h-screen flex flex-col print:min-h-0 print:block">
      {/* 1. Vertical Sidebar Navigation (Desktop & Mobile) */}
      <div className="print:hidden">
        <VerticalNav user={activeUser} items={navItems} />
      </div>

      {/* 2. Main Content Container (Shifted right on lg screens for sidebar) */}
      <div className="flex-1 flex flex-col lg:ml-24 transition-all duration-300 print:ml-0 print:block">
        {/* Sticky Top Header Navigation */}
        <div className="print:hidden">
          <HeaderNav title={title} subtitle={subtitle} user={activeUser} />
        </div>

        {/* Dynamic Page Content */}
        <main
          className={twMerge(
            'flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 pb-28 lg:pb-10 print:p-0 print:m-0 print:max-w-none print:block',
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );

  if (requireAuth) {
    return (
      <ProtectedRoute
        requiredScreen={screen}
        requiredPermission={requiredPermission}
        requiredRole={requiredRole}
      >
        {shellContent}
      </ProtectedRoute>
    );
  }

  return shellContent;
}

export default AppLayoutShell;
