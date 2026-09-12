'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ScreenName, PermissionLevel, normalizeScreenName } from '@/lib/auth/rbac';
import { MLSLoader } from '@/components/loader';
import { ShieldAlert, ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Explicit screen name to check permission for (optional, auto-detected from route if omitted) */
  requiredScreen?: ScreenName | string;
  /** Required permission level for the screen ('Full Access' or 'View Only', default: 'View Only') */
  requiredPermission?: 'Full Access' | 'View Only';
  /** Optional role requirement (e.g. 'admin') */
  requiredRole?: string;
  /** Custom label displayed on loader */
  loaderLabel?: string;
  /** Custom sublabel displayed on loader */
  loaderSublabel?: string;
}

/**
 * ProtectedRoute Component
 * ========================
 * Enterprise Role-Based Access Control (RBAC) Route Guard.
 * - Enforces user authentication
 * - Enforces dynamic permissions defined in access_roles (Dashboard, Logs, Roll Call, Users, Archives, Settings)
 * - Automatically resolves screen name from current URL path
 * - Provides graceful feedback and navigational fallback when clearance is insufficient.
 */
export function ProtectedRoute({
  children,
  requiredScreen,
  requiredPermission = 'View Only',
  requiredRole,
  loaderLabel = 'PDRRMO MLS',
  loaderSublabel = 'AUTHENTICATING SECURE PROTOCOL...',
}: ProtectedRouteProps) {
  const {
    user,
    profile,
    currentRole,
    isLoading,
    isAuthenticated,
    isAdmin,
    canAccess,
    canWrite,
    getPermissionLevel,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirectUrl = `/login?redirectedFrom=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  // 1. Loading state -> Display tactical MLS Loader
  if (isLoading) {
    return (
      <MLSLoader
        size="fullscreen"
        label={loaderLabel}
        sublabel={loaderSublabel}
        iconVariant="shield"
      />
    );
  }

  // 2. Unauthenticated -> Show loader while redirection to /login executes
  if (!isAuthenticated || !user) {
    return (
      <MLSLoader
        size="fullscreen"
        label="REDIRECTING TO LOGIN"
        sublabel="SECURE ACCESS REQUIRED"
        iconVariant="lock"
      />
    );
  }

  // 3. Strict Role Requirement Check (e.g., requiredRole="admin")
  if (requiredRole && !isAdmin) {
    const roleMatches =
      currentRole?.code.toLowerCase() === requiredRole.toLowerCase() ||
      profile?.role?.toLowerCase() === requiredRole.toLowerCase();

    if (!roleMatches) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E2E8F0] shadow-xl shadow-slate-200/50 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-5 border border-rose-100 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-[#1E293B] tracking-tight">
              Restricted Clearance Level
            </h2>

            <p className="text-xs text-[#505F76] mt-2 leading-relaxed">
              Your assigned operational role (<strong className="text-[#1E293B] capitalize">{currentRole?.name || profile?.role || 'Officer'}</strong>) does not possess authorization to access this administrative terminal. Required clearance level: <strong className="text-[#004AC6] capitalize">{requiredRole}</strong>.
            </p>

            <div className="mt-6 pt-6 border-t border-[#E2E8F0] flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#004AC6] hover:bg-[#003594] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to MLS Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  // 4. Dynamic Screen Permission Check from access_roles
  const targetScreen = requiredScreen
    ? normalizeScreenName(requiredScreen)
    : normalizeScreenName(pathname);

  if (targetScreen && !isAdmin) {
    const permLevel: PermissionLevel = getPermissionLevel(targetScreen);

    // If target has 'None' permission, block access completely
    if (permLevel === 'None') {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E2E8F0] shadow-xl shadow-slate-200/50 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5 border border-amber-100 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>

            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-[#505F76]">
              Operational Clearance Restraint
            </span>

            <h2 className="text-xl font-bold text-[#1E293B] tracking-tight mt-3">
              Access Restricted: {targetScreen}
            </h2>

            <p className="text-xs text-[#505F76] mt-2 leading-relaxed">
              Your active operational role (
              <strong className="text-[#1E293B]">
                {currentRole?.name || 'Monitoring Officer'}
              </strong>
              ) has been assigned <strong className="text-rose-600">No Access (None)</strong> for the {targetScreen} terminal console.
            </p>

            <div className="mt-6 pt-6 border-t border-[#E2E8F0] flex flex-col gap-2.5">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#004AC6] hover:bg-[#003594] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Operations Dashboard
              </Link>
              <Link
                href="/profile"
                className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-semibold text-[#505F76] hover:text-[#1E293B] hover:bg-slate-50 transition-colors"
              >
                View Profile &amp; Role Credentials
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // If explicit 'Full Access' is required and user only has 'View Only'
    if (requiredPermission === 'Full Access' && !canWrite(targetScreen)) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E2E8F0] shadow-xl shadow-slate-200/50 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#004AC6] flex items-center justify-center mx-auto mb-5 border border-blue-100 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-[#1E293B] tracking-tight">
              Mutation Clearance Required
            </h2>

            <p className="text-xs text-[#505F76] mt-2 leading-relaxed">
              The <strong className="text-[#1E293B]">{targetScreen}</strong> configuration requires <strong className="text-[#004AC6]">Full Access</strong> clearance. Your role is currently operating in <strong className="text-amber-700">View Only</strong> mode.
            </p>

            <div className="mt-6 pt-6 border-t border-[#E2E8F0] flex flex-col gap-2.5">
              <Link
                href={`/${targetScreen.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#004AC6] hover:bg-[#003594] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Open in View-Only Mode
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  // 5. Authenticated & Authorized -> Render protected page content
  return <>{children}</>;
}

export default ProtectedRoute;
