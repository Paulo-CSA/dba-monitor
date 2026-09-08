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
  defaultAuthMode: string;
  authModeLabel: string;
  authDescription: string;
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
    defaultAuthMode: 'SCRAM-SHA-256 / MD5',
    authModeLabel: 'Autenticação Nativa PostgreSQL',
    authDescription: 'Credenciais de usuário e senha salvas no catálogo interno (pg_authid).',
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
    defaultAuthMode: 'caching_sha2_password / mysql_native',
    authModeLabel: 'Autenticação Nativa MySQL',
    authDescription: 'Credenciais de usuário e senha da tabela mysql.user.',
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
    defaultAuthMode: 'SQL Server Authentication',
    authModeLabel: 'SQL Server Authentication (Login SQL e Senha)',
    authDescription: 'Autenticação direta com login e senha do SQL Server (Modo Misto / SQL Server Authentication com login sa ou criado na instância).',
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
  authMode?: string;
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
  isPrivateNetwork?: boolean;
  diagnostics?: string[];
}
