import React, { useState, useEffect } from 'react';
import { BackupOverview, BackupEntry } from '../types/backup';
import { ServerInstance } from '../types/serverFleet';
import { HardDrive, CheckCircle2, Clock, ShieldCheck, Plus, Play, Server, Database, Trash2, Filter, Key, User, Globe, Lock, Terminal, Send, Copy, X, Check, Eye, Download, FileText } from 'lucide-react';
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

  // State for SSH Remote Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupEntry | null>(null);
  const [sshHost, setSshHost] = useState<string>('192.168.10.113');
  const [sshUser, setSshUser] = useState<string>('debian');
  const [sshPassword, setSshPassword] = useState<string>('');
  const [sshPort, setSshPort] = useState<string>('22');
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [transferExecuted, setTransferExecuted] = useState<boolean>(false);
  const [isExecutingTransfer, setIsExecutingTransfer] = useState<boolean>(false);
  const [transferResult, setTransferResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // State for View Content Modal
  const [viewContentModalOpen, setViewContentModalOpen] = useState<boolean>(false);
  const [viewingBackup, setViewingBackup] = useState<BackupEntry | null>(null);
  const [backupContentText, setBackupContentText] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [contentCopied, setContentCopied] = useState<boolean>(false);

  const currentServerName = server ? (server.name || server.host) : 'Servidor Central';
  const currentDbName = databaseName || 'postgres';

  const handleViewContent = async (bkp: BackupEntry) => {
    setViewingBackup(bkp);
    setIsLoadingContent(true);
    setViewContentModalOpen(true);
    setBackupContentText('');
    setContentCopied(false);

    try {
      const res = await fetch(`/api/db/backups/content?id=${bkp.id}&location=${encodeURIComponent(bkp.location)}`);
      const data = await res.json();
      if (data.success && data.content) {
        setBackupContentText(data.content);
      } else {
        setBackupContentText(`-- Erro ao carregar conteúdo do arquivo:\n-- ${data.error || 'Arquivo não encontrado no disco local'}`);
      }
    } catch (err) {
      setBackupContentText(`-- Falha na requisição:\n-- ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleDownloadFile = (bkp: BackupEntry) => {
    window.open(`/api/db/backups/download?id=${bkp.id}&location=${encodeURIComponent(bkp.location)}`, '_blank');
  };

  const srvFolder = currentServerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dbFolder = currentDbName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const defaultPath = `/backups/postgresql/${srvFolder}/${dbFolder}/`;

  useEffect(() => {
    setCustomPath(`/backups/postgresql/${srvFolder}/${dbFolder}/`);
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

  const openTransferModal = (bkp: BackupEntry) => {
    setSelectedBackup(bkp);
    if (bkp.serverHost) {
      setSshHost(bkp.serverHost);
    }
    setTransferExecuted(false);
    setTransferResult(null);
    setCopiedCmd(false);
    setTransferModalOpen(true);
  };

  const getTargetDirFromLocation = (loc: string) => {
    const parts = loc.split('/');
    if (parts.length > 1) {
      parts.pop();
      return parts.join('/') || '/backups';
    }
    return '/backups';
  };

  const buildSshPassCommand = (maskPassword = true) => {
    if (!selectedBackup) return '';
    const loc = selectedBackup.location;
    const targetDir = getTargetDirFromLocation(loc);
    const pass = maskPassword ? '••••••••' : (sshPassword || 'root');
    const user = sshUser || 'debian';
    const host = sshHost || '192.168.10.113';
    const portNum = Number(sshPort) || 22;

    const sshPortFlag = portNum !== 22 ? `-p ${portNum} ` : '';
    const scpPortFlag = portNum !== 22 ? `-P ${portNum} ` : '';
    const sshOpts = `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;

    const cmdMkdir = `sshpass -p '${pass}' ssh ${sshOpts} ${sshPortFlag}${user}@${host} "mkdir -p ${targetDir}"`;
    const cmdScp = `sshpass -p '${pass}' scp ${sshOpts} ${scpPortFlag}${loc} ${user}@${host}:${targetDir}/`;
    const cmdRm = `rm -f ${loc}`;

    return `${cmdMkdir} && \\\n${cmdScp} && \\\n${cmdRm}`;
  };

  const handleCopyCommand = () => {
    const cmd = buildSshPassCommand(false);
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleExecuteTransfer = async () => {
    if (!selectedBackup) return;
    setIsExecutingTransfer(true);
    setTransferResult(null);
    setTransferExecuted(false);

    try {
      const res = await fetch('/api/db/backups/transfer-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupId: selectedBackup.id,
          location: selectedBackup.location,
          sshHost,
          sshUser,
          sshPassword,
          sshPort: Number(sshPort) || 22
        })
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Resposta inesperada do servidor (${res.status}): ${rawText.slice(0, 200)}`);
      }

      if (data.success) {
        setTransferExecuted(true);
        setTransferResult({
          success: true,
          message: data.message || 'Transferência realizada com sucesso!',
          details: data.stdout
        });
      } else {
        setTransferResult({
          success: false,
          message: data.message || 'Erro ao executar transferência SSH no servidor.',
          details: data.error || data.stderr
        });
      }
    } catch (err) {
      setTransferResult({
        success: false,
        message: 'Erro de comunicação ao acionar o servidor.',
        details: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsExecutingTransfer(false);
    }
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
              onClick={() => onTriggerBackup(
                selectedType,
                customPath,
                server,
                currentDbName
              )}
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
                    : `pg_basebackup -h ${host} -p 5432 -U postgres -D "${bkp.location}"`);

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
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleViewContent(bkp)}
                          title="Ver conteúdo completo do arquivo de backup (SQL DDL / Dump)"
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/80 border border-emerald-800/60 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ver Dump</span>
                        </button>
                        <button
                          onClick={() => handleDownloadFile(bkp)}
                          title="Baixar arquivo de backup salvo em disco"
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/80 border border-indigo-800/60 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Baixar</span>
                        </button>
                        <button
                          onClick={() => openTransferModal(bkp)}
                          title="Enviar arquivo de backup via SSH/SCP"
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/80 border border-cyan-800/60 transition-all cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Enviar SSH</span>
                        </button>
                        {onDeleteBackup && (
                          <button
                            onClick={() => onDeleteBackup(bkp.id)}
                            title="Excluir este registro de log"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay for SSH / SCP Transfer */}
      {transferModalOpen && selectedBackup && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setTransferModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-cyan-950 border border-cyan-800/80 rounded-xl text-cyan-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Enviar Backup via SSH / SCP</h3>
                <p className="text-xs text-slate-400">
                  Transferir o arquivo gerado para um servidor remoto e remover o arquivo local.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1">
              <span className="text-slate-400 font-medium">Arquivo de Origem Selected:</span>
              <div className="font-mono text-cyan-300 font-semibold break-all">
                {selectedBackup.location}
              </div>
            </div>

            {/* SSH Credentials Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 pt-1">
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Host / IP Remoto (SSH)</span>
                </label>
                <input
                  type="text"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="192.168.10.113"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Usuário SSH</span>
                </label>
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="debian"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Senha SSH</span>
                </label>
                <input
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  placeholder="root"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Porta</span>
                </label>
                <input
                  type="text"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                  placeholder="22"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white font-mono rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Command Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Comando a ser Executado no Servidor:</span>
                  <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>Senha protegida</span>
                  </span>
                </span>
                <button
                  onClick={handleCopyCommand}
                  className="flex items-center space-x-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                  title="Copiar comando completo com senha"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copiado!' : 'Copiar Comando'}</span>
                </button>
              </div>

              <pre className="bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px] p-3 rounded-xl whitespace-pre-wrap break-all select-all leading-relaxed">
                {buildSshPassCommand(true)}
              </pre>
            </div>

            {/* Execution Loading Indicator */}
            {isExecutingTransfer && (
              <div className="p-3 bg-cyan-950/80 border border-cyan-700/80 rounded-xl text-cyan-300 text-xs flex items-center space-x-3 animate-fadeIn">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>
                  Executando comando de transferência via SSH/SCP no servidor central... Aguarde.
                </span>
              </div>
            )}

            {/* Execution Result Notification */}
            {transferResult && !isExecutingTransfer && (
              <div className={`p-3 rounded-xl text-xs space-y-1.5 border animate-fadeIn ${
                transferResult.success
                  ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-800/80 text-rose-300'
              }`}>
                <div className="flex items-center space-x-2 font-semibold">
                  {transferResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{transferResult.message}</span>
                </div>
                {transferResult.details && (
                  <pre className="font-mono text-[10px] bg-slate-950/90 p-2 rounded-lg text-slate-300 max-h-32 overflow-y-auto break-all whitespace-pre-wrap">
                    {transferResult.details}
                  </pre>
                )}
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTransferModalOpen(false)}
                disabled={isExecutingTransfer}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={handleExecuteTransfer}
                disabled={isExecutingTransfer}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
              >
                {isExecutingTransfer ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Executando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Executar Envio Remoto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay for Viewing Backup File Content (SQL / BaseBackup Dump) */}
      {viewContentModalOpen && viewingBackup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Conteúdo do Arquivo de Backup
                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {viewingBackup.type}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-lg">
                    {viewingBackup.location}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupContentText);
                    setContentCopied(true);
                    setTimeout(() => setContentCopied(false), 2000);
                  }}
                  disabled={isLoadingContent || !backupContentText}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 hover:bg-emerald-900 transition-all cursor-pointer disabled:opacity-50"
                  title="Copiar todo o SQL para a área de transferência"
                >
                  {contentCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{contentCopied ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>

                <button
                  onClick={() => handleDownloadFile(viewingBackup)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-800 hover:bg-indigo-900 transition-all cursor-pointer"
                  title="Baixar arquivo diretamente"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>

                <button
                  onClick={() => setViewContentModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto bg-slate-950 font-mono text-xs">
              {isLoadingContent ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Lendo arquivo de backup do disco...</span>
                </div>
              ) : (
                <div className="relative">
                  <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl mb-3 flex items-center justify-between text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-500">Banco: </span>
                      <strong className="text-cyan-400">{viewingBackup.databaseName || 'postgres'}</strong>
                      <span className="mx-2 text-slate-700">|</span>
                      <span className="text-slate-500">Tamanho: </span>
                      <strong className="text-emerald-400">{viewingBackup.sizeFormatted}</strong>
                      <span className="mx-2 text-slate-700">|</span>
                      <span className="text-slate-500">Linhas Totais: </span>
                      <strong className="text-purple-400">{backupContentText.split('\n').length} linhas</strong>
                    </div>
                  </div>

                  <pre className="text-emerald-400 bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto whitespace-pre leading-relaxed text-[11px] select-all">
                    {backupContentText}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px]">
                {viewingBackup.notes || 'Arquivo salvo no sistema de arquivos do servidor.'}
              </span>
              <button
                onClick={() => setViewContentModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
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
