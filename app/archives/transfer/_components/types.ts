export interface B2VaultFileItem {
  fileId: string;
  fileName: string;
  contentLength: number;
  contentSha1: string;
  contentType: string;
  uploadTimestamp: number;
}

export interface B2VaultStatusResponse {
  configured: boolean;
  connected: boolean;
  bucketName: string;
  bucketId: string;
  totalFiles: number;
  totalBytes: number;
  quotaBytes: number;
  files: B2VaultFileItem[];
  errorMessage?: string;
}

export interface BucketMigrationFile {
  id: string;
  filename: string;
  category: 'log' | 'roll-call';
  storagePath: string;
  fileSizeBytes: number;
  formattedSize: string;
  createdAt: string;
  leadOfficer: string;
  shift: string;
  hash: string;
  rawSnapshot?: any;
}

export interface TransferProgressState {
  current: number;
  total: number;
  currentFilename: string;
  isFinished: boolean;
  errorCount: number;
  successCount: number;
  statusMessage: string;
}

export interface ToastNotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
  submessage?: string;
}
