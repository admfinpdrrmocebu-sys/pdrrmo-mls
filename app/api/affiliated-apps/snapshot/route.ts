import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'affiliated-apps';

function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.localhost')
  ) {
    return true;
  }

  // IPv4 private/loopback/link-local check
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, aStr, bStr] = ipv4Match;
    const a = Number(aStr);
    const b = Number(bStr);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    ) {
      return true;
    }
  }

  return false;
}

function normalizeTargetUrl(rawUrl: string): URL {
  let trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// web app links are supported.');
  }
  return parsed;
}

interface CaptureResult {
  buffer: Uint8Array;
  contentType: string;
  ext: 'png' | 'jpg' | 'webp';
  suggestedTitle?: string;
}

function resolveExtFromMime(mime: string): { contentType: string; ext: 'png' | 'jpg' | 'webp' } {
  const clean = mime.toLowerCase();
  if (clean.includes('webp')) return { contentType: 'image/webp', ext: 'webp' };
  if (clean.includes('jpeg') || clean.includes('jpg')) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  return { contentType: 'image/png', ext: 'png' };
}

/**
 * Tier 1: Microlink Headless Chromium Screenshot Service
 */
async function captureViaMicrolink(targetUrl: string): Promise<CaptureResult | null> {
  try {
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(
      targetUrl
    )}&screenshot=true&meta=true&viewport.width=1280&viewport.height=800`;

    const metaRes = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(16000),
      cache: 'no-store',
    });

    if (!metaRes.ok) return null;

    const payload = await metaRes.json();
    const screenshotUrl: string | undefined = payload?.data?.screenshot?.url;
    const suggestedTitle: string | undefined =
      typeof payload?.data?.title === 'string' ? payload.data.title.trim() : undefined;

    if (!screenshotUrl) return null;

    const imgRes = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(14000),
      cache: 'no-store',
    });

    if (!imgRes.ok) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    if (arrayBuffer.byteLength < 1024) return null;

    const mime = imgRes.headers.get('content-type') || 'image/png';
    const { contentType, ext } = resolveExtFromMime(mime);

    return {
      buffer: new Uint8Array(arrayBuffer),
      contentType,
      ext,
      suggestedTitle,
    };
  } catch {
    return null;
  }
}

/**
 * Tier 2: Thum.io Live Webpage Renderer Fallback
 */
async function captureViaThumIo(targetUrl: string): Promise<CaptureResult | null> {
  try {
    const endpoint = `https://image.thum.io/get/width/1280/crop/800/noanimate/${targetUrl}`;
    const imgRes = await fetch(endpoint, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });

    if (!imgRes.ok) return null;
    const mime = imgRes.headers.get('content-type') || '';
    if (!mime.toLowerCase().startsWith('image/')) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    if (arrayBuffer.byteLength < 1024) return null;

    const { contentType, ext } = resolveExtFromMime(mime);
    return {
      buffer: new Uint8Array(arrayBuffer),
      contentType,
      ext,
    };
  } catch {
    return null;
  }
}

/**
 * Tier 3: OpenGraph (og:image / twitter:image) Meta Tag Fallback
 */
async function captureViaOpenGraph(targetUrl: string): Promise<CaptureResult | null> {
  try {
    const htmlRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const suggestedTitle = titleMatch?.[1]?.trim();

    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

    const rawImgUrl = ogMatch?.[1]?.trim();
    if (!rawImgUrl) return null;

    const resolvedImgUrl = new URL(rawImgUrl, targetUrl);
    if (isPrivateOrLocalHost(resolvedImgUrl.hostname)) return null;

    const imgRes = await fetch(resolvedImgUrl.toString(), {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (!imgRes.ok) return null;
    const mime = imgRes.headers.get('content-type') || '';
    if (!mime.toLowerCase().startsWith('image/')) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    if (arrayBuffer.byteLength < 512) return null;

    const { contentType, ext } = resolveExtFromMime(mime);
    return {
      buffer: new Uint8Array(arrayBuffer),
      contentType,
      ext,
      suggestedTitle,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/affiliated-apps/snapshot
 * Captures a live screenshot of an Affiliated App URL and stores it permanently
 * as an image file inside the Supabase 'affiliated-apps' storage bucket.
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session.' }, { status: 401 });
    }

    const body = await request.json();
    const rawUrl = typeof body?.url === 'string' ? body.url : '';
    const previousStoragePath =
      typeof body?.previousStoragePath === 'string' && body.previousStoragePath.trim()
        ? body.previousStoragePath.trim()
        : null;

    if (!rawUrl.trim()) {
      return NextResponse.json({ error: 'Please provide an App Link URL.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = normalizeTargetUrl(rawUrl);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || 'Invalid App Link URL format.' },
        { status: 400 }
      );
    }

    if (isPrivateOrLocalHost(parsedUrl.hostname)) {
      return NextResponse.json(
        {
          error:
            'Local or private network URLs cannot be snapped remotely. Please upload a custom picture below.',
          code: 'PRIVATE_NETWORK_URL',
        },
        { status: 422 }
      );
    }

    const normalizedUrl = parsedUrl.toString();

    // Attempt multi-tier live webpage snapshot
    const captured =
      (await captureViaMicrolink(normalizedUrl)) ||
      (await captureViaThumIo(normalizedUrl)) ||
      (await captureViaOpenGraph(normalizedUrl));

    if (!captured) {
      return NextResponse.json(
        {
          error:
            'Unable to automatically snap a preview from this link right now. You can upload a picture manually or try re-snapping.',
          code: 'SNAPSHOT_UNAVAILABLE',
        },
        { status: 502 }
      );
    }

    // Select storage client (prefer service role if configured so bucket auto-provisioning works seamlessly)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storageClient =
      serviceRoleKey && supabaseUrl
        ? createSupabaseClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : authClient;

    const safeHost = parsedUrl.hostname
      .replace(/[^a-z0-9-]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'web-app';

    const storagePath = `snapshots/${Date.now()}-${safeHost}.${captured.ext}`;

    let { error: uploadError } = await storageClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, captured.buffer, {
        contentType: captured.contentType,
        upsert: true,
      });

    // If bucket was not yet created and serviceRoleKey is available, auto-create once & retry
    if (
      uploadError &&
      serviceRoleKey &&
      /bucket.*not found/i.test(uploadError.message || '')
    ) {
      await storageClient.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      });

      const retryRes = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, captured.buffer, {
          contentType: captured.contentType,
          upsert: true,
        });
      uploadError = retryRes.error;
    }

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Failed to save snapshot to Supabase Storage: ${uploadError.message}. Ensure the 'affiliated-apps' bucket exists via the SQL migration.`,
        },
        { status: 500 }
      );
    }

    // Clean up temporary unsaved snapshot from earlier in the same modal session if provided
    if (previousStoragePath && previousStoragePath !== storagePath) {
      await storageClient.storage.from(BUCKET_NAME).remove([previousStoragePath]).catch(() => {});
    }

    const { data: publicUrlData } = storageClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      imageUrl: publicUrlData.publicUrl,
      storagePath,
      normalizedUrl,
      suggestedTitle: captured.suggestedTitle || null,
    });
  } catch (err: any) {
    console.error('Affiliated App snapshot API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error while snapping App Link.' },
      { status: 500 }
    );
  }
}
