/**
 * =============================================================================
 * PDRRMO MLS — Operational Screens In-Memory SWR Data Cache
 * =============================================================================
 * Stores fetched database records for Drone Streams, Screen Projector, and
 * Affiliated Apps in browser memory so pages hydrate synchronously in 0ms with
 * zero loading skeleton or spinner flash upon navigation.
 */

import type { DroneStreamItem } from '@/app/drone-stream/page';

// Re-use or define minimal types matching the respective pages
export interface CachedProjectorScreen {
  id: string;
  name: string;
  webLink: string;
  sortOrder: number;
  deviceOrders: Record<string, number>;
  isActive: boolean;
  createdBy: string | null;
  createdByName: string | null;
}

export interface CachedAffiliatedApp {
  id: string;
  name: string;
  appUrl: string;
  imageUrl: string;
  sortOrder: number;
  updatedAt: string;
}

// Module-level in-memory stores (survive client-side route transitions)
let _droneStreamsCache: DroneStreamItem[] | null = null;
let _projectorScreensCache: CachedProjectorScreen[] | null = null;
let _affiliatedAppsCache: CachedAffiliatedApp[] | null = null;

// =============================================================================
// DRONE STREAMS CACHE
// =============================================================================

export function getCachedDroneStreams(): DroneStreamItem[] | null {
  return _droneStreamsCache;
}

export function setCachedDroneStreams(items: DroneStreamItem[]): void {
  _droneStreamsCache = items;
}

export function updateCachedDroneStream(item: DroneStreamItem): void {
  if (!_droneStreamsCache) {
    _droneStreamsCache = [item];
    return;
  }
  const idx = _droneStreamsCache.findIndex((s) => s.id === item.id);
  if (idx !== -1) {
    _droneStreamsCache[idx] = item;
  } else {
    _droneStreamsCache.push(item);
  }
}

export function removeCachedDroneStream(id: string): void {
  if (!_droneStreamsCache) return;
  _droneStreamsCache = _droneStreamsCache.filter((s) => s.id !== id);
}

// =============================================================================
// SCREEN PROJECTOR CACHE
// =============================================================================

export function getCachedProjectorScreens(): CachedProjectorScreen[] | null {
  return _projectorScreensCache;
}

export function setCachedProjectorScreens(items: CachedProjectorScreen[]): void {
  _projectorScreensCache = items;
}

// =============================================================================
// AFFILIATED APPS CACHE
// =============================================================================

export function getCachedAffiliatedApps(): CachedAffiliatedApp[] | null {
  return _affiliatedAppsCache;
}

export function setCachedAffiliatedApps(items: CachedAffiliatedApp[]): void {
  _affiliatedAppsCache = items;
}

// =============================================================================
// CACHE RESET (e.g. on user sign out)
// =============================================================================

export function clearOperationalScreensCache(): void {
  _droneStreamsCache = null;
  _projectorScreensCache = null;
  _affiliatedAppsCache = null;
}
