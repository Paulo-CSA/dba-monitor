import { BackupOverview, BackupEntry } from '../types/backup';
import { createInitialBackupOverview } from '../utils/mockGenerator';

export class BackupMonitor {
  private overview: BackupOverview;

  constructor() {
    this.overview = createInitialBackupOverview();
  }

  public getBackupOverview(): BackupOverview {
    return { ...this.overview };
  }

  public triggerManualBackup(type: 'pg_dump' | 'pg_basebackup'): BackupEntry {
    const now = new Date();
    const newEntry: BackupEntry = {
      id: `bkp-manual-${Date.now().toString().slice(-6)}`,
      type,
      status: 'completed',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 45000).toISOString(),
      durationSeconds: 45,
      sizeBytes: 154000000000,
      sizeFormatted: '143.4 GB',
      location: `s3://pg-backups-prod/manual/${now.toISOString().slice(0,10)}/manual_${type}.tar.gz`,
      checksum: 'sha256:d41d8cd98f00b204e9800998ecf8427e',
      verifiedIntegrity: true,
      notes: 'Backup manual disparado pelo painel PgMonitor.'
    };

    this.overview.recentBackups.unshift(newEntry);
    this.overview.lastBackupTimestamp = now.toISOString();
    this.overview.timeSinceLastBackupFormatted = 'Agora mesmo';
    this.overview.backupHealthStatus = 'healthy';

    return newEntry;
  }
}

export const backupMonitorSingleton = new BackupMonitor();
