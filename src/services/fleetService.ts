import { ServerInstance, DatabaseInfo } from '../types/serverFleet';

export const mockServerFleet: ServerInstance[] = [
  {
    id: 'srv-prod-us-01',
    name: 'PostgreSQL Prod Principal',
    host: 'pg-prod-us1.internal.cloud',
    port: 5432,
    environment: 'Produção',
    pgVersion: 'PostgreSQL 16.2',
    uptimeFormatted: '48d 14h 22m',
    cpuUsagePercent: 42,
    avgLatencyMs: 3.8,
    totalDatabasesCount: 5,
    totalActiveConnections: 142,
    totalSizeFormatted: '482.5 GB',
    status: 'healthy',
    databases: [
      {
        datname: 'production_db',
        sizeBytes: 298492000000,
        sizeFormatted: '278.0 GB',
        activeConnections: 78,
        maxConnections: 200,
        tps: 1240,
        cacheHitRatio: 99.4,
        owner: 'app_master',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'orders_catalog_db',
        sizeBytes: 112000000000,
        sizeFormatted: '104.3 GB',
        activeConnections: 34,
        maxConnections: 100,
        tps: 480,
        cacheHitRatio: 98.9,
        owner: 'orders_service',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'users_auth_db',
        sizeBytes: 48500000000,
        sizeFormatted: '45.1 GB',
        activeConnections: 22,
        maxConnections: 100,
        tps: 310,
        cacheHitRatio: 99.7,
        owner: 'auth_admin',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'audit_logs_db',
        sizeBytes: 58000000000,
        sizeFormatted: '54.0 GB',
        activeConnections: 6,
        maxConnections: 50,
        tps: 45,
        cacheHitRatio: 97.2,
        owner: 'sec_auditor',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'postgres',
        sizeBytes: 1200000000,
        sizeFormatted: '1.1 GB',
        activeConnections: 2,
        maxConnections: 20,
        tps: 2,
        cacheHitRatio: 99.9,
        owner: 'postgres',
        encoding: 'UTF8',
        status: 'online'
      }
    ]
  },
  {
    id: 'srv-prod-eu-02',
    name: 'PostgreSQL Prod Secundário',
    host: 'pg-prod-eu2.internal.cloud',
    port: 5432,
    environment: 'Produção',
    pgVersion: 'PostgreSQL 16.1',
    uptimeFormatted: '19d 08h 11m',
    cpuUsagePercent: 68,
    avgLatencyMs: 6.2,
    totalDatabasesCount: 4,
    totalActiveConnections: 98,
    totalSizeFormatted: '310.2 GB',
    status: 'healthy',
    databases: [
      {
        datname: 'eu_clients_db',
        sizeBytes: 185000000000,
        sizeFormatted: '172.2 GB',
        activeConnections: 52,
        maxConnections: 150,
        tps: 820,
        cacheHitRatio: 99.1,
        owner: 'eu_app_user',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'gdpr_compliance_store',
        sizeBytes: 88000000000,
        sizeFormatted: '81.9 GB',
        activeConnections: 28,
        maxConnections: 100,
        tps: 210,
        cacheHitRatio: 98.6,
        owner: 'gdpr_service',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'billing_finance_db',
        sizeBytes: 58000000000,
        sizeFormatted: '54.0 GB',
        activeConnections: 16,
        maxConnections: 50,
        tps: 140,
        cacheHitRatio: 99.5,
        owner: 'fin_app',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'postgres',
        sizeBytes: 1100000000,
        sizeFormatted: '1.0 GB',
        activeConnections: 2,
        maxConnections: 20,
        tps: 1,
        cacheHitRatio: 99.9,
        owner: 'postgres',
        encoding: 'UTF8',
        status: 'online'
      }
    ]
  },
  {
    id: 'srv-analytics-03',
    name: 'Cluster Homologação Analytics',
    host: 'pg-homolog.internal.cloud',
    port: 5433,
    environment: 'Homologação',
    pgVersion: 'PostgreSQL 15.6',
    uptimeFormatted: '102d 03h 40m',
    cpuUsagePercent: 88,
    avgLatencyMs: 18.5,
    totalDatabasesCount: 3,
    totalActiveConnections: 31,
    totalSizeFormatted: '1.8 TB',
    status: 'warning',
    databases: [
      {
        datname: 'dw_events_bi',
        sizeBytes: 1450000000000,
        sizeFormatted: '1.35 TB',
        activeConnections: 18,
        maxConnections: 50,
        tps: 340,
        cacheHitRatio: 94.2,
        owner: 'bi_analyst',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'ml_feature_store',
        sizeBytes: 420000000000,
        sizeFormatted: '391.1 GB',
        activeConnections: 11,
        maxConnections: 40,
        tps: 180,
        cacheHitRatio: 96.8,
        owner: 'data_science',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'postgres',
        sizeBytes: 1200000000,
        sizeFormatted: '1.1 GB',
        activeConnections: 2,
        maxConnections: 20,
        tps: 1,
        cacheHitRatio: 99.9,
        owner: 'postgres',
        encoding: 'UTF8',
        status: 'online'
      }
    ]
  },
  {
    id: 'srv-staging-04',
    name: 'PostgreSQL Desenvolvimento',
    host: 'pg-dev.internal.cloud',
    port: 5432,
    environment: 'Desenvolvimento',
    pgVersion: 'PostgreSQL 16.2',
    uptimeFormatted: '5d 11h 04m',
    cpuUsagePercent: 12,
    avgLatencyMs: 1.9,
    totalDatabasesCount: 3,
    totalActiveConnections: 14,
    totalSizeFormatted: '45.8 GB',
    status: 'healthy',
    databases: [
      {
        datname: 'dev_main',
        sizeBytes: 32000000000,
        sizeFormatted: '29.8 GB',
        activeConnections: 8,
        maxConnections: 100,
        tps: 65,
        cacheHitRatio: 99.8,
        owner: 'dev_team',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'dev_sandbox',
        sizeBytes: 16000000000,
        sizeFormatted: '14.9 GB',
        activeConnections: 4,
        maxConnections: 50,
        tps: 20,
        cacheHitRatio: 99.2,
        owner: 'qa_team',
        encoding: 'UTF8',
        status: 'online'
      },
      {
        datname: 'postgres',
        sizeBytes: 1200000000,
        sizeFormatted: '1.1 GB',
        activeConnections: 2,
        maxConnections: 20,
        tps: 1,
        cacheHitRatio: 99.9,
        owner: 'postgres',
        encoding: 'UTF8',
        status: 'online'
      }
    ]
  }
];
