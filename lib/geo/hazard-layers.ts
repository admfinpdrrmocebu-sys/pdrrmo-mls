/**
 * =============================================================================
 * PDRRMO CEBU — DOST-NOAH Multi-Hazard Vector Layer Registry & State Persistence
 * =============================================================================
 * Matches the exact 9 vector layers & attribute schemas inside `public/geo/cebu_noah.pmtiles`.
 */

export type HazardLayerId =
  | 'flood_5yr'
  | 'flood_25yr'
  | 'flood_100yr'
  | 'landslide'
  | 'debris_flow'
  | 'storm_surge_ssa1'
  | 'storm_surge_ssa2'
  | 'storm_surge_ssa3'
  | 'storm_surge_ssa4';

export type HazardCategory = 'flood' | 'landslide' | 'storm_surge';

export type BasemapMode = 'auto' | 'light' | 'dark' | 'satellite' | 'offline';

export interface HazardSeverityStop {
  value: number;
  label: string;
  depthOrDetail: string;
  color: string;
  outlineColor: string;
}

export interface HazardLayerDefinition {
  id: HazardLayerId;
  name: string;
  shortName: string;
  category: HazardCategory;
  description: string;
  attributeKey: 'Var' | 'HAZ';
  featureCount: number;
  badgeColor: string;
  defaultVisible: boolean;
  severityStops: HazardSeverityStop[];
}

export interface HazardCategoryDefinition {
  id: HazardCategory;
  label: string;
  shortLabel: string;
  description: string;
  accentColor: string;
  layerIds: HazardLayerId[];
}

export const HAZARD_CATEGORIES: HazardCategoryDefinition[] = [
  {
    id: 'flood',
    label: 'Flood Hazard',
    shortLabel: 'Flood',
    description: 'Rainfall return inundation depths',
    accentColor: '#2563eb',
    layerIds: ['flood_100yr', 'flood_25yr', 'flood_5yr'],
  },
  {
    id: 'landslide',
    label: 'Landslide & Slope',
    shortLabel: 'Slope',
    description: 'Slope instability & debris runout',
    accentColor: '#ea580c',
    layerIds: ['landslide', 'debris_flow'],
  },
  {
    id: 'storm_surge',
    label: 'Storm Surge Advisories',
    shortLabel: 'Surge',
    description: 'Coastal SSA 1–4 storm surge zones',
    accentColor: '#7c3aed',
    layerIds: [
      'storm_surge_ssa4',
      'storm_surge_ssa3',
      'storm_surge_ssa2',
      'storm_surge_ssa1',
    ],
  },
];

export const CEBU_BOUNDS: [[number, number], [number, number]] = [
  [123.05, 9.25],
  [124.85, 11.75],
];

export const CEBU_DEFAULT_CAMERA = {
  lng: 123.8854,
  lat: 10.3157,
  zoom: 9.6,
  pitch: 0,
  bearing: 0,
};

export interface CebuRegionPreset {
  id: string;
  label: string;
  lng: number;
  lat: number;
  zoom: number;
}

export const CEBU_REGION_PRESETS: CebuRegionPreset[] = [
  { id: 'province', label: 'All Cebu Province', lng: 123.85, lat: 10.38, zoom: 8.6 },
  { id: 'metro', label: 'Metro Cebu', lng: 123.905, lat: 10.325, zoom: 11.8 },
  { id: 'north', label: 'North Cebu (Bogo–Daanbantayan)', lng: 124.005, lat: 11.12, zoom: 10.6 },
  { id: 'south', label: 'South Cebu (Carcar–Santander)', lng: 123.46, lat: 9.75, zoom: 10.1 },
  { id: 'bantayan', label: 'Bantayan Island', lng: 123.73, lat: 11.2, zoom: 11.5 },
  { id: 'camotes', label: 'Camotes Islands', lng: 124.42, lat: 10.66, zoom: 11.2 },
];

const FLOOD_SEVERITY_STOPS: HazardSeverityStop[] = [
  {
    value: 1,
    label: 'Low Hazard',
    depthOrDetail: '0.1m – 0.5m flood depth',
    color: '#38bdf8',
    outlineColor: '#0284c7',
  },
  {
    value: 2,
    label: 'Medium Hazard',
    depthOrDetail: '0.5m – 1.5m flood depth',
    color: '#2563eb',
    outlineColor: '#1d4ed8',
  },
  {
    value: 3,
    label: 'High Hazard',
    depthOrDetail: '> 1.5m flood depth',
    color: '#1e1b4b',
    outlineColor: '#312e81',
  },
];

const STORM_SURGE_STOPS: HazardSeverityStop[] = [
  {
    value: 1,
    label: 'Low Surge Risk',
    depthOrDetail: '0.1m – 0.5m surge inundation',
    color: '#2dd4bf',
    outlineColor: '#0d9488',
  },
  {
    value: 2,
    label: 'Medium Surge Risk',
    depthOrDetail: '0.5m – 1.5m surge inundation',
    color: '#0891b2',
    outlineColor: '#0e7490',
  },
  {
    value: 3,
    label: 'High Surge Risk',
    depthOrDetail: '> 1.5m coastal surge inundation',
    color: '#7c3aed',
    outlineColor: '#5b21b6',
  },
];

export const HAZARD_LAYERS: HazardLayerDefinition[] = [
  {
    id: 'flood_100yr',
    name: 'Flood Hazard (100-Year Return)',
    shortName: 'Flood 100-Yr',
    category: 'flood',
    description: 'Extreme rainfall flood inundation (100-year rain return period).',
    attributeKey: 'Var',
    featureCount: 169323,
    badgeColor: '#2563eb',
    defaultVisible: true,
    severityStops: FLOOD_SEVERITY_STOPS,
  },
  {
    id: 'flood_25yr',
    name: 'Flood Hazard (25-Year Return)',
    shortName: 'Flood 25-Yr',
    category: 'flood',
    description: 'Severe rainfall flood inundation (25-year rain return period).',
    attributeKey: 'Var',
    featureCount: 96566,
    badgeColor: '#0284c7',
    defaultVisible: false,
    severityStops: FLOOD_SEVERITY_STOPS,
  },
  {
    id: 'flood_5yr',
    name: 'Flood Hazard (5-Year Return)',
    shortName: 'Flood 5-Yr',
    category: 'flood',
    description: 'Frequent heavy rainfall flood inundation (5-year rain return period).',
    attributeKey: 'Var',
    featureCount: 91883,
    badgeColor: '#38bdf8',
    defaultVisible: false,
    severityStops: FLOOD_SEVERITY_STOPS,
  },
  {
    id: 'landslide',
    name: 'Rain-Induced Landslide',
    shortName: 'Landslide',
    category: 'landslide',
    description: 'Slope instability and rain-triggered landslide susceptibility zones.',
    attributeKey: 'HAZ',
    featureCount: 273234,
    badgeColor: '#ea580c',
    defaultVisible: true,
    severityStops: [
      {
        value: 1,
        label: 'Low Susceptibility',
        depthOrDetail: 'Gentle slope / minor mass movement potential',
        color: '#fde047',
        outlineColor: '#ca8a04',
      },
      {
        value: 2,
        label: 'Moderate Susceptibility',
        depthOrDetail: 'Moderate slope instability during prolonged rain',
        color: '#fb923c',
        outlineColor: '#ea580c',
      },
      {
        value: 3,
        label: 'High Susceptibility',
        depthOrDetail: 'Steep terrain prone to active landslides',
        color: '#ef4444',
        outlineColor: '#b91c1c',
      },
      {
        value: 4,
        label: 'Critical / Very High',
        depthOrDetail: 'Severe escarpment / critical landslide hazard zone',
        color: '#991b1b',
        outlineColor: '#7f1d1d',
      },
    ],
  },
  {
    id: 'debris_flow',
    name: 'Debris Flow / Alluvial Fan',
    shortName: 'Debris Flow',
    category: 'landslide',
    description: 'High-velocity channelized mud and debris flow runout paths.',
    attributeKey: 'HAZ',
    featureCount: 18859,
    badgeColor: '#dc2626',
    defaultVisible: true,
    severityStops: [
      {
        value: 3,
        label: 'High Debris Flow Hazard',
        depthOrDetail: 'Alluvial fan & gully runout impact zone',
        color: '#f43f5e',
        outlineColor: '#be123c',
      },
      {
        value: 4,
        label: 'Critical Debris Flow Path',
        depthOrDetail: 'Direct high-velocity debris channel impact',
        color: '#881337',
        outlineColor: '#4c0519',
      },
    ],
  },
  {
    id: 'storm_surge_ssa4',
    name: 'Storm Surge Advisory 4 (SSA 4)',
    shortName: 'Surge SSA 4',
    category: 'storm_surge',
    description: 'Up to 5-meter catastrophic coastal storm surge inundation.',
    attributeKey: 'HAZ',
    featureCount: 73139,
    badgeColor: '#7c3aed',
    defaultVisible: false,
    severityStops: STORM_SURGE_STOPS,
  },
  {
    id: 'storm_surge_ssa3',
    name: 'Storm Surge Advisory 3 (SSA 3)',
    shortName: 'Surge SSA 3',
    category: 'storm_surge',
    description: 'Up to 4-meter severe coastal storm surge inundation.',
    attributeKey: 'HAZ',
    featureCount: 72342,
    badgeColor: '#8b5cf6',
    defaultVisible: false,
    severityStops: STORM_SURGE_STOPS,
  },
  {
    id: 'storm_surge_ssa2',
    name: 'Storm Surge Advisory 2 (SSA 2)',
    shortName: 'Surge SSA 2',
    category: 'storm_surge',
    description: 'Up to 3-meter moderate-to-high coastal storm surge inundation.',
    attributeKey: 'HAZ',
    featureCount: 70106,
    badgeColor: '#0891b2',
    defaultVisible: false,
    severityStops: STORM_SURGE_STOPS,
  },
  {
    id: 'storm_surge_ssa1',
    name: 'Storm Surge Advisory 1 (SSA 1)',
    shortName: 'Surge SSA 1',
    category: 'storm_surge',
    description: 'Up to 2-meter coastal storm surge advisory zone.',
    attributeKey: 'HAZ',
    featureCount: 68127,
    badgeColor: '#14b8a6',
    defaultVisible: false,
    severityStops: STORM_SURGE_STOPS,
  },
];

export interface PersistedHazardMapState {
  visibleLayers: Record<HazardLayerId, boolean>;
  visibleSeverities: Record<HazardLayerId, number[]>;
  fillOpacity: number;
  basemapMode: BasemapMode;
  camera: {
    lng: number;
    lat: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

const HAZARD_MAP_STATE_STORAGE_KEY = 'pdrrmo_hazard_map_state_v1';

export function getDefaultVisibleLayers(): Record<HazardLayerId, boolean> {
  const map = {} as Record<HazardLayerId, boolean>;
  for (const layer of HAZARD_LAYERS) {
    map[layer.id] = layer.defaultVisible;
  }
  return map;
}

export function getDefaultVisibleSeverities(): Record<HazardLayerId, number[]> {
  const map = {} as Record<HazardLayerId, number[]>;
  for (const layer of HAZARD_LAYERS) {
    map[layer.id] = layer.severityStops.map((s) => s.value);
  }
  return map;
}

export function loadPersistedHazardMapState(): PersistedHazardMapState {
  const defaults: PersistedHazardMapState = {
    visibleLayers: getDefaultVisibleLayers(),
    visibleSeverities: getDefaultVisibleSeverities(),
    fillOpacity: 0.68,
    basemapMode: 'auto',
    camera: { ...CEBU_DEFAULT_CAMERA },
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(HAZARD_MAP_STATE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedHazardMapState>;

    const visibleLayers = { ...defaults.visibleLayers };
    if (parsed.visibleLayers && typeof parsed.visibleLayers === 'object') {
      for (const layer of HAZARD_LAYERS) {
        if (typeof parsed.visibleLayers[layer.id] === 'boolean') {
          visibleLayers[layer.id] = parsed.visibleLayers[layer.id]!;
        }
      }
    }

    const visibleSeverities = { ...defaults.visibleSeverities };
    if (parsed.visibleSeverities && typeof parsed.visibleSeverities === 'object') {
      for (const layer of HAZARD_LAYERS) {
        const rawVals = parsed.visibleSeverities[layer.id];
        if (Array.isArray(rawVals)) {
          const allowedValues = new Set(layer.severityStops.map((s) => s.value));
          visibleSeverities[layer.id] = layer.severityStops
            .map((s) => s.value)
            .filter((val) => rawVals.includes(val) && allowedValues.has(val));
        }
      }
    }

    const fillOpacity =
      typeof parsed.fillOpacity === 'number' &&
      parsed.fillOpacity >= 0.15 &&
      parsed.fillOpacity <= 0.95
        ? parsed.fillOpacity
        : defaults.fillOpacity;

    const basemapMode: BasemapMode =
      parsed.basemapMode === 'auto' ||
      parsed.basemapMode === 'light' ||
      parsed.basemapMode === 'dark' ||
      parsed.basemapMode === 'satellite' ||
      parsed.basemapMode === 'offline'
        ? parsed.basemapMode
        : 'auto';

    const cam = parsed.camera;
    const camera =
      cam &&
      typeof cam.lng === 'number' &&
      typeof cam.lat === 'number' &&
      typeof cam.zoom === 'number'
        ? {
            lng: cam.lng,
            lat: cam.lat,
            zoom: cam.zoom,
            pitch: typeof cam.pitch === 'number' ? cam.pitch : 0,
            bearing: typeof cam.bearing === 'number' ? cam.bearing : 0,
          }
        : defaults.camera;

    return {
      visibleLayers,
      visibleSeverities,
      fillOpacity,
      basemapMode,
      camera,
    };
  } catch {
    return defaults;
  }
}

export function savePersistedHazardMapState(state: PersistedHazardMapState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HAZARD_MAP_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
