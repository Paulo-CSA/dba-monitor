import React, { useState } from 'react';
import { StuckQuery } from '../types/locks';
import { AlertTriangle, Sparkles, XCircle, Search, Clock, ShieldAlert, Check } from 'lucide-react';
import { truncateSql, formatDurationSeconds } from '../utils/formatters';

interface StuckQueriesTableProps {
  stuckQueries: StuckQuery[];
  onKillPid: (pid: number) => void;
  onAnalyzeWithAi: (query: StuckQuery) => void;
  killingPid: number | null;
}

export const StuckQueriesTable: React.FC<StuckQueriesTableProps> = ({
  stuckQueries,
  onKillPid,
  onAnalyzeWithAi,
  killingPid
}) => {
  const [filterText, setFilterText] = useState('');
  const [minDuration, setMinDuration] = useState<number>(0);

  const filteredQueries = stuckQueries.filter((q) => {
    const matchesText =
      q.pid.toString().includes(filterText) ||
      q.usename.toLowerCase().includes(filterText.toLowerCase()) ||
      q.datname.toLowerCase().includes(filterText.toLowerCase()) ||
      q.query.toLowerCase().includes(filterText.toLowerCase());

    const matchesDuration = q.durationSeconds >= minDuration;
    return matchesText && matchesDuration;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-white">Consultas Lentas e Transações (`pg_stat_activity`)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Sessões PostgreSQL ativas executando há mais tempo que o esperado ou retendo locks de tabela.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Duration Filter Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Duração Min:</span>
            <select
              value={minDuration}
              onChange={(e) => setMinDuration(Number(e.target.value))}
              className="bg-transparent font-mono text-cyan-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value={0}>Todas</option>
              <option value={30}>&gt; 30 seg</option>
              <option value={60}>&gt; 1 min</option>
              <option value={180}>&gt; 3 min</option>
            </select>
          </div>

          {/* Search Field */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar por PID, usuário ou SQL..."
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-1.5 w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Queries Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">PID</th>
              <th className="py-2.5 px-3">Usuário / Banco</th>
              <th className="py-2.5 px-3">Duração</th>
              <th className="py-2.5 px-3">Wait Event / Bloqueador</th>
              <th className="py-2.5 px-3">Consulta SQL Executada</th>
              <th className="py-2.5 px-3 text-right">Ações de DBA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
            {filteredQueries.length > 0 ? (
              filteredQueries.map((q) => (
                <tr key={q.pid} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-cyan-300">{q.pid}</td>
                  <td className="py-3 px-3">
                    <div className="font-sans text-white font-medium">{q.usename}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{q.datname}</div>
                  </td>
                  <td className="py-3 px-3 font-bold text-rose-400">
                    <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/80">
                      {formatDurationSeconds(q.durationSeconds)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {q.blocking_pid ? (
                      <span className="text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                        Bloqueado por PID {q.blocking_pid}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {q.wait_event ? `${q.wait_event_type}: ${q.wait_event}` : 'Executando CPU'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-300 max-w-md font-mono text-[11px] truncate" title={q.query}>
                    <code className="bg-slate-950 px-2 py-1 rounded border border-slate-800 block truncate">
                      {q.query}
                    </code>
                  </td>
                  <td className="py-3 px-3 text-right font-sans">
                    <div className="flex items-center justify-end space-x-2">
                      {/* AI Diagnostics Button */}
                      <button
                        onClick={() => onAnalyzeWithAi(q)}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-all cursor-pointer"
                        title="Analisar plano de execução e otimização com Gemini IA"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span className="hidden sm:inline">Análise IA</span>
                      </button>

                      {/* Terminate Session Button */}
                      <button
                        onClick={() => onKillPid(q.pid)}
                        disabled={killingPid === q.pid}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 transition-all cursor-pointer"
                        title="Executar SELECT pg_terminate_backend(PID)"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>{killingPid === q.pid ? 'Encerrando...' : 'Encerrar PID'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500 font-sans">
                  Nenhuma consulta presa detectada no momento. O banco está operando sem transações travadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
