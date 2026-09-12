/**
 * Utility for client-side document compression and decompression
 * Uses native CompressionStream and DecompressionStream (Gzip)
 */

export interface CompressedPayloadResult {
  blob: Blob;
  sizeBytes: number;
  originalSizeBytes: number;
  isCompressed: boolean;
  compressionRatio: string;
}

/**
 * Compresses a text or JSON string into a compact Gzip Blob before uploading to Supabase Storage.
 */
export async function compressPayload(payloadString: string): Promise<CompressedPayloadResult> {
  const originalSizeBytes = new TextEncoder().encode(payloadString).length;

  if (typeof window !== 'undefined' && 'CompressionStream' in window) {
    try {
      const stream = new Blob([payloadString], { type: 'application/json' })
        .stream()
        .pipeThrough(new CompressionStream('gzip'));

      const compressedBlob = await new Response(stream).blob();
      const ratio = ((1 - compressedBlob.size / Math.max(1, originalSizeBytes)) * 100).toFixed(1);

      return {
        blob: compressedBlob,
        sizeBytes: compressedBlob.size,
        originalSizeBytes,
        isCompressed: true,
        compressionRatio: `${ratio}%`,
      };
    } catch (err) {
      console.warn('Native CompressionStream skipped, using fallback:', err);
    }
  }

  // Fallback: minified UTF-8 JSON Blob
  const rawBlob = new Blob([payloadString], { type: 'application/json' });
  return {
    blob: rawBlob,
    sizeBytes: rawBlob.size,
    originalSizeBytes,
    isCompressed: false,
    compressionRatio: '0.0%',
  };
}

/**
 * Decompresses a Blob or ArrayBuffer downloaded from Supabase Storage.
 */
export async function decompressPayload(blobOrBuffer: Blob | ArrayBuffer): Promise<string> {
  const blob = blobOrBuffer instanceof Blob ? blobOrBuffer : new Blob([blobOrBuffer]);

  if (typeof window !== 'undefined' && 'DecompressionStream' in window) {
    try {
      // Attempt Gzip decompression
      const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    } catch {
      // If file was uncompressed plain text/JSON, read directly
      return await blob.text();
    }
  }

  return await blob.text();
}
