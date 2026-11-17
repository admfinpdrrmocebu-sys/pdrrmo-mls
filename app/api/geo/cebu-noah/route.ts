import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PMTILES_FILE_PATH = path.join(process.cwd(), 'lib', 'geo', 'cebu_noah.pmtiles');
const MAX_SINGLE_RANGE_BYTES = 16 * 1024 * 1024; // 16 MB safety cap per range slice

interface FileMeta {
  size: number;
  etag: string;
}

let cachedMeta: FileMeta | null = null;

async function getPmtilesMeta(): Promise<FileMeta> {
  const stat = await fs.promises.stat(PMTILES_FILE_PATH);
  const etag = `"cebu-noah-${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  cachedMeta = { size: stat.size, etag };
  return cachedMeta;
}

/**
 * HEAD /api/geo/cebu-noah
 * Returns file size, ETag, and byte-range support headers for PMTiles v3 client.
 */
export async function HEAD() {
  try {
    const meta = cachedMeta ?? (await getPmtilesMeta());
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.pmtiles',
        'Content-Length': String(meta.size),
        'Accept-Ranges': 'bytes',
        ETag: meta.etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Hazard PMTiles archive not found at lib/geo/cebu_noah.pmtiles.' },
      { status: 404 }
    );
  }
}

/**
 * GET /api/geo/cebu-noah
 * Streams exact byte ranges (206 Partial Content) from lib/geo/cebu_noah.pmtiles.
 */
export async function GET(request: NextRequest) {
  try {
    const meta = cachedMeta ?? (await getPmtilesMeta());
    const rangeHeader = request.headers.get('range');

    // If no Range header is sent, return the initial 16 KB header + root directory slice
    let start = 0;
    let end = Math.min(16383, meta.size - 1);

    if (rangeHeader) {
      const match = /bytes=(\d+)-(\d*)/i.exec(rangeHeader);
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${meta.size}`,
          },
        });
      }

      start = parseInt(match[1], 10);
      end = match[2] ? parseInt(match[2], 10) : Math.min(start + MAX_SINGLE_RANGE_BYTES - 1, meta.size - 1);

      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 0 ||
        start >= meta.size ||
        end < start
      ) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${meta.size}`,
          },
        });
      }

      if (end >= meta.size) {
        end = meta.size - 1;
      }

      if (end - start + 1 > MAX_SINGLE_RANGE_BYTES) {
        end = start + MAX_SINGLE_RANGE_BYTES - 1;
      }
    }

    const length = end - start + 1;
    const buffer = Buffer.allocUnsafe(length);
    const fileHandle = await fs.promises.open(PMTILES_FILE_PATH, 'r');

    try {
      const { bytesRead } = await fileHandle.read(buffer, 0, length, start);
      const slice = bytesRead === length ? buffer : buffer.subarray(0, bytesRead);

      return new NextResponse(new Uint8Array(slice), {
        status: 206,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${start + slice.length - 1}/${meta.size}`,
          'Content-Length': String(slice.length),
          'Accept-Ranges': 'bytes',
          ETag: meta.etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } finally {
      await fileHandle.close();
    }
  } catch (err) {
    console.error('Error serving cebu_noah.pmtiles byte range:', err);
    return NextResponse.json(
      { error: 'Failed to read hazard map tile range.' },
      { status: 500 }
    );
  }
}
