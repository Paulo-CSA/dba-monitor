import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { ServerInstance } from '../types/serverFleet';
import { ActiveAlert } from '../types/alerts';
import { RealtimeMetricsPayload } from '../types/metrics';
import {
  Server,
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Users,
  Zap,
  Clock,
  ShieldCheck,
  TrendingUp,
  HardDrive,
  BarChart2,
  CheckCircle2,
  PieChart as PieChartIcon,
  Check
} from 'lucide-react';
import { formatMs, formatBytes } from '../utils/formatters';

interface GlobalDashboardViewProps {
  servers: ServerInstance[];
  activeAlerts: ActiveAlert[];
  metrics: RealtimeMetricsPayload | null;
  onSelectServer?: (serverId: string) => void;
  onSwitchTab?: (tab: string) => void;
  onOpenConnectionsModal?: () => void;
  onAcknowledgeAlert?: (alertId: string, serverId?: string, dbName?: string) => void;
}

export const GlobalDashboardView: React.FC<GlobalDashboardViewProps> = ({
  servers,
  activeAlerts,
  metrics,
  onSelectServer,
  onSwitchTab,
  onOpenConnectionsModal,
  onAcknowledgeAlert
}) => {
  // Calculate aggregated metrics across all servers
  const totalServers = servers.length;
  const healthyCount = servers.filter((s) => s.status === 'healthy').length;
  const warningCount = servers.filter((s) => s.status === 'warning').length;
  const criticalCount = servers.filter((s) => s.status === 'critical').length;

  const totalDatabases = servers.reduce((acc, s) => acc + (s.totalDatabasesCount || s.databases?.length || 0), 0);
  const totalActiveConnections = servers.reduce((acc, s) => {
    if (s.stuckQueries && Array.isArray(s.stuckQueries) && s.stuckQueries.length > 0) {
      return acc + s.stuckQueries.length;
    }
    const dbConns = s.databases ? s.databases.reduce((dAcc, d) => dAcc + (d.activeConnections || 0), 0) : 0;
    return acc + Math.max(dbConns, s.totalActiveConnections || 0);
  }, 0);

  // Compute average CPU across servers
  const avgCpuUsage = Math.round(
    servers.reduce((acc, s) => acc + s.cpuUsagePercent, 0) / (totalServers || 1)
  );

  // Compute total fleet TPS (queries/sec)
  const totalFleetTps = servers.reduce((acc, s) => {
    const serverTps = s.databases.reduce((dbAcc, db) => dbAcc + (db.tps || 0), 0);
    return acc + serverTps;
  }, 0);

  // Compute average latency
  const avgLatencyMs = Number(
    (servers.reduce((acc, s) => acc + s.avgLatencyMs, 0) / (totalServers || 1)).toFixed(2)
  );

  // Render empty state if no servers are registered
  if (totalServers === 0) {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 max-w-2xl mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
            <Server className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Nenhum Servidor PostgreSQL Cadastrado</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Adicione seu primeiro servidor PostgreSQL para que a aplicação realize a consulta via SQL do <code>SELECT version();</code> e recupere automaticamente os bancos de dados cadastrados.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onSwitchTab?.('add_server')}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center space-x-2"
            >
              <Server className="w-4 h-4" />
              <span>Adicionar Servidor PostgreSQL</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
  const topTpsServers = [...servers]
    .map((s) => ({
      name: s.name.length > 20 ? s.name.substring(0, 18) + '...' : s.name,
      fullName: s.name,
      host: s.host,
      environment: s.environment,
      tps: s.databases.reduce((acc, db) => acc + (db.tps || 0), 0),
      connections: s.totalActiveConnections
    }))
    .sort((a, b) => b.tps - a.tps)
    .slice(0, 5);

  // All databases mapped flat for fleet-wide ranking
  const allDatabases = servers.flatMap((s) =>
    s.databases.map((db) => ({
      dbName: db.datname,
      serverName: s.name,
      serverId: s.id,
      host: s.host,
      environment: s.environment,
      sizeFormatted: db.sizeFormatted,
      sizeGb: Number((db.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)),
      connections: db.activeConnections || 0,
      tps: db.tps || 0
    }))
  );

  // Server connections across fleet (sorted by active connections)
  const serverConnectionsData = [...servers]
    .map((s) => ({
      id: s.id,
      name: s.name.length > 20 ? s.name.substring(0, 18) + '...' : s.name,
      fullName: s.name,
      host: s.host,
      environment: s.environment,
      connections: s.totalActiveConnections || s.databases.reduce((acc, db) => acc + (db.activeConnections || 0), 0),
      databasesCount: s.databases.length,
      tps: s.databases.reduce((acc, db) => acc + (db.tps || 0), 0)
    }))
    .sort((a, b) => b.connections - a.connections);

  // Top 5 databases with most active connections
  const topDbConnections = [...allDatabases]
    .map((db) => ({
      ...db,
      displayName: db.dbName.length > 18 ? db.dbName.substring(0, 16) + '...' : db.dbName
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5);

  // Top 5 largest databases across all servers
  const topSizeDatabases = [...allDatabases]
    .sort((a, b) => b.sizeGb - a.sizeGb)
    .slice(0, 5);

  // Distribution by environment tag
  const envCounts = {
    Produção: servers.filter((s) => s.environment === 'Produção').length,
    Desenvolvimento: servers.filter((s) => s.environment === 'Desenvolvimento').length,
    Homologação: servers.filter((s) => s.environment === 'Homologação').length
  };

  const envPieData = [
    { name: 'Produção', value: envCounts.Produção, color: '#f43f5e' },
    { name: 'Desenvolvimento', value: envCounts.Desenvolvimento, color: '#06b6d4' },
    { name: 'Homologação', value: envCounts.Homologação, color: '#f59e0b' }
  ].filter((item) => item.value > 0);

  // Environment Colors for bar labels
  const getEnvBadgeStyle = (env: string) => {
    switch (env) {
      case 'Produção':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'Desenvolvimento':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'Homologação':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Header Title */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Dashboard de Monitoramento Global
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Visão da Frota em Tempo Real</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Visão consolidada do cluster PostgreSQL: {totalServers} servidores, {totalDatabases} bancos de dados e {totalActiveConnections} conexões ativas.
          </p>
        </div>

        {/* Quick Summary Pill Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center space-x-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Saudáveis:</span>
            <span className="font-bold text-emerald-400">{healthyCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center space-x-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-400">Alertas:</span>
            <span className="font-bold text-amber-400">{warningCount + criticalCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center space-x-2 text-xs">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">TPS Total:</span>
            <span className="font-bold text-cyan-300 font-mono">{totalFleetTps} tps</span>
          </div>
        </div>
      </div>

      {/* Central de Alertas e Notificações Ativas (Posicionado logo abaixo do Header) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Central de Alertas e Notificações Ativas</h2>
              <p className="text-xs text-slate-400">Avisos automáticos de CPU, conexões, queries lentas e locks</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-amber-950 text-amber-300 border border-amber-800">
            {activeAlerts.length} Alerta(s) Ativo(s)
          </span>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="p-6 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-300">Todos os Servidores Saudáveis</h3>
            <p className="text-xs text-emerald-400/80 font-mono">
              Nenhuma violação de limite ou alerta crítico detectado no momento. Todos os clusters estão operando dentro dos parâmetros ideais.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border flex items-start space-x-3 transition-all ${
                  alert.severity === 'critical'
                    ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate text-white">{alert.ruleName}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded font-mono ${
                        alert.severity === 'critical'
                          ? 'bg-rose-900 text-rose-200 border border-rose-700'
                          : 'bg-amber-900 text-amber-200 border border-amber-700'
                      }`}
                    >
                      {alert.severity === 'critical' ? 'CRÍTICO' : 'AVISO'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 font-mono leading-relaxed">{alert.message}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] opacity-80 font-mono">
                    <span>Host: {alert.serverHost} | {alert.triggeredAtFormatted}</span>
                    {onAcknowledgeAlert && (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.id, undefined, alert.ruleName.includes('(') ? alert.ruleName.split('(')[1]?.replace(')', '') : undefined)}
                        className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-[10px] flex items-center space-x-1 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                        title="Marcar como Ciente e silenciar alerta"
                      >
                        <Check className="w-3 h-3" />
                        <span>Ciente</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Servidores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Servidores Monitorados</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-cyan-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">{totalServers}</span>
            <span className="text-xs text-slate-400 font-mono">{healthyCount}/{totalServers} Online</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Bancos Ativos: <strong className="text-slate-200">{totalDatabases}</strong></span>
            <span className="text-emerald-400 font-semibold">{Math.round((healthyCount / (totalServers || 1)) * 100)}% OK</span>
          </div>
        </div>

        {/* Card 2: Throughput Total da Frota (TPS & Block I/O) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Throughput Total da Frota (TPS)</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-cyan-300 font-mono">{totalFleetTps}</span>
            <span className="text-xs text-cyan-400 font-mono">TPS / seg</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Block I/O Ops: <strong className="text-slate-200">Normal</strong></span>
            <span className="text-cyan-400 font-semibold">Sem gargalos</span>
          </div>
        </div>

        {/* Card 3: Sessões Ativas na Frota (`Server Sessions`) */}
        <div
          onClick={onOpenConnectionsModal}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-purple-500/80 hover:shadow-lg hover:shadow-purple-950/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 group-hover:text-purple-300 transition-colors">
              Sessões Ativas da Frota (`Server Sessions`) &rarr;
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-purple-300">
              {totalActiveConnections}
            </span>
            <span className="text-xs text-slate-400 font-mono">Sessões Ativas</span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="h-full transition-all bg-purple-500"
              style={{ width: `${Math.min(100, (totalActiveConnections / (totalServers * 100 || 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Conexões Ativas & Alertas */}
        <div
          onClick={onOpenConnectionsModal}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-cyan-500/80 hover:shadow-lg hover:shadow-cyan-950/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 group-hover:text-cyan-300 transition-colors">
              Conexões Ativas & Alertas &rarr;
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-300 font-mono">{totalActiveConnections}</span>
            <span className="text-xs text-slate-400 font-mono">Pool Ativo</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Alertas do Sistema:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
              activeAlerts.length > 0 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}>
              {activeAlerts.length} Ativos
            </span>
          </div>
        </div>
      </div>

      {/* Row 1 Charts: Conexões por Servidor & Top 5 Conexões por Bancos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Conexões Ativas por Servidor */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Conexões Ativas por Servidor</h2>
                <p className="text-xs text-slate-400">Distribuição de sessões ativas por instância PostgreSQL</p>
              </div>
            </div>
            {onOpenConnectionsModal ? (
              <button
                onClick={onOpenConnectionsModal}
                className="text-xs font-mono text-purple-400 bg-purple-950/60 border border-purple-800/80 hover:bg-purple-900/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                title="Ver todas as conexões da frota"
              >
                <span>Ver Conexões</span>
                <span>&rarr;</span>
              </button>
            ) : (
              <span className="text-xs font-mono text-purple-400 bg-purple-950/60 border border-purple-800/80 px-2.5 py-1 rounded-lg">
                Sessões / Servidor
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serverConnectionsData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} unit=" conns" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 11 }} width={110} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`${value} Conexões Ativas`, 'Sessões Ativas']}
                  labelFormatter={(label, items) => {
                    const item = items[0]?.payload;
                    return item ? `${item.fullName} (${item.host})` : label;
                  }}
                />
                <Bar dataKey="connections" radius={[0, 8, 8, 0]}>
                  {serverConnectionsData.map((entry, index) => (
                    <Cell
                      key={`srv-conn-${index}`}
                      fill={
                        index === 0
                          ? '#a855f7'
                          : index === 1
                          ? '#8b5cf6'
                          : index === 2
                          ? '#6366f1'
                          : index === 3
                          ? '#3b82f6'
                          : '#06b6d4'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table List representation below chart for clarity */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {serverConnectionsData.map((srv, idx) => (
              <div
                key={srv.id || idx}
                onClick={() => onSelectServer?.(srv.id)}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800/50 transition-colors text-xs cursor-pointer group"
                title="Clique para selecionar este servidor"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-white group-hover:text-purple-300 transition-colors truncate block">
                      {srv.fullName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{srv.host} &bull; {srv.databasesCount} bancos</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold font-mono rounded border ${getEnvBadgeStyle(srv.environment)}`}>
                    {srv.environment}
                  </span>
                  <span className="font-bold font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                    {srv.connections} conexões
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Top 5 Conexões por Bancos de Dados */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Top 5 Conexões por Bancos de Dados</h2>
                <p className="text-xs text-slate-400">Bancos com maior número de conexões ativas na frota</p>
              </div>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1 rounded-lg">
              Top 5 Bancos
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDbConnections} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="displayName" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" conns" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`${value} Conexões Ativas`, 'Conexões do Banco']}
                  labelFormatter={(label, items) => {
                    const item = items[0]?.payload;
                    return item ? `${item.dbName} (${item.serverName} - ${item.host})` : label;
                  }}
                />
                <Bar dataKey="connections" name="Conexões Ativas" radius={[8, 8, 0, 0]}>
                  {topDbConnections.map((entry, index) => (
                    <Cell
                      key={`db-cell-${index}`}
                      fill={
                        index === 0
                          ? '#06b6d4'
                          : index === 1
                          ? '#3b82f6'
                          : index === 2
                          ? '#8b5cf6'
                          : index === 3
                          ? '#a855f7'
                          : '#ec4899'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table List representation */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {topDbConnections.map((db, idx) => (
              <div
                key={idx}
                onClick={() => onSelectServer?.(db.serverId)}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800/50 transition-colors text-xs cursor-pointer group"
                title="Clique para acessar o servidor deste banco"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="font-bold text-white group-hover:text-cyan-300 transition-colors font-mono truncate block">
                      {db.dbName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate block">
                      {db.serverName} ({db.host}) &bull; {db.sizeFormatted}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0 font-mono">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${getEnvBadgeStyle(db.environment)}`}>
                    {db.environment}
                  </span>
                  <span className="font-bold px-2 py-0.5 rounded border text-xs bg-cyan-950 text-cyan-300 border-cyan-800">
                    {db.connections} conexões
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Top 5 Servidores com Maiores Consultas (TPS) & Top 5 Maiores Bancos por Tamanho */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Servidores com Maiores Consultas (TPS) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Top 5 Servidores com Maiores Consultas (TPS)</h2>
                <p className="text-xs text-slate-400">Instâncias com maior volume de transações por segundo</p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
              Throughput QPS
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTpsServers} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} unit=" tps" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 11 }} width={110} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`${value} TPS`, 'Volume de Consultas']}
                  labelFormatter={(label, items) => {
                    const item = items[0]?.payload;
                    return item ? `${item.fullName} (${item.host})` : label;
                  }}
                />
                <Bar dataKey="tps" radius={[0, 8, 8, 0]}>
                  {topTpsServers.map((entry, index) => (
                    <Cell
                      key={`tps-cell-${index}`}
                      fill={
                        index === 0
                          ? '#10b981'
                          : index === 1
                          ? '#06b6d4'
                          : index === 2
                          ? '#3b82f6'
                          : index === 3
                          ? '#6366f1'
                          : '#8b5cf6'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table List representation below chart */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {topTpsServers.map((srv, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800/50 transition-colors text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-white truncate block">{srv.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{srv.host}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold font-mono rounded border ${getEnvBadgeStyle(srv.environment)}`}>
                    {srv.environment}
                  </span>
                  <span className="font-bold font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    {srv.tps} TPS
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Maior Espaço em Disco (GB) por Banco de Dados */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Top 5 Maiores Bancos de Dados por Tamanho (GB)</h2>
                <p className="text-xs text-slate-400">Bancos de dados que mais consomem armazenamento no cluster</p>
              </div>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/80 px-2.5 py-1 rounded-lg">
              Espaço em Disco
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSizeDatabases} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="dbName" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" GB" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`${value} GB`, 'Tamanho do Banco']}
                  labelFormatter={(label, items) => {
                    const item = items[0]?.payload;
                    return item ? `Database: ${item.dbName} (${item.serverName})` : label;
                  }}
                />
                <Bar dataKey="sizeGb" name="Tamanho (GB)" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {topSizeDatabases.map((db, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800/50 transition-colors text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Database className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-white font-mono">{db.dbName}</span>
                    <span className="text-[10px] text-slate-400 block truncate">Servidor: {db.serverName} ({db.host})</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0 font-mono">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${getEnvBadgeStyle(db.environment)}`}>
                    {db.environment}
                  </span>
                  <span className="font-bold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                    {db.sizeFormatted}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Distribuição por Ambiente */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <PieChartIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Distribuição da Frota por Ambiente</h2>
              <p className="text-xs text-slate-400">Proporção de instâncias PostgreSQL agrupadas por ambiente (Produção, Desenvolvimento, Homologação)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="h-52 w-full flex items-center justify-center md:col-span-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={envPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {envPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`${value} Servidor(es)`, 'Quantidade']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {envPieData.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {Math.round((item.value / (totalServers || 1)) * 100)}% da frota
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-2xl font-bold font-mono text-white">{item.value}</span>
                  <span className="text-xs text-slate-400">{item.value === 1 ? 'instância' : 'instâncias'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
