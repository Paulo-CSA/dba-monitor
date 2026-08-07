import React from 'react';
import { ServerInstance, DatabaseInfo } from '../types/serverFleet';
import { Server, Database, Activity, Cpu, HardDrive, Clock, CheckCircle2, AlertTriangle, ChevronRight, Globe, User } from 'lucide-react';

interface SelectedServerContextBarProps {
  servers: ServerInstance[];
  selectedServerId: string;
  selectedDatabaseName: string;
  onSelectServer: (serverId: string) => void;
  onSelectDatabase: (datname: string) => void;
}

export const SelectedServerContextBar: React.FC<SelectedServerContextBarProps> = ({
  servers,
  selectedServerId,
  selectedDatabaseName,
  onSelectServer,
  onSelectDatabase
}) => {
  const activeServer = servers.find((s) => s.id === selectedServerId) || servers[0];
  if (!activeServer) {
    return (
      <div className="bg-slate-900/90 border border-amber-800/60 rounded-2xl p-4 shadow-md flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Nenhum servidor cadastrado na frota. Adicione um novo servidor para monitorar métricas.</span>
        </div>
      </div>
    );
  }

  const activeDb =
    activeServer.databases.find((d) => d.datname === selectedDatabaseName) || activeServer.databases[0];

  const getEnvBadgeClass = (env: string) => {
    switch (env) {
      case 'Produção':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'Desenvolvimento':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'Homologação':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'Teste':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getEnvShort = (env: string) => {
    switch (env) {
      case 'Produção':
        return 'PROD';
      case 'Desenvolvimento':
        return 'DEV';
      case 'Homologação':
        return 'HOMO';
      case 'Teste':
        return 'TEST';
      default:
        return env;
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Server and Database Selector Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Server Select Dropdown */}
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500">
            <Server className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 font-medium">Servidor:</span>
            <select
              value={activeServer.id}
              onChange={(e) => {
                const srvId = e.target.value;
                onSelectServer(srvId);
                const targetSrv = servers.find((s) => s.id === srvId);
                if (targetSrv && targetSrv.databases.length > 0) {
                  onSelectDatabase(targetSrv.databases[0].datname);
                }
              }}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
            >
              {servers.map((srv) => (
                <option key={srv.id} value={srv.id} className="bg-slate-950 text-slate-100">
                  [{getEnvShort(srv.environment)}] {srv.name} ({srv.host})
                </option>
              ))}
            </select>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:block" />

          {/* Database Select Dropdown */}
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500">
            <Database className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 font-medium">Banco:</span>
            <select
              value={activeDb ? activeDb.datname : ''}
              onChange={(e) => onSelectDatabase(e.target.value)}
              className="bg-transparent text-xs font-bold text-cyan-300 font-mono focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[200px] truncate"
            >
              {activeServer.databases.map((db) => (
                <option key={db.datname} value={db.datname} className="bg-slate-950 text-slate-100 font-mono">
                  {db.datname} ({db.sizeFormatted})
                </option>
              ))}
            </select>
          </div>

          {/* Environment Tag Badge */}
          <span
            className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg border uppercase tracking-wide flex items-center space-x-1.5 ${getEnvBadgeClass(
              activeServer.environment
            )}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeServer.environment === 'Produção'
                  ? 'bg-rose-400 animate-pulse'
                  : activeServer.environment === 'Desenvolvimento'
                  ? 'bg-cyan-400'
                  : activeServer.environment === 'Homologação'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>{activeServer.environment} ({getEnvShort(activeServer.environment)})</span>
          </span>
        </div>

        {/* Right: Quick Telemetry Pills */}
        <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-slate-300">
          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Host:</span>
            <span className="font-bold text-slate-100">{activeServer.host}:{activeServer.port}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">CPU:</span>
            <span className={`font-bold ${activeServer.cpuUsagePercent > 80 ? 'text-rose-400' : 'text-cyan-300'}`}>
              {activeServer.cpuUsagePercent}%
            </span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Uptime:</span>
            <span className="font-bold text-amber-300">{activeServer.uptimeFormatted}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Tamanho:</span>
            <span className="font-bold text-indigo-300">{activeDb?.sizeFormatted || activeServer.totalSizeFormatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
