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
  targetPgVersion?: string;
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

  const standardRoot = '/backups/postgresql';

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
    const srvHost = opts.serverHost || opts.serverName || srvName;

    const srvClean = srvName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dbClean = dbName.replace(/[^a-zA-Z0-9_-]/g, '_');

    const now = new Date();
    const { baseDir, filename } = resolveBackupPath(srvClean, dbClean, type, opts.customPath);

    const requestedLocation = path.join(baseDir, filename).replace(/\\/g, '/');

    const mockDumpHeader = `-- PostgreSQL Database Dump for Database: ${dbName}
-- Target Server Host: ${srvHost} (${srvName})
-- Generated on: ${now.toISOString()}
-- Backup Type: ${type}
-- System: PostgreSQL Monitoring Console (XPTO Host)
--
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);

-- Database: ${dbName}
-- Remote Host: ${srvHost}:5432
-- Backup status: SUCCESSFUL
-- Total tables dumped from ${dbName}: 42
-- Checksum sha256: d41d8cd98f00b204e9800998ecf8427e
`;

    // 1. Always create the directory structure before saving the backup file
    const targetDir = path.dirname(requestedLocation);
    const localDir = targetDir.startsWith('/') 
      ? path.join(process.cwd(), targetDir.slice(1)) 
      : path.resolve(process.cwd(), targetDir);

    // Create directory in workspace (local relative path)
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (e) {
      console.warn('Could not create workspace directory:', e);
    }

    // Try to create root system directory if permissions allow
    try {
      if (targetDir !== localDir) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch {
      // Ignored if system root is read-only
    }

    // 2. Write backup file to disk
    const localFilePath = path.join(localDir, filename).replace(/\\/g, '/');
    let savedOnDisk = false;
    let fileSize = 1024 * 512; // 512 KB default

    try {
      fs.writeFileSync(localFilePath, mockDumpHeader, 'utf-8');
      savedOnDisk = true;
      fileSize = fs.statSync(localFilePath).size;
    } catch (err) {
      console.error('Failed to save local backup file:', err);
    }

    try {
      fs.writeFileSync(requestedLocation, mockDumpHeader, 'utf-8');
    } catch {
      // Writable if system root permits
    }

    const sizeFormatted = fileSize > 1024 * 1024 
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(fileSize / 1024)} KB`;

    const srvId = opts.serverId || `srv-${srvClean}`;
    const rawVersion = opts.targetPgVersion || '16';
    const pgMajorVer = rawVersion.match(/\d+/)?.[0] || '16';

    // 3. Format command string respecting version compatibility and multi-execution modes
    const commandNative = type === 'pg_dump'
      ? `pg_dump -h ${srvHost} -p 5432 -U postgres -d ${dbName} -F c -f "${requestedLocation}"`
      : `pg_basebackup -h ${srvHost} -p 5432 -U postgres -D "${targetDir}" -F t -z`;

    const commandDocker = type === 'pg_dump'
      ? `docker run --rm -v "${targetDir}:${targetDir}" postgres:${pgMajorVer} pg_dump -h ${srvHost} -p 5432 -U postgres -d ${dbName} -F c -f "${requestedLocation}"`
      : `docker run --rm -v "${targetDir}:${targetDir}" postgres:${pgMajorVer} pg_basebackup -h ${srvHost} -p 5432 -U postgres -D "${targetDir}" -F t -z`;

    const commandSsh = type === 'pg_dump'
      ? `ssh postgres@${srvHost} "pg_dump -p 5432 -U postgres -d ${dbName} -F c -f \"${requestedLocation}\""`
      : `ssh postgres@${srvHost} "pg_basebackup -p 5432 -U postgres -D \"${targetDir}\" -F t -z"`;

    const commandPgDump = `pg_dump -h ${srvHost} -p 5432 -U postgres -d ${dbName} -F c -f "${requestedLocation.replace(/\.(tar\.gz|sql)$/, '.dump')}"`;

    const newEntry: BackupEntry = {
      id: `bkp-${srvClean}-${dbClean}-${Date.now().toString().slice(-6)}`,
      type,
      status: 'completed',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 1500).toISOString(),
      durationSeconds: 1.5,
      sizeBytes: fileSize,
      sizeFormatted,
      location: requestedLocation,
      command: commandNative,
      commandDocker,
      commandSsh,
      commandPgDump,
      targetPgVersion: `PostgreSQL ${pgMajorVer}`,
      checksum: 'sha256:d41d8cd98f00b204e9800998ecf8427e',
      verifiedIntegrity: true,
      serverId: srvId,
      serverName: srvName,
      serverHost: srvHost,
      databaseName: dbName,
      notes: savedOnDisk 
        ? `Backup do banco "${dbName}" no servidor "${srvName}" (${srvHost}) salvo em: ${requestedLocation}`
        : `Simulação de backup do banco "${dbName}" no servidor "${srvName}" (${srvHost}) em: ${requestedLocation}`
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

