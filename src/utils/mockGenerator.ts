import { LatencyMetric, CpuMetric, SystemResourceMetric } from '../types/metrics';
import { FileLocationSetting, PgSystemConfig } from '../types/config';
import { StuckQuery, ActiveLock } from '../types/locks';
import { BackupOverview } from '../types/backup';
import { DatabaseIntegrityOverview } from '../types/health';

export function createInitialFileLocations(): FileLocationSetting[] {
  return [
    {
      name: 'config_file',
      setting: '/etc/postgresql/14/main/postgresql.conf',
      category: 'File Locations',
      short_desc: 'Arquivo principal de configurações do servidor (config_file).',
      is_writable: false,
      status: 'valid'
    },
    {
      name: 'hba_file',
      setting: '/etc/postgresql/14/main/pg_hba.conf',
      category: 'File Locations',
      short_desc: 'Regras de autenticação de clientes baseada em host (hba_file).',
      is_writable: false,
      status: 'valid'
    },
    {
      name: 'ident_file',
      setting: '/etc/postgresql/14/main/pg_ident.conf',
      category: 'File Locations',
      short_desc: 'Mapeamento de identidades de usuários do sistema operacional (ident_file).',
      is_writable: false,
      status: 'valid'
    },
    {
      name: 'data_directory',
      setting: '/var/lib/postgresql/14/main',
      category: 'File Locations',
      short_desc: 'Diretório de armazenamento físico do cluster de dados (data_directory).',
      is_writable: true,
      status: 'valid'
    },
    {
      name: 'external_pid_file',
      setting: '/var/run/postgresql/14-main.pid',
      category: 'File Locations',
      short_desc: 'Arquivo de identificação do processo mestre do PostgreSQL (external_pid_file).',
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
  return [];
}

export function createInitialActiveLocks(): ActiveLock[] {
  return [];
}

export function createInitialBackupOverview(): BackupOverview {
  return {
    lastBackupTimestamp: '',
    timeSinceLastBackupFormatted: 'Nenhum backup',
    backupHealthStatus: 'healthy',
    totalBackupSizeFormatted: '0 KB',
    walArchiveStatus: 'active',
    walArchivedCount: 0,
    retentionPolicyDays: 30,
    recentBackups: []
  };
}

export function createInitialIntegrityOverview(): DatabaseIntegrityOverview {
  return {
    overallIntegrityScore: 100,
    status: 'HEALTHY',
    connectionStatus: 'Connected',
    checksumsEnabled: true,
    replicationLagBytes: 0,
    deadlockCountLast24h: 0,
    activeTransactionsCount: 0,
    healthChecks: [
      {
        id: 'hc-1',
        component: 'Data Checksums (pg_checksums)',
        status: 'ok',
        message: 'Checksums de blocos ativados no PostgreSQL.',
        details: 'Integridade de páginas de dados verificada via CRC-32.',
        lastChecked: new Date().toISOString()
      },
      {
        id: 'hc-2',
        component: 'Status de Conexão e Atividade',
        status: 'ok',
        message: 'Conectado e monitorando em tempo real.',
        details: 'Sem latência excessiva ou travamentos de sistema.',
        lastChecked: new Date().toISOString()
      }
    ],
    topBloatedTables: []
  };
}
