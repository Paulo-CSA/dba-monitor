import React, { useState, useEffect } from 'react';
import { BackupOverview } from '../types/backup';
import { ServerInstance } from '../types/serverFleet';
import { HardDrive, CheckCircle2, Clock, ShieldCheck, Plus, Play, Server, Database, Trash2, Filter } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

interface BackupTrackerProps {
  backupOverview: BackupOverview;
  onTriggerBackup: (
    type: 'pg_dump' | 'pg_basebackup',
    customPath?: string,
    targetServerObj?: ServerInstance,
    targetDbNameParam?: string
  ) => void;
  onDeleteBackup?: (id: string) => void;
  onClearAllBackups?: () => void;
  isTriggering: boolean;
  server?: ServerInstance;
  databaseName?: string;
  servers?: ServerInstance[];
  onSelectServer?: (serverId: string) => void;
  onSelectDatabase?: (dbName: string) => void;
}

export const BackupTracker: React.FC<BackupTrackerProps> = ({
  backupOverview,
  onTriggerBackup,
  onDeleteBackup,
  onClearAllBackups,
  isTriggering,
  server,
  databaseName,
  servers = [],
  onSelectServer,
  onSelectDatabase
}) => {
  const [selectedType, setSelectedType] = useState<'pg_basebackup' | 'pg_dump'>('pg_basebackup');
  const [customPath, setCustomPath] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'selected'>('all');

  const currentServerName = server ? (server.name || server.host) : 'Servidor Central';
  const currentDbName = databaseName || 'postgres';

  const srvFolder = currentServerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dbFolder = currentDbName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const defaultPath = `/database/backups/postgresql/${srvFolder}/${dbFolder}/`;

  useEffect(() => {
    setCustomPath(`/database/backups/postgresql/${srvFolder}/${dbFolder}/`);
  }, [server?.id, server?.name, server?.host, databaseName, srvFolder, dbFolder]);

  const totalSizeFormatted = server ? server.totalSizeFormatted : backupOverview.totalBackupSizeFormatted;

  const filteredBackups = backupOverview.recentBackups.filter((b) => {
    if (filterMode === 'all') return true;
    const matchSrv =
      (b.serverId && server?.id && b.serverId === server.id) ||
      (b.serverName && b.serverName === currentServerName) ||
      (b.serverHost && server?.host && b.serverHost === server.host) ||
      (!b.serverId && !b.serverName && !b.serverHost);

    const matchDb =
      (b.databaseName && b.databaseName === currentDbName) ||
      (!b.databaseName);

    return matchSrv && matchDb;
  });

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold uppercase">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Último Backup Realizado</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-white block">
              {backupOverview.timeSinceLastBackupFormatted}
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">
              {formatDateTime(backupOverview.lastBackupTimestamp)}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold uppercase">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Status da Política</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-emerald-400 uppercase">
              {backupOverview.backupHealthStatus}
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">
              Retenção de {backupOverview.retentionPolicyDays} dias ({server ? server.environment : 'S3 Global'})
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold uppercase">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span>Storage do Servidor</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-white">
              {totalSizeFormatted}
            </span>
            <span className="text-xs text-slate-400 block mt-0.5 font-mono truncate">
              {`s3://pg-backups/${srvFolder}/${dbFolder}/`}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold uppercase">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Arquivamento WAL</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-cyan-300 uppercase">
              {backupOverview.walArchiveStatus}
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">
              {backupOverview.walArchivedCount} segmentos salvos
            </span>
          </div>
        </div>
      </div>

      {/* Manual Backup Trigger Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Disparar Backup Manual Imediato</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Execute um backup físico (pg_basebackup) ou exportação lógica de esquemas (pg_dump)</p>
          </div>

          <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl px-3 py-2 flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Servidor:</span>
              {servers.length > 1 && onSelectServer ? (
                <select
                  value={server?.id || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    onSelectServer(selectedId);
                    const foundSrv = servers.find((s) => s.id === selectedId);
                    if (foundSrv) {
                      const sName = (foundSrv.name || foundSrv.host).replace(/[^a-zA-Z0-9_-]/g, '_');
                      const dName = (foundSrv.databases[0]?.datname || currentDbName || 'postgres').replace(/[^a-zA-Z0-9_-]/g, '_');
                      setCustomPath(`/database/backups/postgresql/${sName}/${dName}/`);
                    }
                  }}
                  className="bg-slate-900 border border-slate-700 text-white text-xs font-bold font-mono rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {servers.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name || srv.host}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold font-mono text-white">{currentServerName}</span>
              )}
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Banco:</span>
              {server && server.databases.length > 0 && onSelectDatabase ? (
                <select
                  value={currentDbName}
                  onChange={(e) => onSelectDatabase(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-bold font-mono rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {server.databases.map((db) => (
                    <option key={db.datname} value={db.datname}>
                      {db.datname}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold font-mono text-emerald-400">{currentDbName}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Caminho de Destino Específico no Servidor ({currentServerName} / {currentDbName}):
            </label>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder={defaultPath}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Tipo de Backup:
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'pg_basebackup' | 'pg_dump')}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="pg_basebackup">pg_basebackup (Físico Completo)</option>
              <option value="pg_dump">pg_dump (Lógico de Tabelas)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              onClick={() => onTriggerBackup(selectedType, customPath, server, currentDbName)}
              disabled={isTriggering}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer whitespace-nowrap"
            >
              <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'Gerando...' : 'Iniciar Backup'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-sm font-bold text-white">Histórico e Registro de Backups</h3>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({backupOverview.recentBackups.length})
              </button>
              <button
                onClick={() => setFilterMode('selected')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  filterMode === 'selected'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {currentServerName} / {currentDbName}
              </button>
            </div>
          </div>

          {backupOverview.recentBackups.length > 0 && onClearAllBackups && (
            <button
              onClick={onClearAllBackups}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Todos os Logs</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">ID / Identificador</th>
                <th className="py-2.5 px-4">Servidor</th>
                <th className="py-2.5 px-4">Banco (`datname`)</th>
                <th className="py-2.5 px-4">Tipo & Comando CLI Executado</th>
                <th className="py-2.5 px-4">Data e Hora</th>
                <th className="py-2.5 px-4">Tamanho</th>
                <th className="py-2.5 px-4">Status & Integridade</th>
                <th className="py-2.5 px-4">Destino no Storage</th>
                <th className="py-2.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                    Nenhum backup registrado para os filtros selecionados. Clique em &quot;Iniciar Backup&quot; para disparar um backup.
                  </td>
                </tr>
              ) : (
                filteredBackups.map((bkp) => {
                  const host = bkp.serverHost || bkp.serverName || 'localhost';
                  const db = bkp.databaseName || 'postgres';
                  const cmdStr = bkp.command || (bkp.type === 'pg_dump'
                    ? `pg_dump -h ${host} -p 5432 -U postgres -d ${db} -F c -f "${bkp.location}"`
                    : `pg_basebackup -h ${host} -p 5432 -U postgres -D "${bkp.location}" -F t -z`);

                  return (
                    <tr key={bkp.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">{bkp.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-200">
                        <span className="flex items-center space-x-1">
                          <Server className="w-3 h-3 text-cyan-400 inline" />
                          <span>{bkp.serverName || bkp.serverId || 'Servidor Central'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        <span className="flex items-center space-x-1">
                          <Database className="w-3 h-3 text-emerald-400 inline" />
                          <span>{db}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">
                          {bkp.type}
                        </span>
                        <div
                          className="mt-1 text-[10px] text-cyan-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono max-w-xs truncate cursor-help"
                          title={cmdStr}
                        >
                          {cmdStr}
                        </div>
                      </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">{formatDateTime(bkp.startTime)}</td>
                    <td className="py-3 px-4 font-mono text-emerald-300 font-semibold">{bkp.sizeFormatted}</td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {bkp.status.toUpperCase()}
                        </span>
                        {bkp.verifiedIntegrity && (
                          <span className="text-[10px] text-cyan-400 font-semibold">(Integridade OK)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 truncate max-w-xs" title={bkp.location}>
                      {bkp.location}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onDeleteBackup && (
                        <button
                          onClick={() => onDeleteBackup(bkp.id)}
                          title="Excluir este registro de log"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
