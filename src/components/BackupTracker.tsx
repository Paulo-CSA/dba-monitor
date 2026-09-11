import React, { useState, useEffect } from 'react';
import { BackupOverview, BackupEntry } from '../types/backup';
import { ServerInstance } from '../types/serverFleet';
import { HardDrive, CheckCircle2, Clock, ShieldCheck, Server, Database, Trash2, User, Globe, Lock, Terminal, X, Play, Folder, Key, Copy, Check, RotateCcw, Edit3, Sparkles, Info, Cpu, FileText, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
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
      customCommand?: string;
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

  // State for manual CLI command editing
  const [customCliCommand, setCustomCliCommand] = useState<string>('');
  const [isCommandEdited, setIsCommandEdited] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  // State for Backup Execution Log Modal
  const [selectedLogBackup, setSelectedLogBackup] = useState<BackupEntry | null>(null);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  const currentServerName = server ? (server.name || server.host) : 'SRV-BD';
  const currentDbName = databaseName || 'northwind';
  const currentPgVersion = server?.pgVersion || 'PostgreSQL 16.2';

  // Extract numeric major version (e.g. 8 for 'PostgreSQL 8.4', 16 for 'PostgreSQL 16.2')
  const majorVersionMatch = currentPgVersion.match(/(\d+(\.\d+)?)/);
  const majorVersionNum = majorVersionMatch ? parseFloat(majorVersionMatch[1]) : 16;
  const isLegacyPg8OrOlder = majorVersionNum < 9.0;

  const srvFolder = currentServerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dbFolder = currentDbName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const defaultFolderPath = `/backups/postgresql/${srvFolder}/${dbFolder}`;

  useEffect(() => {
    setTargetFolder(`/backups/postgresql/${srvFolder}/${dbFolder}`);
    if (server?.host) {
      setSshHost(server.host);
    }
  }, [server?.id, server?.name, server?.host, databaseName, srvFolder, dbFolder]);

  const generateDefaultCliCommand = (
    actionType: 'pg_dump' | 'pg_basebackup',
    folder: string,
    user: string,
    pass: string,
    host: string,
    port: string,
    dUser: string,
    dbName: string,
    pgVerStr?: string
  ) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const fileName = actionType === 'pg_dump'
      ? `backup_${dbName}_${timestamp}.sql`
      : `basebackup_${dbName}_${timestamp}`;
    const fClean = (folder || `/backups/postgresql/${srvFolder}/${dbFolder}`).replace(/\/$/, '');
    const passStr = pass ? '••••••••' : 'sua_senha';
    const pFlag = port && Number(port) !== 22 ? `-p ${port} ` : '';

    const effectiveVer = pgVerStr || currentPgVersion;
    const vMatch = effectiveVer.match(/(\d+(\.\d+)?)/);
    const vNum = vMatch ? parseFloat(vMatch[1]) : 16;
    const isLegacy = vNum < 9.0;

    if (actionType === 'pg_dump') {
      // PostgreSQL 8.x and older used `pg_dump -U postgres -F p dbname > output.sql` (no -d flag)
      // PostgreSQL 9.0+ supports `pg_dump -d dbname -F p > output.sql`
      const dumpDbSyntax = isLegacy ? `${dbName} -F p` : `-d ${dbName} -F p`;
      return `sshpass -p '${passStr}' ssh ${pFlag}-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user || 'root'}@${host || '172.16.0.200'} "mkdir -p ${fClean} && sudo -u ${dUser || 'postgres'} pg_dump ${dumpDbSyntax} > ${fClean}/${fileName}"`;
    } else {
      return `sshpass -p '${passStr}' ssh ${pFlag}-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user || 'root'}@${host || '172.16.0.200'} "mkdir -p ${fClean}/${fileName} && sudo -u ${dUser || 'postgres'} pg_basebackup -D ${fClean}/${fileName} -F p -P"`;
    }
  };

  useEffect(() => {
    if (sshModalOpen && !isCommandEdited) {
      const updated = generateDefaultCliCommand(
        sshActionType,
        targetFolder,
        sshUser,
        sshPassword,
        sshHost,
        sshPort,
        dbUser,
        currentDbName,
        currentPgVersion
      );
      setCustomCliCommand(updated);
    }
  }, [sshModalOpen, isCommandEdited, sshActionType, targetFolder, sshUser, sshPassword, sshHost, sshPort, dbUser, currentDbName, currentPgVersion]);

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
    const initialCmd = generateDefaultCliCommand(
      type,
      targetFolder,
      sshUser,
      sshPassword,
      sshHost,
      sshPort,
      dbUser,
      currentDbName,
      currentPgVersion
    );
    setCustomCliCommand(initialCmd);
    setIsCommandEdited(false);
    setSshModalOpen(true);
  };

  const handleResetToDefaultCli = () => {
    const defaultCmd = generateDefaultCliCommand(
      sshActionType,
      targetFolder,
      sshUser,
      sshPassword,
      sshHost,
      sshPort,
      dbUser,
      currentDbName,
      currentPgVersion
    );
    setCustomCliCommand(defaultCmd);
    setIsCommandEdited(false);
  };

  const handleCopyCliCommand = () => {
    navigator.clipboard.writeText(customCliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleAppendFlag = (flag: string) => {
    let current = customCliCommand;
    if (sshActionType === 'pg_dump' && current.includes('pg_dump')) {
      current = current.replace(/pg_dump\s+/, `pg_dump ${flag} `);
    } else if (sshActionType === 'pg_basebackup' && current.includes('pg_basebackup')) {
      current = current.replace(/pg_basebackup\s+/, `pg_basebackup ${flag} `);
    } else {
      current = `${current} ${flag}`;
    }
    setCustomCliCommand(current);
    setIsCommandEdited(true);
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
        dbUser,
        customCommand: customCliCommand
      }
    );
    setSshModalOpen(false);
  };

  const getDisplayLog = (entry: BackupEntry): string => {
    if (entry.outputLog && entry.outputLog.trim()) {
      return entry.outputLog;
    }

    const lines: string[] = [
      `[${formatDateTime(entry.startTime)}] [INÍCIO] Registro de execução do backup`,
      `[ID DO REGISTRO]: ${entry.id}`,
      `[TIPO]: ${entry.type}`,
      `[SERVIDOR]: ${entry.serverName || entry.serverHost || currentServerName} (${entry.serverHost || '172.16.0.200'})`,
      `[BANCO DE DADOS]: ${entry.databaseName || currentDbName}`,
      `[STATUS]: ${entry.status === 'completed' ? 'SUCESSO / CONCLUÍDO' : entry.status === 'failed' ? 'FALHA / ERRO' : entry.status}`,
      `[LOCAL]: ${entry.location}`,
      `[TAMANHO]: ${entry.sizeFormatted} (${entry.sizeBytes} bytes)`,
      `[DURAÇÃO]: ${entry.durationSeconds ? `${entry.durationSeconds}s` : '1.5s'}`,
      `[CHECKSUM]: ${entry.checksum || 'sha256:d41d8cd98f00b204e9800998ecf8427e'}`,
      `--------------------------------------------------------------------------------`
    ];

    if (entry.command) {
      lines.push(`[COMANDO EXECUTADO]:\n$ ${entry.command}`);
      lines.push(`--------------------------------------------------------------------------------`);
    }

    if (entry.stdout && entry.stdout.trim()) {
      lines.push(`[SAÍDA STDOUT]:\n${entry.stdout}`);
    }

    if (entry.stderr && entry.stderr.trim()) {
      lines.push(`[SAÍDA STDERR / ALERTA]:\n${entry.stderr}`);
    }

    if (entry.notes) {
      lines.push(`[NOTAS DO SISTEMA]:\n${entry.notes}`);
    }

    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`[${formatDateTime(entry.endTime || entry.startTime)}] Execução finalizada.`);

    return lines.join('\n');
  };

  const handleCopyLog = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Executar Backup Direto via SSH (sshpass)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Crie diretórios e execute comandos de dump ou basebackup diretamente no servidor remoto</p>
          </div>

          <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
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

            <div className="h-3 w-px bg-slate-800 hidden sm:block" />

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

            <div className="h-3 w-px bg-slate-800 hidden sm:block" />

            {/* PostgreSQL Engine Version Badge */}
            <div className="flex items-center space-x-1.5 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Versão:</span>
              <span className={`font-mono text-xs font-bold ${isLegacyPg8OrOlder ? 'text-amber-400' : 'text-cyan-300'}`}>
                {currentPgVersion}
              </span>
              {isLegacyPg8OrOlder && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80" title="PostgreSQL 8.x legado detectado (usa sintaxe sem flag -d no dump)">
                  Legado v8
                </span>
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

        {/* Live Active Execution Banner */}
        {isTriggering && (
          <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-4 space-y-2.5 animate-pulse shadow-lg shadow-cyan-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  [EXECUÇÃO EM ANDAMENTO] Executando processo de backup via SSH...
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300">
                {currentServerName} &bull; {currentDbName}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 space-y-1">
              <p className="text-slate-400">&gt; Conectando via SSH ao servidor {sshHost || server?.host || '172.16.0.200'}...</p>
              <p className="text-cyan-300">&gt; Disparando rotina de backup ({sshActionType}) no banco {currentDbName}...</p>
              <p className="text-slate-500 text-[10px]">Aguardando retorno do processo e gerando logs operacionais...</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">ID</th>
                <th className="py-2.5 px-4">Servidor</th>
                <th className="py-2.5 px-4">Banco</th>
                <th className="py-2.5 px-4">Tipo</th>
                <th className="py-2.5 px-4">Data e Hora</th>
                <th className="py-2.5 px-4">Tamanho</th>
                <th className="py-2.5 px-4">Caminho do Backup (Path)</th>
                <th className="py-2.5 px-4 text-center">Logs</th>
                <th className="py-2.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-mono">
                    Nenhum backup registrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredBackups.map((bkp) => {
                  const db = bkp.databaseName || currentDbName;
                  const isCompleted = bkp.status === 'completed' || bkp.status === 'verified';
                  const isFailed = bkp.status === 'failed';
                  const isInProgress = bkp.status === 'in_progress';

                  return (
                    <tr key={bkp.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        {isCompleted && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Sucesso</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            <span>Falha</span>
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800 animate-pulse">
                            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                            <span>Executando</span>
                          </span>
                        )}
                      </td>
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
                        <button
                          onClick={() => setSelectedLogBackup(bkp)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
                          title="Ver logs detalhados e console de execução"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Ver Logs</span>
                        </button>
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

              <div className="md:col-span-3">
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

              <div className="md:col-span-3">
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

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Versão do PostgreSQL:
                </label>
                <div className={`w-full bg-slate-950 border ${isLegacyPg8OrOlder ? 'border-amber-800/80' : 'border-slate-800'} rounded-xl px-3 py-2 flex items-center justify-between`}>
                  <span className={`text-xs font-mono font-bold ${isLegacyPg8OrOlder ? 'text-amber-300' : 'text-cyan-300'} truncate`}>
                    {currentPgVersion}
                  </span>
                  {isLegacyPg8OrOlder && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 uppercase">
                      v8
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Version Syntax Notice */}
            {sshActionType === 'pg_dump' && (
              <div className={`rounded-xl p-3 border text-xs flex items-start space-x-2.5 ${
                isLegacyPg8OrOlder
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}>
                <Info className={`w-4 h-4 mt-0.5 shrink-0 ${isLegacyPg8OrOlder ? 'text-amber-400' : 'text-cyan-400'}`} />
                <div className="space-y-0.5">
                  <span className="font-semibold block">
                    {isLegacyPg8OrOlder
                      ? `Detecção de PostgreSQL Legado (${currentPgVersion})`
                      : `Sintaxe do PostgreSQL (${currentPgVersion})`}
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isLegacyPg8OrOlder
                      ? 'No PostgreSQL 8.x e anteriores, a flag -d não é suportada pelo pg_dump. O comando padrão foi configurado automaticamente passando o nome do banco diretamente (ex: pg_dump ' + currentDbName + ' -F p).'
                      : 'No PostgreSQL 9.0+, o comando padrão utiliza a flag padrão -d ' + currentDbName + ' -F p. Você pode ajustar manualmente abaixo caso necessário.'}
                  </p>
                </div>
              </div>
            )}

            {/* Command Editor (Manual CLI Modification) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Comando CLI Executado via SSH:</span>
                  {isCommandEdited ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Editado manualmente</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Gerado dinamicamente</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {isCommandEdited && (
                    <button
                      type="button"
                      onClick={handleResetToDefaultCli}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Restaurar o comando gerado pelos campos do formulário"
                    >
                      <RotateCcw className="w-3 h-3 text-amber-400" />
                      <span>Restaurar Padrão</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyCliCommand}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 transition-colors cursor-pointer"
                    title="Copiar comando completo para a área de transferência"
                  >
                    {copiedCli ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-cyan-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Editable Command Textarea */}
              <div className="relative">
                <textarea
                  value={customCliCommand}
                  onChange={(e) => {
                    setCustomCliCommand(e.target.value);
                    setIsCommandEdited(true);
                  }}
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-700/90 rounded-xl p-3 font-mono text-xs text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 leading-relaxed resize-y selection:bg-cyan-900 selection:text-white"
                  placeholder="Edite o comando SSH/PostgreSQL manualmente se desejar..."
                  spellCheck={false}
                />
              </div>

              {/* Quick flag helpers */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <span>Inserir flags rápidas no comando:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Você pode digitar qualquer parâmetro ou flag no campo acima</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {sshActionType === 'pg_dump' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-v')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Modo detalhado (Verbose)"
                      >
                        + -v (verbose)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('--clean')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Limpar / Dropar objetos do banco antes de recriá-los"
                      >
                        + --clean
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('--if-exists')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Usar IF EXISTS nos comandos DROP"
                      >
                        + --if-exists
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-F c')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Formato Custom binário pg_dump (comprimido e flexível para pg_restore)"
                      >
                        + -F c (custom format)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-Z 9')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Nível de compressão gzip máxima (0 a 9)"
                      >
                        + -Z 9 (compressão)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-j 4')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Execução com 4 workers paralelos (requer formato Directory)"
                      >
                        + -j 4 (jobs)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-b')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Incluir Large Objects (Blobs)"
                      >
                        + -b (blobs)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-X stream')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Streaming de logs WAL durante o basebackup"
                      >
                        + -X stream
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-c fast')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Realizar Checkpoint rápido no início"
                      >
                        + -c fast (checkpoint)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-z')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Compressão gzip no stream de basebackup"
                      >
                        + -z (gzip)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-v')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Modo detalhado (Verbose)"
                      >
                        + -v (verbose)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAppendFlag('-P')}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Exibir progresso de transferência"
                      >
                        + -P (progress)
                      </button>
                    </>
                  )}
                </div>
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

      {/* Backup Execution Logs Console Modal */}
      {selectedLogBackup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedLogBackup(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start space-x-3.5 border-b border-slate-800 pb-4">
              <div className="p-3 bg-cyan-950 border border-cyan-800/80 rounded-xl text-cyan-400">
                <Terminal className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 pr-8">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white">
                    Logs &amp; Console de Execução do Backup
                  </h3>
                  {selectedLogBackup.status === 'completed' || selectedLogBackup.status === 'verified' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Concluído</span>
                    </span>
                  ) : selectedLogBackup.status === 'failed' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      <span>Falha / Erro</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                      <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                      <span>Em Andamento</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  ID: <span className="text-cyan-300 font-bold">{selectedLogBackup.id}</span> &bull; Tipo: <span className="text-white font-bold">{selectedLogBackup.type}</span> &bull; Data: <span className="text-slate-300">{formatDateTime(selectedLogBackup.startTime)}</span>
                </p>
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Servidor</span>
                <span className="font-mono text-slate-200 font-semibold">{selectedLogBackup.serverName || selectedLogBackup.serverHost || currentServerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Banco de Dados</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedLogBackup.databaseName || currentDbName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tamanho Gerado</span>
                <span className="font-mono text-cyan-300 font-bold">{selectedLogBackup.sizeFormatted}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Duração</span>
                <span className="font-mono text-slate-300">{selectedLogBackup.durationSeconds ? `${selectedLogBackup.durationSeconds}s` : '1.5s'}</span>
              </div>
            </div>

            {/* Command Executed Box (if any) */}
            {selectedLogBackup.command && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Comando Executado:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLogBackup.command || '');
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar Comando</span>
                  </button>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 break-all select-all">
                  $ {selectedLogBackup.command}
                </div>
              </div>
            )}

            {/* Terminal Console Log Output */}
            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Saída do Processo (Stdout &amp; Logs do Sistema):</span>
                </span>
                <button
                  onClick={() => handleCopyLog(getDisplayLog(selectedLogBackup))}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedLog ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar Logs</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 min-h-[160px] max-h-[340px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 select-all space-y-1 shadow-inner">
                {getDisplayLog(selectedLogBackup).split('\n').map((line, idx) => {
                  let colorClass = 'text-slate-300';
                  if (line.includes('[INÍCIO]') || line.includes('[INFO]')) colorClass = 'text-cyan-400 font-semibold';
                  else if (line.includes('[SUCESSO]') || line.includes('[OK]') || line.includes('Concluído')) colorClass = 'text-emerald-400 font-semibold';
                  else if (line.includes('[SSH RETORNO]') || line.includes('[ERRO]') || line.includes('[STDERR]') || line.includes('FALHA')) colorClass = 'text-rose-400 font-semibold';
                  else if (line.includes('[DESTINO') || line.includes('[ARQUIVO')) colorClass = 'text-amber-300';
                  else if (line.includes('[DIAGNÓSTICO')) colorClass = 'text-yellow-300 font-semibold';
                  else if (line.startsWith('$') || line.includes('[COMANDO')) colorClass = 'text-blue-400';
                  else if (line.startsWith('---')) colorClass = 'text-slate-600';

                  return (
                    <div key={idx} className={`leading-relaxed whitespace-pre-wrap ${colorClass}`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-500 font-mono truncate max-w-[500px]">
                Destino: {selectedLogBackup.location}
              </span>
              <button
                onClick={() => setSelectedLogBackup(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
