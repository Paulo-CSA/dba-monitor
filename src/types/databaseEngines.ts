import { DatabaseInfo } from './serverFleet';
import { StuckQuery } from './locks';
import { FileLocationSetting, PgSystemConfig } from './config';

export type DatabaseEngineType = 'postgres' | 'mysql' | 'mssql';

export interface DatabaseEngineMetadata {
  id: DatabaseEngineType;
  name: string;
  shortName: string;
  defaultPort: number;
  defaultUser: string;
  defaultDatabase: string;
  defaultVersionQuery: string;
  databasesCatalogQuery: string;
  processesQuery: string;
  iconColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  tag: string;
}

export const DATABASE_ENGINES: Record<DatabaseEngineType, DatabaseEngineMetadata> = {
  postgres: {
    id: 'postgres',
    name: 'PostgreSQL',
    shortName: 'Postgres',
    defaultPort: 5432,
    defaultUser: 'postgres',
    defaultDatabase: 'postgres',
    defaultVersionQuery: 'SELECT version();',
    databasesCatalogQuery: 'SELECT datname FROM pg_database WHERE datistemplate = false;',
    processesQuery: 'SELECT * FROM pg_stat_activity;',
    iconColor: '#38bdf8', // sky/cyan
    badgeBg: 'bg-sky-950/60',
    badgeBorder: 'border-sky-700/60',
    badgeText: 'text-sky-300',
    tag: 'PG'
  },
  mysql: {
    id: 'mysql',
    name: 'MySQL',
    shortName: 'MySQL',
    defaultPort: 3306,
    defaultUser: 'root',
    defaultDatabase: 'mysql',
    defaultVersionQuery: 'SELECT VERSION();',
    databasesCatalogQuery: 'SHOW DATABASES;',
    processesQuery: 'SHOW FULL PROCESSLIST;',
    iconColor: '#f97316', // orange/amber
    badgeBg: 'bg-orange-950/60',
    badgeBorder: 'border-orange-700/60',
    badgeText: 'text-orange-300',
    tag: 'MYSQL'
  },
  mssql: {
    id: 'mssql',
    name: 'Microsoft SQL Server',
    shortName: 'MS SQL',
    defaultPort: 1433,
    defaultUser: 'sa',
    defaultDatabase: 'master',
    defaultVersionQuery: 'SELECT @@VERSION;',
    databasesCatalogQuery: 'SELECT name FROM sys.databases WHERE state = 0;',
    processesQuery: 'SELECT * FROM sys.dm_exec_sessions;',
    iconColor: '#ef4444', // red/rose
    badgeBg: 'bg-red-950/60',
    badgeBorder: 'border-red-700/60',
    badgeText: 'text-red-300',
    tag: 'MSSQL'
  }
};

export interface EngineConnectParams {
  host: string;
  port: number;
  dbUser: string;
  dbPassword?: string;
  database?: string;
  engine?: DatabaseEngineType;
}

export interface EngineConnectResult {
  success: boolean;
  isLive: boolean;
  message: string;
  engine: DatabaseEngineType;
  serverVersion?: string;
  pgVersion?: string; // Kept for 100% backward compatibility with existing components
  uptimeFormatted?: string;
  uptimeSeconds?: number;
  sharedBuffers?: string;
  workMem?: string;
  maintenanceWorkMem?: string;
  effectiveCacheSize?: string;
  maxConnections?: number;
  ramTotalMb?: number;
  databases?: DatabaseInfo[];
  stuckQueries?: StuckQuery[];
  sysConfig?: PgSystemConfig;
  error?: string;
}
