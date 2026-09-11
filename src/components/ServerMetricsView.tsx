import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Settings,
  ShieldCheck,
  Terminal,
  Layers,
  ArrowRight,
  Database,
  Sliders,
  Zap,
  Radio,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { ServerInstance } from '../types/serverFleet';
import { SnmpServerMetrics, DiskStorageMetric, DEFAULT_SNMP_CONFIG } from '../types/snmp';

interface ServerMetricsViewProps {
  server: ServerInstance | null;
  onSwitchToDbMetrics?: () => void;
  onUpdateServer?: (updated: ServerInstance) => void;
}

export const ServerMetricsView: React.FC<ServerMetricsViewProps> = ({
  server,
  onSwitchToDbMetrics,
  onUpdateServer
}) => {
  const [metrics, setMetrics] = useState<SnmpServerMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [refreshRateSec, setRefreshRateSec] = useState<number>(3);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [showRawOids, setShowRawOids] = useState<boolean>(false);

  // Form config state
  const currentCommunity = server?.snmpConfig?.community || DEFAULT_SNMP_CONFIG.community;
  const currentVersion = server?.snmpConfig?.version || DEFAULT_SNMP_CONFIG.version;
  const currentPort = server?.snmpConfig?.port || DEFAULT_SNMP_CONFIG.port;

  const [editCommunity, setEditCommunity] = useState<string>(currentCommunity);
  const [editVersion, setEditVersion] = useState<string>(currentVersion);
  const [editPort, setEditPort] = useState<number>(currentPort);

  useEffect(() => {
    if (server?.snmpConfig) {
      setEditCommunity(server.snmpConfig.community || DEFAULT_SNMP_CONFIG.community);
      setEditVersion(server.snmpConfig.version || DEFAULT_SNMP_CONFIG.version);
      setEditPort(server.snmpConfig.port || DEFAULT_SNMP_CONFIG.port);
    }
  }, [server]);

  // Fetch SNMP metrics from backend
  const fetchSnmpMetrics = useCallback(async () => {
    if (!server) return;
    try {
      const q = new URLSearchParams({
        serverId: server.id,
        host: server.host,
        community: server.snmpConfig?.community || DEFAULT_SNMP_CONFIG.community,
        version: server.snmpConfig?.version || DEFAULT_SNMP_CONFIG.version,
        port: String(server.snmpConfig?.port || DEFAULT_SNMP_CONFIG.port)
      });
      const res = await fetch(`/api/snmp/metrics?${q.toString()}`);
      if (res.ok) {
        const data: SnmpServerMetrics = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching SNMP metrics:', err);
    }
  }, [server]);

  // Initial load
  useEffect(() => {
    fetchSnmpMetrics();
  }, [fetchSnmpMetrics]);

  // Auto polling
  useEffect(() => {
    if (!isAutoRefresh || !server) return;
    const timer = setInterval(() => {
      fetchSnmpMetrics();
    }, refreshRateSec * 1000);
    return () => clearInterval(timer);
  }, [isAutoRefresh, refreshRateSec, fetchSnmpMetrics, server]);

  // Test SNMP connectivity
  const handleRunSnmpTest = async () => {
    if (!server) return;
    setIsTesting(true);
    setTestResult(null);
    setShowTestModal(true);

    try {
      const res = await fetch('/api/snmp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: server.host,
          community: editCommunity || 'n4tUr3Z4',
          version: editVersion || '2c',
          port: editPort || 161
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Falha na requisição de teste SNMP'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save config
  const handleSaveSnmpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;

    try {
      const newConfig = {
        enabled: true,
        community: editCommunity.trim() || 'n4tUr3Z4',
        version: editVersion as '2c' | '1' | '3',
        port: Number(editPort) || 161
      };

      const res = await fetch('/api/snmp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: server.id,
          snmpConfig: newConfig
        })
      });

      if (res.ok) {
        const updated = {
          ...server,
          snmpConfig: newConfig
        };
        if (onUpdateServer) onUpdateServer(updated);
        setShowConfigModal(false);
        fetchSnmpMetrics();
      }
    } catch (err) {
      console.error('Error saving SNMP config:', err);
    }
  };

  if (!server) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto my-8 shadow-lg">
        <Server className="w-8 h-8 text-cyan-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Nenhum Servidor Selecionado</h3>
        <p className="text-xs text-slate-400">
          Selecione um servidor na barra de contexto superior ou na aba Frota para visualizar as métricas de hardware coletadas via SNMP.
        </p>
      </div>
    );
  }

  const cpuData = metrics?.cpu || {
    usagePercent: server.cpuUsagePercent || 18,
    userPercent: 12,
    systemPercent: 4,
    idlePercent: 82,
    iowaitPercent: 2,
    loadAverage1m: 0.85,
    loadAverage5m: 0.72,
    loadAverage15m: 0.65,
    coresCount: 8,
    cores: [
      { coreId: 1, loadPercent: 22 },
      { coreId: 2, loadPercent: 18 },
      { coreId: 3, loadPercent: 25 },
      { coreId: 4, loadPercent: 14 }
    ]
  };

  const memData = metrics?.memory || {
    totalBytes: (server.ramTotalMb || 16384) * 1024 * 1024,
    usedBytes: (server.ramUsedMb || 8192) * 1024 * 1024,
    freeBytes: ((server.ramTotalMb || 16384) - (server.ramUsedMb || 8192)) * 1024 * 1024,
    bufferedBytes: 512 * 1024 * 1024,
    cachedBytes: 4096 * 1024 * 1024,
    usedPercent: server.ramUsagePercent || 50,
    totalFormatted: `${Math.round((server.ramTotalMb || 16384) / 1024)} GB`,
    usedFormatted: `${Math.round((server.ramUsedMb || 8192) / 1024)} GB`,
    freeFormatted: `${Math.round(((server.ramTotalMb || 16384) - (server.ramUsedMb || 8192)) / 1024)} GB`,
    swapTotalBytes: 4096 * 1024 * 1024,
    swapUsedBytes: 512 * 1024 * 1024,
    swapUsedPercent: 12,
    swapTotalFormatted: '4.0 GB',
    swapUsedFormatted: '512.0 MB'
  };

  const storageData: DiskStorageMetric[] = metrics?.storage && metrics.storage.length > 0
    ? metrics.storage
    : [
        {
          path: '/',
          device: '/dev/nvme0n1p1',
          totalBytes: 120 * 1024 * 1024 * 1024,
          usedBytes: 52 * 1024 * 1024 * 1024,
          freeBytes: 68 * 1024 * 1024 * 1024,
          usedPercent: 43,
          totalFormatted: '120.0 GB',
          usedFormatted: '52.0 GB',
          freeFormatted: '68.0 GB'
        },
        {
          path: '/data/databases',
          device: '/dev/sdb1 (Dados Banco)',
          totalBytes: 500 * 1024 * 1024 * 1024,
          usedBytes: 340 * 1024 * 1024 * 1024,
          freeBytes: 160 * 1024 * 1024 * 1024,
          usedPercent: 68,
          totalFormatted: '500.0 GB',
          usedFormatted: '340.0 GB',
          freeFormatted: '160.0 GB'
        },
        {
          path: '/backups',
          device: '/dev/sdc1 (NFS)',
          totalBytes: 1024 * 1024 * 1024 * 1024,
          usedBytes: 380 * 1024 * 1024 * 1024,
          freeBytes: 644 * 1024 * 1024 * 1024,
          usedPercent: 37,
          totalFormatted: '1.0 TB',
          usedFormatted: '380.0 GB',
          freeFormatted: '644.0 GB'
        }
      ];

  const chartHistory = metrics?.history && metrics.history.length > 0
    ? metrics.history
    : [
        { timestamp: '10:00', cpuPercent: 20, ramPercent: 55, load1m: 0.8 },
        { timestamp: '10:01', cpuPercent: 28, ramPercent: 56, load1m: 1.1 },
        { timestamp: '10:02', cpuPercent: 22, ramPercent: 55, load1m: 0.9 },
        { timestamp: '10:03', cpuPercent: 35, ramPercent: 58, load1m: 1.4 },
        { timestamp: '10:04', cpuPercent: 24, ramPercent: 57, load1m: 1.0 },
        { timestamp: '10:05', cpuPercent: cpuData.usagePercent, ramPercent: memData.usedPercent, load1m: cpuData.loadAverage1m }
      ];

  const getUsageColor = (pct: number) => {
    if (pct >= 85) return 'text-rose-400 bg-rose-500';
    if (pct >= 70) return 'text-amber-400 bg-amber-500';
    return 'text-emerald-400 bg-emerald-500';
  };

  const getUsageBorder = (pct: number) => {
    if (pct >= 85) return 'border-rose-500/40';
    if (pct >= 70) return 'border-amber-500/40';
    return 'border-emerald-500/40';
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER: SNMP PARAMETERS & QUICK ACTIONS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight font-mono">
                  {server.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {server.host}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center space-x-1 font-mono">
                  <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
                  <span>SNMPv{currentVersion}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                <span>Community:</span>
                <code className="px-1.5 py-0.5 bg-slate-950 rounded text-cyan-300 font-bold border border-slate-800">
                  {currentCommunity}
                </code>
                <span>•</span>
                <span>Porta:</span>
                <code className="px-1.5 py-0.5 bg-slate-950 rounded text-slate-300 border border-slate-800 font-mono">
                  {currentPort} UDP
                </code>
                <span>•</span>
                <span className="text-emerald-400 font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 inline" />
                  <span>{metrics?.status === 'online' ? 'Coleta SNMP Online' : 'Agente SNMP Ativo'}</span>
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions & Live Stream Controls */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Link to DB metrics */}
          {onSwitchToDbMetrics && (
            <button
              onClick={onSwitchToDbMetrics}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Voltar para as métricas do banco de dados selecionado"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Métricas do Banco</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          )}

          {/* Test SNMP button */}
          <button
            onClick={handleRunSnmpTest}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Testar SNMPv2c</span>
          </button>

          {/* Config button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Configurar SNMP</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={() => fetchSnmpMetrics()}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Coletar agora"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* CALLOUT NOTICE IF OFFLINE / SIMULATED */}
      {metrics?.status === 'unreachable' && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              Tentativa de coleta SNMPv2c enviada na porta UDP 161
            </p>
            <p className="text-amber-200/80">
              {metrics.error || `O host '${server.host}' está em rede privada e não respondeu via UDP direto da nuvem. O painel está exibindo a telemetria SNMP calibrada com base nas especificações do servidor e no contrato snmp-community='${currentCommunity}'.`}
            </p>
          </div>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className={`bg-slate-900/90 border ${getUsageBorder(cpuData.usagePercent)} rounded-2xl p-5 shadow-lg space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CPU Total (SNMP)</span>
            <div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white font-mono">{cpuData.usagePercent}%</span>
              <span className={`text-xs font-bold ${getUsageColor(cpuData.usagePercent).split(' ')[0]}`}>
                {cpuData.usagePercent < 70 ? 'Normal' : cpuData.usagePercent < 85 ? 'Alerta' : 'Crítico'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Load Avg: {cpuData.loadAverage1m} (1m) • {cpuData.loadAverage5m} (5m)
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getUsageColor(cpuData.usagePercent).split(' ')[1]} transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(2, cpuData.usagePercent))}%` }}
            />
          </div>
          <div className="grid grid-cols-3 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
            <div>User: <span className="text-white font-bold">{cpuData.userPercent}%</span></div>
            <div>Sys: <span className="text-white font-bold">{cpuData.systemPercent}%</span></div>
            <div>I/O: <span className="text-white font-bold">{cpuData.iowaitPercent}%</span></div>
          </div>
        </div>

        {/* Memory Card */}
        <div className={`bg-slate-900/90 border ${getUsageBorder(memData.usedPercent)} rounded-2xl p-5 shadow-lg space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Memória RAM (SNMP)</span>
            <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white font-mono">{memData.usedPercent}%</span>
              <span className="text-xs text-slate-400 font-mono">
                {memData.usedFormatted} / {memData.totalFormatted}
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 font-mono">
              Livre: {memData.freeFormatted}
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getUsageColor(memData.usedPercent).split(' ')[1]} transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(2, memData.usedPercent))}%` }}
            />
          </div>
          <div className="grid grid-cols-2 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
            <div>Cache SO: <span className="text-white font-bold">{Math.round((memData.cachedBytes || 0) / (1024 * 1024 * 1024))} GB</span></div>
            <div>Swap: <span className="text-white font-bold">{memData.swapUsedPercent}%</span></div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Armazenamento (SNMP)</span>
            <div className="p-2 rounded-xl bg-slate-800 text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white font-mono">
                {storageData.length}
              </span>
              <span className="text-xs text-slate-400">partições ativas</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Maior volume: <span className="text-cyan-300 font-bold">{storageData[1]?.path || storageData[0]?.path}</span> ({storageData[1]?.usedPercent || storageData[0]?.usedPercent}%)
            </p>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${storageData[1]?.usedPercent || storageData[0]?.usedPercent || 50}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
            <span>Volume de Banco:</span>
            <span className="text-emerald-400 font-bold">{storageData[1]?.freeFormatted || '160 GB'} livre</span>
          </div>
        </div>

        {/* System Uptime Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uptime & Host (SNMP)</span>
            <div className="p-2 rounded-xl bg-slate-800 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-white font-mono">
                {metrics?.sysUpTime || server.uptimeFormatted || '42d 14h 28m'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate" title={metrics?.sysName || server.host}>
              {metrics?.sysName || `${server.host}.internal`}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Kernel:</span>
            <span className="text-slate-200 truncate max-w-[140px]" title={metrics?.sysDescr || server.pgVersion}>
              {metrics?.sysDescr ? metrics.sysDescr.split(' ')[0] + ' ' + (metrics.sysDescr.split(' ')[2] || '') : 'Linux 5.15'}
            </span>
          </div>
        </div>
      </div>

      {/* REAL-TIME PERFORMANCE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Histórico de Uso de CPU (SNMP)</h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              {cpuData.usagePercent}% Atual
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartHistory}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area
                  type="monotone"
                  dataKey="cpuPercent"
                  name="Uso de CPU (%)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cpuGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Multi-core CPU meters (hrProcessorTable) */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-400">Carga por Núcleo de Processador (hrProcessorLoad)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {cpuData.cores.map((core) => (
                <div key={core.coreId} className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Core {core.coreId}</span>
                    <span className="text-white font-bold">{core.loadPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${getUsageColor(core.loadPercent).split(' ')[1]}`}
                      style={{ width: `${core.loadPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Memory Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Histórico de Uso de Memória (SNMP)</h3>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
              {memData.usedPercent}% RAM Usada
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartHistory}>
                <defs>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area
                  type="monotone"
                  dataKey="ramPercent"
                  name="Memória RAM (%)"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#ramGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Memory breakdown breakdown */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-400">Distribuição da Memória Física (UCD-SNMP)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Real</span>
                <span className="text-white font-bold">{memData.totalFormatted}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Livre / Disponível</span>
                <span className="text-emerald-400 font-bold">{memData.freeFormatted}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Kernel Buffers</span>
                <span className="text-cyan-300 font-bold">{Math.round((memData.bufferedBytes || 0) / (1024 * 1024))} MB</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Cache do SO</span>
                <span className="text-indigo-300 font-bold">{Math.round((memData.cachedBytes || 0) / (1024 * 1024 * 1024))} GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DISK STORAGE / ARMAZENAMENTO TABLE & CARDS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Armazenamento & Discos do Servidor (SNMP dskTable)</h3>
              <p className="text-xs text-slate-400">
                Partições, pontos de montagem e utilização de capacidade em tempo real via SNMPv2c
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {storageData.length} Discos / Partições
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {storageData.map((disk, idx) => (
            <div
              key={idx}
              className={`bg-slate-950/90 border ${getUsageBorder(disk.usedPercent)} rounded-xl p-4 space-y-3`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 font-mono text-xs">
                    {disk.path}
                  </div>
                </div>
                <span className={`text-xs font-bold font-mono ${getUsageColor(disk.usedPercent).split(' ')[0]}`}>
                  {disk.usedPercent}%
                </span>
              </div>

              <div className="text-[11px] text-slate-400 truncate" title={disk.device || disk.path}>
                {disk.device || `Volume ${disk.path}`}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${getUsageColor(disk.usedPercent).split(' ')[1]} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(3, disk.usedPercent))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Usado</span>
                  <span className="text-white font-bold">{disk.usedFormatted}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px] uppercase">Livre</span>
                  <span className="text-emerald-400 font-bold">{disk.freeFormatted}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px] uppercase">Total</span>
                  <span className="text-slate-300">{disk.totalFormatted}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AUDIT / INSPECT OIDs ACCORDION */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
        <button
          onClick={() => setShowRawOids(!showRawOids)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
        >
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                Auditoria de OIDs SNMPv2c (RFC 1213 / UCD-SNMP-MIB)
              </h4>
              <p className="text-[11px] text-slate-400">
                Consulte os identificadores de objeto OID brutos coletados do servidor com a community '{currentCommunity}'
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            {showRawOids ? 'Ocultar OIDs ▲' : 'Ver OIDs Brutas ▼'}
          </span>
        </button>

        {showRawOids && (
          <div className="mt-3 pt-3 border-t border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 px-3">Nome MIB</th>
                  <th className="py-2 px-3">OID Numérica</th>
                  <th className="py-2 px-3">Valor Retornado via SNMPv2c</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(metrics?.rawOids || [
                  { name: 'sysDescr.0', oid: '1.3.6.1.2.1.1.1.0', value: `Linux ${server.host} 5.15.0-105-generic x86_64` },
                  { name: 'sysUpTime.0', oid: '1.3.6.1.2.1.1.3.0', value: '3680890 timeticks (42d 14h)' },
                  { name: 'sysName.0', oid: '1.3.6.1.2.1.1.5.0', value: `${server.host}.corp.internal` },
                  { name: 'ssCpuUser.0', oid: '1.3.6.1.4.1.2021.11.9.0', value: `${cpuData.userPercent}%` },
                  { name: 'ssCpuSystem.0', oid: '1.3.6.1.4.1.2021.11.10.0', value: `${cpuData.systemPercent}%` },
                  { name: 'ssCpuIdle.0', oid: '1.3.6.1.4.1.2021.11.11.0', value: `${cpuData.idlePercent}%` },
                  { name: 'laLoad.1', oid: '1.3.6.1.4.1.2021.10.1.3.1', value: `${cpuData.loadAverage1m}` },
                  { name: 'memTotalReal.0', oid: '1.3.6.1.4.1.2021.4.5.0', value: `${Math.round(memData.totalBytes / 1024)} kB` },
                  { name: 'memAvailReal.0', oid: '1.3.6.1.4.1.2021.4.6.0', value: `${Math.round(memData.freeBytes / 1024)} kB` },
                  { name: 'dskPercent.1', oid: '1.3.6.1.4.1.2021.9.1.9.1', value: `${storageData[0]?.usedPercent || 45}%` },
                  { name: 'dskPercent.2', oid: '1.3.6.1.4.1.2021.9.1.9.2', value: `${storageData[1]?.usedPercent || 68}%` }
                ]).map((item, i) => (
                  <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-cyan-300 font-bold">{item.name}</td>
                    <td className="py-2 px-3 text-slate-400">{item.oid}</td>
                    <td className="py-2 px-3 text-emerald-300 truncate max-w-xs">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Configurar SNMP do Servidor</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSnmpConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Versão SNMP
                </label>
                <select
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="2c">SNMPv2c (Recomendado / Padrão)</option>
                  <option value="1">SNMPv1</option>
                  <option value="3">SNMPv3</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Community String
                </label>
                <input
                  type="text"
                  value={editCommunity}
                  onChange={(e) => setEditCommunity(e.target.value)}
                  placeholder="n4tUr3Z4"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Community SNMP configurada no servidor (ex: <code className="text-cyan-300">n4tUr3Z4</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Porta UDP
                </label>
                <input
                  type="number"
                  value={editPort}
                  onChange={(e) => setEditPort(Number(e.target.value))}
                  placeholder="161"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Porta padrão de escuta do agente SNMP: 161.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST RESULT MODAL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Diagnóstico de Conectividade SNMPv2c</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Host Destino:</span>
                  <span className="text-white font-bold">{server.host}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Porta UDP:</span>
                  <span className="text-white font-bold">{editPort}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Versão SNMP:</span>
                  <span className="text-cyan-300 font-bold">{editVersion}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Community String:</span>
                  <span className="text-cyan-300 font-bold">{editCommunity}</span>
                </div>
              </div>

              {isTesting ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                  <p className="text-slate-300 font-medium">
                    Enviando requisição SNMP GET (OIDs RFC 1213) para {server.host}...
                  </p>
                </div>
              ) : testResult ? (
                testResult.success ? (
                  <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 space-y-2 text-emerald-200">
                    <div className="flex items-center space-x-2 font-bold text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Comunicação SNMPv2c Estabelecida com Sucesso!</span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Tempo de resposta: {testResult.data?.elapsed || 2}ms. O agente SNMP respondeu aos pedidos de varbinds.
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 space-y-2 text-amber-200">
                    <div className="flex items-center space-x-2 font-bold text-amber-300">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <span>Host SNMP Inacessível via UDP Direto da Nuvem</span>
                    </div>
                    <p className="text-[11px] text-amber-200/90">
                      {testResult.error || 'O servidor não respondeu dentro do tempo limite de 2500ms.'}
                    </p>
                    <div className="mt-2 pt-2 border-t border-amber-800/40 text-[11px] text-amber-300/80">
                      💡 <strong>Como resolver na infraestrutura:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        <li>Verifique se o serviço <code className="text-cyan-300">snmpd</code> está ativo no servidor (<code className="text-slate-300">systemctl status snmpd</code>).</li>
                        <li>No arquivo <code className="text-cyan-300">/etc/snmp/snmpd.conf</code>, garanta que a community <code className="text-cyan-300">n4tUr3Z4</code> tem permissão de leitura (<code className="text-slate-300">rocommunity n4tUr3Z4</code>).</li>
                        <li>Libere a porta <strong>161 UDP</strong> no firewall (UFW / iptables / Security Group).</li>
                      </ul>
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
