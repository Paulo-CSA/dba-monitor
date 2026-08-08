import React from 'react';
import { DatabaseIntegrityOverview } from '../types/health';
import { ServerInstance } from '../types/serverFleet';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, HardDrive, Layers, Server, Database } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface IntegrityHealthCardProps {
  health: DatabaseIntegrityOverview;
  onRunScan: () => void;
  isScanning: boolean;
  server?: ServerInstance;
  databaseName?: string;
}

export const IntegrityHealthCard: React.FC<IntegrityHealthCardProps> = ({
  health,
  onRunScan,
  isScanning,
  server,
  databaseName
}) => {
  const activeDb = server?.databases.find((d) => d.datname === databaseName) || server?.databases[0];
  const serverScore = server
    ? server.status === 'healthy'
      ? 99
      : server.status === 'warning'
      ? 84
      : 65
    : health.overallIntegrityScore;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-white">Integridade e Saúde do Banco de Dados</h2>
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase border ${
                  (server?.status || health.status) === 'healthy' || health.status === 'Saudável'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border-amber-800'
                }`}
              >
                {server ? (server.status === 'healthy' ? 'Saudável' : server.status === 'warning' ? 'Atenção' : 'Crítico') : health.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Verificação contínua de integridade de checksums de blocos (CRC32), status de réplicas, estado das transações e nível de inchaço de tabelas (bloat) para{' '}
              <strong className="text-cyan-300">{server ? `${server.name} (${server.host})` : 'servidor ativo'}</strong>.
            </p>
          </div>
        </div>

        {/* Score Ring & Action */}
        <div className="flex items-center space-x-6 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <div className="text-center font-mono">
            <span
              className={`text-3xl font-extrabold ${
                serverScore >= 90 ? 'text-emerald-400' : serverScore >= 75 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {serverScore}%
            </span>
            <span className="block text-[11px] text-slate-400 uppercase font-semibold">Score de Saúde</span>
          </div>

          <button
            onClick={onRunScan}
            disabled={isScanning}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Escaneando Bloco...' : 'Escanear Integridade'}</span>
          </button>
        </div>
      </div>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health.healthChecks.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start space-x-3 transition-colors hover:border-slate-700"
          >
            {item.status === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            )}

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white">{item.component}</h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(item.lastChecked).toLocaleTimeString('pt-BR')}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5 font-medium">{item.message}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800">
                {item.details}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Bloat Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Análise de Bloat de Tabelas (Inchaço de Páginas Dead Tuples)</h3>
              <p className="text-xs text-slate-400">Recomendações automáticas de limpeza para liberação de espaço em disco</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Tabela e Esquema</th>
                <th className="py-2.5 px-4">Tamanho Total</th>
                <th className="py-2.5 px-4">Espaço Bloat (Inútil)</th>
                <th className="py-2.5 px-4">% Bloat</th>
                <th className="py-2.5 px-4 text-right">Ação Sugerida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {health.topBloatedTables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    Nenhuma tabela com inchaço (bloat) identificada no momento.
                  </td>
                </tr>
              ) : (
                health.topBloatedTables.map((tb, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-white">
                      {tb.schemaName}.{tb.tableName}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatBytes(tb.tableSizeBytes)}</td>
                    <td className="py-3 px-4 font-mono text-rose-300 font-medium">{formatBytes(tb.bloatBytes)}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        tb.bloatPercentage > 30 ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {tb.bloatPercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={`text-[11px] px-2.5 py-1 rounded-lg ${
                        tb.recommendedAction === 'VACUUM FULL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : tb.recommendedAction === 'VACUUM'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {tb.recommendedAction}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
