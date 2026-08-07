import { LatencyMetric, CpuMetric, SystemResourceMetric } from '../types/metrics';
import { FileLocationSetting, PgSystemConfig } from '../types/config';
import { StuckQuery, ActiveLock } from '../types/locks';
import { BackupOverview } from '../types/backup';
import { DatabaseIntegrityOverview } from '../types/health';

export function createInitialFileLocations(): FileLocationSetting[] {
  return [
    {
      name: 'config_file',
      setting: '/var/lib/postgresql/data/postgresql.conf',
      category: 'File Locations',
      short_desc: 'Sets the server\'s main configuration file.',
      is_writable: false,
      status: 'valid'
    },
    {
      name: 'hba_file',
      setting: '/var/lib/postgresql/data/pg_hba.conf',
      category: 'File Locations',
      short_desc: 'Sets the server\'s host-based authentication configuration file.',
      is_writable: false,
      status: 'valid'
    },
    {
      name: 'ident_file',
      setting: '/var/lib/postgresql/data/pg_ident.conf',
      category: 'File Locations',
      short_desc: 'Sets the server\'s identification mapping configuration file.',
      is_writable: false,
      status: 'valid'
    },
    {
      name: 'data_directory',
      setting: '/var/lib/postgresql/data',
      category: 'File Locations',
      short_desc: 'Sets the directory to locate store data files.',
      is_writable: true,
      status: 'valid'
    },
    {
      name: 'external_pid_file',
      setting: '/var/run/postgresql/16-main.pid',
      category: 'File Locations',
      short_desc: 'Sets an external process ID file created by the server.',
      is_writable: false,
      status: 'valid'
    }
  ];
}

export function createInitialPgConfig(): PgSystemConfig {
  return {
    version: 'PostgreSQL 16.2 (Ubuntu 16.2-1.pgdg22.04+1) on x86_64-pc-linux-gnu',
    uptimeSeconds: 849200,
    serverEncoding: 'UTF8',
    clientEncoding: 'UTF8',
    maxConnectionsSetting: 200,
    sharedBuffersSetting: '4GB',
    workMemSetting: '64MB',
    maintenanceWorkMemSetting: '512MB',
    effectiveCacheSizeSetting: '12GB',
    walLevelSetting: 'replica',
    fileLocations: createInitialFileLocations()
  };
}

export function generateHistoricalMetrics(count = 20): {
  latencyHistory: LatencyMetric[];
  cpuHistory: CpuMetric[];
  resourceHistory: SystemResourceMetric[];
} {
  const now = Date.now();
  const latencyHistory: LatencyMetric[] = [];
  const cpuHistory: CpuMetric[] = [];
  const resourceHistory: SystemResourceMetric[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const timeStr = new Date(now - i * 3000).toLocaleTimeString();
    const baseCpu = 25 + Math.sin(i / 2) * 15 + Math.random() * 10;
    const baseLat = 1.8 + Math.cos(i / 3) * 0.8 + Math.random() * 0.5;

    latencyHistory.push({
      timestamp: timeStr,
      readLatencyMs: parseFloat((baseLat * 0.8).toFixed(2)),
      writeLatencyMs: parseFloat((baseLat * 1.4).toFixed(2)),
      avgLatencyMs: parseFloat(baseLat.toFixed(2)),
      p95LatencyMs: parseFloat((baseLat * 2.1).toFixed(2))
    });

    cpuHistory.push({
      timestamp: timeStr,
      usagePercent: parseFloat(baseCpu.toFixed(1)),
      userPercent: parseFloat((baseCpu * 0.7).toFixed(1)),
      systemPercent: parseFloat((baseCpu * 0.25).toFixed(1)),
      iowaitPercent: parseFloat((baseCpu * 0.05).toFixed(1))
    });

    resourceHistory.push({
      timestamp: timeStr,
      ramUsagePercent: parseFloat((58 + Math.random() * 4).toFixed(1)),
      ramUsedMb: Math.round(9500 + Math.random() * 500),
      ramTotalMb: 16384,
      activeConnections: Math.round(42 + Math.random() * 12),
      maxConnections: 200,
      tps: Math.round(1250 + Math.random() * 300),
      cacheHitRatio: parseFloat((99.2 + Math.random() * 0.6).toFixed(2)),
      diskUsagePercent: 64.2
    });
  }

  return { latencyHistory, cpuHistory, resourceHistory };
}

export function createInitialStuckQueries(): StuckQuery[] {
  const now = new Date();
  return [
    {
      pid: 14829,
      usename: 'app_user',
      datname: 'production_db',
      client_addr: '10.0.4.12',
      application_name: 'reporting_service',
      state: 'active',
      query: `SELECT o.id, o.created_at, SUM(i.quantity * i.unit_price) AS total FROM orders o JOIN order_items i ON o.id = i.order_id WHERE o.created_at >= '2025-01-01' GROUP BY o.id, o.created_at ORDER BY total DESC;`,
      durationSeconds: 148,
      wait_event_type: 'Lock',
      wait_event: 'relation',
      blocking_pid: 14750,
      isStuck: true,
      query_start: new Date(now.getTime() - 148000).toISOString()
    },
    {
      pid: 14750,
      usename: 'admin_batch',
      datname: 'production_db',
      client_addr: '10.0.2.88',
      application_name: 'migration_script',
      state: 'active',
      query: `UPDATE order_items SET audit_flag = true WHERE updated_at < NOW() - INTERVAL '30 days';`,
      durationSeconds: 215,
      wait_event_type: 'IO',
      wait_event: 'DataFileRead',
      blocking_pid: null,
      isStuck: true,
      query_start: new Date(now.getTime() - 215000).toISOString()
    },
    {
      pid: 15102,
      usename: 'analytics_rw',
      datname: 'analytics_db',
      client_addr: '10.0.6.45',
      application_name: 'metabase_worker',
      state: 'active',
      query: `VACUUM FULL ANALYZE user_events_historical;`,
      durationSeconds: 410,
      wait_event_type: 'Maintenance',
      wait_event: 'VacuumLock',
      blocking_pid: null,
      isStuck: true,
      query_start: new Date(now.getTime() - 410000).toISOString()
    }
  ];
}

export function createInitialActiveLocks(): ActiveLock[] {
  return [
    {
      locktype: 'relation',
      relation: 'order_items',
      mode: 'RowExclusiveLock',
      granted: true,
      pid: 14750,
      usename: 'admin_batch',
      datname: 'production_db',
      blocking_pid: null,
      querySnippet: 'UPDATE order_items SET audit_flag = true...',
      durationSeconds: 215
    },
    {
      locktype: 'relation',
      relation: 'order_items',
      mode: 'AccessShareLock',
      granted: false,
      pid: 14829,
      usename: 'app_user',
      datname: 'production_db',
      blocking_pid: 14750,
      querySnippet: 'SELECT o.id, o.created_at, SUM(...) FROM orders...',
      durationSeconds: 148
    },
    {
      locktype: 'relation',
      relation: 'user_events_historical',
      mode: 'AccessExclusiveLock',
      granted: true,
      pid: 15102,
      usename: 'analytics_rw',
      datname: 'analytics_db',
      blocking_pid: null,
      querySnippet: 'VACUUM FULL ANALYZE user_events_historical;',
      durationSeconds: 410
    }
  ];
}

export function createInitialBackupOverview(): BackupOverview {
  const now = new Date();
  const lastBackup = new Date(now.getTime() - 4 * 3600 * 1000); // 4 hours ago

  return {
    lastBackupTimestamp: lastBackup.toISOString(),
    timeSinceLastBackupFormatted: '4h 12m atrás',
    backupHealthStatus: 'healthy',
    totalBackupSizeFormatted: '142.8 GB',
    walArchiveStatus: 'active',
    walArchivedCount: 1842,
    retentionPolicyDays: 30,
    recentBackups: [
      {
        id: 'bkp-2026-08-07-0600',
        type: 'pg_basebackup',
        status: 'completed',
        startTime: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 3.8 * 3600 * 1000).toISOString(),
        durationSeconds: 720,
        sizeBytes: 153328222208,
        sizeFormatted: '142.8 GB',
        location: 's3://pg-backups-prod/2026/08/07/full_base.tar.gz',
        checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        verifiedIntegrity: true,
        notes: 'Backup diário completo automatizado.'
      },
      {
        id: 'bkp-2026-08-06-0600',
        type: 'pg_basebackup',
        status: 'completed',
        startTime: new Date(now.getTime() - 28 * 3600 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 27.8 * 3600 * 1000).toISOString(),
        durationSeconds: 710,
        sizeBytes: 151120000000,
        sizeFormatted: '140.7 GB',
        location: 's3://pg-backups-prod/2026/08/06/full_base.tar.gz',
        checksum: 'sha256:8f4e2c8a1b0d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f',
        verifiedIntegrity: true
      },
      {
        id: 'bkp-2026-08-05-1800',
        type: 'pg_dump',
        status: 'completed',
        startTime: new Date(now.getTime() - 40 * 3600 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 39.5 * 3600 * 1000).toISOString(),
        durationSeconds: 1800,
        sizeBytes: 42000000000,
        sizeFormatted: '39.1 GB',
        location: 's3://pg-backups-prod/2026/08/05/logical_schema.sql.gz',
        checksum: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        verifiedIntegrity: true,
        notes: 'Exportação lógica de esquemas críticos.'
      }
    ]
  };
}

export function createInitialIntegrityOverview(): DatabaseIntegrityOverview {
  return {
    overallIntegrityScore: 96,
    status: 'HEALTHY',
    connectionStatus: 'Connected',
    checksumsEnabled: true,
    replicationLagBytes: 0,
    deadlockCountLast24h: 1,
    activeTransactionsCount: 38,
    healthChecks: [
      {
        id: 'hc-1',
        component: 'Data Checksums (pg_checksums)',
        status: 'ok',
        message: 'Checksums de blocos estão ativados e sem páginas corrompidas.',
        details: 'Todos os blocos lidos nas últimas 24h passaram na verificação de integridade CRC-32.',
        lastChecked: new Date().toISOString()
      },
      {
        id: 'hc-2',
        component: 'Replicação Streaming',
        status: 'ok',
        message: 'Standby secundário em sincronia (0 bytes de atraso).',
        details: 'lsn actual: 0/19F32B0, standby byte lag: 0 bytes, flush_lsn match.',
        lastChecked: new Date().toISOString()
      },
      {
        id: 'hc-3',
        component: 'Verificação de Inodes e Disco',
        status: 'ok',
        message: 'Volume /var/lib/postgresql/data possui 35.8% livre.',
        details: '350 GB livres de 1000 GB no filesystem ext4.',
        lastChecked: new Date().toISOString()
      },
      {
        id: 'hc-4',
        component: 'Detecção de Lock Persistente',
        status: 'warning',
        message: 'Existe 1 transação aguardando Lock por mais de 2 minutos.',
        details: 'PID 14829 está em wait_event_type = Lock na tabela order_items.',
        lastChecked: new Date().toISOString()
      }
    ],
    topBloatedTables: [
      {
        tableName: 'order_items',
        schemaName: 'public',
        tableSizeBytes: 12400000000,
        bloatBytes: 3100000000,
        bloatPercentage: 25.0,
        recommendedAction: 'VACUUM'
      },
      {
        tableName: 'audit_logs',
        schemaName: 'logging',
        tableSizeBytes: 28000000000,
        bloatBytes: 9800000000,
        bloatPercentage: 35.0,
        recommendedAction: 'VACUUM FULL'
      },
      {
        tableName: 'user_sessions',
        schemaName: 'public',
        tableSizeBytes: 1500000000,
        bloatBytes: 220000000,
        bloatPercentage: 14.6,
        recommendedAction: 'OK'
      }
    ]
  };
}
