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

  public triggerManualBackup(type: 'pg_dump' | 'pg_basebackup', customPath?: string): BackupEntry {
    const now = new Date();
    const formattedLocation = customPath && customPath.trim().length > 0
      ? (customPath.endsWith('/') ? `${customPath}backup_${type}_${now.toISOString().slice(0,10)}.tar.gz` : customPath)
      : `/var/backups/postgresql/manual_${type}_${now.toISOString().slice(0,10)}.tar.gz`;

    const newEntry: BackupEntry = {
      id: `bkp-manual-${Date.now().toString().slice(-6)}`,
      type,
      status: 'completed',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 2000).toISOString(),
      durationSeconds: 2,
      sizeBytes: 1024 * 512,
      sizeFormatted: '512 KB',
      location: formattedLocation,
      checksum: 'sha256:d41d8cd98f00b204e9800998ecf8427e',
      verifiedIntegrity: true,
      notes: `Backup manual salvo em: ${formattedLocation}`
    };

    this.overview.recentBackups.unshift(newEntry);
    this.overview.lastBackupTimestamp = now.toISOString();
    this.overview.timeSinceLastBackupFormatted = 'Agora mesmo';
    this.overview.backupHealthStatus = 'healthy';

    return newEntry;
  }
}

export const backupMonitorSingleton = new BackupMonitor();
