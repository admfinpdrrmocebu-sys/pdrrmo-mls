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

    // Insecure context check (required by Safari & modern WebKit/Firefox engines)
    if (typeof window !== 'undefined' && 'isSecureContext' in window && !window.isSecureContext) {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalhost) {
        reject(
          new Error(
            'Geolocation requires a secure connection (HTTPS). Please access via HTTPS or localhost.'
          )
        );
        return;
      }
    }

    const handleSuccess = (position: GeolocationPosition) => {
      try {
        localStorage.setItem('pdrrmo_location_granted', 'true');
      } catch {}
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: Math.round(position.coords.accuracy || 0),
        timestamp: position.timestamp,
      });
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      let message = 'Unable to acquire your GPS location.';
      if (error.code === error.PERMISSION_DENIED) {
        message =
          'Location permission denied. Please allow location access in your browser to verify geofence coverage.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message =
          'GPS signal unavailable. Please ensure location services are enabled on your device.';
      } else if (error.code === error.TIMEOUT) {
        message = 'GPS location request timed out. Please try refreshing your position.';
      }
      reject(new Error(message));
    };

    // Phase 1: High Accuracy GPS (Satellites + Wi-Fi) with 8s timeout
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (phase1Error) => {
        // If high accuracy times out or is unavailable (common in Safari, Firefox, or indoors),
        // automatically fallback to Phase 2: Standard Wi-Fi / Cell tower positioning
        if (
          phase1Error.code === phase1Error.TIMEOUT ||
          phase1Error.code === phase1Error.POSITION_UNAVAILABLE
        ) {
          navigator.geolocation.getCurrentPosition(handleSuccess, handleFinalError, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          });
        } else {
          handleFinalError(phase1Error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
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
