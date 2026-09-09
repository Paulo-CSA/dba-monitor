export const SYSTEM_DATABASE_NAMES = new Set([
  'postgres',
  'template0',
  'template1',
  'root',
  'master',
  'tempdb',
  'model',
  'msdb',
  'mysql',
  'information_schema',
  'performance_schema',
  'sys'
]);

/**
 * Checks if a given database name belongs to a system / internal catalog
 * (PostgreSQL: postgres/template*, MSSQL: master/tempdb/model/msdb, MySQL: mysql/sys/schemas)
 */
export function isSystemDatabase(dbName?: string | null): boolean {
  if (!dbName) return false;
  return SYSTEM_DATABASE_NAMES.has(dbName.toLowerCase().trim());
}
