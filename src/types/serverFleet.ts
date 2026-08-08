import { FileLocationSetting } from './config';
import { StuckQuery } from './locks';

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
  environment: 'Produção' | 'Desenvolvimento' | 'Homologação';
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
  fileLocations?: FileLocationSetting[];
  stuckQueries?: StuckQuery[];
}
