import { EngineConnectParams, EngineConnectResult, DatabaseEngineType } from '../types/databaseEngines';
import { testAndFetchLivePgData } from './pgLiveService';
import { testAndFetchLiveMysqlData } from './mysqlService';
import { testAndFetchLiveMssqlData } from './mssqlService';

/**
 * Dispatches test-connection and metadata probing to the appropriate database engine service.
 * Preserves 100% of the existing PostgreSQL logic without modification.
 */
export async function dispatchTestConnection(params: EngineConnectParams): Promise<EngineConnectResult> {
  const engine: DatabaseEngineType = params.engine || 'postgres';

  switch (engine) {
    case 'mysql':
      return await testAndFetchLiveMysqlData(params);

    case 'mssql':
      return await testAndFetchLiveMssqlData(params);

    case 'postgres':
    default: {
      const pgResult = await testAndFetchLivePgData({
        host: params.host,
        port: params.port || 5432,
        dbUser: params.dbUser || 'postgres',
        dbPassword: params.dbPassword,
        database: params.database || 'postgres',
        sslMode: params.sslMode,
        ssl: params.ssl
      });
      return {
        ...pgResult,
        engine: 'postgres',
        serverVersion: pgResult.pgVersion
      };
    }
  }
}
