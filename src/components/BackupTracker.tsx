import React, { useState, useEffect } from 'react';
import { BackupOverview, BackupEntry } from '../types/backup';
import { ServerInstance } from '../types/serverFleet';
import { HardDrive, CheckCircle2, Clock, ShieldCheck, Server, Database, Trash2, User, Globe, Lock, Terminal, X, Play, Folder, Key } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

interface BackupTrackerProps {
  backupOverview: BackupOverview;
  onTriggerBackup: (
    type: 'pg_dump' | 'pg_basebackup',
    customPath?: string,
    targetServerObj?: ServerInstance,
    targetDbNameParam?: string,
    sshParams?: {
      sshUser?: string;
      sshPassword?: string;
      sshHost?: string;
      sshPort?: number;
      targetFolder?: string;
      dbUser?: string;
    }
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
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'selected'>('all');

  // State for SSH Credentials Modal
  const [sshModalOpen, setSshModalOpen] = useState<boolean>(false);
  const [sshActionType, setSshActionType] = useState<'pg_dump' | 'pg_basebackup'>('pg_dump');
  const [sshUser, setSshUser] = useState<string>('root');
  const [sshPassword, setSshPassword] = useState<string>('');
  const [sshHost, setSshHost] = useState<string>('172.16.0.200');
  const [sshPort, setSshPort] = useState<string>('22');
  const [dbUser, setDbUser] = useState<string>('postgres');

  const currentServerName = server ? (server.name || server.host) : 'SRV-BD';
  const currentDbName = databaseName || 'northwind';

  const srvFolder = currentServerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dbFolder = currentDbName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const defaultFolderPath = `/backups/postgresql/${srvFolder}/${dbFolder}`;

  useEffect(() => {
    setTargetFolder(`/backups/postgresql/${srvFolder}/${dbFolder}`);
    if (server?.host) {
      setSshHost(server.host);
    }
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

  const handleOpenSshModal = (type: 'pg_dump' | 'pg_basebackup') => {
    setSshActionType(type);
    setSshModalOpen(true);
  };

  const handleConfirmSshBackup = () => {
    onTriggerBackup(
      sshActionType,
      targetFolder,
      server,
      currentDbName,
      {
        sshUser,
        sshPassword,
        sshHost,
        sshPort: Number(sshPort) || 22,
        targetFolder,
        dbUser
      }
    );
    setSshModalOpen(false);
  };

  const timestampSample = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const sampleFileName = sshActionType === 'pg_dump' 
    ? `backup_${currentDbName}_${timestampSample}.sql`
    : `basebackup_${currentDbName}_${timestampSample}`;
  
  const folderClean = targetFolder.replace(/\/$/, '');
  const passSample = sshPassword ? '••••••••' : 'sua_senha';

  const portFlagStr = sshPort && Number(sshPort) !== 22 ? `-p ${sshPort} ` : '';
  const previewCommand = sshActionType === 'pg_dump'
    ? `sshpass -p '${passSample}' ssh ${portFlagStr}-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${sshUser}@${sshHost} "mkdir -p ${folderClean} && sudo -u ${dbUser || 'postgres'} pg_dump -d ${currentDbName} -F c > ${folderClean}/${sampleFileName}"`
    : `sshpass -p '${passSample}' ssh ${portFlagStr}-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${sshUser}@${sshHost} "mkdir -p ${folderClean}/${sampleFileName} && sudo -u ${dbUser || 'postgres'} pg_basebackup -D ${folderClean}/${sampleFileName} -F p -P"`;

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
              Retenção de {backupOverview.retentionPolicyDays} dias ({server ? server.environment : 'Servidor Ativo'})
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
              {targetFolder || defaultFolderPath}
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

      {/* Manual Backup Trigger Section via SSH */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Executar Backup Direto via SSH (sshpass)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Crie diretórios e execute comandos de dump ou basebackup diretamente no servidor remoto</p>
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
                      setTargetFolder(`/backups/postgresql/${sName}/${dName}`);
                      setSshHost(foundSrv.host);
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
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center space-x-1">
              <Folder className="w-3.5 h-3.5 text-cyan-400" />
              <span>Caminho do Diretório Destino no Servidor Remoto:</span>
            </label>
            <input
              type="text"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              placeholder={defaultFolderPath}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="md:col-span-6 flex items-center space-x-3">
            <button
              onClick={() => handleOpenSshModal('pg_dump')}
              disabled={isTriggering}
              className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer whitespace-nowrap"
            >
              <Terminal className={`w-4 h-4 ${isTriggering && sshActionType === 'pg_dump' ? 'animate-spin' : ''}`} />
              <span>Iniciar Dump</span>
            </button>

            <button
              onClick={() => handleOpenSshModal('pg_basebackup')}
              disabled={isTriggering}
              className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer whitespace-nowrap"
            >
              <HardDrive className={`w-4 h-4 ${isTriggering && sshActionType === 'pg_basebackup' ? 'animate-spin' : ''}`} />
              <span>Iniciar BaseBackup</span>
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
                <th className="py-2.5 px-4">ID</th>
                <th className="py-2.5 px-4">Servidor</th>
                <th className="py-2.5 px-4">Banco</th>
                <th className="py-2.5 px-4">Tipo</th>
                <th className="py-2.5 px-4">Data e Hora</th>
                <th className="py-2.5 px-4">Tamanho</th>
                <th className="py-2.5 px-4">Caminho do Backup (Path)</th>
                <th className="py-2.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                    Nenhum backup registrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredBackups.map((bkp) => {
                  const db = bkp.databaseName || currentDbName;

                  return (
                    <tr key={bkp.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">{bkp.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-200">
                        <span className="flex items-center space-x-1">
                          <Server className="w-3 h-3 text-cyan-400 inline" />
                          <span>{bkp.serverName || bkp.serverId || currentServerName}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        <span className="flex items-center space-x-1">
                          <Database className="w-3 h-3 text-emerald-400 inline" />
                          <span>{db}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          bkp.type === 'pg_dump' 
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                            : 'bg-blue-950 text-blue-300 border-blue-800'
                        }`}>
                          {bkp.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">{formatDateTime(bkp.startTime)}</td>
                      <td className="py-3 px-4 font-mono text-emerald-300 font-semibold">{bkp.sizeFormatted}</td>
                      <td className="py-3 px-4 font-mono text-cyan-300 font-medium break-all select-all" title={bkp.location}>
                        {bkp.location}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {onDeleteBackup && (
                          <button
                            onClick={() => onDeleteBackup(bkp.id)}
                            title="Excluir este registro"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

      {/* SSH Authentication & Execution Modal */}
      {sshModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setSshModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-cyan-950 border border-cyan-800 rounded-xl text-cyan-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {sshActionType === 'pg_dump' ? 'Iniciar Dump via SSH (sshpass)' : 'Iniciar BaseBackup via SSH (sshpass)'}
                </h3>
                <p className="text-xs text-slate-400">
                  Informe o usuário e senha SSH para criar o diretório e executar o comando remoto.
                </p>
              </div>
            </div>

            {/* SSH Credentials Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Usuário SSH:</span>
                </label>
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Senha SSH (sshpass):</span>
                </label>
                <input
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Host / IP SSH:</span>
                </label>
                <input
                  type="text"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="172.16.0.200"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Porta SSH:
                </label>
                <input
                  type="text"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                  placeholder="22"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Usuário do Banco (`-U`):
                </label>
                <input
                  type="text"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  placeholder="postgres"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-emerald-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Banco (`datname`):
                </label>
                <input
                  type="text"
                  value={currentDbName}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-bold font-mono rounded-xl px-3 py-2 opacity-80"
                />
              </div>
            </div>

            {/* Command Preview */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 block">Comando CLI Executado via SSH:</span>
              <div className="font-mono text-[11px] text-cyan-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 overflow-x-auto select-all break-all leading-relaxed">
                {previewCommand}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setSshModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSshBackup}
                disabled={isTriggering}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 transition-all shadow-lg shadow-cyan-600/20 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
                <span>{isTriggering ? 'Executando SSH...' : 'Confirmar e Executar via SSH'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
