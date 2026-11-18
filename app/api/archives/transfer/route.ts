import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getB2VaultStatus,
  uploadBufferToB2,
  downloadFileFromB2,
  findExistingB2File,
  isBackblazeConfigured,
} from '@/lib/backblaze-b2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null };
  }
  return { supabase, user };
}

/**
 * GET /api/archives/transfer
 * - ?action=status -> Returns Backblaze B2 configuration status, 10 GB quota usage, and stored files
 * - ?action=download&fileName=MLS/file.pdf -> Streams private PDF from Backblaze B2 to authenticated user
 */
export async function GET(request: NextRequest) {
  const { user } = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get('action') || 'status';

  if (action === 'download') {
    const fileName = request.nextUrl.searchParams.get('fileName') || '';
    if (!fileName) {
      return NextResponse.json(
        { error: 'Missing fileName parameter.' },
        { status: 400 }
      );
    }

    try {
      const { buffer, contentType } = await downloadFileFromB2(fileName);
      const baseName = fileName.split('/').pop() || 'archive.pdf';

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${baseName.replace(/"/g, '')}"`,
          'Content-Length': String(buffer.byteLength),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to download file from Backblaze B2.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const status = await getB2VaultStatus();
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

/**
 * POST /api/archives/transfer
 * Transfers a single archive PDF from Supabase Storage (or uploaded fallback Blob)
 * directly into the private Backblaze B2 bucket with SHA-1 verification.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isBackblazeConfigured()) {
    return NextResponse.json(
      {
        error:
          'Backblaze B2 is not configured yet. Add B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, and B2_BUCKET_NAME to your environment variables.',
      },
      { status: 400 }
    );
  }

  try {
    const contentTypeHeader = request.headers.get('content-type') || '';
    let storagePath = '';
    let filename = '';
    let category: 'log' | 'roll-call' = 'log';
    let fileBuffer: Buffer | null = null;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      storagePath = String(formData.get('storagePath') || '');
      filename = String(formData.get('filename') || '');
      category =
        formData.get('category') === 'roll-call' ? 'roll-call' : 'log';

      const uploadedBlob = formData.get('file');
      if (uploadedBlob && uploadedBlob instanceof Blob) {
        const arr = await uploadedBlob.arrayBuffer();
        fileBuffer = Buffer.from(arr);
      }
    } else {
      const body = await request.json();
      storagePath = String(body.storagePath || '');
      filename = String(body.filename || '');
      category = body.category === 'roll-call' ? 'roll-call' : 'log';
    }

    const cleanFilename = (filename || storagePath.split('/').pop() || 'archive.pdf')
      .replace(/^\/+/, '');
    const prefix = category === 'roll-call' ? 'RC' : 'MLS';
    const b2FileName = storagePath.startsWith('MLS/') || storagePath.startsWith('RC/')
      ? storagePath
      : `${prefix}/${cleanFilename.endsWith('.pdf') ? cleanFilename : `${cleanFilename}.pdf`}`;

    // Check live Backblaze B2 bucket FIRST before downloading from Supabase Storage
    const existingByName = await findExistingB2File(b2FileName);
    if (existingByName) {
      return NextResponse.json({
        ok: true,
        success: true,
        skipped: true,
        duplicate: true,
        uploaded: existingByName,
        message: `${b2FileName} already exists in Backblaze B2 (duplicate skipped).`,
      });
    }

    // If no raw binary was sent in the request, read directly from Supabase Storage server-side
    if (!fileBuffer && storagePath) {
      const { data: blobData, error: dlErr } = await supabase.storage
        .from('archive-documents')
        .download(storagePath);

      if (dlErr || !blobData) {
        return NextResponse.json(
          {
            error:
              dlErr?.message ||
              `Could not download ${storagePath} from Supabase Storage bucket.`,
          },
          { status: 404 }
        );
      }

      const arr = await blobData.arrayBuffer();
      fileBuffer = Buffer.from(arr);
    }

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Archive PDF binary is empty or missing.' },
        { status: 400 }
      );
    }

    // Secondary duplicate check by SHA-1 content digest across the B2 bucket
    const sha1Hex = crypto.createHash('sha1').update(fileBuffer).digest('hex');
    const existingByHash = await findExistingB2File(b2FileName, sha1Hex);
    if (existingByHash) {
      return NextResponse.json({
        ok: true,
        success: true,
        skipped: true,
        duplicate: true,
        uploaded: existingByHash,
        message: `${b2FileName} matches an identical file already stored in Backblaze B2 (duplicate skipped).`,
      });
    }

    const uploadedFile = await uploadBufferToB2({
      fileName: b2FileName,
      buffer: fileBuffer,
      contentType: 'application/pdf',
    });

    return NextResponse.json({
      ok: true,
      success: true,
      skipped: false,
      duplicate: false,
      uploaded: uploadedFile,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Backblaze B2 transfer failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
