'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import DroneStreamPage from '@/app/drone-stream/page';
import ScreenProjectorPage from '@/app/screen-projector/page';
import AffiliatedAppsPage from '@/app/affiliated-apps/page';

export const PERSISTENT_OPERATIONAL_ROUTES = [
  '/drone-stream',
  '/screen-projector',
  '/affiliated-apps',
] as const;

export type PersistentRoute = (typeof PERSISTENT_OPERATIONAL_ROUTES)[number];

export function isPersistentOperationalRoute(pathname?: string | null): boolean {
  if (!pathname) return false;
  return PERSISTENT_OPERATIONAL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}

export function matchPersistentRoute(pathname?: string | null): PersistentRoute | null {
  if (!pathname) return null;
  const match = PERSISTENT_OPERATIONAL_ROUTES.find(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  return match || null;
}

export interface PersistentOperationsHostProps {
  children: React.ReactNode;
}

/**
 * PersistentOperationsHost
 * ========================
 * High-performance Keep-Alive Shell for mission-critical Disaster Operations screens:
 * - Drone Stream Console (/drone-stream) -> WebRTC RTCPeerConnection & <video> kept alive
 * - Screen Projector (/screen-projector) -> Multi-grid <iframe> web apps kept loaded
 * - Affiliated Apps (/affiliated-apps) -> Directory directory cards kept hydrated in memory
 *
 * Keeps active DOM elements alive offscreen via CSS visibility (display: none / pointer-events: none)
 * when switching between screens, enabling instantaneous 0ms transitions without video re-negotiation
 * or iframe reload cycles.
 */
export function PersistentOperationsHost({ children }: PersistentOperationsHostProps) {
  const pathname = usePathname();

  const activePersistentRoute = useMemo(
    () => matchPersistentRoute(pathname),
    [pathname]
  );

  // Track which operational routes have been visited at least once during this session
  const [visitedRoutes, setVisitedRoutes] = useState<Record<PersistentRoute, boolean>>(() => {
    const initialMatch = matchPersistentRoute(pathname);
    if (initialMatch) {
      return { [initialMatch]: true } as Record<PersistentRoute, boolean>;
    }
    return {} as Record<PersistentRoute, boolean>;
  });

  useEffect(() => {
    if (activePersistentRoute) {
      setVisitedRoutes((prev) => {
        if (prev[activePersistentRoute]) return prev;
        return { ...prev, [activePersistentRoute]: true };
      });
    }
  }, [activePersistentRoute]);

  const isCurrentRoutePersistent = Boolean(activePersistentRoute);

  return (
    <>
      {/* ===================================================================== */}
      {/* 1. PERSISTENT OPERATIONAL SCREENS (KEEP-ALIVE IN MEMORY & DOM)        */}
      {/* ===================================================================== */}

      {/* DRONE STREAM CONSOLE VIEW */}
      {visitedRoutes['/drone-stream'] && (
        <div
          id="persistent-view-drone-stream"
          style={{
            display: activePersistentRoute === '/drone-stream' ? 'block' : 'none',
          }}
          className={
            activePersistentRoute === '/drone-stream'
              ? 'w-full h-full min-h-screen'
              : 'hidden pointer-events-none'
          }
          aria-hidden={activePersistentRoute !== '/drone-stream'}
        >
          <DroneStreamPage />
        </div>
      )}

      {/* SCREEN PROJECTOR LED WALL VIEW */}
      {visitedRoutes['/screen-projector'] && (
        <div
          id="persistent-view-screen-projector"
          style={{
            display: activePersistentRoute === '/screen-projector' ? 'block' : 'none',
          }}
          className={
            activePersistentRoute === '/screen-projector'
              ? 'w-full h-full min-h-screen'
              : 'hidden pointer-events-none'
          }
          aria-hidden={activePersistentRoute !== '/screen-projector'}
        >
          <ScreenProjectorPage />
        </div>
      )}

      {/* AFFILIATED APPS DIRECTORY VIEW */}
      {visitedRoutes['/affiliated-apps'] && (
        <div
          id="persistent-view-affiliated-apps"
          style={{
            display: activePersistentRoute === '/affiliated-apps' ? 'block' : 'none',
          }}
          className={
            activePersistentRoute === '/affiliated-apps'
              ? 'w-full h-full min-h-screen'
              : 'hidden pointer-events-none'
          }
          aria-hidden={activePersistentRoute !== '/affiliated-apps'}
        >
          <AffiliatedAppsPage />
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. STANDARD ROUTE VIEW (Active for Dashboard, Shifts, Logs, etc.)     */}
      {/* ===================================================================== */}
      {!isCurrentRoutePersistent && children}
    </>
  );
}
