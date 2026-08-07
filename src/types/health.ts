export interface TableBloatInfo {
  tableName: string;
  schemaName: string;
  tableSizeBytes: number;
  bloatBytes: number;
  bloatPercentage: number;
  recommendedAction: 'VACUUM' | 'VACUUM FULL' | 'REINDEX' | 'OK';
}

export interface HealthCheckItem {
  id: string;
  component: string; // e.g. "Checksums", "Replication", "Deadlocks", "Connection Pool", "Disk Space"
  status: 'ok' | 'warning' | 'error';
  message: string;
  details: string;
  lastChecked: string;
}

export interface DatabaseIntegrityOverview {
  overallIntegrityScore: number; // 0-100
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  connectionStatus: 'Connected' | 'High Latency' | 'Disconnected';
  checksumsEnabled: boolean;
  replicationLagBytes: number;
  deadlockCountLast24h: number;
  activeTransactionsCount: number;
  healthChecks: HealthCheckItem[];
  topBloatedTables: TableBloatInfo[];
}
