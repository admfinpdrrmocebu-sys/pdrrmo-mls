/**
 * =============================================================================
 * PDRRMO MLS — Screen Projector Adaptive Auto-Grid Solver
 * =============================================================================
 * Automatically calculates optimal grid columns & rows across Mobile, Tablet,
 * Laptop/Desktop, 1080p FHD, 2K QHD, and 4K/Ultra-Wide LED Wall displays.
 */

export type DeviceTier = 'mobile' | 'tablet' | 'desktop' | 'fhd' | 'qhd' | 'uhd';

export type LayoutProfileKey = 'mobile' | 'tablet' | 'desktop' | 'led_wall';

export type GridPreset =
  | 'auto'
  | '1x1'
  | '2x1'
  | '2x2'
  | '3x2'
  | '4x2'
  | '3x3'
  | '4x3'
  | '5x3'
  | '4x4'
  | '6x3'
  | '6x4';

export interface GridPresetOption {
  value: GridPreset;
  label: string;
  cols?: number;
  rows?: number;
}

export const GRID_PRESET_OPTIONS: GridPresetOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1x1', label: '1×1', cols: 1, rows: 1 },
  { value: '2x1', label: '2×1', cols: 2, rows: 1 },
  { value: '2x2', label: '2×2', cols: 2, rows: 2 },
  { value: '3x2', label: '3×2', cols: 3, rows: 2 },
  { value: '4x2', label: '4×2', cols: 4, rows: 2 },
  { value: '3x3', label: '3×3', cols: 3, rows: 3 },
  { value: '4x3', label: '4×3', cols: 4, rows: 3 },
  { value: '5x3', label: '5×3', cols: 5, rows: 3 },
  { value: '4x4', label: '4×4', cols: 4, rows: 4 },
  { value: '6x3', label: '6×3', cols: 6, rows: 3 },
  { value: '6x4', label: '6×4', cols: 6, rows: 4 },
];

export interface AutoGridResult {
  cols: number;
  rows: number;
  tier: DeviceTier;
  profileKey: LayoutProfileKey;
  maxCols: number;
  fillViewport: boolean;
  minRowHeightPx: number;
}

export function getDeviceTier(width: number): DeviceTier {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop';
  if (width < 2560) return 'fhd';
  if (width < 3840) return 'qhd';
  return 'uhd';
}

export function getLayoutProfileKey(tier: DeviceTier): LayoutProfileKey {
  if (tier === 'mobile') return 'mobile';
  if (tier === 'tablet') return 'tablet';
  if (tier === 'desktop') return 'desktop';
  return 'led_wall';
}

export function getMaxColsForTier(tier: DeviceTier, width: number, height: number): number {
  const aspect = height > 0 ? width / height : 1.77;
  const isUltraWide = aspect >= 2.2 && width >= 1920;

  let baseMax = 1;
  switch (tier) {
    case 'mobile':
      baseMax = 1;
      break;
    case 'tablet':
      baseMax = 2;
      break;
    case 'desktop':
      baseMax = 3;
      break;
    case 'fhd':
      baseMax = 4;
      break;
    case 'qhd':
      baseMax = 5;
      break;
    case 'uhd':
      baseMax = 6;
      break;
  }

  if (isUltraWide) {
    return Math.min(6, baseMax + 1);
  }
  return baseMax;
}

/**
 * Computes optimal (cols, rows) given container width/height and active screen count.
 */
export function computeAutoGrid(
  width: number,
  height: number,
  screenCount: number,
  preset: GridPreset = 'auto'
): AutoGridResult {
  const safeWidth = Math.max(320, width || 1280);
  const safeHeight = Math.max(240, height || 720);
  const tier = getDeviceTier(safeWidth);
  const profileKey = getLayoutProfileKey(tier);
  const maxCols = getMaxColsForTier(tier, safeWidth, safeHeight);
  const count = Math.max(0, screenCount);

  if (preset !== 'auto') {
    const matched = GRID_PRESET_OPTIONS.find((p) => p.value === preset);
    if (matched?.cols && matched?.rows) {
      const cols = matched.cols;
      const neededRows = Math.max(matched.rows, Math.ceil(Math.max(1, count) / cols));
      const rowHeight = safeHeight / neededRows;
      const fillViewport = neededRows <= matched.rows && rowHeight >= 150;
      return {
        cols,
        rows: neededRows,
        tier,
        profileKey,
        maxCols,
        fillViewport,
        minRowHeightPx: tier === 'mobile' ? 220 : 190,
      };
    }
  }

  if (count <= 1) {
    return {
      cols: 1,
      rows: 1,
      tier,
      profileKey,
      maxCols,
      fillViewport: true,
      minRowHeightPx: 260,
    };
  }

  // Mobile (< 640px): single-column compact stack
  if (tier === 'mobile') {
    return {
      cols: 1,
      rows: count,
      tier,
      profileKey,
      maxCols: 1,
      fillViewport: false,
      minRowHeightPx: 220,
    };
  }

  // Portrait-oriented larger screen (e.g. rotated vertical monitor / portrait tablet)
  const aspect = safeWidth / safeHeight;
  if (aspect < 0.95) {
    const portraitCols = tier === 'tablet' ? Math.min(2, count) : Math.min(2, maxCols, count);
    const portraitRows = Math.ceil(count / portraitCols);
    const rowH = safeHeight / portraitRows;
    return {
      cols: portraitCols,
      rows: portraitRows,
      tier,
      profileKey,
      maxCols: portraitCols,
      fillViewport: rowH >= 180,
      minRowHeightPx: 210,
    };
  }

  // Tablet (640px - 1023px): up to 2 columns
  if (tier === 'tablet') {
    const cols = 2;
    const rows = Math.ceil(count / cols);
    return {
      cols,
      rows,
      tier,
      profileKey,
      maxCols: 2,
      fillViewport: count <= 4 && safeHeight / rows >= 170,
      minRowHeightPx: 210,
    };
  }

  // Ultra-wide LED Wall optimization (e.g. 32:9 dual-display wall)
  if (aspect >= 2.2 && count <= maxCols) {
    return {
      cols: count,
      rows: 1,
      tier,
      profileKey,
      maxCols,
      fillViewport: true,
      minRowHeightPx: 200,
    };
  }

  // Canonical balanced matrix for Desktop / FHD / QHD / UHD LED Walls
  let cols: number;
  if (count === 2) {
    cols = 2;
  } else if (count === 3) {
    cols = Math.min(3, maxCols);
  } else if (count === 4) {
    cols = 2;
  } else if (count <= 6) {
    cols = Math.min(3, maxCols);
  } else if (count <= 8) {
    cols = Math.min(4, maxCols);
  } else if (count === 9) {
    cols = Math.min(3, maxCols);
  } else if (count <= 12) {
    cols = Math.min(4, maxCols);
  } else if (count <= 15) {
    cols = Math.min(5, maxCols);
  } else if (count === 16) {
    cols = Math.min(4, maxCols);
  } else if (count <= 18) {
    cols = Math.min(6, maxCols);
  } else if (count <= 20) {
    cols = Math.min(5, maxCols);
  } else {
    cols = maxCols;
  }

  cols = Math.max(1, Math.min(cols, count, maxCols));
  const rows = Math.ceil(count / cols);
  const perRowHeight = safeHeight / rows;
  const fillViewport = perRowHeight >= 165;

  return {
    cols,
    rows,
    tier,
    profileKey,
    maxCols,
    fillViewport,
    minRowHeightPx: 190,
  };
}

export function normalizeWebLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isValidWebLink(raw: string): boolean {
  const normalized = normalizeWebLink(raw);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname) &&
      (parsed.hostname.includes('.') || parsed.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

export function getDisplayHost(urlStr: string): string {
  try {
    const parsed = new URL(normalizeWebLink(urlStr));
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.trim() || 'screen';
  }
}
