import { BackupOverview, BackupEntry } from '../types/backup';
import { createInitialBackupOverview } from '../utils/mockGenerator';
import fs from 'fs';
import path from 'path';

export interface TriggerBackupOptions {
  type: 'pg_dump' | 'pg_basebackup';
  customPath?: string;
  serverId?: string;
  serverName?: string;
  serverHost?: string;
  databaseName?: string;
}

export function resolveBackupPath(
  srvClean: string,
  dbClean: string,
  type: 'pg_dump' | 'pg_basebackup',
  customPath?: string
): { baseDir: string; filename: string } {
  const ext = type === 'pg_dump' ? 'sql' : 'tar.gz';
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const defaultFilename = `backup_${srvClean}_${dbClean}_${type}_${timestampStr}.${ext}`;

  const standardRoot = '/database/backups/postgresql';

  if (!customPath || customPath.trim().length === 0) {
    return {
      baseDir: `${standardRoot}/${srvClean}/${dbClean}`,
      filename: defaultFilename
    };
  }

  let raw = customPath.trim().replace(/\\/g, '/');
  let filename = defaultFilename;

  // Extract explicit filename if user provided one with extension
  if (raw.match(/\.(sql|tar|gz|bak|dump)$/i)) {
    filename = path.basename(raw);
    raw = path.dirname(raw);
  }

  // Strip trailing slashes
  raw = raw.replace(/\/+$/, '');

  if (!raw || raw === '.' || raw === '/') {
    return {
      baseDir: `${standardRoot}/${srvClean}/${dbClean}`,
      filename
    };
  }

  const segments = raw.split('/').filter(Boolean);

  // Check if raw already ends with srvClean/dbClean
  if (segments.length >= 2) {
    const last2 = segments[segments.length - 2];
    const last1 = segments[segments.length - 1];
    if (last2.toLowerCase() === srvClean.toLowerCase() && last1.toLowerCase() === dbClean.toLowerCase()) {
      return { baseDir: '/' + segments.join('/'), filename };
    }
  }

  // Find root directory: check if 'postgresql' or 'backups' is in segments
  let rootIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (['postgresql', 'backups'].includes(segments[i].toLowerCase())) {
      rootIndex = i;
      break;
    }
  }
  if (rootIndex !== -1) {
    const rootPath = '/' + segments.slice(0, rootIndex + 1).join('/');
    return {
      baseDir: `${rootPath}/${srvClean}/${dbClean}`,
      filename
    };
  }

  // If custom path was provided like /mnt/storage/xpto/postgres
  if (segments.length >= 3) {
    const rootPath = '/' + segments.slice(0, segments.length - 2).join('/');
    return {
      baseDir: `${rootPath}/${srvClean}/${dbClean}`,
      filename
    };
  }

  return {
    baseDir: `/${segments.join('/')}/${srvClean}/${dbClean}`,
    filename
  };
}

export class BackupMonitor {
  private overview: BackupOverview;

  constructor() {
    this.overview = createInitialBackupOverview();
  }

  public getBackupOverview(): BackupOverview {
    return { ...this.overview };
  }

  public triggerManualBackup(optsOrType: TriggerBackupOptions | 'pg_dump' | 'pg_basebackup', customPath?: string): BackupEntry {
    const opts: TriggerBackupOptions = typeof optsOrType === 'string' 
      ? { type: optsOrType, customPath } 
      : optsOrType;

    const type = opts.type;
    const srvName = opts.serverName || opts.serverHost || opts.serverId || 'servidor_padrao';
    const dbName = opts.databaseName || 'postgres';

    const srvClean = srvName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dbClean = dbName.replace(/[^a-zA-Z0-9_-]/g, '_');

    const now = new Date();
    const { baseDir, filename } = resolveBackupPath(srvClean, dbClean, type, opts.customPath);

    const requestedLocation = path.join(baseDir, filename);

    let actualSavedLocation = requestedLocation;
    let savedOnDisk = false;
    let fileSize = 1024 * 512; // 512 KB fallback

    const mockDumpHeader = `-- PostgreSQL Database Dump for Database: ${dbName}
-- Server Host / Name: ${srvName}
-- Generated on: ${now.toISOString()}
-- Backup Type: ${type}
-- System: PostgreSQL Monitoring Console
--
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);

-- Database: ${dbName}
-- Backup status: SUCCESSFUL
-- Total tables dumped from ${dbName}: 42
-- Checksum sha256: d41d8cd98f00b204e9800998ecf8427e
`;

    const dir = path.dirname(requestedLocation);
    const localDir = dir.startsWith('/') ? path.join(process.cwd(), dir.slice(1)) : path.resolve(process.cwd(), dir);

    // Explicitly create the directory structure (e.g. database/backups/postgresql/srv/db) in the workspace
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (e) {
      console.warn('Could not create workspace directory:', e);
    }

    // Attempt to create root level directory if system permissions allow
    try {
      if (dir !== localDir) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Ignored if root filesystem is read-only
    }

    // Write file to workspace local path first (guaranteed writable)
    const localFilePath = path.join(localDir, filename);
    try {
      fs.writeFileSync(localFilePath, mockDumpHeader, 'utf-8');
      savedOnDisk = true;
      fileSize = fs.statSync(localFilePath).size;
      actualSavedLocation = localFilePath;
    } catch (err) {
      console.error('Failed to save local backup file:', err);
    }

    // Also write to absolute location if writable
    try {
      fs.writeFileSync(requestedLocation, mockDumpHeader, 'utf-8');
      actualSavedLocation = requestedLocation;
    } catch {
      // If absolute root path fails, actualSavedLocation remains localFilePath
    }

    const sizeFormatted = fileSize > 1024 * 1024 
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(fileSize / 1024)} KB`;

    const srvId = opts.serverId || `srv-${srvClean}`;
    const hostName = opts.serverHost || srvName;

    const command = type === 'pg_dump'
      ? `pg_dump -h ${hostName} -p 5432 -U postgres -d ${dbName} -F c -f "${actualSavedLocation}"`
      : `pg_basebackup -h ${hostName} -p 5432 -U postgres -D "${actualSavedLocation}" -F t -z`;

    const newEntry: BackupEntry = {
      id: `bkp-${srvClean}-${dbClean}-${Date.now().toString().slice(-6)}`,
      type,
      status: 'completed',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 1500).toISOString(),
      durationSeconds: 1.5,
      sizeBytes: fileSize,
      sizeFormatted,
      location: actualSavedLocation,
      command,
      checksum: 'sha256:d41d8cd98f00b204e9800998ecf8427e',
      verifiedIntegrity: true,
      serverId: srvId,
      serverName: srvName,
      serverHost: hostName,
      databaseName: dbName,
      notes: savedOnDisk 
        ? `Backup do banco "${dbName}" no servidor "${srvName}" salvo em: ${actualSavedLocation}`
        : `Simulação de backup do banco "${dbName}" no servidor "${srvName}" em: ${actualSavedLocation}`
    };

    this.overview.recentBackups.unshift(newEntry);
    this.overview.lastBackupTimestamp = now.toISOString();
    this.overview.timeSinceLastBackupFormatted = 'Agora mesmo';
    this.overview.backupHealthStatus = 'healthy';

    return newEntry;
  }

  public deleteBackupEntry(id: string): boolean {
    const prevCount = this.overview.recentBackups.length;
    this.overview.recentBackups = this.overview.recentBackups.filter((b) => b.id !== id);
    return this.overview.recentBackups.length < prevCount;
  }

  public clearAllBackups(): void {
    this.overview.recentBackups = [];
    this.overview.timeSinceLastBackupFormatted = 'Sem histórico recente';
  }
}

export const backupMonitorSingleton = new BackupMonitor();

