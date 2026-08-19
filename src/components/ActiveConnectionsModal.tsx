import React, { useState, useMemo } from 'react';
import { StuckQuery } from '../types/locks';
import { ServerInstance } from '../types/serverFleet';
import {
  Users,
  X,
  Search,
  Sparkles,
  XCircle,
  RefreshCw,
  Database,
  CheckCircle,
  Clock,
  Terminal,
  User,
  Server,
  Filter,
  Layers
} from 'lucide-react';
import { formatDurationSeconds } from '../utils/formatters';

interface ActiveConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  databaseName: string;
  activeConnectionsCount: number;
  maxConnectionsCount: number;
  tps: number;
  connectionsList: StuckQuery[];
  serverHost?: string;
  servers?: ServerInstance[];
  killedPids?: number[];
  onRefresh?: () => void | Promise<void>;
  onKillPid: (pid: number) => void;
  onAnalyzeWithAi: (query: StuckQuery) => void;
  killingPid: number | null;
  initialFilterScope?: 'all' | 'specific';
}

export const ActiveConnectionsModal: React.FC<ActiveConnectionsModalProps> = ({
  isOpen,
  onClose,
  serverName,
  databaseName,
  activeConnectionsCount,
  maxConnectionsCount,
  tps,
  connectionsList,
  serverHost,
  servers = [],
  killedPids = [],
  onRefresh,
  onKillPid,
  onAnalyzeWithAi,
  killingPid,
  initialFilterScope = 'all'
}) => {
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>(
    initialFilterScope === 'specific' ? serverName : 'all'
  );
  const [selectedDbFilter, setSelectedDbFilter] = useState<string>(
    initialFilterScope === 'specific' ? databaseName : 'all'
  );
  const [filterText, setFilterText] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'idle' | 'waiting'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastRefreshedAt(new Date());
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (err) {
        console.error('Error refreshing connections in modal:', err);
      }
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Collect unique list of all databases available across all servers
  const allAvailableDatabases = useMemo(() => {
    const dbSet = new Set<string>();
    for (const srv of servers) {
      for (const d of srv.databases || []) {
        if (d.datname) dbSet.add(d.datname);
      }
    }
    for (const c of connectionsList) {
      if (c.datname) dbSet.add(c.datname);
    }
    return Array.from(dbSet).sort();
  }, [servers, connectionsList]);

  // Filter connections by server, database, text and state
  const effectiveConnections: StuckQuery[] = useMemo(() => {
    return connectionsList.filter((conn) => {
      if (killedPids.includes(conn.pid)) return false;

      // Server filter
      if (selectedServerFilter !== 'all') {
        const matchesServer =
          (conn.serverName && conn.serverName.toLowerCase() === selectedServerFilter.toLowerCase()) ||
          (conn.serverId && conn.serverId === selectedServerFilter) ||
          (conn.client_addr && conn.client_addr.includes(selectedServerFilter));
        if (!matchesServer && servers.length > 1) {
          // If server filter matches active server object
          const srvObj = servers.find((s) => s.name === selectedServerFilter || s.id === selectedServerFilter);
          if (srvObj && conn.client_addr !== srvObj.host && conn.serverName !== srvObj.name) {
            return false;
          }
        }
      }

      // Database filter
      if (selectedDbFilter !== 'all') {
        if (!conn.datname || conn.datname.toLowerCase() !== selectedDbFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [connectionsList, killedPids, selectedServerFilter, selectedDbFilter, servers]);

  const activeCount = effectiveConnections.filter((c) => c.state === 'active' || c.isStuck).length;
  const waitingCount = effectiveConnections.filter((c) => !!c.wait_event || !!c.blocking_pid).length;
  const idleCount = effectiveConnections.filter(
    (c) => c.state === 'idle' || c.state === 'idle in transaction' || c.state.includes('idle')
  ).length;

  const filteredConnections = effectiveConnections.filter((conn) => {
    const matchesText =
      conn.pid.toString().includes(filterText) ||
      (conn.usename && conn.usename.toLowerCase().includes(filterText.toLowerCase())) ||
      (conn.datname && conn.datname.toLowerCase().includes(filterText.toLowerCase())) ||
      (conn.serverName && conn.serverName.toLowerCase().includes(filterText.toLowerCase())) ||
      (conn.query && conn.query.toLowerCase().includes(filterText.toLowerCase())) ||
      (conn.application_name && conn.application_name.toLowerCase().includes(filterText.toLowerCase()));

    if (!matchesText) return false;

    if (stateFilter === 'active') {
      return conn.state === 'active' || conn.isStuck;
    } else if (stateFilter === 'idle') {
      return conn.state === 'idle' || conn.state === 'idle in transaction' || conn.state.includes('idle');
    } else if (stateFilter === 'waiting') {
      return !!conn.wait_event || !!conn.blocking_pid;
    }

    return true;
  });

  const isViewingAll = selectedDbFilter === 'all' && selectedServerFilter === 'all';

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-cyan-400 border border-blue-500/20 flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Conexões Ativas e Sessões (`pg_stat_activity`)
                </h2>
                {isViewingAll ? (
                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    <span>Todas as Conexões da Frota ({connectionsList.length})</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1">
                    <Database className="w-3 h-3 text-cyan-400" />
                    <span>{selectedDbFilter !== 'all' ? selectedDbFilter : 'Todos os Bancos'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Exibindo clientes e workers conectados em tempo real no PostgreSQL
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sincronizado:</span>
              <span className="text-cyan-400 font-bold">{lastRefreshedAt.toLocaleTimeString()}</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Executar SELECT * FROM pg_stat_activity"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Query & Scope Bar */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 text-xs font-mono text-cyan-300 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 overflow-x-auto">
            <Terminal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-slate-400 font-sans font-medium text-[11px] flex-shrink-0">Consulta SQL:</span>
            <code className="bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded font-bold text-cyan-300 whitespace-nowrap">
              {selectedDbFilter === 'all'
                ? `SELECT pid, usename, datname, client_addr, application_name, state, query, backend_start FROM pg_stat_activity;`
                : `SELECT pid, usename, datname, client_addr, application_name, state, query, backend_start FROM pg_stat_activity WHERE datname = '${selectedDbFilter}';`}
            </code>
          </div>

          <div className="flex items-center space-x-2">
            {!isViewingAll && (
              <button
                onClick={() => {
                  setSelectedServerFilter('all');
                  setSelectedDbFilter('all');
                }}
                className="text-[11px] font-sans text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Ver Todas as Conexões da Frota &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Total de Conexões</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-white text-base">
              <span className="text-cyan-400">{effectiveConnections.length}</span>
              <span className="text-slate-500 text-xs">sessão(ões)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Em Execução Ativa</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-base">
              <span className="text-emerald-400">{activeCount}</span>
              <span className="text-slate-500 text-xs">ativas</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Aguardando / Bloqueadas</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-amber-300 text-base">
              <span>{waitingCount}</span>
              <span className="text-slate-500 text-xs">lock(s)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Sessões Idle / Pool</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-purple-300 text-base">
              <span>{idleCount}</span>
              <span className="text-slate-500 text-xs">ociosa(s)</span>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Selectors for Server and Database */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Server Selector */}
            {servers.length > 1 && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 text-[11px]">Servidor:</span>
                <select
                  value={selectedServerFilter}
                  onChange={(e) => setSelectedServerFilter(e.target.value)}
                  className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-slate-950 text-white">
                    Todos os Servidores ({servers.length})
                  </option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.name} className="bg-slate-950 text-white">
                      {s.name} ({s.host})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Database Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 text-[11px]">Banco:</span>
              <select
                value={selectedDbFilter}
                onChange={(e) => setSelectedDbFilter(e.target.value)}
                className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-slate-950 text-white">
                  Todos os Bancos ({allAvailableDatabases.length})
                </option>
                {allAvailableDatabases.map((dbName) => (
                  <option key={dbName} value={dbName} className="bg-slate-950 text-white">
                    {dbName}
                  </option>
                ))}
              </select>
            </div>

            {/* State Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setStateFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                  stateFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({effectiveConnections.length})
              </button>
              <button
                onClick={() => setStateFilter('active')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                  stateFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ativas ({activeCount})
              </button>
              <button
                onClick={() => setStateFilter('waiting')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                  stateFilter === 'waiting'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lock ({waitingCount})
              </button>
              <button
                onClick={() => setStateFilter('idle')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                  stateFilter === 'idle'
                    ? 'bg-slate-800 text-slate-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Idle ({idleCount})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar por PID, Usuário, Banco, Host, Query..."
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-1.5 w-full sm:w-72 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Connections Table */}
        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">PID</th>
                {servers.length > 1 && <th className="py-2.5 px-3">Servidor</th>}
                <th className="py-2.5 px-3">Banco / Usuário</th>
                <th className="py-2.5 px-3">Aplicação / Host</th>
                <th className="py-2.5 px-3">Estado / Lock</th>
                <th className="py-2.5 px-3">Duração</th>
                <th className="py-2.5 px-3">Consulta SQL</th>
                <th className="py-2.5 px-3 text-right">Ações DBA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
              {filteredConnections.length > 0 ? (
                filteredConnections.map((conn) => (
                  <tr key={`${conn.serverId || ''}-${conn.pid}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-cyan-300">
                      <span className="font-mono">#{conn.pid}</span>
                    </td>

                    {servers.length > 1 && (
                      <td className="py-3 px-3 font-sans">
                        <div className="font-bold text-white text-xs flex items-center space-x-1">
                          <Server className="w-3 h-3 text-slate-400" />
                          <span>{conn.serverName || serverName}</span>
                        </div>
                      </td>
                    )}

                    <td className="py-3 px-3">
                      <div className="text-cyan-200 font-bold flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span>{conn.usename || 'postgres'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                        <Database className="w-3 h-3 text-slate-500" />
                        <span>{conn.datname || 'postgres'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-300">
                      <div>{conn.application_name || 'psql / driver'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{conn.client_addr || '127.0.0.1'}</div>
                    </td>

                    <td className="py-3 px-3">
                      {conn.blocking_pid ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800 block">
                          Bloqueado por PID {conn.blocking_pid}
                        </span>
                      ) : conn.wait_event ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800 block">
                          {conn.wait_event_type || 'Wait'}: {conn.wait_event}
                        </span>
                      ) : conn.state === 'idle' || conn.state.includes('idle') ? (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400">
                          {conn.state}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {conn.state || 'active'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-bold text-amber-300">
                      {formatDurationSeconds(conn.durationSeconds)}
                    </td>

                    <td className="py-3 px-3 text-slate-300 max-w-xs font-mono text-[11px] truncate" title={conn.query}>
                      <code className="bg-slate-950 px-2 py-1 rounded border border-slate-800 block truncate text-cyan-200">
                        {conn.query}
                      </code>
                    </td>

                    <td className="py-3 px-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onAnalyzeWithAi(conn)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-all cursor-pointer"
                          title="Analisar query com IA Gemini"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="hidden sm:inline">IA</span>
                        </button>

                        <button
                          disabled={true}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800/60 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60"
                          title="Ação de encerrar sessão/PID desativada por segurança"
                        >
                          <XCircle className="w-3 h-3 text-slate-500" />
                          <span>Encerrar (Desativado)</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={servers.length > 1 ? 8 : 7} className="text-center py-12 text-slate-500 font-sans space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto" />
                    <div>
                      Nenhuma conexão encontrada para o filtro selecionado (
                      <strong className="text-slate-300">{selectedDbFilter === 'all' ? 'Todos os Bancos' : selectedDbFilter}</strong>
                      ).
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>
              Exibindo <strong className="text-white font-mono">{filteredConnections.length}</strong> de{' '}
              <strong className="text-white font-mono">{effectiveConnections.length}</strong> sessões ativas coletadas
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
