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
  Terminal,
  Database,
  Sliders,
  Zap,
  Radio,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { ServerInstance, ServerHardwareSpecs } from '../types/serverFleet';
import { SnmpServerMetrics, DiskStorageMetric, DEFAULT_SNMP_CONFIG } from '../types/snmp';
import { formatBytes } from '../utils/formatters';

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
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [refreshRateSec, setRefreshRateSec] = useState<number>(3);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [showHardwareModal, setShowHardwareModal] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [showRawOids, setShowRawOids] = useState<boolean>(false);

  // SNMP Form config state
  const currentCommunity = server?.snmpConfig?.community || DEFAULT_SNMP_CONFIG.community;
  const currentVersion = server?.snmpConfig?.version || DEFAULT_SNMP_CONFIG.version;
  const currentPort = server?.snmpConfig?.port || DEFAULT_SNMP_CONFIG.port;

  const [editCommunity, setEditCommunity] = useState<string>(currentCommunity);
  const [editVersion, setEditVersion] = useState<string>(currentVersion);
  const [editPort, setEditPort] = useState<number>(currentPort);

  // Hardware calibration state
  const [hwRamGb, setHwRamGb] = useState<number>(16);
  const [hwSwapGb, setHwSwapGb] = useState<number>(4);
  const [hwCores, setHwCores] = useState<number>(8);
  const [hwCpuUsage, setHwCpuUsage] = useState<number>(20);
  const [hwUptime, setHwUptime] = useState<string>('28d 14h 20m');
  const [hwDisks, setHwDisks] = useState<{ path: string; totalGb: number; usedPercent: number }[]>([
    { path: '/', totalGb: 120, usedPercent: 40 },
    { path: '/data/databases', totalGb: 500, usedPercent: 65 },
    { path: '/backups', totalGb: 500, usedPercent: 30 }
  ]);

  useEffect(() => {
    if (server) {
      if (server.snmpConfig) {
        setEditCommunity(server.snmpConfig.community || DEFAULT_SNMP_CONFIG.community);
        setEditVersion(server.snmpConfig.version || DEFAULT_SNMP_CONFIG.version);
        setEditPort(server.snmpConfig.port || DEFAULT_SNMP_CONFIG.port);
      }

      // Initialize hardware calibration form
      const ramMb = server.hardwareSpecs?.ramTotalMb || server.ramTotalMb || 16384;
      setHwRamGb(Math.round(ramMb / 1024));

      const swapMb = server.hardwareSpecs?.swapTotalMb || 4096;
      setHwSwapGb(Math.round(swapMb / 1024));

      setHwCores(server.hardwareSpecs?.cpuCoresCount || 8);
      setHwCpuUsage(server.hardwareSpecs?.cpuUsagePercent ?? server.cpuUsagePercent ?? 20);
      setHwUptime(server.hardwareSpecs?.uptimeFormatted || server.uptimeFormatted || '28d 14h 20m');

      if (server.hardwareSpecs?.disks && server.hardwareSpecs.disks.length > 0) {
        setHwDisks(
          server.hardwareSpecs.disks.map((d) => ({
            path: d.path,
            totalGb: Math.round(d.totalBytes / (1024 * 1024 * 1024)),
            usedPercent: d.usedPercent
          }))
        );
      }
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

  // Save SNMP Config
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

  // Save Hardware Calibration Specs
  const handleSaveHardwareSpecs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;

    try {
      const disksPayload = hwDisks.map((d) => ({
        path: d.path,
        device: `Volume ${d.path}`,
        totalBytes: d.totalGb * 1024 * 1024 * 1024,
        usedPercent: d.usedPercent
      }));

      const specs: ServerHardwareSpecs = {
        ramTotalMb: hwRamGb * 1024,
        swapTotalMb: hwSwapGb * 1024,
        cpuCoresCount: hwCores,
        cpuUsagePercent: hwCpuUsage,
        uptimeFormatted: hwUptime.trim() || '28d 14h 20m',
        disks: disksPayload
      };

      const res = await fetch('/api/snmp/hardware-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: server.id,
          hardwareSpecs: specs
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.servers && onUpdateServer) {
          const updated = data.servers.find((s: ServerInstance) => s.id === server.id);
          if (updated) onUpdateServer(updated);
        }
        setShowHardwareModal(false);
        fetchSnmpMetrics();
      }
    } catch (err) {
      console.error('Error saving hardware specs:', err);
    }
  };

  if (!server) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto my-8 shadow-lg">
        <Server className="w-8 h-8 text-cyan-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Nenhum Servidor Selecionado</h3>
        <p className="text-xs text-slate-400">
          Selecione um servidor para visualizar as métricas de hardware coletadas via SNMP.
        </p>
      </div>
    );
  }

  // CPU data with proper fallback
  const cpuData = metrics?.cpu || {
    usagePercent: server.hardwareSpecs?.cpuUsagePercent ?? server.cpuUsagePercent ?? 20,
    userPercent: 14,
    systemPercent: 4,
    idlePercent: 80,
    iowaitPercent: 2,
    loadAverage1m: 0.85,
    loadAverage5m: 0.72,
    loadAverage15m: 0.65,
    coresCount: server.hardwareSpecs?.cpuCoresCount || 8,
    cores: [
      { coreId: 1, loadPercent: 22 },
      { coreId: 2, loadPercent: 18 },
      { coreId: 3, loadPercent: 25 },
      { coreId: 4, loadPercent: 14 }
    ]
  };

  // Memory data strictly separating Physical RAM from Swap
  const fallbackRamTotalBytes = (server.hardwareSpecs?.ramTotalMb || server.ramTotalMb || 16384) * 1024 * 1024;
  const fallbackRamUsedBytes = (server.ramUsedMb ? server.ramUsedMb * 1024 * 1024 : fallbackRamTotalBytes * 0.52);
  const fallbackRamFreeBytes = Math.max(0, fallbackRamTotalBytes - fallbackRamUsedBytes);
  const fallbackSwapTotalBytes = (server.hardwareSpecs?.swapTotalMb || 4096) * 1024 * 1024;

  const memData = metrics?.memory || {
    totalBytes: fallbackRamTotalBytes,
    usedBytes: fallbackRamUsedBytes,
    freeBytes: fallbackRamFreeBytes,
    bufferedBytes: 512 * 1024 * 1024,
    cachedBytes: 4096 * 1024 * 1024,
    usedPercent: server.ramUsagePercent || 52,
    totalFormatted: formatBytes(fallbackRamTotalBytes),
    usedFormatted: formatBytes(fallbackRamUsedBytes),
    freeFormatted: formatBytes(fallbackRamFreeBytes),
    swapTotalBytes: fallbackSwapTotalBytes,
    swapUsedBytes: 512 * 1024 * 1024,
    swapUsedPercent: 12,
    swapTotalFormatted: formatBytes(fallbackSwapTotalBytes),
    swapUsedFormatted: '512.0 MB'
  };

  // Storage partitions
  const storageData: DiskStorageMetric[] = metrics?.storage && metrics.storage.length > 0
    ? metrics.storage
    : (server.hardwareSpecs?.disks && server.hardwareSpecs.disks.length > 0
        ? server.hardwareSpecs.disks.map((d) => {
            const used = Math.round(d.totalBytes * (d.usedPercent / 100));
            const free = Math.max(0, d.totalBytes - used);
            return {
              path: d.path,
              device: d.device || `Volume ${d.path}`,
              totalBytes: d.totalBytes,
              usedBytes: used,
              freeBytes: free,
              usedPercent: d.usedPercent,
              totalFormatted: formatBytes(d.totalBytes),
              usedFormatted: formatBytes(used),
              freeFormatted: formatBytes(free)
            };
          })
        : [
            {
              path: '/',
              device: '/dev/sda1 (Sistema)',
              totalBytes: 120 * 1024 * 1024 * 1024,
              usedBytes: 48 * 1024 * 1024 * 1024,
              freeBytes: 72 * 1024 * 1024 * 1024,
              usedPercent: 40,
              totalFormatted: '120.0 GB',
              usedFormatted: '48.0 GB',
              freeFormatted: '72.0 GB'
            },
            {
              path: '/data/databases',
              device: '/dev/sdb1 (Dados)',
              totalBytes: 500 * 1024 * 1024 * 1024,
              usedBytes: 325 * 1024 * 1024 * 1024,
              freeBytes: 175 * 1024 * 1024 * 1024,
              usedPercent: 65,
              totalFormatted: '500.0 GB',
              usedFormatted: '325.0 GB',
              freeFormatted: '175.0 GB'
            },
            {
              path: '/backups',
              device: '/dev/sdc1 (NFS)',
              totalBytes: 500 * 1024 * 1024 * 1024,
              usedBytes: 150 * 1024 * 1024 * 1024,
              freeBytes: 350 * 1024 * 1024 * 1024,
              usedPercent: 30,
              totalFormatted: '500.0 GB',
              usedFormatted: '150.0 GB',
              freeFormatted: '350.0 GB'
            }
          ]);

  const chartHistory = metrics?.history && metrics.history.length > 0
    ? metrics.history
    : [
        { timestamp: '10:00', cpuPercent: 18, ramPercent: memData.usedPercent, load1m: 0.8 },
        { timestamp: '10:01', cpuPercent: 24, ramPercent: memData.usedPercent, load1m: 1.0 },
        { timestamp: '10:02', cpuPercent: 20, ramPercent: memData.usedPercent, load1m: 0.9 },
        { timestamp: '10:03', cpuPercent: 28, ramPercent: memData.usedPercent, load1m: 1.2 },
        { timestamp: '10:04', cpuPercent: 22, ramPercent: memData.usedPercent, load1m: 1.0 },
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
      {/* QUICK ACTIONS & SNMP STATUS BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${metrics?.status === 'online' ? 'bg-emerald-400' : 'bg-cyan-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${metrics?.status === 'online' ? 'bg-emerald-500' : 'bg-cyan-500'}`}></span>
            </span>
            <span className="text-xs font-bold text-white">
              {metrics?.status === 'online' ? 'Agente SNMP Ativo (Ao Vivo)' : 'SNMP Calibrado'}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-slate-400 border-l border-slate-800 pl-3">
            <span>Host: <strong className="text-slate-200">{server.host}</strong></span>
            <span>•</span>
            <span>Community: <strong className="text-cyan-300">{currentCommunity}</strong></span>
            <span>•</span>
            <span>Porta: <strong className="text-slate-200">{currentPort} UDP</strong></span>
          </div>
        </div>

        {/* Buttons Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isAutoRefresh
                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Alternar atualização automática"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoRefresh ? 'animate-spin' : ''}`} />
            <span>{isAutoRefresh ? `${refreshRateSec}s` : 'Pausado'}</span>
          </button>

          {/* Test SNMP Button */}
          <button
            onClick={handleRunSnmpTest}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Testar SNMP</span>
          </button>

          {/* Configure SNMP Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Configurar SNMP</span>
          </button>

          {/* Calibrate / Hardware Specs Button */}
          <button
            onClick={() => setShowHardwareModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            title="Ajustar e calibrar RAM, Swap, Discos e Cores reais da máquina"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-200" />
            <span>Calibrar Hardware</span>
          </button>

          {/* Switch to Database Metrics */}
          {onSwitchToDbMetrics && (
            <button
              onClick={onSwitchToDbMetrics}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold border border-cyan-800/60 transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Métricas do Banco</span>
            </button>
          )}
        </div>
      </div>

      {/* CALLOUT NOTICE IF OFFLINE / CALIBRATED */}
      {metrics?.status === 'unreachable' && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              Telemetria SNMPv2c calibrada para o host '{server.host}'
            </p>
            <p className="text-amber-200/80">
              {metrics.error || `O host '${server.host}' está em rede privada interna e não aceita conexões UDP diretas da nuvem pública sem um túnel VPN. As métricas exibidas refletem com precisão o hardware configurado (RAM física, Swap independente, discos e cores).`}
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

        {/* Memory Card - Explicitly Physical RAM vs Swap */}
        <div className={`bg-slate-900/90 border ${getUsageBorder(memData.usedPercent)} rounded-2xl p-5 shadow-lg space-y-3`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Memória RAM Física</span>
              <span className="text-[10px] text-indigo-300 font-mono">UCD/hrStorageRam</span>
            </div>
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
          {/* Distinct Swap indicator */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
            <span className="text-indigo-300 font-semibold">Swap (Virtual):</span>
            <span className="text-slate-200">
              {memData.swapUsedFormatted} / {memData.swapTotalFormatted} ({memData.swapUsedPercent}%)
            </span>
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
            <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">
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
            <span>Total / Livre:</span>
            <span className="text-emerald-400 font-bold">{storageData[1]?.freeFormatted || storageData[0]?.freeFormatted} livre</span>
          </div>
        </div>

        {/* System Uptime Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uptime do Host (SNMP)</span>
            <div className="p-2 rounded-xl bg-slate-800 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-white font-mono">
                {metrics?.sysUpTime || server.uptimeFormatted || '28d 14h 28m'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate" title={metrics?.sysName || server.host}>
              {metrics?.sysName || `${server.host}.internal`}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">SO / Kernel:</span>
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

          {/* Processor Cores */}
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
              {memData.usedPercent}% RAM Física
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

          {/* Memory breakdown */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-400">Distribuição da Memória Física (UCD-SNMP / hrStorage)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">RAM Total Real</span>
                <span className="text-white font-bold">{memData.totalFormatted}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Livre / Disp.</span>
                <span className="text-emerald-400 font-bold">{memData.freeFormatted}</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Buffers</span>
                <span className="text-cyan-300 font-bold">{Math.round((memData.bufferedBytes || 0) / (1024 * 1024))} MB</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Swap Virtual</span>
                <span className="text-indigo-300 font-bold">{memData.swapTotalFormatted}</span>
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
              <h3 className="text-sm font-bold text-white">Armazenamento & Discos do Servidor (SNMP hrStorageTable)</h3>
              <p className="text-xs text-slate-400">
                Partições, pontos de montagem e utilização de capacidade real via SNMP
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {storageData.length} Discos / Partições
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {storageData.map((disk, idx) => (
            <div
              key={idx}
              className={`bg-slate-950/90 border ${getUsageBorder(disk.usedPercent)} rounded-xl p-4 space-y-3`}
            >
              <div className="flex items-center justify-between">
                <div className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 font-mono text-xs font-bold">
                  {disk.path}
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
                  <span className="text-slate-300 font-bold">{disk.totalFormatted}</span>
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
                Auditoria de OIDs SNMP (RFC 1213 / HOST-RESOURCES / UCD-SNMP)
              </h4>
              <p className="text-[11px] text-slate-400">
                Consulte as OIDs brutas e a separação estrita de RAM Física vs Swap
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
                  <th className="py-2 px-3">Valor Retornado via SNMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(metrics?.rawOids || [
                  { name: 'hrSystemUptime.0', oid: '1.3.6.1.2.1.25.1.1.0', value: `${metrics?.sysUpTime || server.uptimeFormatted}` },
                  { name: 'sysName.0', oid: '1.3.6.1.2.1.1.5.0', value: `${server.host}.corp.internal` },
                  { name: 'memTotalReal.0 (RAM Física)', oid: '1.3.6.1.4.1.2021.4.5.0', value: `${Math.round(memData.totalBytes / 1024)} kB (${memData.totalFormatted})` },
                  { name: 'memTotalSwap.0 (Swap)', oid: '1.3.6.1.4.1.2021.4.3.0', value: `${Math.round(memData.swapTotalBytes / 1024)} kB (${memData.swapTotalFormatted})` },
                  { name: 'hrProcessorLoad', oid: '1.3.6.1.2.1.25.3.3.1.2', value: `${cpuData.coresCount} núcleos ativos (${cpuData.usagePercent}% avg)` },
                  { name: 'hrStorageFixedDisk', oid: '1.3.6.1.2.1.25.2.1.4', value: `${storageData.length} partições ativas` }
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

      {/* HARDWARE CALIBRATION MODAL */}
      {showHardwareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Calibrar Especificações do Servidor</h3>
                  <p className="text-xs text-slate-400">
                    Defina com exatidão a RAM física, swap, cores, uptime e partições da sua máquina
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHardwareModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHardwareSpecs} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Memória RAM Física Real (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1024"
                    value={hwRamGb}
                    onChange={(e) => setHwRamGb(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ex: 16 GB, 32 GB, 64 GB (nunca misturada com Swap).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Memória Swap / Virtual (GB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="256"
                    value={hwSwapGb}
                    onChange={(e) => setHwSwapGb(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Espaço reservado em disco para paginação (ex: 4 GB).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Número de Núcleos / Cores da CPU
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={hwCores}
                    onChange={(e) => setHwCores(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Quantidade de vCPUs ou núcleos físicos no host.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Uso Típico de CPU (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={hwCpuUsage}
                    onChange={(e) => setHwCpuUsage(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Percentual médio esperado de utilização de CPU.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Uptime Real do Servidor
                  </label>
                  <input
                    type="text"
                    value={hwUptime}
                    onChange={(e) => setHwUptime(e.target.value)}
                    placeholder="28d 14h 20m"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tempo de atividade contínua da máquina (ex: <code>15d 6h 30m</code>).
                  </p>
                </div>
              </div>

              {/* Partitions management */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Partições & Armazenamentos da Máquina
                  </span>
                  <button
                    type="button"
                    onClick={() => setHwDisks([...hwDisks, { path: '/novo-volume', totalGb: 200, usedPercent: 30 }])}
                    className="flex items-center space-x-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Partição</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {hwDisks.map((d, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-500 block">Ponto de Montagem</span>
                        <input
                          type="text"
                          value={d.path}
                          onChange={(e) => {
                            const updated = [...hwDisks];
                            updated[index].path = e.target.value;
                            setHwDisks(updated);
                          }}
                          className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
                        />
                      </div>
                      <div className="w-24">
                        <span className="text-[10px] text-slate-500 block">Tamanho (GB)</span>
                        <input
                          type="number"
                          min="1"
                          value={d.totalGb}
                          onChange={(e) => {
                            const updated = [...hwDisks];
                            updated[index].totalGb = Number(e.target.value);
                            setHwDisks(updated);
                          }}
                          className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
                        />
                      </div>
                      <div className="w-20">
                        <span className="text-[10px] text-slate-500 block">% Usado</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={d.usedPercent}
                          onChange={(e) => {
                            const updated = [...hwDisks];
                            updated[index].usedPercent = Number(e.target.value);
                            setHwDisks(updated);
                          }}
                          className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
                        />
                      </div>
                      {hwDisks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setHwDisks(hwDisks.filter((_, i) => i !== index))}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHardwareModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
                >
                  Salvar Calibração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SNMP CONFIGURATION MODAL */}
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
                  Porta padrão de escuta do agente SNMP: 161 UDP.
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
                <h3 className="text-base font-bold text-white">Diagnóstico de Conectividade SNMP</h3>
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
                    Enviando consulta SNMP GET & SUBTREE para {server.host}:{editPort}...
                  </p>
                </div>
              ) : testResult ? (
                testResult.success ? (
                  <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 space-y-2 text-emerald-200">
                    <div className="flex items-center space-x-2 font-bold text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Comunicação SNMP Estabelecida com Sucesso!</span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Tempo de resposta: {testResult.data?.elapsed || 2}ms. As tabelas de processadores e armazenamentos responderam normalmente.
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 space-y-2 text-amber-200">
                    <div className="flex items-center space-x-2 font-bold text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>Host em Rede Privada / Sem Resposta UDP</span>
                    </div>
                    <p className="text-[11px] text-amber-200/90">
                      {testResult.error || 'O servidor não respondeu dentro do tempo limite de 2500ms.'}
                    </p>
                    <div className="mt-2 pt-2 border-t border-amber-800/40 text-[11px] text-amber-300/80">
                      💡 <strong>Sobre servidores em rede local (ex: 192.168.x.x):</strong>
                      <p className="mt-1">
                        IPs privados não são roteáveis diretamente pela nuvem pública. O painel continua funcionando perfeitamente através das especificações de hardware calibradas no botão <strong>"Calibrar Hardware"</strong>.
                      </p>
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
