import crypto from 'crypto';

export interface B2StoredFile {
  fileId: string;
  fileName: string;
  contentLength: number;
  contentSha1: string;
  contentType: string;
  uploadTimestamp: number;
}

export interface B2VaultStatus {
  configured: boolean;
  connected: boolean;
  bucketName: string;
  bucketId: string;
  totalFiles: number;
  totalBytes: number;
  quotaBytes: number;
  files: B2StoredFile[];
  errorMessage?: string;
}

interface B2AuthSession {
  accountId: string;
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  allowedBucketId: string | null;
  allowedBucketName: string | null;
  expiresAt: number;
}

const B2_FREE_TIER_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB Free Tier
const AUTH_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

let cachedAuthSession: B2AuthSession | null = null;
let cachedResolvedBucket: { bucketId: string; bucketName: string } | null = null;

function getB2Env() {
  const stripQuotes = (v: string) => v.trim().replace(/^["']|["']$/g, '');
  const keyId = stripQuotes(process.env.B2_KEY_ID || '');
  const applicationKey = stripQuotes(process.env.B2_APPLICATION_KEY || '');
  const bucketId = stripQuotes(process.env.B2_BUCKET_ID || '');
  const bucketName = stripQuotes(process.env.B2_BUCKET_NAME || '');

  return {
    keyId,
    applicationKey,
    bucketId,
    bucketName,
    isConfigured: Boolean(keyId && applicationKey && (bucketId || bucketName)),
  };
}

export function isBackblazeConfigured(): boolean {
  return getB2Env().isConfigured;
}

export async function authorizeB2Account(forceRefresh = false): Promise<B2AuthSession> {
  if (
    !forceRefresh &&
    cachedAuthSession &&
    Date.now() < cachedAuthSession.expiresAt
  ) {
    return cachedAuthSession;
  }

  const { keyId, applicationKey } = getB2Env();
  if (!keyId || !applicationKey) {
    throw new Error(
      'Backblaze B2 credentials are not configured. Set B2_KEY_ID and B2_APPLICATION_KEY in your environment.'
    );
  }

  if (!applicationKey.startsWith('K') && applicationKey.includes('-')) {
    throw new Error(
      `B2_APPLICATION_KEY ("${applicationKey}") looks like your Key Name (keyName) instead of the secret Application Key. In Backblaze B2 -> Application Keys, click "Add a New Application Key" and copy the secret "applicationKey" (starts with "K00...") from the blue banner.`
    );
  }

  const basicAuth = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
  const res = await fetch(
    'https://api.backblazeb2.com/b2api/v3/b2_authorize_account',
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson.message || errJson.code || detail;
    } catch {}
    throw new Error(
      `Backblaze B2 authorization failed (${detail}). Verify that B2_KEY_ID is your keyID and B2_APPLICATION_KEY is the secret applicationKey (starts with "K00..."), not the keyName.`
    );
  }

  const data = await res.json();
  const apiInfo = data.apiInfo?.storageApi || data;

  const session: B2AuthSession = {
    accountId: data.accountId,
    authorizationToken: data.authorizationToken,
    apiUrl: apiInfo.apiUrl || data.apiUrl,
    downloadUrl: apiInfo.downloadUrl || data.downloadUrl,
    allowedBucketId:
      apiInfo.bucketId || apiInfo.allowed?.bucketId || data.allowed?.bucketId || null,
    allowedBucketName:
      apiInfo.bucketName || apiInfo.allowed?.bucketName || data.allowed?.bucketName || null,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  };

  cachedAuthSession = session;
  return session;
}

export async function resolveB2Bucket(
  session: B2AuthSession
): Promise<{ bucketId: string; bucketName: string }> {
  const env = getB2Env();

  if (env.bucketId && env.bucketName) {
    return { bucketId: env.bucketId, bucketName: env.bucketName };
  }

  if (session.allowedBucketId && session.allowedBucketName) {
    return {
      bucketId: session.allowedBucketId,
      bucketName: session.allowedBucketName,
    };
  }

  if (cachedResolvedBucket) {
    return cachedResolvedBucket;
  }

  const res = await fetch(`${session.apiUrl}/b2api/v3/b2_list_buckets`, {
    method: 'POST',
    headers: {
      Authorization: session.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: session.accountId,
      ...(env.bucketId ? { bucketId: env.bucketId } : {}),
      ...(env.bucketName ? { bucketName: env.bucketName } : {}),
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(
      'Could not resolve Backblaze B2 bucket. Please provide both B2_BUCKET_ID and B2_BUCKET_NAME in environment variables.'
    );
  }

  const data = await res.json();
  const buckets = Array.isArray(data.buckets) ? data.buckets : [];
  const matched =
    buckets.find(
      (b: any) =>
        (env.bucketId && b.bucketId === env.bucketId) ||
        (env.bucketName && b.bucketName === env.bucketName)
    ) || buckets[0];

  if (!matched) {
    throw new Error('No matching Backblaze B2 bucket found on this account.');
  }

  cachedResolvedBucket = {
    bucketId: String(matched.bucketId),
    bucketName: String(matched.bucketName),
  };
  return cachedResolvedBucket;
}

function encodeB2FileName(fileName: string): string {
  return fileName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function uploadBufferToB2(params: {
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<B2StoredFile> {
  const { fileName, buffer, contentType = 'application/pdf' } = params;
  const sha1Hex = crypto.createHash('sha1').update(buffer).digest('hex');

  const attemptUpload = async (forceReauth = false): Promise<B2StoredFile> => {
    const session = await authorizeB2Account(forceReauth);
    const { bucketId } = await resolveB2Bucket(session);

    // 1. Obtain upload URL and token for the target private bucket
    const urlRes = await fetch(
      `${session.apiUrl}/b2api/v3/b2_get_upload_url`,
      {
        method: 'POST',
        headers: {
          Authorization: session.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId }),
        cache: 'no-store',
      }
    );

    if (!urlRes.ok) {
      if (!forceReauth && urlRes.status === 401) {
        return attemptUpload(true);
      }
      let errMsg = `HTTP ${urlRes.status}`;
      try {
        const j = await urlRes.json();
        errMsg = j.message || j.code || errMsg;
      } catch {}
      throw new Error(`Backblaze b2_get_upload_url failed: ${errMsg}`);
    }

    const { uploadUrl, authorizationToken: uploadAuthToken } =
      await urlRes.json();

    // 2. Upload file binary with SHA-1 verification
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: uploadAuthToken,
        'X-Bz-File-Name': encodeB2FileName(fileName),
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'X-Bz-Content-Sha1': sha1Hex,
      },
      body: new Uint8Array(buffer),
      cache: 'no-store',
    });

    if (!uploadRes.ok) {
      if (!forceReauth && (uploadRes.status === 401 || uploadRes.status === 503)) {
        return attemptUpload(true);
      }
      let errMsg = `HTTP ${uploadRes.status}`;
      try {
        const j = await uploadRes.json();
        errMsg = j.message || j.code || errMsg;
      } catch {}
      throw new Error(`Backblaze b2_upload_file failed: ${errMsg}`);
    }

    const uploaded = await uploadRes.json();
    return {
      fileId: String(uploaded.fileId),
      fileName: String(uploaded.fileName),
      contentLength: Number(uploaded.contentLength || buffer.byteLength),
      contentSha1: String(uploaded.contentSha1 || sha1Hex),
      contentType: String(uploaded.contentType || contentType),
      uploadTimestamp: Number(uploaded.uploadTimestamp || Date.now()),
    };
  };

  return attemptUpload(false);
}

export async function listB2ArchiveFiles(
  maxTotal = 2000
): Promise<{
  bucketId: string;
  bucketName: string;
  files: B2StoredFile[];
}> {
  const fetchPage = async (
    forceReauth = false
  ): Promise<{ bucketId: string; bucketName: string; files: B2StoredFile[] }> => {
    const session = await authorizeB2Account(forceReauth);
    const { bucketId, bucketName } = await resolveB2Bucket(session);

    const allFiles: B2StoredFile[] = [];
    let startFileName: string | null = null;
    let startFileId: string | null = null;

    while (allFiles.length < maxTotal) {
      const batchSize = Math.min(1000, maxTotal - allFiles.length);
      const res: Response = await fetch(`${session.apiUrl}/b2api/v3/b2_list_file_versions`, {
        method: 'POST',
        headers: {
          Authorization: session.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId,
          maxFileCount: batchSize,
          ...(startFileName ? { startFileName } : {}),
          ...(startFileId ? { startFileId } : {}),
        }),
        cache: 'no-store',
      });

      if (!res.ok) {
        if (!forceReauth && res.status === 401) {
          return fetchPage(true);
        }
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          errMsg = j.message || j.code || errMsg;
        } catch {}
        throw new Error(`Backblaze b2_list_file_versions failed: ${errMsg}`);
      }

      const data = (await res.json()) as {
        files?: any[];
        nextFileName?: string | null;
        nextFileId?: string | null;
      };
      const rawFiles = Array.isArray(data.files) ? data.files : [];

      for (const f of rawFiles) {
        if (f.action === 'upload' && !String(f.fileName).endsWith('/.bzEmpty')) {
          allFiles.push({
            fileId: String(f.fileId),
            fileName: String(f.fileName),
            contentLength: Number(f.contentLength || 0),
            contentSha1: String(f.contentSha1 || ''),
            contentType: String(f.contentType || 'application/pdf'),
            uploadTimestamp: Number(f.uploadTimestamp || Date.now()),
          });
        }
      }

      if (!data.nextFileName) break;
      startFileName = String(data.nextFileName);
      startFileId = data.nextFileId ? String(data.nextFileId) : null;
    }

    allFiles.sort((a, b) => b.uploadTimestamp - a.uploadTimestamp);
    return { bucketId, bucketName, files: allFiles };
  };

  return fetchPage(false);
}

export async function findExistingB2File(
  fileName: string,
  sha1Hex?: string
): Promise<B2StoredFile | null> {
  const { files } = await listB2ArchiveFiles();
  const normalizedTarget = fileName.trim().toLowerCase();

  const matchByName = files.find(
    (f) => f.fileName.trim().toLowerCase() === normalizedTarget
  );
  if (matchByName) return matchByName;

  if (sha1Hex) {
    const normalizedSha = sha1Hex.trim().toLowerCase();
    const matchBySha = files.find(
      (f) => f.contentSha1.trim().toLowerCase() === normalizedSha
    );
    if (matchBySha) return matchBySha;
  }

  return null;
}

export async function getB2VaultStatus(): Promise<B2VaultStatus> {
  const env = getB2Env();
  if (!env.isConfigured) {
    return {
      configured: false,
      connected: false,
      bucketName: env.bucketName || 'Not Configured',
      bucketId: env.bucketId || '',
      totalFiles: 0,
      totalBytes: 0,
      quotaBytes: B2_FREE_TIER_QUOTA_BYTES,
      files: [],
      errorMessage:
        'Add B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, and B2_BUCKET_NAME to .env.local to connect Backblaze B2.',
    };
  }

  try {
    const { bucketId, bucketName, files } = await listB2ArchiveFiles(2000);
    const totalBytes = files.reduce((sum, f) => sum + f.contentLength, 0);

    return {
      configured: true,
      connected: true,
      bucketName,
      bucketId,
      totalFiles: files.length,
      totalBytes,
      quotaBytes: B2_FREE_TIER_QUOTA_BYTES,
      files,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unable to connect to Backblaze B2.';
    return {
      configured: true,
      connected: false,
      bucketName: env.bucketName || 'Backblaze B2 Vault',
      bucketId: env.bucketId || '',
      totalFiles: 0,
      totalBytes: 0,
      quotaBytes: B2_FREE_TIER_QUOTA_BYTES,
      files: [],
      errorMessage: msg,
    };
  }
}

export async function downloadFileFromB2(fileName: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const session = await authorizeB2Account(false);
  const { bucketName } = await resolveB2Bucket(session);
  const encodedPath = encodeB2FileName(fileName);

  const res = await fetch(
    `${session.downloadUrl}/file/${encodeURIComponent(bucketName)}/${encodedPath}`,
    {
      method: 'GET',
      headers: {
        Authorization: session.authorizationToken,
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error(`Backblaze download failed with status ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    contentType: res.headers.get('content-type') || 'application/pdf',
  };
}
