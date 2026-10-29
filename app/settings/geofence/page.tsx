'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Compass,
  MapPin,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LocateFixed,
  Radar,
  Globe,
  Sliders,
  Info,
  Crosshair,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AppLayoutShell } from '@/components/nav-route';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { GeneralCard } from '@/components/card';
import { useAuth } from '@/lib/auth';
import { ViewOnlyNotice } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import {
  GeofenceConfig,
  DEFAULT_GEOFENCE_CONFIG,
  UserCoordinates,
  calculateDistanceMeters,
  checkGeofenceCoverage,
  formatDistance,
  getUserCoordinates,
  saveGeofenceCache,
  loadGeofenceCache,
} from '@/lib/geo/geofence';

const RADIUS_PRESETS = [50, 100, 200, 300, 500, 1000, 2500];

const MAPBOX_ACCESS_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  process.env.mapbox_token ||
  '';

function calculateZoomForRadius(radiusMeters: number): number {
  if (radiusMeters <= 50) return 17;
  if (radiusMeters <= 100) return 16.5;
  if (radiusMeters <= 200) return 15.5;
  if (radiusMeters <= 300) return 15;
  if (radiusMeters <= 500) return 14.5;
  if (radiusMeters <= 1000) return 13.5;
  if (radiusMeters <= 2000) return 12.5;
  return 11.5;
}

function createGeoJSONCircle(
  center: [number, number],
  radiusInMeters: number,
  points = 64
) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusInMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInMeters / 110574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {},
  };
}

interface MapboxGeofenceMapProps {
  center: [number, number]; // [lng, lat]
  radiusMeters: number;
  stationName: string;
  isActive: boolean;
  userCoords: UserCoordinates | null;
  proximityCheck: { distanceMeters: number; isInside: boolean } | null;
  canModify: boolean;
  onCenterChange: (lat: number, lng: number) => void;
}

function MapboxGeofenceMap({
  center,
  radiusMeters,
  stationName,
  isActive,
  userCoords,
  proximityCheck,
  canModify,
  onCenterChange,
}: MapboxGeofenceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const styleUrl =
      mapStyle === 'satellite'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/streets-v12';

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: center,
      zoom: calculateZoomForRadius(radiusMeters),
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // Add Circle Source
      map.addSource('geofence-circle', {
        type: 'geojson',
        data: createGeoJSONCircle(center, radiusMeters),
      });

      // Add Circle Fill Layer
      map.addLayer({
        id: 'geofence-circle-fill',
        type: 'fill',
        source: 'geofence-circle',
        paint: {
          'fill-color': '#004AC6',
          'fill-opacity': isActive ? 0.2 : 0.08,
        },
      });

      // Add Circle Outline Layer
      map.addLayer({
        id: 'geofence-circle-line',
        type: 'line',
        source: 'geofence-circle',
        paint: {
          'line-color': '#004AC6',
          'line-width': 2.5,
          'line-opacity': isActive ? 0.9 : 0.4,
          'line-dasharray': [2, 1],
        },
      });

      // Add Station Center Marker
      const centerMarker = new mapboxgl.Marker({
        color: '#004AC6',
        draggable: canModify,
      })
        .setLngLat(center)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-1 font-sans text-xs">
              <strong class="text-slate-800 font-bold block">${stationName}</strong>
              <span class="text-slate-500 text-[11px]">${radiusMeters}m Geofence Perimeter</span>
              ${canModify ? '<div class="text-[10px] text-blue-600 font-semibold mt-1">Drag marker to reposition</div>' : ''}
            </div>`
          )
        )
        .addTo(map);

      centerMarker.on('dragend', () => {
        const lngLat = centerMarker.getLngLat();
        onCenterChange(Number(lngLat.lat.toFixed(6)), Number(lngLat.lng.toFixed(6)));
      });

      centerMarkerRef.current = centerMarker;

      // Click on map to set center if allowed
      map.on('click', (e) => {
        if (!canModify) return;
        onCenterChange(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6)));
      });

      setIsLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [mapStyle]);

  // Update center & radius when config changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Update Circle GeoJSON
    const source = map.getSource('geofence-circle') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(createGeoJSONCircle(center, radiusMeters));
    }

    // Update Circle Layers paint if isActive changed
    if (map.getLayer('geofence-circle-fill')) {
      map.setPaintProperty('geofence-circle-fill', 'fill-opacity', isActive ? 0.2 : 0.08);
    }
    if (map.getLayer('geofence-circle-line')) {
      map.setPaintProperty('geofence-circle-line', 'line-opacity', isActive ? 0.9 : 0.4);
    }

    // Update Center Marker position & popup
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLngLat(center);
      centerMarkerRef.current.setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="p-1 font-sans text-xs">
            <strong class="text-slate-800 font-bold block">${stationName}</strong>
            <span class="text-slate-500 text-[11px]">${radiusMeters}m Geofence Perimeter</span>
            ${canModify ? '<div class="text-[10px] text-blue-600 font-semibold mt-1">Drag marker to reposition</div>' : ''}
          </div>`
        )
      );
    }
  }, [center, radiusMeters, stationName, isActive, canModify, isLoaded]);

  // Update User Live GPS Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    if (userCoords) {
      const userLngLat: [number, number] = [userCoords.longitude, userCoords.latitude];
      const isInside = proximityCheck?.isInside ?? false;
      const distStr = proximityCheck ? formatDistance(proximityCheck.distanceMeters) : '';

      if (!userMarkerRef.current) {
        const marker = new mapboxgl.Marker({
          color: isInside ? '#10B981' : '#F43F5E',
        })
          .setLngLat(userLngLat)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div class="p-1 font-sans text-xs">
                <strong class="text-slate-800 font-bold block">Your Live Location</strong>
                <span class="${isInside ? 'text-emerald-600' : 'text-rose-600'} font-semibold text-[11px]">
                  ${distStr} away (${isInside ? 'Inside Area' : 'Outside Area'})
                </span>
              </div>`
            )
          )
          .addTo(map);

        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setLngLat(userLngLat);
        userMarkerRef.current.setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-1 font-sans text-xs">
              <strong class="text-slate-800 font-bold block">Your Live Location</strong>
              <span class="${isInside ? 'text-emerald-600' : 'text-rose-600'} font-semibold text-[11px]">
                ${distStr} away (${isInside ? 'Inside Area' : 'Outside Area'})
              </span>
            </div>`
          )
        );
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userCoords, proximityCheck, isLoaded]);

  // Re-center button action
  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: center,
      zoom: calculateZoomForRadius(radiusMeters),
      essential: true,
    });
  };

  return (
    <div className="relative w-full aspect-square max-h-[340px] rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-inner bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Controls Overlay (Top-Left) */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
        {/* Style Switcher (Streets vs Satellite) */}
        <div className="bg-white/95 backdrop-blur-xs p-0.5 rounded-xl shadow-xs border border-slate-200 flex items-center text-xs">
          <button
            type="button"
            onClick={() => setMapStyle('streets')}
            className={`px-2 py-1 rounded-lg font-bold transition-all ${
              mapStyle === 'streets'
                ? 'bg-[#004AC6] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Streets
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('satellite')}
            className={`px-2 py-1 rounded-lg font-bold transition-all ${
              mapStyle === 'satellite'
                ? 'bg-[#004AC6] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Re-center Button */}
        <button
          type="button"
          onClick={handleRecenter}
          className="p-1.5 rounded-xl bg-white/95 backdrop-blur-xs hover:bg-white text-slate-700 hover:text-[#004AC6] shadow-xs border border-slate-200 transition-colors cursor-pointer"
          title="Re-center on Station"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Info Pill */}
      <div className="absolute bottom-2.5 left-2.5 right-20 flex items-center justify-between text-[10px] font-mono bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs z-10 pointer-events-none truncate">
        <span className="text-slate-700 font-semibold truncate">
          {center[1].toFixed(4)}, {center[0].toFixed(4)} · {formatDistance(radiusMeters)}
        </span>
        <span className={isActive ? 'text-emerald-600 font-bold ml-1' : 'text-amber-600 font-bold ml-1'}>
          {isActive ? 'ENFORCED' : 'BYPASSED'}
        </span>
      </div>
    </div>
  );
}

/**
 * Calculates compass bearing in degrees (0-360) from point 1 to point 2
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function GeofenceSettingsPage() {
  const { user, profile, isViewOnly, canWrite } = useAuth();
  const canModifySettings = canWrite('Settings') && !isViewOnly('Settings');

  // Geofence Form State
  const [geofenceId, setGeofenceId] = useState<string>(DEFAULT_GEOFENCE_CONFIG.id);
  const [name, setName] = useState<string>(DEFAULT_GEOFENCE_CONFIG.name);
  const [description, setDescription] = useState<string>(DEFAULT_GEOFENCE_CONFIG.description);
  const [latitude, setLatitude] = useState<string>(String(DEFAULT_GEOFENCE_CONFIG.latitude));
  const [longitude, setLongitude] = useState<string>(String(DEFAULT_GEOFENCE_CONFIG.longitude));
  const [radiusMeters, setRadiusMeters] = useState<string>(String(DEFAULT_GEOFENCE_CONFIG.radiusMeters));
  const [isActive, setIsActive] = useState<boolean>(DEFAULT_GEOFENCE_CONFIG.isActive);

  // Loading & Saving States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // User Live GPS Tester State
  const [userCoords, setUserCoords] = useState<UserCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Visualizer View Mode ('radar' | 'map') - Mapbox Map by default
  const [visualizerTab, setVisualizerTab] = useState<'radar' | 'map'>('map');

  // Callback when Mapbox pin is dragged or map is clicked
  const handleMapCenterChange = useCallback((newLat: number, newLng: number) => {
    setLatitude(newLat.toFixed(6));
    setLongitude(newLng.toFixed(6));
  }, []);

  // Toast State
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ title, message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.title === title ? null : prev));
      }, 4500);
    },
    []
  );

  // Parsed Numeric Coordinates
  const parsedLat = useMemo(() => {
    const val = parseFloat(latitude);
    return Number.isFinite(val) ? Math.max(-90, Math.min(90, val)) : DEFAULT_GEOFENCE_CONFIG.latitude;
  }, [latitude]);

  const parsedLng = useMemo(() => {
    const val = parseFloat(longitude);
    return Number.isFinite(val)
      ? Math.max(-180, Math.min(180, val))
      : DEFAULT_GEOFENCE_CONFIG.longitude;
  }, [longitude]);

  const parsedRadius = useMemo(() => {
    const num = parseInt(radiusMeters.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [radiusMeters]);

  const effectiveRadius = useMemo(() => {
    return parsedRadius > 0 ? parsedRadius : DEFAULT_GEOFENCE_CONFIG.radiusMeters;
  }, [parsedRadius]);

  const activeConfig: GeofenceConfig = useMemo(
    () => ({
      id: geofenceId,
      name: name.trim() || 'PDRRMO Command Center',
      description: description.trim(),
      latitude: parsedLat,
      longitude: parsedLng,
      radiusMeters: effectiveRadius,
      isActive,
    }),
    [geofenceId, name, description, parsedLat, parsedLng, effectiveRadius, isActive]
  );

  // Fetch Geofence Configuration from Supabase
  const fetchGeofenceSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('geofence_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const config: GeofenceConfig = {
          id: data.id,
          name: data.name || DEFAULT_GEOFENCE_CONFIG.name,
          description: data.description || DEFAULT_GEOFENCE_CONFIG.description,
          latitude: Number(data.latitude ?? DEFAULT_GEOFENCE_CONFIG.latitude),
          longitude: Number(data.longitude ?? DEFAULT_GEOFENCE_CONFIG.longitude),
          radiusMeters: Number(data.radius_meters ?? DEFAULT_GEOFENCE_CONFIG.radiusMeters),
          isActive: Boolean(data.is_active ?? true),
          updatedAt: data.updated_at,
        };
        setGeofenceId(config.id);
        setName(config.name);
        setDescription(config.description);
        setLatitude(String(config.latitude));
        setLongitude(String(config.longitude));
        setRadiusMeters(String(config.radiusMeters));
        setIsActive(config.isActive);
        saveGeofenceCache(config);
      } else {
        // Fallback to localStorage cache if table pending migration
        const cached = loadGeofenceCache();
        if (cached) {
          setGeofenceId(cached.id);
          setName(cached.name);
          setDescription(cached.description);
          setLatitude(String(cached.latitude));
          setLongitude(String(cached.longitude));
          setRadiusMeters(String(cached.radiusMeters));
          setIsActive(cached.isActive);
        }
      }
    } catch {
      const cached = loadGeofenceCache();
      if (cached) {
        setName(cached.name);
        setDescription(cached.description);
        setLatitude(String(cached.latitude));
        setLongitude(String(cached.longitude));
        setRadiusMeters(String(cached.radiusMeters));
        setIsActive(cached.isActive);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Acquire User's Current GPS Position for Proximity Testing
  const handleTestMyLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const coords = await getUserCoordinates();
      setUserCoords(coords);
    } catch (err: any) {
      setLocationError(err.message || 'Could not acquire GPS coordinates.');
    } finally {
      setIsLocating(false);
    }
  }, []);

  // Set Geofence Center to Current User GPS Location
  const handleSetCenterToCurrentLocation = useCallback(async () => {
    if (!canModifySettings) return;
    setIsLocating(true);
    setLocationError(null);
    try {
      const coords = await getUserCoordinates();
      setUserCoords(coords);
      setLatitude(coords.latitude.toFixed(6));
      setLongitude(coords.longitude.toFixed(6));
      showToast(
        'Center Coordinates Updated',
        `Station center set to your current GPS position (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}).`,
        'info'
      );
    } catch (err: any) {
      setLocationError(err.message || 'Could not acquire GPS coordinates.');
      showToast('GPS Error', err.message || 'Failed to read your location.', 'error');
    } finally {
      setIsLocating(false);
    }
  }, [canModifySettings, showToast]);

  useEffect(() => {
    fetchGeofenceSettings();
    handleTestMyLocation();
  }, [fetchGeofenceSettings, handleTestMyLocation]);

  // Save Geofence Configuration to Supabase
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifySettings) {
      showToast('Access Restricted', 'You have View-Only permissions for Settings.', 'error');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      showToast('Invalid Latitude', 'Latitude must be a valid number between -90 and 90.', 'error');
      return;
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      showToast(
        'Invalid Longitude',
        'Longitude must be a valid number between -180 and 180.',
        'error'
      );
      return;
    }

    setIsSaving(true);
    try {
      const currentUserId = user?.id || profile?.id || null;
      const configToSave: GeofenceConfig = {
        id: geofenceId,
        name: name.trim() || 'PDRRMO Command Center',
        description: description.trim() || 'Primary operational headquarters geofence perimeter',
        latitude: latNum,
        longitude: lngNum,
        radiusMeters: Math.max(10, effectiveRadius),
        isActive,
        updatedAt: new Date().toISOString(),
      };

      // Save to local cache immediately for instant responsiveness
      saveGeofenceCache(configToSave);

      // Persist to Supabase geofence_settings table
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        geofenceId
      );

      if (isUuid) {
        const { error } = await supabase
          .from('geofence_settings')
          .update({
            name: configToSave.name,
            description: configToSave.description,
            latitude: configToSave.latitude,
            longitude: configToSave.longitude,
            radius_meters: configToSave.radiusMeters,
            is_active: configToSave.isActive,
            updated_by: currentUserId,
            updated_at: configToSave.updatedAt,
          })
          .eq('id', geofenceId);

        if (error) throw error;
      } else {
        // Insert new row if no UUID row existed yet
        const { data, error } = await supabase
          .from('geofence_settings')
          .insert({
            name: configToSave.name,
            description: configToSave.description,
            latitude: configToSave.latitude,
            longitude: configToSave.longitude,
            radius_meters: configToSave.radiusMeters,
            is_active: configToSave.isActive,
            created_by: currentUserId,
            updated_by: currentUserId,
          })
          .select()
          .single();

        if (error) throw error;
        if (data?.id) {
          setGeofenceId(data.id);
          saveGeofenceCache({ ...configToSave, id: data.id });
        }
      }

      showToast(
        'GeoFence Configuration Saved',
        `Perimeter updated to ${configToSave.radiusMeters}m around ${configToSave.name}.`,
        'success'
      );
    } catch (err: any) {
      console.warn('Supabase geofence save notice (cached locally):', err?.message);
      showToast(
        'Saved to Local Configuration',
        'GeoFence coverage settings applied. Run the SQL migration to sync across all terminals.',
        'info'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Compute Live Proximity Check for current user
  const proximityCheck = useMemo(() => {
    if (!userCoords) return null;
    const distanceMeters = calculateDistanceMeters(
      userCoords.latitude,
      userCoords.longitude,
      activeConfig.latitude,
      activeConfig.longitude
    );
    const isInside = distanceMeters <= activeConfig.radiusMeters;
    const bearing = calculateBearing(
      activeConfig.latitude,
      activeConfig.longitude,
      userCoords.latitude,
      userCoords.longitude
    );
    return {
      distanceMeters,
      isInside,
      bearing,
    };
  }, [userCoords, activeConfig]);

  return (
    <AppLayoutShell
      title="Station GeoFencing"
      subtitle="Attendance Perimeter & Coverage Area Configuration"
      screen="Settings"
    >
      <div className="space-y-6 pb-12">
        {/* ========================================================================= */}
        {/* 1. HEADER & BACK NAVIGATION */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004AC6] hover:text-[#003594] transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Settings</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center border border-[#004AC6]/20">
                <Compass className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1E293B] tracking-tight">
                Station GeoFencing Security
              </h1>
            </div>
            <p className="text-sm text-[#505F76]">
              Define the circular geographic boundary where personnel must be physically located to Check In and Check Out on the Schedule Dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <SecondaryButton
              size="sm"
              onClick={handleTestMyLocation}
              disabled={isLocating}
              leftIcon={
                <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin text-[#004AC6]' : ''}`} />
              }
            >
              {isLocating ? 'Acquiring GPS...' : 'Test My GPS'}
            </SecondaryButton>
          </div>
        </div>

        <ViewOnlyNotice
          screen="Settings"
          message="GeoFencing security boundaries are in View-Only mode under your current clearance."
        />

        {/* ========================================================================= */}
        {/* 2. TOP SUMMARY TELEMETRY CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {/* Card 1: Enforcement Status */}
          <GeneralCard className="p-5 border-[#E2E8F0] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#757680]">
                Security Gate Status
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-[#1E293B]">
                  {isActive ? 'Enforced' : 'Bypassed'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#505F76]">
                {isActive
                  ? 'Personnel must be inside circle to check in'
                  : 'Geofence check is currently disabled'}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}
            >
              {isActive ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
          </GeneralCard>

          {/* Card 2: Coverage Circle Radius */}
          <GeneralCard className="p-5 border-[#E2E8F0] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#757680]">
                Circle Coverage Radius
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-[#004AC6] font-mono">
                  {formatDistance(effectiveRadius)}
                </span>
                <span className="text-xs font-semibold text-[#505F76]">
                  ({effectiveRadius.toLocaleString()} meters)
                </span>
              </div>
              <p className="text-xs text-[#505F76]">
                Area: ~{Math.round((Math.PI * effectiveRadius * effectiveRadius) / 1000).toLocaleString()}k m² coverage
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/20 flex items-center justify-center shrink-0">
              <Radar className="w-6 h-6" />
            </div>
          </GeneralCard>

          {/* Card 3: Live Proximity Verification */}
          <GeneralCard className="p-5 border-[#E2E8F0] flex items-center justify-between">
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#757680]">
                Your Current Proximity
              </span>
              {proximityCheck ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-extrabold text-[#1E293B] font-mono">
                      {formatDistance(proximityCheck.distanceMeters)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        proximityCheck.isInside
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {proximityCheck.isInside ? 'Inside Zone' : 'Outside Zone'}
                    </span>
                  </div>
                  <p className="text-xs text-[#505F76] truncate">
                    {proximityCheck.isInside
                      ? 'Your position qualifies for Check-In'
                      : `Exceeds ${formatDistance(effectiveRadius)} radius limit`}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-[#505F76]">
                    {isLocating ? 'Locating GPS...' : 'GPS Not Acquired'}
                  </div>
                  <p className="text-xs text-[#757680] truncate">
                    {locationError || 'Click "Test My GPS" to check distance'}
                  </p>
                </>
              )}
            </div>
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                proximityCheck
                  ? proximityCheck.isInside
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-slate-100 text-[#505F76] border-slate-200'
              }`}
            >
              <Navigation className="w-6 h-6" />
            </div>
          </GeneralCard>
        </div>

        {/* ========================================================================= */}
        {/* 3. MAIN 2-COLUMN CONFIGURATION & VISUALIZER */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: GEOFENCE PARAMETERS FORM (7 cols) */}
          <form onSubmit={handleSaveSettings} className="lg:col-span-7 space-y-6">
            <GeneralCard className="p-6 sm:p-7 border-[#E2E8F0] space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-[#004AC6]" />
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                      Perimeter Parameters
                    </h2>
                    <p className="text-xs text-[#505F76]">
                      Set the headquarters coordinates and circular coverage radius.
                    </p>
                  </div>
                </div>

                {/* Active Enforcement Switch */}
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="text-xs font-bold text-[#1E293B]">
                    {isActive ? 'Enforce GeoFence' : 'GeoFence Off'}
                  </span>
                  <button
                    type="button"
                    disabled={!canModifySettings}
                    onClick={() => setIsActive((prev) => !prev)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
                      isActive ? 'bg-[#004AC6] justify-end' : 'bg-slate-300 justify-start'
                    } ${!canModifySettings ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-xs transition-transform" />
                  </button>
                </label>
              </div>

              {/* Station Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                    Station / Zone Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    disabled={!canModifySettings}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. PDRRMO Command Center"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white transition-all disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                    Perimeter Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    disabled={!canModifySettings}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Operational headquarters boundary"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-medium text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Center Coordinates (Latitude & Longitude) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#004AC6]" />
                    <span>Center Point Coordinates (Latitude & Longitude)</span>
                  </label>

                  {canModifySettings && (
                    <button
                      type="button"
                      onClick={handleSetCenterToCurrentLocation}
                      disabled={isLocating}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004AC6] hover:text-[#003594] bg-[#004AC6]/8 hover:bg-[#004AC6]/15 px-3 py-1.5 rounded-full transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      <span>Use My Current GPS Location</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#505F76]">
                      Center Latitude (°N/S)
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      disabled={!canModifySettings}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="10.3157"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-mono font-bold text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#505F76]">
                      Center Longitude (°E/W)
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      disabled={!canModifySettings}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="123.8854"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-mono font-bold text-[#1E293B] focus:outline-none focus:border-[#004AC6] focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Circle Coverage Radius Slider & Presets */}
              <div className="space-y-4 pt-3 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                    Circle Coverage Radius (Meters)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={radiusMeters}
                      disabled={!canModifySettings}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, '');
                        setRadiusMeters(digits);
                      }}
                      onBlur={() => {
                        if (!radiusMeters || parseInt(radiusMeters, 10) <= 0) {
                          setRadiusMeters('50');
                        }
                      }}
                      placeholder="200"
                      className="w-28 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-mono font-extrabold text-[#004AC6] text-right focus:outline-none focus:border-[#004AC6] focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all disabled:opacity-60"
                    />
                    <span className="text-xs font-bold text-[#505F76]">meters</span>
                  </div>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min={25}
                  max={2500}
                  step={25}
                  value={Math.min(2500, Math.max(25, effectiveRadius))}
                  disabled={!canModifySettings}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#004AC6] disabled:opacity-60"
                />

                {/* Quick Radius Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#757680] mr-1">
                    Quick Presets:
                  </span>
                  {RADIUS_PRESETS.map((preset) => {
                    const isSelected = effectiveRadius === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={!canModifySettings}
                        onClick={() => setRadiusMeters(String(preset))}
                        className={`px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#004AC6] text-white border-[#004AC6] shadow-2xs'
                            : 'bg-[#F8FAFC] text-[#505F76] border-[#E2E8F0] hover:border-[#004AC6]/40 hover:text-[#004AC6]'
                        } disabled:opacity-50`}
                      >
                        {formatDistance(preset)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[#505F76]">
                  <Info className="w-4 h-4 text-[#004AC6] shrink-0" />
                  <span>
                    Changes apply immediately to all Schedule Dashboard check-in terminals.
                  </span>
                </div>

                {canModifySettings && (
                  <PrimaryButton
                    type="submit"
                    size="md"
                    pill
                    disabled={isSaving || isLoading}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    {isSaving ? 'Saving...' : 'Save GeoFence'}
                  </PrimaryButton>
                )}
              </div>
            </GeneralCard>
          </form>

          {/* RIGHT COLUMN: INTERACTIVE CIRCLE VISUALIZER & MAP (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <GeneralCard className="p-5 sm:p-6 border-[#E2E8F0] space-y-4">
              {/* Visualizer Header & Mode Switcher */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#1E293B]">
                    Coverage Area Visualizer
                  </h3>
                  <p className="text-xs text-[#505F76]">
                    {activeConfig.name} ({formatDistance(activeConfig.radiusMeters)} radius)
                  </p>
                </div>

                <div className="bg-[#F1F5F9] p-1 rounded-xl flex items-center gap-1 border border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setVisualizerTab('radar')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualizerTab === 'radar'
                        ? 'bg-white text-[#004AC6] shadow-2xs'
                        : 'text-[#505F76] hover:text-[#1E293B]'
                    }`}
                  >
                    <Radar className="w-3.5 h-3.5" />
                    <span>Radar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualizerTab('map')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualizerTab === 'map'
                        ? 'bg-white text-[#004AC6] shadow-2xs'
                        : 'text-[#505F76] hover:text-[#1E293B]'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Map</span>
                  </button>
                </div>
              </div>

              {/* VISUALIZER CANVAS */}
              {visualizerTab === 'radar' ? (
                <div className="relative w-full aspect-square max-h-[320px] mx-auto rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-inner">
                  {/* Subtle Coordinate Grid Lines */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                      backgroundSize: '32px 32px',
                    }}
                  />

                  {/* Crosshair Axes */}
                  <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />

                  {/* Compass Labels */}
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-500">
                    N
                  </span>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-500">
                    S
                  </span>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-500">
                    E
                  </span>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-500">
                    W
                  </span>

                  {/* Outer Reference Ring (1.5x radius) */}
                  <div className="w-[82%] h-[82%] rounded-full border border-dashed border-slate-700/70 flex items-center justify-center">
                    {/* Active Geofence Coverage Circle */}
                    <div
                      className={`w-[68%] h-[68%] rounded-full border-2 flex items-center justify-center relative transition-colors duration-300 ${
                        isActive
                          ? 'bg-blue-500/15 border-blue-400 shadow-[0_0_40px_rgba(59,130,246,0.25)]'
                          : 'bg-amber-500/10 border-amber-400/60 border-dashed'
                      }`}
                    >
                      {/* Inner 50% Ring */}
                      <div className="w-1/2 h-1/2 rounded-full border border-blue-400/25" />

                      {/* Radius Label on Perimeter */}
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-mono font-bold shadow-sm whitespace-nowrap">
                        R = {formatDistance(activeConfig.radiusMeters)}
                      </span>

                      {/* Center Station HQ Pin */}
                      <div className="relative flex flex-col items-center">
                        <span className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        </span>
                        <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-[9px] font-bold text-blue-200 border border-slate-700 whitespace-nowrap">
                          HQ Center
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Plotted Live User GPS Dot */}
                  {proximityCheck && (
                    <div
                      style={{
                        // Scale distance relative to activeConfig.radiusMeters (where 34% of container radius = 1.0x radiusMeters)
                        transform: (() => {
                          const ratio = Math.min(
                            1.32,
                            proximityCheck.distanceMeters / Math.max(1, activeConfig.radiusMeters)
                          );
                          const maxPx = 92; // radius in px on radar corresponding to 1.0x geofence radius
                          const distPx = ratio * maxPx;
                          const rad = ((proximityCheck.bearing - 90) * Math.PI) / 180;
                          const x = Math.cos(rad) * distPx;
                          const y = Math.sin(rad) * distPx;
                          return `translate(${x}px, ${y}px)`;
                        })(),
                      }}
                      className="absolute z-20 flex flex-col items-center transition-transform duration-500"
                    >
                      <span className="relative flex h-4 w-4">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            proximityCheck.isInside ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-md ${
                            proximityCheck.isInside ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                      </span>
                      <span
                        className={`mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold text-white shadow-xs whitespace-nowrap ${
                          proximityCheck.isInside ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        You ({formatDistance(proximityCheck.distanceMeters)})
                      </span>
                    </div>
                  )}

                  {/* Bottom Coordinates Overlay */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-800">
                    <span>
                      Center: {activeConfig.latitude.toFixed(4)}, {activeConfig.longitude.toFixed(4)}
                    </span>
                    <span className={isActive ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {isActive ? '● ACTIVE' : '○ BYPASSED'}
                    </span>
                  </div>
                </div>
              ) : (
                <MapboxGeofenceMap
                  center={[activeConfig.longitude, activeConfig.latitude]}
                  radiusMeters={activeConfig.radiusMeters}
                  stationName={activeConfig.name}
                  isActive={activeConfig.isActive}
                  userCoords={userCoords}
                  proximityCheck={proximityCheck}
                  canModify={canModifySettings}
                  onCenterChange={handleMapCenterChange}
                />
              )}

              {/* Live GPS Verification Readout Box */}
              <div
                className={`p-4 rounded-2xl border transition-colors ${
                  proximityCheck
                    ? proximityCheck.isInside
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-rose-50/70 border-rose-200'
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      proximityCheck
                        ? proximityCheck.isInside
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-[#505F76]'
                    }`}
                  >
                    {proximityCheck ? (
                      proximityCheck.isInside ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )
                    ) : (
                      <LocateFixed className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#1E293B]">
                        {proximityCheck
                          ? proximityCheck.isInside
                            ? 'Check-In Permitted at Your Location'
                            : 'Check-In Blocked at Your Location'
                          : 'GPS Verification Standby'}
                      </span>
                      {userCoords && (
                        <span className="text-[10px] font-mono text-[#505F76]">
                          ±{userCoords.accuracyMeters}m GPS
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#505F76]">
                      {proximityCheck
                        ? proximityCheck.isInside
                          ? `You are ${formatDistance(proximityCheck.distanceMeters)} from ${activeConfig.name} (within the ${formatDistance(activeConfig.radiusMeters)} boundary).`
                          : `You are ${formatDistance(proximityCheck.distanceMeters)} away from ${activeConfig.name}. Personnel must be within ${formatDistance(activeConfig.radiusMeters)} to Check In.`
                        : locationError ||
                          'Click "Test My GPS" to measure your live distance from the station perimeter.'}
                    </p>
                  </div>
                </div>
              </div>
            </GeneralCard>
          </div>
        </div>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-4 flex items-start gap-3"
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600'
                    : toast.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-blue-50 text-[#004AC6]'
                }`}
              >
                {toast.type === 'error' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#1E293B]">{toast.title}</p>
                <p className="text-xs text-[#505F76] mt-0.5">{toast.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayoutShell>
  );
}
