export interface DatabaseInfo {
  datname: string;
  sizeBytes: number;
  sizeFormatted: string;
  activeConnections: number;
  maxConnections: number;
  tps: number;
  cacheHitRatio: number;
  owner: string;
  encoding: string;
  status: 'online' | 'degraded' | 'maintenance';
}

export interface ServerInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  region: string;
  environment: 'Produção' | 'Desenvolvimento' | 'Homologação' | 'Teste';
  pgVersion: string;
  uptimeFormatted: string;
  cpuUsagePercent: number;
  avgLatencyMs: number;
  totalDatabasesCount: number;
  totalActiveConnections: number;
  totalSizeFormatted: string;
  status: 'healthy' | 'warning' | 'critical';
  dbUser?: string;
  dbPassword?: string;
  databases: DatabaseInfo[];
}
