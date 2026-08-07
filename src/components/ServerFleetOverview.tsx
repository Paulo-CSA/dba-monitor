import React, { useState } from 'react';
import { ServerInstance, DatabaseInfo } from '../types/serverFleet';
import { Server, Database, Eye, ShieldCheck, Cpu, HardDrive, Clock, Search, ExternalLink, ArrowRight, Layers, Lock, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface ServerFleetOverviewProps {
  servers: ServerInstance[];
  selectedServerId: string;
  selectedDatabaseName: string;
  onSelectServer: (serverId: string) => void;
  onSelectDatabase: (datname: string) => void;
}

export const ServerFleetOverview: React.FC<ServerFleetOverviewProps> = ({
  servers,
  selectedServerId,
  selectedDatabaseName,
  onSelectServer,
  onSelectDatabase
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const activeServer = servers.find((s) => s.id === selectedServerId) || servers[0];

  // Filter servers and their databases by search
  const filteredServers = servers.filter((srv) => {
    const matchesServerName = srv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      srv.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
      srv.region.toLowerCase().includes(searchTerm.toLowerCase());

    const hasMatchingDb = srv.databases.some((db) =>
      db.datname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      db.owner.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return matchesServerName || hasMatchingDb;
  });

  return (
    <div className="space-y-6">
      {/* Fleet Search & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>Frota de Servidores PostgreSQL Monitorados ({servers.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Identificação de múltiplos clusters, hosts e mapeamento dos bancos de dados ativos
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar servidor, host ou banco (datname)..."
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl pl-9 pr-3 py-2 w-64 sm:w-80 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Servers Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredServers.map((srv) => {
          const isSelected = srv.id === activeServer.id;

          return (
            <div
              key={srv.id}
              onClick={() => onSelectServer(srv.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500 ring-1 ring-cyan-500 shadow-lg shadow-cyan-950/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-0 right-0 bg-cyan-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg uppercase">
                  Servidor Selecionado
                </div>
              )}

              <div className="flex items-start justify-between">
                <div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    srv.environment === 'Produção' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                    srv.environment === 'Desenvolvimento' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                    srv.environment === 'Homologação' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {srv.environment}
                  </span>
                  <h3 className="text-xs font-bold text-white mt-2 line-clamp-1">{srv.name}</h3>
                  <span className="text-[11px] font-mono text-cyan-400 block mt-0.5">{srv.host}:{srv.port}</span>
                </div>
              </div>

              {/* Server Stats Pills */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">CPU / Latência</span>
                  <span className={`font-bold ${srv.cpuUsagePercent > 80 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {srv.cpuUsagePercent}% | {srv.avgLatencyMs}ms
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block">Bancos Detectados</span>
                  <span className="font-bold text-cyan-300 flex items-center space-x-1">
                    <Database className="w-3 h-3 text-cyan-400" />
                    <span>{srv.totalDatabasesCount} dbs ({srv.totalSizeFormatted})</span>
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/50 pt-2">
                <span>{srv.pgVersion}</span>
                <span className="text-emerald-400 font-semibold">{srv.region.split(' ')[0]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Server Database Breakdown Table */}
      {activeServer && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Bancos de Dados Existentes em `{activeServer.host}` ({activeServer.databases.length} bancos)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mapeamento das propriedades `datname`, dono do banco, tamanho em disco (`pg_database_size`) e conexões ativas
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="text-slate-400">Versão: <strong className="text-white">{activeServer.pgVersion}</strong></span>
              <span className="text-slate-400">Uptime: <strong className="text-emerald-400">{activeServer.uptimeFormatted}</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Nome do Banco (`datname`)</th>
                  <th className="py-2.5 px-4">Proprietário (`owner`)</th>
                  <th className="py-2.5 px-4">Tamanho em Disco</th>
                  <th className="py-2.5 px-4">Conexões Ativas</th>
                  <th className="py-2.5 px-4">Taxa de Transação (TPS)</th>
                  <th className="py-2.5 px-4">Cache Hit Ratio</th>
                  <th className="py-2.5 px-4 text-right">Ação Observabilidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {activeServer.databases.map((db) => {
                  const isCurrentActiveDb = db.datname === selectedDatabaseName;

                  return (
                    <tr
                      key={db.datname}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isCurrentActiveDb ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center space-x-2">
                          <Database className={`w-4 h-4 ${isCurrentActiveDb ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <span className={isCurrentActiveDb ? 'text-cyan-300 font-extrabold' : 'text-white'}>
                            {db.datname}
                          </span>
                          {isCurrentActiveDb && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase">
                              Ativo no Dashboard
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">{db.owner}</td>

                      <td className="py-3 px-4 font-bold text-emerald-400">{db.sizeFormatted}</td>

                      <td className="py-3 px-4 text-slate-200">
                        <span className="font-bold text-white">{db.activeConnections}</span> / {db.maxConnections}
                      </td>

                      <td className="py-3 px-4 text-purple-300 font-bold">{db.tps} tps</td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          db.cacheHitRatio >= 98
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {db.cacheHitRatio}%
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => onSelectDatabase(db.datname)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isCurrentActiveDb
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                          }`}
                        >
                          {isCurrentActiveDb ? 'Monitorando Este Banco' : 'Selecionar Para Leitura'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
