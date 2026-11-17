'use client';

import {
  PMTiles,
  Protocol,
  SharedPromiseCache,
  type Source,
  type RangeResponse,
  type Entry,
} from 'pmtiles';

const IDB_NAME = 'pdrrmo_hazard_pmtiles_v1';
const IDB_VERSION = 1;
const STORE_RANGES = 'ranges';
const STORE_META = 'meta';
const ARCHIVE_KEY = 'cebu-noah';
const ARCHIVE_ENDPOINT = '/api/geo/cebu-noah';
const MAX_L1_ENTRIES = 320;
const BATCH_PRECACHE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB contiguous batch slice

export const HAZARD_CACHE_UPDATED_EVENT = 'pdrrmo:hazard-cache-updated';

export interface HazardCacheStats {
  cachedTileCount: number;
  totalTileCount: number;
  cachedBytes: number;
  isFullyCached: boolean;
}

interface StoredRangeRecord {
  key: string;
  data: ArrayBuffer;
  size: number;
  etag?: string;
}

interface StoredMetaRecord {
  key: string;
  value: unknown;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openHazardIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RANGES)) {
          db.createObjectStore(STORE_RANGES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbGetRange(key: string): Promise<StoredRangeRecord | null> {
  const db = await openHazardIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readonly');
      const store = tx.objectStore(STORE_RANGES);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as StoredRangeRecord) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPutRange(record: StoredRangeRecord): Promise<void> {
  const db = await openHazardIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readwrite');
      const store = tx.objectStore(STORE_RANGES);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbPutRangesBatch(records: StoredRangeRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openHazardIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readwrite');
      const store = tx.objectStore(STORE_RANGES);
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAllRangeKeys(): Promise<Set<string>> {
  const db = await openHazardIdb();
  if (!db) return new Set();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RANGES, 'readonly');
      const store = tx.objectStore(STORE_RANGES);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = Array.isArray(req.result) ? req.result.map(String) : [];
        resolve(new Set(keys));
      };
      req.onerror = () => resolve(new Set());
    } catch {
      resolve(new Set());
    }
  });
}

async function idbGetMeta<T>(key: string): Promise<T | null> {
  const db = await openHazardIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(key);
      req.onsuccess = () => {
        const res = req.result as StoredMetaRecord | undefined;
        resolve(res ? (res.value as T) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetMeta(key: string, value: unknown): Promise<void> {
  const db = await openHazardIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function notifyCacheUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HAZARD_CACHE_UPDATED_EVENT));
  }
}

/**
 * Custom PMTiles v3 Source backed by a 2-tier cache:
 * - L1: In-memory Map for instantaneous sub-millisecond reads during the active session
 * - L2: IndexedDB persistent byte-range store that survives browser closes and F5 refreshes
 */
export class IndexedDbPmtilesSource implements Source {
  private l1Cache = new Map<string, RangeResponse>();
  private inflight = new Map<string, Promise<RangeResponse>>();
  private currentEtag: string | undefined;

  getKey(): string {
    return ARCHIVE_KEY;
  }

  private setL1(key: string, value: RangeResponse, isPinnedHeader = false) {
    if (!isPinnedHeader && this.l1Cache.size >= MAX_L1_ENTRIES) {
      const firstKey = this.l1Cache.keys().next().value;
      if (firstKey && !firstKey.startsWith('range:0:') && !firstKey.startsWith('range:127:')) {
        this.l1Cache.delete(firstKey);
      }
    }
    this.l1Cache.set(key, value);
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string
  ): Promise<RangeResponse> {
    const key = `range:${offset}:${length}`;
    const isHeaderOrRootDir = offset < 16384;

    // 1. Check L1 RAM Cache (0ms)
    const l1Hit = this.l1Cache.get(key);
    if (l1Hit) {
      return {
        data: l1Hit.data.slice(0),
        etag: l1Hit.etag ?? this.currentEtag,
        cacheControl: l1Hit.cacheControl,
        expires: l1Hit.expires,
      };
    }

    // 2. Check L2 IndexedDB Persistent Cache (~1-2ms, survives browser close & F5)
    const idbHit = await idbGetRange(key);
    if (idbHit && idbHit.data && idbHit.data.byteLength === length) {
      const response: RangeResponse = {
        data: idbHit.data,
        etag: idbHit.etag ?? etag ?? this.currentEtag,
        cacheControl: 'public, max-age=31536000, immutable',
      };
      this.setL1(key, response, isHeaderOrRootDir);
      return {
        data: response.data.slice(0),
        etag: response.etag,
        cacheControl: response.cacheControl,
      };
    }

    // 3. Deduplicate concurrent network range requests
    const existingInflight = this.inflight.get(key);
    if (existingInflight) {
      const shared = await existingInflight;
      return {
        data: shared.data.slice(0),
        etag: shared.etag,
        cacheControl: shared.cacheControl,
      };
    }

    const fetchPromise = (async (): Promise<RangeResponse> => {
      const end = offset + length - 1;
      const res = await fetch(ARCHIVE_ENDPOINT, {
        method: 'GET',
        headers: {
          Range: `bytes=${offset}-${end}`,
        },
        signal,
      });

      if (!res.ok && res.status !== 206) {
        throw new Error(`PMTiles range fetch failed (${res.status}) for bytes=${offset}-${end}`);
      }

      const buf = await res.arrayBuffer();
      const responseEtag = res.headers.get('etag') ?? etag ?? this.currentEtag;
      if (responseEtag) {
        this.currentEtag = responseEtag;
      }

      const rangeRes: RangeResponse = {
        data: buf,
        etag: responseEtag,
        cacheControl: res.headers.get('cache-control') ?? undefined,
      };

      this.setL1(key, rangeRes, isHeaderOrRootDir);

      // Persist asynchronously to IndexedDB so future refreshes/sessions never re-fetch this tile
      void idbPutRange({
        key,
        data: buf,
        size: buf.byteLength,
        etag: responseEtag,
      }).then(() => {
        notifyCacheUpdated();
      });

      return rangeRes;
    })();

    this.inflight.set(key, fetchPromise);
    try {
      const result = await fetchPromise;
      return {
        data: result.data.slice(0),
        etag: result.etag,
        cacheControl: result.cacheControl,
      };
    } finally {
      this.inflight.delete(key);
    }
  }

  public primeRangeInMemory(offset: number, length: number, data: ArrayBuffer, etag?: string) {
    const key = `range:${offset}:${length}`;
    this.setL1(
      key,
      {
        data,
        etag: etag ?? this.currentEtag,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      offset < 16384
    );
  }
}

// Singleton instances for the client session
let singletonSource: IndexedDbPmtilesSource | null = null;
let singletonCache: SharedPromiseCache | null = null;
let singletonPmtiles: PMTiles | null = null;
let singletonProtocol: Protocol | null = null;
let cachedDirectoryEntries: Entry[] | null = null;

export function getCebuNoahPmtiles(): {
  source: IndexedDbPmtilesSource;
  pmtiles: PMTiles;
  protocol: Protocol;
  cache: SharedPromiseCache;
} {
  if (!singletonSource) {
    singletonSource = new IndexedDbPmtilesSource();
  }
  if (!singletonCache) {
    singletonCache = new SharedPromiseCache(128);
  }
  if (!singletonPmtiles) {
    singletonPmtiles = new PMTiles(singletonSource, singletonCache);
  }
  if (!singletonProtocol) {
    singletonProtocol = new Protocol({ metadata: false, errorOnMissingTile: false });
    singletonProtocol.add(singletonPmtiles);
  }
  return {
    source: singletonSource,
    pmtiles: singletonPmtiles,
    protocol: singletonProtocol,
    cache: singletonCache,
  };
}

/**
 * Loads and caches the 3,937 directory entries from the PMTiles root directory (10,489 bytes).
 */
export async function getCebuNoahDirectoryEntries(): Promise<Entry[]> {
  if (cachedDirectoryEntries) return cachedDirectoryEntries;
  const { source, pmtiles, cache } = getCebuNoahPmtiles();
  const header = await pmtiles.getHeader();
  const entries = await cache.getDirectory(
    source,
    header.rootDirectoryOffset,
    header.rootDirectoryLength,
    header
  );
  cachedDirectoryEntries = entries;
  return entries;
}

/**
 * Returns live statistics on how many of the 3,937 Cebu NOAH hazard tiles are stored in IndexedDB.
 */
export async function getHazardCacheStats(): Promise<HazardCacheStats> {
  try {
    const [entries, keys, fullFlag] = await Promise.all([
      getCebuNoahDirectoryEntries().catch(() => [] as Entry[]),
      idbGetAllRangeKeys(),
      idbGetMeta<boolean>('isFullyCached'),
    ]);

    const totalTileCount = entries.length || 3937;
    let cachedTileCount = 0;
    let cachedBytes = 0;

    if (entries.length > 0) {
      for (const entry of entries) {
        const key = `range:${entry.offset}:${entry.length}`;
        if (keys.has(key)) {
          cachedTileCount += 1;
          cachedBytes += entry.length;
        }
      }
    } else {
      // Fallback estimate from keys
      cachedTileCount = Math.max(0, keys.size - 2);
    }

    const isFullyCached =
      Boolean(fullFlag) || (totalTileCount > 0 && cachedTileCount >= totalTileCount);

    return {
      cachedTileCount,
      totalTileCount,
      cachedBytes,
      isFullyCached,
    };
  } catch {
    return {
      cachedTileCount: 0,
      totalTileCount: 3937,
      cachedBytes: 0,
      isFullyCached: false,
    };
  }
}

/**
 * Silently pre-warms the low-zoom overview tiles (zooms 0..8) in IndexedDB so initial
 * province-wide rendering and zooming are instantaneous across reloads.
 */
export async function prewarmOverviewHazardTiles(): Promise<void> {
  try {
    const entries = await getCebuNoahDirectoryEntries();
    const keys = await idbGetAllRangeKeys();
    // Hilbert tileId < 21845 covers zoom 0..7 overview tiles across Cebu
    const overviewMissing = entries.filter(
      (e) => e.tileId < 21845 && !keys.has(`range:${e.offset}:${e.length}`)
    );
    if (overviewMissing.length === 0) return;

    await downloadAndStoreEntriesInBatches(overviewMissing);
  } catch {
    // Ignore background pre-warm errors
  }
}

async function downloadAndStoreEntriesInBatches(
  missingEntries: Entry[],
  onProgress?: (doneTiles: number, totalMissing: number, bytesDownloaded: number) => void,
  signal?: AbortSignal
): Promise<void> {
  // Sort by physical offset so contiguous tiles are combined into fast 2 MB range reads
  const sorted = [...missingEntries].sort((a, b) => a.offset - b.offset);
  const { source } = getCebuNoahPmtiles();

  let i = 0;
  let completed = 0;
  let downloadedBytes = 0;

  while (i < sorted.length) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const batch: Entry[] = [sorted[i]];
    const batchStart = sorted[i].offset;
    let batchEnd = sorted[i].offset + sorted[i].length - 1;
    i += 1;

    while (i < sorted.length) {
      const next = sorted[i];
      const nextEnd = next.offset + next.length - 1;
      const gap = next.offset - (batchEnd + 1);
      // Merge into the same HTTP Range request if contiguous (gap <= 4096) and total <= 2 MB
      if (gap <= 4096 && nextEnd - batchStart + 1 <= BATCH_PRECACHE_MAX_BYTES) {
        batch.push(next);
        batchEnd = Math.max(batchEnd, nextEnd);
        i += 1;
      } else {
        break;
      }
    }

    const res = await fetch(ARCHIVE_ENDPOINT, {
      method: 'GET',
      headers: {
        Range: `bytes=${batchStart}-${batchEnd}`,
      },
      signal,
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(`Batch range request failed (${res.status})`);
    }

    const batchBuffer = await res.arrayBuffer();
    const etag = res.headers.get('etag') ?? undefined;
    const recordsToPut: StoredRangeRecord[] = [];

    for (const entry of batch) {
      const relStart = entry.offset - batchStart;
      const relEnd = relStart + entry.length;
      if (relStart >= 0 && relEnd <= batchBuffer.byteLength) {
        const slice = batchBuffer.slice(relStart, relEnd);
        recordsToPut.push({
          key: `range:${entry.offset}:${entry.length}`,
          data: slice,
          size: slice.byteLength,
          etag,
        });
        source.primeRangeInMemory(entry.offset, entry.length, slice, etag);
        downloadedBytes += slice.byteLength;
      }
    }

    await idbPutRangesBatch(recordsToPut);
    completed += batch.length;
    onProgress?.(completed, sorted.length, downloadedBytes);
    notifyCacheUpdated();
  }
}

/**
 * Downloads and stores all remaining Cebu NOAH hazard tiles (up to 3,937 tiles) in IndexedDB
 * so the entire province renders 100% from local disk storage even after closing the browser.
 */
export async function precacheAllCebuHazardTiles(
  onProgress?: (stats: {
    cachedTileCount: number;
    totalTileCount: number;
    cachedBytes: number;
    percent: number;
  }) => void,
  signal?: AbortSignal
): Promise<HazardCacheStats> {
  const entries = await getCebuNoahDirectoryEntries();
  const existingKeys = await idbGetAllRangeKeys();

  let alreadyCachedCount = 0;
  let alreadyCachedBytes = 0;
  const missing: Entry[] = [];

  for (const entry of entries) {
    const key = `range:${entry.offset}:${entry.length}`;
    if (existingKeys.has(key)) {
      alreadyCachedCount += 1;
      alreadyCachedBytes += entry.length;
    } else {
      missing.push(entry);
    }
  }

  const totalTileCount = entries.length;

  if (missing.length === 0) {
    await idbSetMeta('isFullyCached', true);
    const doneStats: HazardCacheStats = {
      cachedTileCount: totalTileCount,
      totalTileCount,
      cachedBytes: alreadyCachedBytes,
      isFullyCached: true,
    };
    onProgress?.({
      ...doneStats,
      percent: 100,
    });
    notifyCacheUpdated();
    return doneStats;
  }

  await downloadAndStoreEntriesInBatches(
    missing,
    (newlyDone, _totalMissing, newlyBytes) => {
      const currentCount = alreadyCachedCount + newlyDone;
      const currentBytes = alreadyCachedBytes + newlyBytes;
      const percent = Math.min(100, Math.round((currentCount / totalTileCount) * 100));
      onProgress?.({
        cachedTileCount: currentCount,
        totalTileCount,
        cachedBytes: currentBytes,
        percent,
      });
    },
    signal
  );

  await idbSetMeta('isFullyCached', true);
  notifyCacheUpdated();
  return getHazardCacheStats();
}

export async function clearHazardMapTileCache(): Promise<void> {
  const db = await openHazardIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([STORE_RANGES, STORE_META], 'readwrite');
      tx.objectStore(STORE_RANGES).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  if (singletonSource) {
    singletonSource = new IndexedDbPmtilesSource();
  }
  notifyCacheUpdated();
}
