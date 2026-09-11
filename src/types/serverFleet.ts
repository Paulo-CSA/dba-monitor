import { FileLocationSetting } from './config';
import { StuckQuery } from './locks';
import { SnmpConfig, SnmpServerMetrics } from './snmp';

export interface TableSizeInfo {
  schemaName: string;
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeFormatted: string;
  totalMb: number;
}

export interface DatabaseInfo {
  datname: string;
  sizeBytes: number;
  sizeFormatted: string;
  activeConnections: number;
  maxConnections: number;
  tps: number;
  cacheHitRatio: number;
  tablesCount: number;
  owner: string;
  encoding: string;
  status: 'online' | 'degraded' | 'maintenance';
  topTables?: TableSizeInfo[];
}

export interface ServerInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  engine?: 'postgres' | 'mysql' | 'mssql';
  authMode?: string;
  environment: 'Produção' | 'Desenvolvimento' | 'Homologação';
  pgVersion: string;
  uptimeFormatted: string;
  uptimeSeconds?: number;
  cpuUsagePercent: number;
  avgLatencyMs: number;
  ramTotalMb?: number;
  ramUsedMb?: number;
  ramUsagePercent?: number;
  sharedBuffers?: string;
  workMem?: string;
  maintenanceWorkMem?: string;
  effectiveCacheSize?: string;
  maxConnections?: number;
  totalDatabasesCount: number;
  totalActiveConnections: number;
  totalSizeFormatted: string;
  status: 'healthy' | 'warning' | 'critical';
  dbUser?: string;
  dbPassword?: string;
  databases: DatabaseInfo[];
  fileLocations?: FileLocationSetting[];
  stuckQueries?: StuckQuery[];
  topTables?: TableSizeInfo[];
  snmpConfig?: SnmpConfig;
  snmpMetrics?: SnmpServerMetrics;
}

