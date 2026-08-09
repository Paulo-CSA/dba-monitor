import React, { useState, useEffect } from 'react';
import { BackupOverview } from '../types/backup';
import { ServerInstance } from '../types/serverFleet';
import {
  HardDrive,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Play,
  Server,
  Database,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  Terminal,
  Container,
  Key,
  FileText,
  HelpCircle
} from 'lucide-react';
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
  const [commandMode, setCommandMode] = useState<'docker' | 'native' | 'ssh' | 'pg_dump'>('docker');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showVersionGuide, setShowVersionGuide] = useState<boolean>(true);

  const currentServerName = server ? (server.name || server.host) : 'Servidor Central';
  const currentDbName = databaseName || 'postgres';

  const srvFolder = currentServerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dbFolder = currentDbName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const defaultPath = `/backups/postgresql/${srvFolder}/${dbFolder}/`;

  useEffect(() => {
    setCustomPath(`/backups/postgresql/${srvFolder}/${dbFolder}/`);
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

  const handleCopyCommand = (cmdText: string, id: string) => {
    navigator.clipboard.writeText(cmdText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
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

      {/* PostgreSQL Version Mismatch Alert & Guidance Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h4 className="text-sm font-bold text-amber-200">
              Solução para Erro &quot;incompatible server version&quot; (Servidor XPTO vs Servidor Remoto)
            </h4>
          </div>
          <button
            onClick={() => setShowVersionGuide(!showVersionGuide)}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 underline cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showVersionGuide ? 'Ocultar Explicação' : 'Como Resolver?'}</span>
          </button>
        </div>

        {showVersionGuide && (
          <div className="text-xs text-slate-300 space-y-2 pt-1 border-t border-amber-500/20">
            <p>
              O erro <code className="bg-slate-950 text-rose-300 px-1.5 py-0.5 rounded font-mono">pg_basebackup: error: incompatible server version 16.14</code> ocorre quando a versão do PostgreSQL no servidor onde você digita o comando (ex: <strong className="text-white">PostgreSQL 14</strong> no servidor da aplicação XPTO) é inferior à do banco de destino (ex: <strong className="text-white">PostgreSQL 16</strong> em <code className="text-cyan-300 font-mono">192.168.10.113</code>).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
                  <Container className="w-4 h-4 text-cyan-400" />
                  <span>1. Opção Docker (Recomendada)</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Usa o cliente <code className="text-cyan-300 font-mono">postgres:16</code> isolado. Baixa e executa o backup perfeitamente de qualquer máquina host sem mudar pacotes nativos.
                </p>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-emerald-400 flex items-center space-x-1.5">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>2. Opção SSH Remoto</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Executa o comando <code className="text-emerald-300 font-mono">pg_basebackup</code> via SSH diretamente no próprio servidor remoto onde o PostgreSQL 16 já está instalado.
                </p>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-purple-400 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>3. Opção pg_dump (Lógico)</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  O <code className="text-purple-300 font-mono">pg_dump</code> permite exportar dados e tabelas com compatibilidade total entre versões de cluster distintas.
                </p>
              </div>
            </div>
          </div>
        )}
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
                      setCustomPath(`/backups/postgresql/${sName}/${dName}/`);
                    }
                  }}
                  className="bg-slate-900 border border-slate-700 text-white text-xs font-bold font-mono rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {servers.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name || srv.host} ({srv.pgVersion || 'PG'})
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

          {/* Mode selector for commands */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-400">Modo do Comando CLI:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setCommandMode('docker')}
                title="Usar Docker com a versão exata da imagem do servidor (evita erro incompatibilidade)"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  commandMode === 'docker'
                    ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Container className="w-3.5 h-3.5" />
                <span>Docker</span>
              </button>
              <button
                onClick={() => setCommandMode('native')}
                title="Comando nativo direto no terminal"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  commandMode === 'native'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Nativo</span>
              </button>
              <button
                onClick={() => setCommandMode('ssh')}
                title="Executar diretamente via SSH no servidor de destino"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  commandMode === 'ssh'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>SSH</span>
              </button>
              <button
                onClick={() => setCommandMode('pg_dump')}
                title="Exportação lógica via pg_dump"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  commandMode === 'pg_dump'
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>pg_dump</span>
              </button>
            </div>

            {backupOverview.recentBackups.length > 0 && onClearAllBackups && (
              <button
                onClick={onClearAllBackups}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Logs</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">ID / Identificador</th>
                <th className="py-2.5 px-4">Servidor Target</th>
                <th className="py-2.5 px-4">Banco (`datname`)</th>
                <th className="py-2.5 px-4">Tipo & Comando Pronto para Execução</th>
                <th className="py-2.5 px-4">Data e Hora</th>
                <th className="py-2.5 px-4">Tamanho</th>
                <th className="py-2.5 px-4">Status & Integridade</th>
                <th className="py-2.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                    Nenhum backup registrado para os filtros selecionados. Clique em &quot;Iniciar Backup&quot; para disparar um backup.
                  </td>
                </tr>
              ) : (
                filteredBackups.map((bkp) => {
                  const host = bkp.serverHost || bkp.serverName || 'localhost';
                  const db = bkp.databaseName || 'postgres';
                  const targetVer = bkp.targetPgVersion || server?.pgVersion || '16';
                  const pgMajorVer = targetVer.match(/\d+/)?.[0] || '16';

                  const parentDir = bkp.location.includes('/')
                    ? bkp.location.substring(0, bkp.location.lastIndexOf('/'))
                    : bkp.location;

                  let activeCmd = '';
                  if (commandMode === 'docker') {
                    activeCmd = bkp.commandDocker || (bkp.type === 'pg_dump'
                      ? `docker run --rm -v "${parentDir}:${parentDir}" postgres:${pgMajorVer} pg_dump -h ${host} -p 5432 -U postgres -d ${db} -F c -f "${bkp.location}"`
                      : `docker run --rm -v "${parentDir}:${parentDir}" postgres:${pgMajorVer} pg_basebackup -h ${host} -p 5432 -U postgres -D "${parentDir}" -F t -z`);
                  } else if (commandMode === 'ssh') {
                    activeCmd = bkp.commandSsh || (bkp.type === 'pg_dump'
                      ? `ssh postgres@${host} "pg_dump -p 5432 -U postgres -d ${db} -F c -f \"${bkp.location}\""`
                      : `ssh postgres@${host} "pg_basebackup -p 5432 -U postgres -D \"${parentDir}\" -F t -z"`);
                  } else if (commandMode === 'pg_dump') {
                    activeCmd = bkp.commandPgDump || `pg_dump -h ${host} -p 5432 -U postgres -d ${db} -F c -f "${bkp.location.replace(/\.(tar\.gz|sql)$/, '.dump')}"`;
                  } else {
                    activeCmd = bkp.command || (bkp.type === 'pg_dump'
                      ? `pg_dump -h ${host} -p 5432 -U postgres -d ${db} -F c -f "${bkp.location}"`
                      : `pg_basebackup -h ${host} -p 5432 -U postgres -D "${parentDir}" -F t -z`);
                  }

                  const isCopied = copiedId === bkp.id;

                  return (
                    <tr key={bkp.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">{bkp.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-200">
                        <span className="flex items-center space-x-1">
                          <Server className="w-3 h-3 text-cyan-400 inline" />
                          <span>{bkp.serverName || bkp.serverId || 'Servidor Central'}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {host} ({targetVer})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        <span className="flex items-center space-x-1">
                          <Database className="w-3 h-3 text-emerald-400 inline" />
                          <span>{db}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[10px]">
                            {bkp.type}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 text-[10px] uppercase font-bold">
                            {commandMode}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-1.5">
                          <div
                            className="text-[10px] text-cyan-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono max-w-sm truncate cursor-help"
                            title={activeCmd}
                          >
                            {activeCmd}
                          </div>
                          <button
                            onClick={() => handleCopyCommand(activeCmd, bkp.id)}
                            title="Copiar comando exatamente como formatado"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
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
