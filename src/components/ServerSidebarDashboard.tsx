import React, { useState } from 'react';
import { ServerInstance, DatabaseInfo } from '../types/serverFleet';
import { RealtimeMetricsPayload } from '../types/metrics';
import { StuckQuery, ActiveLock } from '../types/locks';
import { MetricCard } from './MetricCard';
import { MetricsCharts } from './MetricsCharts';
import { StuckQueriesTable } from './StuckQueriesTable';
import { ActiveLocksView } from './ActiveLocksView';
import { EditServerModal } from './EditServerModal';
import { formatMs, formatBytes } from '../utils/formatters';

import {
  Server,
  Database,
  Eye,
  ShieldCheck,
  Cpu,
  Clock,
  Search,
  Lock,
  Activity,
  Users,
  HardDrive,
  ChevronRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Pencil,
  Plus
} from 'lucide-react';

interface ServerSidebarDashboardProps {
  servers: ServerInstance[];
  selectedServerId: string;
  selectedDatabaseName: string;
  onSelectServer: (serverId: string) => void;
  onSelectDatabase: (datname: string) => void;
  metrics: RealtimeMetricsPayload | null;
  stuckQueries: StuckQuery[];
  activeLocks: ActiveLock[];
  onKillPid: (pid: number) => void;
  onAnalyzeWithAi: (query: StuckQuery) => void;
  killingPid: number | null;
  onUpdateServer?: (updatedServer: ServerInstance) => void;
  onDeleteServer?: (serverId: string) => void;
  onAddServer?: (newServer: ServerInstance) => void;
  onOpenConnectionsModal?: () => void;
}

export const ServerSidebarDashboard: React.FC<ServerSidebarDashboardProps> = ({
  servers,
  selectedServerId,
  selectedDatabaseName,
  onSelectServer,
  onSelectDatabase,
  metrics,
  stuckQueries,
  activeLocks,
  onKillPid,
  onAnalyzeWithAi,
  killingPid,
  onUpdateServer,
  onDeleteServer,
  onAddServer,
  onOpenConnectionsModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnvFilter, setSelectedEnvFilter] = useState<'TODOS' | 'Produção' | 'Desenvolvimento' | 'Homologação' | 'ALERTAS'>('TODOS');
  const [activeTab, setActiveTab] = useState<'databases' | 'metrics' | 'queries_locks'>('databases');
  const [editingServer, setEditingServer] = useState<ServerInstance | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const activeServer = servers.find((s) => s.id === selectedServerId) || servers[0];

  // Helper to detect server alerts (zero tables, high cpu, warning status, etc.)
  const getServerAlertInfo = (srv: ServerInstance) => {
    const zeroTableDbs = (srv.databases || []).filter(
      (d) => (d.tablesCount ?? 0) < 1 && d.datname.toLowerCase() !== 'postgres' && !d.datname.toLowerCase().startsWith('template')
    );
    const hasZeroTables = zeroTableDbs.length > 0;
    const isHighCpu = srv.cpuUsagePercent > 80;
    const isWarningStatus = srv.status === 'warning' || srv.status === 'critical';
    const hasAlert = hasZeroTables || isHighCpu || isWarningStatus;

    return {
      hasAlert,
      hasZeroTables,
      zeroTableDbs,
      isHighCpu,
      isWarningStatus
    };
  };

  const handleAddNewServerClick = () => {
    const newServer: ServerInstance = {
      id: `srv-custom-${Date.now().toString().slice(-4)}`,
      name: 'Novo Servidor PG',
      host: '10.0.0.50',
      port: 5432,
      environment: 'Desenvolvimento',
      pgVersion: 'PostgreSQL 16.2',
      uptimeFormatted: '1d 0h',
      cpuUsagePercent: 12,
      avgLatencyMs: 2.1,
      totalDatabasesCount: 1,
      totalActiveConnections: 5,
      totalSizeFormatted: '10 GB',
      status: 'healthy',
      databases: [
        {
          datname: 'app_db',
          sizeBytes: 10 * 1024 * 1024 * 1024,
          sizeFormatted: '10 GB',
          activeConnections: 5,
          maxConnections: 100,
          tps: 120,
          cacheHitRatio: 99.5,
          tablesCount: 0,
          owner: 'postgres',
          encoding: 'UTF8',
          status: 'online'
        }
      ]
    };
    setEditingServer(newServer);
    setIsEditModalOpen(true);
  };

  const alertServersCount = servers.filter((s) => getServerAlertInfo(s).hasAlert).length;

  // Environment tag list with abbreviations and Alertas
  const envTags: { key: 'TODOS' | 'Produção' | 'Desenvolvimento' | 'Homologação' | 'ALERTAS'; label: string; full: string }[] = [
    { key: 'TODOS', label: 'TODOS', full: 'Todos os Ambientes' },
    ...(alertServersCount > 0
      ? [{ key: 'ALERTAS' as const, label: 'ALERTAS', full: 'Servidores com Alertas' }]
      : []),
    { key: 'Produção', label: 'PROD', full: 'Produção' },
    { key: 'Desenvolvimento', label: 'DEV', full: 'Desenvolvimento' },
    { key: 'Homologação', label: 'HOMO', full: 'Homologação' }
  ];

  // Filter servers in sidebar by search term AND selected environment tag
  const filteredServers = servers.filter((srv) => {
    const alertInfo = getServerAlertInfo(srv);
    const matchesEnv =
      selectedEnvFilter === 'TODOS'
        ? true
        : selectedEnvFilter === 'ALERTAS'
        ? alertInfo.hasAlert
        : srv.environment === selectedEnvFilter;

    const matchesSearch =
      srv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      srv.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
      srv.environment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      srv.databases.some((db) => db.datname.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesEnv && matchesSearch;
  });

  const activeDatabase = activeServer?.databases.find((d) => d.datname === selectedDatabaseName) || activeServer?.databases[0];

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-140px)]">
      {/* ================= SIDEBAR (MENU LATERAL DE SERVIDORES) ================= */}
      <aside className="w-full lg:w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-xl">
        {/* Sidebar Title */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Servidores ({servers.length})</h2>
          </div>

          <button
            onClick={handleAddNewServerClick}
            title="Adicionar Novo Servidor"
            className="px-2 py-1 text-[11px] font-bold rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Adicionar</span>
          </button>
        </div>

        {/* Environment Tag Filter Buttons */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {envTags.map((tag) => {
            const isActive = selectedEnvFilter === tag.key;
            const count =
              tag.key === 'TODOS'
                ? servers.length
                : tag.key === 'ALERTAS'
                ? alertServersCount
                : servers.filter((s) => s.environment === tag.key).length;

            return (
              <button
                key={tag.key}
                onClick={() => setSelectedEnvFilter(tag.key)}
                title={tag.full}
                className={`px-2 py-1 text-[10px] font-bold font-mono rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? tag.key === 'ALERTAS'
                      ? 'bg-orange-950 text-orange-200 border border-orange-600 shadow-sm shadow-orange-950 ring-1 ring-orange-500'
                      : tag.key === 'Produção'
                      ? 'bg-rose-950 text-rose-200 border border-rose-700 shadow-sm shadow-rose-950'
                      : tag.key === 'Desenvolvimento'
                      ? 'bg-cyan-950 text-cyan-200 border border-cyan-700 shadow-sm shadow-cyan-950'
                      : tag.key === 'Homologação'
                      ? 'bg-amber-950 text-amber-200 border border-amber-700 shadow-sm shadow-amber-950'
                      : 'bg-cyan-600 text-white border border-cyan-400 shadow-sm'
                    : tag.key === 'ALERTAS'
                    ? 'bg-orange-950/60 text-orange-300 border border-orange-800/80 hover:bg-orange-900/80 hover:text-orange-100'
                    : 'bg-slate-950/80 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tag.key === 'ALERTAS' && <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                <span>{tag.label}</span>
                <span
                  className={`px-1 py-0.2 text-[9px] rounded-full ${
                    isActive
                      ? tag.key === 'ALERTAS'
                        ? 'bg-orange-800 text-orange-100 font-bold'
                        : 'bg-black/40 text-white font-bold'
                      : tag.key === 'ALERTAS'
                      ? 'bg-orange-900/80 text-orange-300'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Field */}
        <div className="mt-2 relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar servidores e bancos..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
          />
        </div>

        {/* List of Servers in Sidebar */}
        <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-[600px] pr-1">
          {filteredServers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 font-mono bg-slate-950/40 border border-slate-800/60 rounded-xl">
              Nenhum servidor encontrado com a tag <strong>{selectedEnvFilter}</strong>.
            </div>
          ) : (
            filteredServers.map((srv) => {
              const isSelected = srv.id === activeServer.id;
              const alertInfo = getServerAlertInfo(srv);

              let cardBgClass = '';
              if (alertInfo.hasAlert) {
                cardBgClass = isSelected
                  ? 'bg-orange-900/90 border-orange-400 ring-2 ring-orange-500 shadow-lg shadow-orange-950/80 text-orange-100'
                  : 'bg-orange-950/90 border-orange-500/80 hover:bg-orange-900 hover:border-orange-400 text-orange-100 shadow-md shadow-orange-950/40';
              } else if (isSelected) {
                cardBgClass = 'bg-slate-950 border-cyan-500/80 ring-1 ring-cyan-500/50 shadow-md shadow-cyan-950/40';
              } else {
                cardBgClass = 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80';
              }

              return (
                <div
                  key={srv.id}
                  onClick={() => {
                    onSelectServer(srv.id);
                    if (srv.databases.length > 0) {
                      onSelectDatabase(srv.databases[0].datname);
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${cardBgClass}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      {alertInfo.hasAlert ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400 ring-2 ring-orange-500/50 animate-pulse flex-shrink-0" />
                      ) : (
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            srv.status === 'healthy'
                              ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                              : srv.status === 'warning'
                              ? 'bg-amber-400'
                              : 'bg-rose-500'
                          }`}
                        />
                      )}
                      <h3
                        className={`text-xs font-bold truncate ${
                          alertInfo.hasAlert
                            ? 'text-orange-200'
                            : isSelected
                            ? 'text-cyan-300'
                            : 'text-slate-200 group-hover:text-white'
                        }`}
                      >
                        {srv.name}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {alertInfo.hasAlert && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono uppercase rounded bg-orange-900 text-orange-200 border border-orange-600 flex items-center space-x-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 text-orange-400" />
                          <span>ALERTA</span>
                        </span>
                      )}

                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold font-mono uppercase rounded ${
                          srv.environment === 'Produção'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : srv.environment === 'Desenvolvimento'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : srv.environment === 'Homologação'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {srv.environment === 'Produção'
                          ? 'PROD'
                          : srv.environment === 'Desenvolvimento'
                          ? 'DEV'
                          : srv.environment === 'Homologação'
                          ? 'HOMO'
                          : 'TEST'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingServer(srv);
                          setIsEditModalOpen(true);
                        }}
                        title="Editar ou remover servidor"
                        className={`p-1 rounded-lg transition-all cursor-pointer ${
                          alertInfo.hasAlert
                            ? 'text-orange-300 hover:text-white hover:bg-orange-800/60'
                            : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className={`mt-1.5 text-[11px] font-mono truncate ${alertInfo.hasAlert ? 'text-orange-300/80' : 'text-slate-400'}`}>
                    {srv.host}:{srv.port}
                  </div>

                  {/* Warning Details Banner inside server card */}
                  {alertInfo.hasAlert && (
                    <div className="mt-2 px-2 py-1 rounded-lg bg-orange-900/60 border border-orange-600/70 text-[10px] text-orange-200 font-mono flex items-center space-x-1.5 shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span className="truncate">
                        {alertInfo.hasZeroTables
                          ? `${alertInfo.zeroTableDbs.length} banco(s) sem contagem de tabelas`
                          : alertInfo.isHighCpu
                          ? `Uso de CPU crítico (${srv.cpuUsagePercent}%)`
                          : 'Instabilidade detectada no servidor'}
                      </span>
                    </div>
                  )}

                  <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] ${
                    alertInfo.hasAlert ? 'border-orange-800/60 text-orange-300/90' : 'border-slate-800/60 text-slate-500'
                  }`}>
                    <span className={`flex items-center space-x-1 font-mono ${alertInfo.hasAlert ? 'text-orange-300 font-bold' : 'text-cyan-400'}`}>
                      <Database className="w-3 h-3" />
                      <span>{srv.totalDatabasesCount} bancos</span>
                    </span>

                    <span className={`font-mono ${alertInfo.hasAlert ? 'text-orange-200 font-bold' : 'text-slate-400'}`}>
                      CPU {srv.cpuUsagePercent}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Status Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
            <Server className="w-3.5 h-3.5" />
            <span>Frota PostgreSQL</span>
          </div>
          <span className="text-emerald-400 font-mono flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Conectado</span>
          </span>
        </div>
      </aside>

      {/* ================= MAIN CONTENT PANEL (INFORMACÕES DO SERVIDOR & BANCOS) ================= */}
      <main className="flex-1 space-y-6 min-w-0">
        {!activeServer ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 my-6">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Server className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white">Nenhum Servidor Selecionado</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Sua lista de servidores está vazia. Adicione o seu servidor PostgreSQL para consultar via SQL a versão e todos os bancos instalados.
            </p>
            <button
              onClick={handleAddNewServerClick}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Primeiro Servidor</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center space-x-3">
                  <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                    <Server className="w-6 h-6" />
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h1 className="text-lg font-bold text-white">{activeServer.name}</h1>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        activeServer.environment === 'Production' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {activeServer.environment}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-cyan-400 mt-0.5">
                      Host: {activeServer.host}:{activeServer.port} | {activeServer.region}
                    </p>
                  </div>
                </div>
              </div>

              {/* Server Key Telemetry Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Versão PG</span>
                  <span className="font-bold text-white">{activeServer.pgVersion}</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Uptime</span>
                  <span className="font-bold text-emerald-400">{activeServer.uptimeFormatted}</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Carga de CPU</span>
                  <span className={`font-bold ${activeServer.cpuUsagePercent > 80 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {activeServer.cpuUsagePercent}%
                  </span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Armazenamento</span>
                  <span className="font-bold text-purple-300">{activeServer.totalSizeFormatted}</span>
                </div>
              </div>
            </div>

            {/* Inner Tabs Navigation for Active Server */}
            <div className="flex space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('databases')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'databases'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Bancos de Dados ({activeServer.databases.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('metrics')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'metrics'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Métricas de Telemetria ao Vivo</span>
              </button>

              <button
                onClick={() => setActiveTab('queries_locks')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'queries_locks'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Sessões e Locks (`pg_stat_activity`)</span>
              </button>
            </div>

            {/* TAB 1: DATABASES LIST & METRICS SUMMARY */}
            {activeTab === 'databases' && (
              <div className="space-y-6">
                {/* Databases Grid Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeServer.databases.map((db) => {
                    const isSelectedDb = db.datname === selectedDatabaseName;
                    const tablesCount = db.tablesCount ?? 0;
                    const isPostgres = db.datname.toLowerCase() === 'postgres';
                    const isZeroTables = tablesCount < 1 && !isPostgres;

                    let cardBgClass = '';
                    if (isZeroTables) {
                      cardBgClass = isSelectedDb
                        ? 'bg-orange-900/90 border-orange-400 ring-2 ring-orange-500 shadow-lg shadow-orange-950/80 text-orange-100'
                        : 'bg-orange-950/90 border-orange-500/80 hover:bg-orange-900 hover:border-orange-400 text-orange-100 shadow-md shadow-orange-950/40';
                    } else if (isSelectedDb) {
                      cardBgClass = 'bg-slate-950 border-cyan-500 ring-1 ring-cyan-500 shadow-md';
                    } else {
                      cardBgClass = 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950';
                    }

                    return (
                      <div
                        key={db.datname}
                        onClick={() => onSelectDatabase(db.datname)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${cardBgClass}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Database className={`w-5 h-5 ${isZeroTables ? 'text-orange-400' : isSelectedDb ? 'text-cyan-400' : 'text-slate-500'}`} />
                            <div>
                              <h3 className={`text-sm font-bold ${isZeroTables ? 'text-orange-200' : isSelectedDb ? 'text-cyan-300' : 'text-white'}`}>
                                {db.datname}
                              </h3>
                              <span className={`text-[10px] font-mono ${isZeroTables ? 'text-orange-300/80' : 'text-slate-400'}`}>Owner: {db.owner} | {db.encoding}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            {isSelectedDb && (
                              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 uppercase">
                                Selecionado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* DB Metrics Cards */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className={`p-2 rounded-xl border ${isZeroTables ? 'bg-orange-900/40 border-orange-800/80' : 'bg-slate-900 border-slate-800'}`}>
                            <span className={`text-[10px] block ${isZeroTables ? 'text-orange-300' : 'text-slate-500'}`}>Tamanho em Disco</span>
                            <span className="font-bold text-emerald-400">{db.sizeFormatted}</span>
                          </div>

                          <div className={`p-2 rounded-xl border ${isZeroTables ? 'bg-orange-900/40 border-orange-800/80' : 'bg-slate-900 border-slate-800'}`}>
                            <span className={`text-[10px] block ${isZeroTables ? 'text-orange-300' : 'text-slate-500'}`}>Conexões Ativas</span>
                            <span className="font-bold text-cyan-400">
                              {db.activeConnections || 0}
                            </span>
                          </div>

                          <div className={`p-2 rounded-xl border ${isZeroTables ? 'bg-orange-900/40 border-orange-800/80' : 'bg-slate-900 border-slate-800'}`}>
                            <span className={`text-[10px] block ${isZeroTables ? 'text-orange-300' : 'text-slate-500'}`}>Transações/s</span>
                            <span className="font-bold text-purple-300">{db.tps} tps</span>
                          </div>

                          <div className={`p-2 rounded-xl border ${isZeroTables ? 'bg-orange-900/60 border-orange-600' : 'bg-slate-900 border-slate-800'}`}>
                            <span className={`text-[10px] block ${isZeroTables ? 'text-orange-200' : 'text-slate-500'}`}>Qtd. de Tabelas</span>
                            <span className={`font-bold ${isZeroTables ? 'text-orange-300' : 'text-cyan-300'}`}>
                              {tablesCount} {tablesCount === 1 ? 'tabela' : 'tabelas'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDatabase(db.datname);
                            setActiveTab('metrics');
                          }}
                          className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition-all ${
                            isZeroTables
                              ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-md'
                              : isSelectedDb
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          Ver Métricas Detalhadas do Banco &rarr;
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: DETAILED LIVE METRICS CHARTS */}
            {activeTab === 'metrics' && metrics && (
              <div className="space-y-6">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-mono text-xs">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400">Banco Monitorado Atualmente:</span>
                    <strong className="text-cyan-300 text-sm font-bold">{selectedDatabaseName}</strong>
                  </div>

                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                    Telemetria em Tempo Real (Refresh 2s)
                  </span>
                </div>

                {/* Top KPI Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Sessões e Conexões do Servidor"
                    value={activeDatabase?.activeConnections || stuckQueries.length || 0}
                    subtitle="Sessões Ativas no Servidor"
                    icon={Users}
                    status={(activeDatabase?.activeConnections || 0) > 80 ? 'warning' : 'normal'}
                    details={[
                      { label: 'Sessões Ativas', value: `${stuckQueries.length}` },
                      { label: 'Máx Conexões', value: `${metrics.currentResources.maxConnections || 100}` }
                    ]}
                    onClick={onOpenConnectionsModal}
                    clickableHint="Clique para ver conexões ativas"
                  />

                  <MetricCard
                    title="Transações por Segundo (TPS)"
                    value={`${activeDatabase?.tps || metrics.currentResources.tps || 240} tx/s`}
                    subtitle="Throughput de Transações"
                    icon={Zap}
                    status="normal"
                    details={[
                      { label: 'Transações/s', value: `${activeDatabase?.tps || metrics.currentResources.tps || 240}` },
                      { label: 'Capacidade', value: 'Normal' }
                    ]}
                  />

                  <MetricCard
                    title="Sessões Ativas por Banco"
                    value={activeDatabase?.activeConnections ?? stuckQueries.length}
                    subtitle={`Banco: ${activeDatabase?.datname || 'PostgreSQL'}`}
                    icon={Database}
                    status="normal"
                    details={[
                      { label: 'Transações/s', value: `${activeDatabase?.tps || metrics.currentResources.tps}` },
                      { label: 'Usuários Ativos', value: `${stuckQueries[0]?.usename || 'postgres'}` }
                    ]}
                    onClick={onOpenConnectionsModal}
                    clickableHint="Clique para ver conexões ativas"
                  />

                  <MetricCard
                    title="I/O de Bloco no Disco (Block I/O)"
                    value={`${activeDatabase?.cacheHitRatio || metrics.currentResources.cacheHitRatio}%`}
                    subtitle="Operações de Bloco em Disco"
                    icon={HardDrive}
                    status="normal"
                    progressPercent={activeDatabase?.cacheHitRatio || 99}
                    details={[
                      { label: 'Hit Ratio Cache', value: `${activeDatabase?.cacheHitRatio || 99}%` },
                      { label: 'Uso de RAM', value: `${metrics.currentResources.ramUsagePercent}%` }
                    ]}
                  />
                </div>

                {/* Realtime Performance Charts */}
                <MetricsCharts
                  latencyHistory={metrics.latencyHistory}
                  cpuHistory={metrics.cpuHistory}
                  currentCpu={metrics.currentCpu}
                  currentLatency={metrics.currentLatency}
                />
              </div>
            )}

            {/* TAB 3: STUCK QUERIES & LOCKS */}
            {activeTab === 'queries_locks' && (
              <div className="space-y-6">
                <StuckQueriesTable
                  stuckQueries={stuckQueries}
                  onKillPid={onKillPid}
                  onAnalyzeWithAi={onAnalyzeWithAi}
                  killingPid={killingPid}
                />

                <ActiveLocksView activeLocks={activeLocks} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal para Editar ou Remover Servidor */}
      <EditServerModal
        isOpen={isEditModalOpen}
        server={editingServer}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingServer(null);
        }}
        onSave={(updated) => {
          if (servers.some((s) => s.id === updated.id)) {
            if (onUpdateServer) onUpdateServer(updated);
          } else {
            if (onAddServer) onAddServer(updated);
          }
        }}
        onDelete={(serverId) => {
          if (onDeleteServer) onDeleteServer(serverId);
        }}
      />
    </div>
  );
};
