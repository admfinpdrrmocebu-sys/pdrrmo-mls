'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type {
  StyleSpecification,
  LayerSpecification,
  FilterSpecification,
  MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  getCebuNoahPmtiles,
  prewarmOverviewHazardTiles,
} from '@/lib/geo/pmtiles-idb-cache';
import {
  HAZARD_LAYERS,
  CEBU_BOUNDS,
  type HazardLayerId,
  type BasemapMode,
  type HazardLayerDefinition,
  type HazardSeverityStop,
} from '@/lib/geo/hazard-layers';

export interface InspectedHazardFeature {
  layer: HazardLayerDefinition;
  severity: HazardSeverityStop;
  rawValue: number;
  lng: number;
  lat: number;
}

interface HazardMapCanvasProps {
  visibleLayers: Record<HazardLayerId, boolean>;
  visibleSeverities: Record<HazardLayerId, number[]>;
  fillOpacity: number;
  basemapMode: BasemapMode;
  isDarkTheme: boolean;
  initialCamera: {
    lng: number;
    lat: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  flyToTarget: { lng: number; lat: number; zoom: number; token: number } | null;
  onCameraChange: (camera: {
    lng: number;
    lat: number;
    zoom: number;
    pitch: number;
    bearing: number;
  }) => void;
  onInspectFeature: (feature: InspectedHazardFeature | null) => void;
  onMapReady?: () => void;
}

let isPmtilesProtocolRegistered = false;

function ensurePmtilesProtocol() {
  const { protocol } = getCebuNoahPmtiles();
  if (!isPmtilesProtocolRegistered) {
    maplibregl.setWorkerUrl('/maplibre-gl-worker.js');
    maplibregl.addProtocol('pmtiles', protocol.tile);
    isPmtilesProtocolRegistered = true;
  }
}

function buildFillColorExpression(layer: HazardLayerDefinition): unknown {
  const stops: (number | string)[] = [];
  for (const stop of layer.severityStops) {
    stops.push(stop.value, stop.color);
  }
  const fallbackColor =
    layer.severityStops[layer.severityStops.length - 1]?.color ?? '#2563eb';
  return ['match', ['get', layer.attributeKey], ...stops, fallbackColor];
}

function buildOutlineColorExpression(layer: HazardLayerDefinition): unknown {
  const stops: (number | string)[] = [];
  for (const stop of layer.severityStops) {
    stops.push(stop.value, stop.outlineColor);
  }
  const fallbackColor =
    layer.severityStops[layer.severityStops.length - 1]?.outlineColor ?? '#1d4ed8';
  return ['match', ['get', layer.attributeKey], ...stops, fallbackColor];
}

function getActiveSeverityValues(
  layer: HazardLayerDefinition,
  visibleSeverities: Record<HazardLayerId, number[]>
): number[] {
  const configured = visibleSeverities[layer.id];
  if (!Array.isArray(configured)) {
    return layer.severityStops.map((s) => s.value);
  }
  return configured;
}

function buildSeverityFilterExpression(
  layer: HazardLayerDefinition,
  activeValues: number[]
): FilterSpecification | null {
  if (activeValues.length === 0) {
    return ['==', ['to-number', ['get', layer.attributeKey]], -9999] as FilterSpecification;
  }
  if (activeValues.length >= layer.severityStops.length) {
    return null;
  }
  if (activeValues.length === 1) {
    return [
      '==',
      ['to-number', ['get', layer.attributeKey]],
      activeValues[0],
    ] as FilterSpecification;
  }
  return [
    'any',
    ...activeValues.map((val) => [
      '==',
      ['to-number', ['get', layer.attributeKey]],
      val,
    ]),
  ] as FilterSpecification;
}

function resolveActiveBasemap(
  mode: BasemapMode,
  isDarkTheme: boolean
): 'light' | 'dark' | 'satellite' | 'offline' {
  if (mode === 'auto') {
    return isDarkTheme ? 'dark' : 'light';
  }
  return mode;
}

function buildInitialMapStyle(
  visibleLayers: Record<HazardLayerId, boolean>,
  visibleSeverities: Record<HazardLayerId, number[]>,
  fillOpacity: number,
  activeBasemap: 'light' | 'dark' | 'satellite' | 'offline',
  isDarkTheme: boolean
): StyleSpecification {
  const layers: LayerSpecification[] = [
    {
      id: 'background-canvas',
      type: 'background',
      paint: {
        'background-color':
          activeBasemap === 'dark' || (activeBasemap === 'offline' && isDarkTheme)
            ? '#0b1120'
            : '#e2e8f0',
      },
    },
    {
      id: 'basemap-light-layer',
      type: 'raster',
      source: 'basemap-light',
      layout: {
        visibility: activeBasemap === 'light' ? 'visible' : 'none',
      },
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 150,
      },
    },
    {
      id: 'basemap-dark-layer',
      type: 'raster',
      source: 'basemap-dark',
      layout: {
        visibility: activeBasemap === 'dark' ? 'visible' : 'none',
      },
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 150,
      },
    },
    {
      id: 'basemap-dark-labels-layer',
      type: 'raster',
      source: 'basemap-dark-labels',
      layout: {
        visibility: activeBasemap === 'dark' ? 'visible' : 'none',
      },
      paint: {
        'raster-opacity': 0.9,
        'raster-fade-duration': 150,
      },
    },
    {
      id: 'basemap-satellite-layer',
      type: 'raster',
      source: 'basemap-satellite',
      layout: {
        visibility: activeBasemap === 'satellite' ? 'visible' : 'none',
      },
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 150,
      },
    },
  ];

  for (const hLayer of HAZARD_LAYERS) {
    const activeValues = getActiveSeverityValues(hLayer, visibleSeverities);
    const isVisible =
      visibleLayers[hLayer.id] && activeValues.length > 0 ? 'visible' : 'none';
    const severityFilter = buildSeverityFilterExpression(hLayer, activeValues);

    layers.push({
      id: `hazard-fill-${hLayer.id}`,
      type: 'fill',
      source: 'cebu-noah',
      'source-layer': hLayer.id,
      ...(severityFilter ? { filter: severityFilter } : {}),
      layout: {
        visibility: isVisible,
      },
      paint: {
        'fill-color': buildFillColorExpression(hLayer) as never,
        'fill-opacity': fillOpacity,
      },
    });

    layers.push({
      id: `hazard-line-${hLayer.id}`,
      type: 'line',
      source: 'cebu-noah',
      'source-layer': hLayer.id,
      minzoom: 10,
      ...(severityFilter ? { filter: severityFilter } : {}),
      layout: {
        visibility: isVisible,
      },
      paint: {
        'line-color': buildOutlineColorExpression(hLayer) as never,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 1.2] as never,
        'line-opacity': Math.min(1, fillOpacity + 0.18),
      },
    });
  }

  return {
    version: 8,
    sources: {
      'basemap-light': {
        type: 'raster',
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
      'basemap-dark': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 16,
        attribution: '© Esri, HERE, Garmin, OpenStreetMap contributors',
      },
      'basemap-dark-labels': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 16,
        attribution: '© Esri',
      },
      'basemap-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
      'cebu-noah': {
        type: 'vector',
        tiles: ['pmtiles://cebu-noah/{z}/{x}/{y}'],
        minzoom: 0,
        maxzoom: 14,
        bounds: [123.25, 9.4, 124.65, 11.55],
        attribution: 'DOST-NOAH Cebu Multi-Hazard Atlas',
      },
    },
    layers,
  };
}

function applyLayerVisibilityAndFilters(
  map: maplibregl.Map,
  visibleLayers: Record<HazardLayerId, boolean>,
  visibleSeverities: Record<HazardLayerId, number[]>
) {
  for (const hLayer of HAZARD_LAYERS) {
    const activeValues = getActiveSeverityValues(hLayer, visibleSeverities);
    const vis =
      visibleLayers[hLayer.id] && activeValues.length > 0 ? 'visible' : 'none';
    const filterExpr = buildSeverityFilterExpression(hLayer, activeValues);

    const fillId = `hazard-fill-${hLayer.id}`;
    const lineId = `hazard-line-${hLayer.id}`;
    if (map.getLayer(fillId)) {
      map.setLayoutProperty(fillId, 'visibility', vis);
      map.setFilter(fillId, filterExpr);
    }
    if (map.getLayer(lineId)) {
      map.setLayoutProperty(lineId, 'visibility', vis);
      map.setFilter(lineId, filterExpr);
    }
  }
}

export const HazardMapCanvas = React.memo(function HazardMapCanvas({
  visibleLayers,
  visibleSeverities,
  fillOpacity,
  basemapMode,
  isDarkTheme,
  initialCamera,
  flyToTarget,
  onCameraChange,
  onInspectFeature,
  onMapReady,
}: HazardMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isStyleLoadedRef = useRef(false);
  const onCameraChangeRef = useRef(onCameraChange);
  const onInspectFeatureRef = useRef(onInspectFeature);
  const onMapReadyRef = useRef(onMapReady);
  const latestVisibilityRef = useRef({ visibleLayers, visibleSeverities });

  useEffect(() => {
    latestVisibilityRef.current = { visibleLayers, visibleSeverities };
  }, [visibleLayers, visibleSeverities]);

  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);

  useEffect(() => {
    onInspectFeatureRef.current = onInspectFeature;
  }, [onInspectFeature]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  // Initialize MapLibre GL instance once (kept alive across route transitions)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    ensurePmtilesProtocol();

    const activeBasemap = resolveActiveBasemap(basemapMode, isDarkTheme);
    const style = buildInitialMapStyle(
      visibleLayers,
      visibleSeverities,
      fillOpacity,
      activeBasemap,
      isDarkTheme
    );

    const map = new maplibregl.Map({
      container,
      style,
      center: [initialCamera.lng, initialCamera.lat],
      zoom: initialCamera.zoom,
      pitch: initialCamera.pitch,
      bearing: initialCamera.bearing,
      minZoom: 7.2,
      maxZoom: 17.5,
      maxBounds: CEBU_BOUNDS,
      attributionControl: false,
      cooperativeGestures: false,
      fadeDuration: 0,
    });

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 110,
        unit: 'metric',
      }),
      'bottom-left'
    );

    map.on('load', () => {
      isStyleLoadedRef.current = true;
      applyLayerVisibilityAndFilters(
        map,
        latestVisibilityRef.current.visibleLayers,
        latestVisibilityRef.current.visibleSeverities
      );
      map.resize();
      onMapReadyRef.current?.();
      // Silently pre-warm province overview tiles into IndexedDB
      void prewarmOverviewHazardTiles();
    });

    const handleMoveEnd = () => {
      const center = map.getCenter();
      onCameraChangeRef.current({
        lng: Number(center.lng.toFixed(5)),
        lat: Number(center.lat.toFixed(5)),
        zoom: Number(map.getZoom().toFixed(2)),
        pitch: Math.round(map.getPitch()),
        bearing: Math.round(map.getBearing()),
      });
    };

    map.on('moveend', handleMoveEnd);

    const interactiveLayerIds = HAZARD_LAYERS.map((l) => `hazard-fill-${l.id}`);

    map.on('click', (e: MapMouseEvent) => {
      if (!isStyleLoadedRef.current) return;
      const existingLayers = interactiveLayerIds.filter((id) => Boolean(map.getLayer(id)));
      if (existingLayers.length === 0) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: existingLayers,
      });

      if (!features || features.length === 0) {
        onInspectFeatureRef.current(null);
        return;
      }

      const topFeature = features[0];
      const sourceLayer = topFeature.sourceLayer as HazardLayerId | undefined;
      const layerDef = HAZARD_LAYERS.find((l) => l.id === sourceLayer);
      if (!layerDef) {
        onInspectFeatureRef.current(null);
        return;
      }

      const rawVal = Number(topFeature.properties?.[layerDef.attributeKey] ?? 1);
      const matchedSeverity =
        layerDef.severityStops.find((s) => s.value === rawVal) ??
        layerDef.severityStops[0];

      onInspectFeatureRef.current({
        layer: layerDef,
        severity: matchedSeverity,
        rawValue: rawVal,
        lng: Number(e.lngLat.lng.toFixed(5)),
        lat: Number(e.lngLat.lat.toFixed(5)),
      });
    });

    map.on('mousemove', (e: MapMouseEvent) => {
      if (!isStyleLoadedRef.current) return;
      const existingLayers = interactiveLayerIds.filter((id) => Boolean(map.getLayer(id)));
      if (existingLayers.length === 0) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: existingLayers });
      map.getCanvas().style.cursor = hit.length > 0 ? 'pointer' : '';
    });

    // Automatically resize canvas when Keep-Alive host unhides, window resizes, or fullscreen toggles
    const triggerResize = () => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        map.resize();
      }
    };

    const resizeObserver = new ResizeObserver(triggerResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', triggerResize);
    document.addEventListener('fullscreenchange', triggerResize);

    const rafId = requestAnimationFrame(triggerResize);

    mapRef.current = map;

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', triggerResize);
      document.removeEventListener('fullscreenchange', triggerResize);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      isStyleLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update layer visibility & per-severity filters in 0ms without re-fetching tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoadedRef.current) return;
    applyLayerVisibilityAndFilters(map, visibleLayers, visibleSeverities);
  }, [visibleLayers, visibleSeverities]);

  // Update fill & outline opacity smoothly in 0ms
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoadedRef.current) return;

    for (const hLayer of HAZARD_LAYERS) {
      const fillId = `hazard-fill-${hLayer.id}`;
      const lineId = `hazard-line-${hLayer.id}`;
      if (map.getLayer(fillId)) {
        map.setPaintProperty(fillId, 'fill-opacity', fillOpacity);
      }
      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, 'line-opacity', Math.min(1, fillOpacity + 0.18));
      }
    }
  }, [fillOpacity]);

  // Update basemap visibility in 0ms without resetting vector sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoadedRef.current) return;

    const activeBasemap = resolveActiveBasemap(basemapMode, isDarkTheme);
    if (map.getLayer('background-canvas')) {
      map.setPaintProperty(
        'background-canvas',
        'background-color',
        activeBasemap === 'dark' || (activeBasemap === 'offline' && isDarkTheme)
          ? '#0b1120'
          : '#e2e8f0'
      );
    }
    if (map.getLayer('basemap-light-layer')) {
      map.setLayoutProperty(
        'basemap-light-layer',
        'visibility',
        activeBasemap === 'light' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('basemap-dark-layer')) {
      map.setLayoutProperty(
        'basemap-dark-layer',
        'visibility',
        activeBasemap === 'dark' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('basemap-dark-labels-layer')) {
      map.setLayoutProperty(
        'basemap-dark-labels-layer',
        'visibility',
        activeBasemap === 'dark' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('basemap-satellite-layer')) {
      map.setLayoutProperty(
        'basemap-satellite-layer',
        'visibility',
        activeBasemap === 'satellite' ? 'visible' : 'none'
      );
    }
  }, [basemapMode, isDarkTheme]);

  // Fly to preset region when requested
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;
    map.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: flyToTarget.zoom,
      pitch: 0,
      bearing: 0,
      duration: 900,
      essential: true,
    });
  }, [flyToTarget]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full select-none"
      aria-label="Cebu DOST-NOAH Multi-Hazard Vector Map"
    />
  );
});
