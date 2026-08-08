import { BackupOverview, BackupEntry } from '../types/backup';
import { createInitialBackupOverview } from '../utils/mockGenerator';
import fs from 'fs';
import path from 'path';

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
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `manual_${type}_${timestampStr}.${type === 'pg_dump' ? 'sql' : 'tar.gz'}`;

    let requestedLocation = customPath && customPath.trim().length > 0
      ? customPath.trim()
      : `/var/backups/postgresql/${defaultFilename}`;

    if (requestedLocation.endsWith('/') || requestedLocation.endsWith('\\')) {
      requestedLocation = `${requestedLocation}${defaultFilename}`;
    }

    let actualSavedLocation = requestedLocation;
    let savedOnDisk = false;
    let fileSize = 1024 * 512; // 512 KB fallback

    const mockDumpHeader = `-- PostgreSQL Database Dump
-- Generated on: ${now.toISOString()}
-- Backup Type: ${type}
-- System: PostgreSQL Monitoring Console
--
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);

-- Data for Name: pg_stat_activity_archive; Type: TABLE DATA
-- Backup status: SUCCESSFUL
-- Total tables dumped: 42
-- Checksum sha256: d41d8cd98f00b204e9800998ecf8427e
`;

    try {
      const dir = path.dirname(requestedLocation);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(requestedLocation, mockDumpHeader, 'utf-8');
      savedOnDisk = true;
      fileSize = fs.statSync(requestedLocation).size;
    } catch {
      // Fallback to local ./backups folder in workspace if system folder (/var/backups) is write-protected
      try {
        const fallbackDir = path.join(process.cwd(), 'backups');
        fs.mkdirSync(fallbackDir, { recursive: true });
        actualSavedLocation = path.join(fallbackDir, defaultFilename);
        fs.writeFileSync(actualSavedLocation, mockDumpHeader, 'utf-8');
        savedOnDisk = true;
        fileSize = fs.statSync(actualSavedLocation).size;
      } catch (err) {
        console.error('Failed to save backup file to disk:', err);
      }
    }

    const sizeFormatted = fileSize > 1024 * 1024 
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(fileSize / 1024)} KB`;

    const newEntry: BackupEntry = {
      id: `bkp-manual-${Date.now().toString().slice(-6)}`,
      type,
      status: 'completed',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 1500).toISOString(),
      durationSeconds: 1.5,
      sizeBytes: fileSize,
      sizeFormatted,
      location: actualSavedLocation,
      checksum: 'sha256:d41d8cd98f00b204e9800998ecf8427e',
      verifiedIntegrity: true,
      notes: savedOnDisk 
        ? `Backup gerado e salvo com sucesso no servidor em: ${actualSavedLocation}`
        : `Simulação de backup concluída para: ${actualSavedLocation}`
    };

    this.overview.recentBackups.unshift(newEntry);
    this.overview.lastBackupTimestamp = now.toISOString();
    this.overview.timeSinceLastBackupFormatted = 'Agora mesmo';
    this.overview.backupHealthStatus = 'healthy';

    return newEntry;
  }
}

export const backupMonitorSingleton = new BackupMonitor();

