/**
 * Google Drive Direct API Integration for PDRRMO MLS
 * Handles Google OAuth 2.0 token acquisition and direct multipart file uploads
 * straight into the user's Google Drive folder without local downloads.
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '118807822864-nqs65ghp6vn9ills9hadnsu7to3locdu.apps.googleusercontent.com';

// Full drive scope allows writing to both My Drive and Shared with me folders
const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive';

/**
 * Extracts the Google Drive Folder ID from standard Google Drive web URLs
 * e.g., https://drive.google.com/drive/folders/1ABC_123-xyz
 * e.g., https://drive.google.com/drive/u/0/folders/1ABC_123-xyz?usp=sharing
 */
export function extractGoogleDriveFolderId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();

  // Pattern: /folders/FOLDER_ID
  const folderMatch = clean.match(/\/folders\/([a-zA-Z0-9_\-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Pattern: id=FOLDER_ID
  const idMatch = clean.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // If the user pasted just the folder ID directly (standard 25-45 char alphanumeric)
  if (/^[a-zA-Z0-9_\-]{20,50}$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Loads the official Google Identity Services (GIS) client script
 */
export function loadGoogleIdentityServicesScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return resolve();
    }

    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }

    const existingScript = document.getElementById('google-gis-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Requests an OAuth 2.0 access token with Google Drive write scope using Google Identity Services
 */
export async function requestGoogleDriveAccessToken(options?: {
  clientId?: string;
  forcePrompt?: boolean;
}): Promise<string> {
  await loadGoogleIdentityServicesScript();

  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services SDK is not initialized.'));
    }

    const activeClientId = options?.clientId || GOOGLE_CLIENT_ID;
    if (!activeClientId) {
      return reject(
        new Error('Google Client ID is missing. Please configure NEXT_PUBLIC_GOOGLE_CLIENT_ID.')
      );
    }

    try {
      let isResolved = false;

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: GOOGLE_DRIVE_SCOPES,
        error_callback: (err: any) => {
          if (!isResolved) {
            isResolved = true;
            reject(
              new Error(
                err?.message || 'Google authentication was cancelled or the window was closed.'
              )
            );
          }
        },
        callback: (tokenResponse: any) => {
          if (isResolved) return;
          isResolved = true;
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }
          if (tokenResponse.access_token) {
            resolve(tokenResponse.access_token);
          } else {
            reject(new Error('No access token returned from Google authentication.'));
          }
        },
      });

      tokenClient.requestAccessToken({
        prompt: options?.forcePrompt ? 'consent' : '',
      });
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Finds or automatically creates a folder in the user's Google Drive by name
 */
export async function getOrCreateDriveFolder(
  accessToken: string,
  folderName = 'PDRRMO MLS Official Archives'
): Promise<{ id: string; name: string }> {
  try {
    // 1. Search for existing folder with this name in user's Drive or Shared Drives
    const query = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, name: data.files[0].name };
      }
    }

    // 2. Create folder if not found
    const createRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      }
    );

    if (createRes.ok) {
      const created = await createRes.json();
      return { id: created.id, name: created.name };
    }
  } catch (err) {
    console.warn('Could not search/create drive folder:', err);
  }

  return { id: '', name: folderName };
}

/**
 * Uploads a file Blob directly to Google Drive via multipart REST API
 * Supports Shared Folders, Shared Drives, and auto-recovery
 */
export async function uploadFileDirectlyToGoogleDrive(params: {
  accessToken: string;
  blob: Blob;
  filename: string;
  folderId?: string | null;
  fallbackFolderName?: string;
}): Promise<{ id: string; name: string; webViewLink?: string; parentFolderUsed?: string }> {
  const { accessToken, blob, filename, folderId, fallbackFolderName } = params;

  async function executeUpload(targetParentId?: string | null) {
    const metadata: Record<string, any> = {
      name: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      mimeType: 'application/pdf',
    };

    if (targetParentId) {
      metadata.parents = [targetParentId];
    }

    const boundary = '-------pdrrmo_mls_gdrive_upload_boundary_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const metadataString =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/pdf\r\n\r\n';

    const metadataBytes = new TextEncoder().encode(metadataString);
    const closeDelimiterBytes = new TextEncoder().encode(closeDelimiter);

    const combinedLength = metadataBytes.length + uint8Array.length + closeDelimiterBytes.length;
    const combinedBuffer = new Uint8Array(combinedLength);
    combinedBuffer.set(metadataBytes, 0);
    combinedBuffer.set(uint8Array, metadataBytes.length);
    combinedBuffer.set(closeDelimiterBytes, metadataBytes.length + uint8Array.length);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: combinedBuffer,
      }
    );

    if (!response.ok) {
      let errorDetail = `Google Drive upload failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch (_) {}
      throw new Error(errorDetail);
    }

    return await response.json();
  }

  // Attempt 1: Upload to the user-specified parent folder
  try {
    const res = await executeUpload(folderId);
    return { ...res, parentFolderUsed: 'Target Google Drive Folder' };
  } catch (initialErr: any) {
    const isParentError =
      initialErr.message?.toLowerCase().includes('parent') ||
      initialErr.message?.toLowerCase().includes('permission') ||
      initialErr.message?.toLowerCase().includes('not found');

    if (folderId && isParentError) {
      console.warn(
        `Target folder (${folderId}) not directly writable. Creating/using 'PDRRMO MLS Official Archives' folder in your Drive...`
      );

      // Attempt 2: Auto-create / find "PDRRMO MLS Official Archives" in their Drive
      try {
        const autoFolder = await getOrCreateDriveFolder(
          accessToken,
          fallbackFolderName || 'PDRRMO MLS Official Archives'
        );
        if (autoFolder.id) {
          const res = await executeUpload(autoFolder.id);
          return { ...res, parentFolderUsed: autoFolder.name };
        }
      } catch (folderCreateErr) {
        console.warn('Auto folder creation failed, falling back to root drive:', folderCreateErr);
      }

      // Attempt 3: Upload directly to root of user's Google Drive
      const rootRes = await executeUpload(null);
      return { ...rootRes, parentFolderUsed: 'My Drive (Root)' };
    }

    throw initialErr;
  }
}
