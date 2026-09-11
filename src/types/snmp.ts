export interface SnmpConfig {
  enabled: boolean;
  version: '2c' | '1' | '3';
  community: string;
  port: number;
}

export interface DiskStorageMetric {
  path: string;
  device?: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  totalFormatted: string;
  usedFormatted: string;
  freeFormatted: string;
}

export interface CpuCoreMetric {
  coreId: number;
  loadPercent: number;
}

export interface SnmpServerMetrics {
  collectedAt: string;
  status: 'online' | 'unreachable' | 'simulated';
  error?: string;
  responseTimeMs?: number;
  communityUsed: string;
  versionUsed: string;
  host: string;
  port: number;
  sysDescr: string;
  sysName: string;
  sysUpTime: string;
  uptimeSeconds: number;
  cpu: {
    usagePercent: number;
    userPercent: number;
    systemPercent: number;
    idlePercent: number;
    iowaitPercent: number;
    loadAverage1m: number;
    loadAverage5m: number;
    loadAverage15m: number;
    coresCount: number;
    cores: CpuCoreMetric[];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    bufferedBytes: number;
    cachedBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
    freeFormatted: string;
    swapTotalBytes: number;
    swapUsedBytes: number;
    swapUsedPercent: number;
    swapTotalFormatted: string;
    swapUsedFormatted: string;
  };
  storage: DiskStorageMetric[];
  rawOids?: { oid: string; name: string; value: string }[];
  history?: {
    timestamp: string;
    cpuPercent: number;
    ramPercent: number;
    load1m: number;
  }[];
}

export const DEFAULT_SNMP_CONFIG: SnmpConfig = {
  enabled: true,
  version: '2c',
  community: 'n4tUr3Z4',
  port: 161
};
