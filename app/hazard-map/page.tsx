'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Map as MapIcon,
  Database,
  Download,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { useTheme } from '@/lib/theme';
import {
  HAZARD_LAYERS,
  getDefaultVisibleLayers,
  getDefaultVisibleSeverities,
  loadPersistedHazardMapState,
  savePersistedHazardMapState,
  type HazardLayerId,
  type HazardCategory,
  type BasemapMode,
} from '@/lib/geo/hazard-layers';
import {
  HAZARD_CACHE_UPDATED_EVENT,
  getHazardCacheStats,
  precacheAllCebuHazardTiles,
  type HazardCacheStats,
} from '@/lib/geo/pmtiles-idb-cache';
import { HazardLegendPanel } from './_components/hazard-legend-panel';
import type { InspectedHazardFeature } from './_components/hazard-map-canvas';

const HazardMapCanvas = dynamic(
  () =>
    import('./_components/hazard-map-canvas').then((mod) => mod.HazardMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 w-full h-full bg-[#F8FAFC] flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center animate-pulse">
          <MapIcon className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-[#1E293B]">
          Initializing MapLibre Vector Engine...
        </p>
        <p className="text-xs text-[#505F76]">
          Loading Cebu DOST-NOAH PMTiles from local persistent cache
        </p>
      </div>
    ),
  }
);

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

export default function HazardMapPage() {
  const { isDark } = useTheme();
  const mapWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const cacheDropdownRef = useRef<HTMLDivElement | null>(null);

  const [initialState] = useState(() => loadPersistedHazardMapState());
  const [layerState, setLayerState] = useState(() => ({
    layers: initialState.visibleLayers,
    severities: initialState.visibleSeverities,
  }));
  const visibleLayers = layerState.layers;
  const visibleSeverities = layerState.severities;
  const [fillOpacity, setFillOpacity] = useState<number>(() => initialState.fillOpacity);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>(
    () => initialState.basemapMode
  );
  const [camera, setCamera] = useState(() => initialState.camera);

  const [inspectedFeature, setInspectedFeature] =
    useState<InspectedHazardFeature | null>(null);

  // Floating in-map HUD & drawer states
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [isCacheDropdownOpen, setIsCacheDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [cacheStats, setCacheStats] = useState<HazardCacheStats>({
    cachedTileCount: 0,
    totalTileCount: 3937,
    cachedBytes: 0,
    isFullyCached: false,
  });
  const [isPreCaching, setIsPreCaching] = useState(false);
  const [preCachePercent, setPreCachePercent] = useState(0);
  const preCacheAbortRef = useRef<AbortController | null>(null);

  // Persist layer & camera state to localStorage across browser restarts and F5
  useEffect(() => {
    savePersistedHazardMapState({
      visibleLayers,
      visibleSeverities,
      fillOpacity,
      basemapMode,
      camera,
    });
  }, [visibleLayers, visibleSeverities, fillOpacity, basemapMode, camera]);

  // Collapse floating drawer on narrow mobile screens after mount without hydration mismatch
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    const id = setTimeout(() => {
      setIsToolbarOpen(false);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Sync fullscreen state cleanly when user presses Esc or exits native fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Refresh IndexedDB tile cache statistics (throttled)
  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshStats = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        void getHazardCacheStats().then((stats) => {
          setCacheStats(stats);
        });
      }, 450);
    };

    void getHazardCacheStats().then(setCacheStats);
    window.addEventListener(HAZARD_CACHE_UPDATED_EVENT, refreshStats);

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      window.removeEventListener(HAZARD_CACHE_UPDATED_EVENT, refreshStats);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const target = mapWorkspaceRef.current;
    if (!target) return;

    try {
      if (!document.fullscreenElement) {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
          setIsFullscreen(true);
        } else {
          setIsFullscreen((prev) => !prev);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback CSS fullscreen if browser blocks native fullscreen API
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  const handleToggleLayer = useCallback((id: HazardLayerId) => {
    setLayerState((prev) => {
      const nextVisible = !prev.layers[id];
      const nextSeverities = { ...prev.severities };
      if (nextVisible && (nextSeverities[id]?.length ?? 0) === 0) {
        const layerDef = HAZARD_LAYERS.find((l) => l.id === id);
        if (layerDef) {
          nextSeverities[id] = layerDef.severityStops.map((s) => s.value);
        }
      }
      return {
        layers: { ...prev.layers, [id]: nextVisible },
        severities: nextSeverities,
      };
    });
  }, []);

  const handleSetCategoryVisibility = useCallback(
    (category: HazardCategory | 'all', visible: boolean) => {
      setLayerState((prev) => {
        const nextLayers = { ...prev.layers };
        const nextSeverities = { ...prev.severities };
        for (const layer of HAZARD_LAYERS) {
          if (category === 'all' || layer.category === category) {
            nextLayers[layer.id] = visible;
            if (visible && (nextSeverities[layer.id]?.length ?? 0) === 0) {
              nextSeverities[layer.id] = layer.severityStops.map((s) => s.value);
            }
          }
        }
        return {
          layers: nextLayers,
          severities: nextSeverities,
        };
      });
    },
    []
  );

  const handleToggleSeverity = useCallback((layerId: HazardLayerId, value: number) => {
    setLayerState((prev) => {
      const layerDef = HAZARD_LAYERS.find((l) => l.id === layerId);
      if (!layerDef) return prev;

      const isParentOn = Boolean(prev.layers[layerId]);
      const current = prev.severities[layerId] ?? [];

      // Clicking a depth while parent layer is OFF turns the layer ON focused on that depth
      if (!isParentOn) {
        return {
          layers: { ...prev.layers, [layerId]: true },
          severities: { ...prev.severities, [layerId]: [value] },
        };
      }

      const exists = current.includes(value);
      const nextValues = layerDef.severityStops
        .map((s) => s.value)
        .filter((v) => (v === value ? !exists : current.includes(v)));

      return {
        layers: { ...prev.layers, [layerId]: nextValues.length > 0 },
        severities: { ...prev.severities, [layerId]: nextValues },
      };
    });
  }, []);

  const handleSetLayerAllSeverities = useCallback(
    (layerId: HazardLayerId, enableAll: boolean) => {
      setLayerState((prev) => {
        const layerDef = HAZARD_LAYERS.find((l) => l.id === layerId);
        if (!layerDef) return prev;
        return {
          layers: { ...prev.layers, [layerId]: enableAll },
          severities: {
            ...prev.severities,
            [layerId]: enableAll ? layerDef.severityStops.map((s) => s.value) : [],
          },
        };
      });
    },
    []
  );

  const handleResetDefaults = useCallback(() => {
    setLayerState({
      layers: getDefaultVisibleLayers(),
      severities: getDefaultVisibleSeverities(),
    });
    setFillOpacity(0.68);
  }, []);

  // Close top-left cache dropdown on outside click
  useEffect(() => {
    if (!isCacheDropdownOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        cacheDropdownRef.current &&
        !cacheDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCacheDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCacheDropdownOpen]);

  const handleStartPreCache = useCallback(async () => {
    if (isPreCaching) return;
    const controller = new AbortController();
    preCacheAbortRef.current = controller;
    setIsPreCaching(true);

    try {
      const finalStats = await precacheAllCebuHazardTiles(
        (progress) => {
          setPreCachePercent(progress.percent);
          setCacheStats({
            cachedTileCount: progress.cachedTileCount,
            totalTileCount: progress.totalTileCount,
            cachedBytes: progress.cachedBytes,
            isFullyCached: progress.percent >= 100,
          });
        },
        controller.signal
      );
      setCacheStats(finalStats);
    } catch {
      // Aborted or network paused; partial progress remains permanently saved in IndexedDB
    } finally {
      setIsPreCaching(false);
      preCacheAbortRef.current = null;
    }
  }, [isPreCaching]);

  const handleCancelPreCache = useCallback(() => {
    preCacheAbortRef.current?.abort();
    preCacheAbortRef.current = null;
    setIsPreCaching(false);
  }, []);

  const activeLayerBadges = HAZARD_LAYERS.filter((l) => visibleLayers[l.id]);
  const cachePercent =
    cacheStats.totalTileCount > 0
      ? Math.min(
          100,
          Math.round((cacheStats.cachedTileCount / cacheStats.totalTileCount) * 100)
        )
      : 0;

  return (
    <AppLayoutShell
      title="Hazard Map"
      subtitle="Cebu DOST-NOAH Multi-Hazard Vector Atlas"
      screen="Hazard Map"
      requiredPermission="View Only"
      className="max-w-none px-3 sm:px-4 md:px-5 py-3 pb-4"
    >
      {/* Full-Viewport Map Workspace (All controls float cleanly inside the map) */}
      <div
        ref={mapWorkspaceRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 w-screen h-dvh bg-[#0b1120] overflow-hidden'
            : 'relative w-full h-[calc(100dvh-6.25rem)] min-h-[560px] rounded-3xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden'
        }
      >
        {/* 1. Full-Bleed MapLibre WebGL Canvas */}
        <HazardMapCanvas
          visibleLayers={visibleLayers}
          visibleSeverities={visibleSeverities}
          fillOpacity={fillOpacity}
          basemapMode={basemapMode}
          isDarkTheme={isDark}
          initialCamera={initialState.camera}
          flyToTarget={null}
          onCameraChange={setCamera}
          onInspectFeature={setInspectedFeature}
        />

        {/* 2. Top-Left Floating Persistent Client Tile Cache Dropdown & Active Layer Strip */}
        <div
          ref={cacheDropdownRef}
          className="absolute top-3.5 left-3.5 right-52 sm:right-64 pointer-events-none flex flex-col items-start gap-2 z-20"
        >
          <div className="pointer-events-auto relative">
            <button
              type="button"
              onClick={() => setIsCacheDropdownOpen((prev) => !prev)}
              aria-expanded={isCacheDropdownOpen}
              className={`px-3 py-2 rounded-xl border shadow-md backdrop-blur-md text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                isCacheDropdownOpen
                  ? 'bg-[#004AC6] text-white border-[#004AC6]'
                  : 'bg-white/95 text-[#1E293B] border-[#E2E8F0] hover:border-[#004AC6]/50'
              }`}
            >
              <Database
                className={`w-3.5 h-3.5 shrink-0 ${
                  isCacheDropdownOpen ? 'text-white' : 'text-[#004AC6]'
                }`}
              />
              <span className="hidden sm:inline">Persistent Client Tile Cache</span>
              <span className="sm:hidden">Tile Cache</span>

              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                  isCacheDropdownOpen
                    ? 'bg-white/20 text-white border-white/30'
                    : cacheStats.isFullyCached
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      : 'bg-blue-50 text-[#004AC6] border-blue-200/80'
                }`}
              >
                {isPreCaching ? `${preCachePercent}%` : `${cachePercent}%`}
              </span>

              {isCacheDropdownOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0 opacity-80" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-80" />
              )}
            </button>

            <AnimatePresence>
              {isCacheDropdownOpen && (
                <motion.div
                  key="tile-cache-dropdown"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-[min(325px,calc(100vw-2rem))] p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] shadow-2xl space-y-2.5 z-30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center shrink-0">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1E293B]">
                          Persistent Client Tile Cache
                        </p>
                        <p className="text-[10px] text-[#505F76]">
                          Survives browser close &amp; F5 refresh (IndexedDB)
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-[#004AC6] border border-blue-200 shrink-0">
                      {isPreCaching ? preCachePercent : cachePercent}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 border border-blue-200/70 overflow-hidden">
                    <div
                      className="h-full bg-[#004AC6] transition-all duration-300"
                      style={{
                        width: `${isPreCaching ? preCachePercent : cachePercent}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#505F76] font-medium">
                    <span>
                      {cacheStats.cachedTileCount.toLocaleString()} /{' '}
                      {cacheStats.totalTileCount.toLocaleString()} tiles cached
                    </span>
                    <span>{formatBytes(cacheStats.cachedBytes)}</span>
                  </div>

                  {cacheStats.isFullyCached ? (
                    <div className="w-full py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>All 3,937 Cebu Hazard Tiles Cached Locally</span>
                    </div>
                  ) : isPreCaching ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2 px-3 rounded-xl bg-blue-50 border border-blue-200 text-[#004AC6] text-xs font-bold flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Caching Offline ({preCachePercent}%)...</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelPreCache}
                        className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Pause offline caching"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartPreCache}
                      className="w-full py-2 px-3 rounded-xl bg-[#004AC6] hover:bg-[#003594] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cache Full Cebu Map Offline (286 MB)</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {activeLayerBadges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 max-w-2xl">
              {activeLayerBadges.map((layer) => {
                const activeCountForLayer =
                  visibleSeverities[layer.id]?.length ?? layer.severityStops.length;
                const totalStops = layer.severityStops.length;
                const isPartial =
                  activeCountForLayer > 0 && activeCountForLayer < totalStops;

                return (
                  <span
                    key={layer.id}
                    className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-[#E2E8F0] shadow-sm text-[11px] font-bold text-[#1E293B]"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: layer.badgeColor }}
                    />
                    <span>{layer.shortName}</span>
                    {isPartial && (
                      <span className="text-[10px] font-extrabold text-[#004AC6]">
                        ({activeCountForLayer}/{totalStops})
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Top-Right Floating Map HUD Actions (Hide/Show Toolbar + Fullscreen) */}
        <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsToolbarOpen((prev) => !prev)}
            title={isToolbarOpen ? 'Hide hazard toolbar' : 'Show hazard toolbar'}
            className={`px-3 py-2 rounded-xl border shadow-md backdrop-blur-md text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              isToolbarOpen
                ? 'bg-[#004AC6] text-white border-[#004AC6]'
                : 'bg-white/95 text-[#1E293B] border-[#E2E8F0] hover:border-[#004AC6]/50'
            }`}
          >
            {isToolbarOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-[#004AC6]" />
            )}
            <span className="hidden sm:inline">
              {isToolbarOpen ? 'Hide Toolbar' : `Layers (${activeLayerBadges.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            className="px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] hover:border-[#004AC6]/50 text-[#1E293B] shadow-md text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#004AC6]" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#004AC6]" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </div>

        {/* 4. Floating Collapsible Hazard Toolbar Drawer (Inside Map, Right Overlay) */}
        <AnimatePresence>
          {isToolbarOpen && (
            <motion.div
              key="hazard-floating-toolbar"
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="absolute top-16 right-3.5 bottom-28 z-20 w-[min(365px,calc(100%-1.75rem))] pointer-events-auto"
            >
              <HazardLegendPanel
                visibleLayers={visibleLayers}
                visibleSeverities={visibleSeverities}
                fillOpacity={fillOpacity}
                basemapMode={basemapMode}
                onToggleLayer={handleToggleLayer}
                onToggleSeverity={handleToggleSeverity}
                onSetLayerAllSeverities={handleSetLayerAllSeverities}
                onSetCategoryVisibility={handleSetCategoryVisibility}
                onResetDefaults={handleResetDefaults}
                onChangeOpacity={setFillOpacity}
                onChangeBasemap={setBasemapMode}
                onHidePanel={() => setIsToolbarOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. Floating Clicked Hazard Feature Inspection Card (Bottom-Left Above Scale) */}
        {inspectedFeature && (
          <div className="absolute bottom-11 left-3.5 z-20 max-w-xs w-[calc(100%-1.75rem)] sm:w-full bg-white/95 backdrop-blur-md rounded-2xl border border-[#CBD5E1] shadow-xl p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 border"
                  style={{
                    backgroundColor: inspectedFeature.severity.color,
                    borderColor: inspectedFeature.severity.outlineColor,
                  }}
                />
                <h3 className="text-xs font-extrabold text-[#1E293B] truncate">
                  {inspectedFeature.layer.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedFeature(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                aria-label="Close inspection popup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#505F76] font-medium">Severity Level:</span>
                <span className="font-bold text-[#1E293B]">
                  {inspectedFeature.severity.label} ({inspectedFeature.layer.attributeKey}={inspectedFeature.rawValue})
                </span>
              </div>
              <p className="text-[11px] text-[#505F76]">
                {inspectedFeature.severity.depthOrDetail}
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[#757680]">
              <span className="inline-flex items-center gap-1">
                <Info className="w-3 h-3 text-[#004AC6]" />
                Clicked Coordinates
              </span>
              <span>
                {inspectedFeature.lat.toFixed(5)}°N, {inspectedFeature.lng.toFixed(5)}°E
              </span>
            </div>
          </div>
        )}
      </div>
    </AppLayoutShell>
  );
}
