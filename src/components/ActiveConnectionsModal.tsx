import React, { useState } from 'react';
import { StuckQuery } from '../types/locks';
import { Users, X, Search, ShieldAlert, Sparkles, XCircle, RefreshCw, Activity, Database, CheckCircle, Clock } from 'lucide-react';
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
  onKillPid: (pid: number) => void;
  onAnalyzeWithAi: (query: StuckQuery) => void;
  killingPid: number | null;
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
  onKillPid,
  onAnalyzeWithAi,
  killingPid
}) => {
  const [filterText, setFilterText] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'idle' | 'waiting'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const filteredConnections = connectionsList.filter((conn) => {
    const matchesText =
      conn.pid.toString().includes(filterText) ||
      conn.usename.toLowerCase().includes(filterText.toLowerCase()) ||
      conn.datname.toLowerCase().includes(filterText.toLowerCase()) ||
      conn.query.toLowerCase().includes(filterText.toLowerCase()) ||
      (conn.application_name && conn.application_name.toLowerCase().includes(filterText.toLowerCase()));

    if (!matchesText) return false;

    if (stateFilter === 'active') {
      return conn.state === 'active' || conn.isStuck;
    } else if (stateFilter === 'idle') {
      return conn.state === 'idle' || conn.state === 'idle in transaction';
    } else if (stateFilter === 'waiting') {
      return !!conn.wait_event || !!conn.blocking_pid;
    }

    return true;
  });

  const capacityPercent = Math.round((activeConnectionsCount / (maxConnectionsCount || 100)) * 100);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-cyan-400 border border-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Conexões Ativas e Sessões (`pg_stat_activity`)</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {databaseName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detalhamento em tempo real de clientes conectados no servidor <strong className="text-slate-200">{serverName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Atualizar lista de conexões"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Conexões Ativas / Limite</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-white text-base">
              <span className="text-cyan-400">{activeConnectionsCount}</span>
              <span className="text-slate-500 text-xs">/ {maxConnectionsCount}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Ocupação de Capacidade</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-base">
              <span className={capacityPercent > 80 ? 'text-rose-400' : 'text-emerald-400'}>
                {capacityPercent}%
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Transações por Segundo (TPS)</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-amber-300 text-base">
              <span>{tps}</span>
              <span className="text-slate-500 text-xs">tps</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-0.5">Sessões em Tabela</span>
            <div className="flex items-baseline space-x-1 font-mono font-bold text-indigo-300 text-base">
              <span>{connectionsList.length}</span>
              <span className="text-slate-500 text-xs">registros</span>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* State Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setStateFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                stateFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({connectionsList.length})
            </button>
            <button
              onClick={() => setStateFilter('active')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                stateFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ativas
            </button>
            <button
              onClick={() => setStateFilter('waiting')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                stateFilter === 'waiting' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aguardando Lock
            </button>
            <button
              onClick={() => setStateFilter('idle')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                stateFilter === 'idle' ? 'bg-slate-800 text-slate-200 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Idle
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar por PID, Usuário, Banco ou Query..."
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-1.5 w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Connections Table */}
        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">PID</th>
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
                  <tr key={conn.pid} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-cyan-300">{conn.pid}</td>
                    <td className="py-3 px-3">
                      <div className="text-white font-semibold">{conn.datname}</div>
                      <div className="text-[11px] text-slate-400 font-sans">{conn.usename}</div>
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
                      ) : conn.state === 'idle' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400">
                          idle
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-300">
                      {formatDurationSeconds(conn.durationSeconds)}
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs font-mono text-[11px] truncate" title={conn.query}>
                      <code className="bg-slate-950 px-2 py-1 rounded border border-slate-800 block truncate">
                        {conn.query}
                      </code>
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onAnalyzeWithAi(conn)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-all cursor-pointer"
                          title="Analisar com Gemini IA"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="hidden sm:inline">IA</span>
                        </button>

                        <button
                          onClick={() => onKillPid(conn.pid)}
                          disabled={killingPid === conn.pid}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 transition-all cursor-pointer"
                          title="Encerrar Backend PID"
                        >
                          <XCircle className="w-3 h-3 text-rose-400" />
                          <span>{killingPid === conn.pid ? '...' : 'Encerrar'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 font-sans space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto" />
                    <div>Nenhuma conexão com filtro selecionado no momento.</div>
                    <div className="text-xs text-slate-600">
                      Conexões normais de leitura/escrita são liberadas rapidamente pelo pooler de conexões.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Dados extraídos dinamicamente da view <code className="text-slate-200">pg_stat_activity</code></span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
