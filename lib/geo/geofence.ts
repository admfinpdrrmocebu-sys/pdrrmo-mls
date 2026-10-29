// =============================================================================
// PDRRMO MLS — GEOLOCATION & GEOFENCING SECURITY UTILITIES
// =============================================================================

export interface GeofenceConfig {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  updatedAt?: string;
}

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
}

export interface GeofenceCheckResult {
  isInside: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
}

export const DEFAULT_GEOFENCE_CONFIG: GeofenceConfig = {
  id: 'default-pdrrmo-geofence',
  name: 'PDRRMO Command Center',
  description: 'Primary operational headquarters geofence perimeter',
  latitude: 10.3157,
  longitude: 123.8854,
  radiusMeters: 200,
  isActive: true,
};

const LOCAL_STORAGE_GEOFENCE_KEY = 'pdrrmo_geofence_config_cache';

/**
 * Calculates the great-circle distance in meters between two GPS coordinates
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Checks if the user's current coordinates fall within the configured geofence perimeter.
 */
export function checkGeofenceCoverage(
  userCoords: { latitude: number; longitude: number },
  geofence: GeofenceConfig
): GeofenceCheckResult {
  const distanceMeters = calculateDistanceMeters(
    userCoords.latitude,
    userCoords.longitude,
    geofence.latitude,
    geofence.longitude
  );

  // If geofencing enforcement is disabled, allow check-in from anywhere
  if (!geofence.isActive) {
    return {
      isInside: true,
      distanceMeters,
      allowedRadiusMeters: geofence.radiusMeters,
    };
  }

  return {
    isInside: distanceMeters <= geofence.radiusMeters,
    distanceMeters,
    allowedRadiusMeters: geofence.radiusMeters,
  };
}

/**
 * Formats distance in meters into a readable string (e.g. "45m" or "1.4km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * Acquires the device's current GPS position via browser Geolocation API.
 */
export function getUserCoordinates(): Promise<UserCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy || 0),
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let message = 'Unable to acquire your GPS location.';
        if (error.code === error.PERMISSION_DENIED) {
          message =
            'Location permission denied. Please allow location access in your browser to verify geofence coverage.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'GPS signal unavailable. Please ensure location services are enabled on your device.';
        } else if (error.code === error.TIMEOUT) {
          message = 'GPS location request timed out. Please try refreshing your position.';
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      }
    );
  });
}

/**
 * LocalStorage fallback cache helpers for Geofence Config
 */
export function saveGeofenceCache(config: GeofenceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_GEOFENCE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

export function loadGeofenceCache(): GeofenceConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GEOFENCE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeofenceConfig;
  } catch {
    return null;
  }
}
