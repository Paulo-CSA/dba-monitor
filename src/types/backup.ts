export interface BackupEntry {
  id: string;
  type: 'pg_dump' | 'pg_basebackup' | 'WAL_Archive' | 'Snapshot';
  status: 'completed' | 'failed' | 'in_progress' | 'verified';
  startTime: string;
  endTime: string;
  durationSeconds: number;
  sizeBytes: number;
  sizeFormatted: string;
  location: string;
  checksum: string;
  verifiedIntegrity: boolean;
  notes?: string;
}

export interface BackupOverview {
  lastBackupTimestamp: string;
  timeSinceLastBackupFormatted: string;
  backupHealthStatus: 'healthy' | 'warning' | 'critical';
  totalBackupSizeFormatted: string;
  walArchiveStatus: 'active' | 'lagging' | 'disabled';
  walArchivedCount: number;
  retentionPolicyDays: number;
  recentBackups: BackupEntry[];
}
