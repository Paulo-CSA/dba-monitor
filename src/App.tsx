import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { MetricCard } from './components/MetricCard';
import { MetricsCharts } from './components/MetricsCharts';
import { ConfigViewer } from './components/ConfigViewer';
import { IntegrityHealthCard } from './components/IntegrityHealthCard';
import { BackupTracker } from './components/BackupTracker';
import { StuckQueriesTable } from './components/StuckQueriesTable';
import { ActiveLocksView } from './components/ActiveLocksView';
import { AlertRulesManager } from './components/AlertRulesManager';
import { AiQueryModal } from './components/AiQueryModal';
import { ExportReportModal } from './components/ExportReportModal';
import { ConnectionSettingsModal } from './components/ConnectionSettingsModal';
import { ActiveConnectionsModal } from './components/ActiveConnectionsModal';

import { ServerFleetOverview } from './components/ServerFleetOverview';
import { ServerSidebarDashboard } from './components/ServerSidebarDashboard';
import { GlobalDashboardView } from './components/GlobalDashboardView';
import { SelectedServerContextBar } from './components/SelectedServerContextBar';
import { ServerInstance, DatabaseInfo } from './types/serverFleet';
import { RealtimeMetricsPayload } from './types/metrics';
import { PgSystemConfig } from './types/config';
import { DatabaseIntegrityOverview } from './types/health';
import { BackupOverview } from './types/backup';
import { StuckQuery, ActiveLock } from './types/locks';
import { AlertRule, ActiveAlert } from './types/alerts';
import { ReportFilterOptions } from './types/export';

import { exportToCSV } from './utils/csvExporter';
import { exportToPDF } from './utils/pdfExporter';
import { analyzeQueryWithAI } from './services/aiDiagnosticService';
import { formatMs, formatBytes } from './utils/formatters';

import { Clock, Cpu, Users, HardDrive, Zap, CheckCircle2, AlertTriangle, Activity, Server, Plus } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(2000);
  const [isLoadSpike, setIsLoadSpike] = useState<boolean>(false);

  // Fleet & Observability States
  const [fleetServers, setFleetServers] = useState<ServerInstance[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [selectedDatabaseName, setSelectedDatabaseName] = useState<string>('');

  // Core Data States
  const [metrics, setMetrics] = useState<RealtimeMetricsPayload | null>(null);
  const [sysConfig, setSysConfig] = useState<PgSystemConfig | null>(null);
  const [sqlConfigQuery, setSqlConfigQuery] = useState<string>('');
  const [integrity, setIntegrity] = useState<DatabaseIntegrityOverview | null>(null);
  const [backupOverview, setBackupOverview] = useState<BackupOverview | null>(null);
  const [stuckQueries, setStuckQueries] = useState<StuckQuery[]>([]);
  const [activeLocks, setActiveLocks] = useState<ActiveLock[]>([]);
  const [killedPids, setKilledPids] = useState<number[]>([]);

  // Alert States
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);

  // Modal States
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const [showConnectionModal, setShowConnectionModal] = useState<boolean>(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState<boolean>(false);

  // AI Modal States
  const [selectedAiQuery, setSelectedAiQuery] = useState<StuckQuery | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);

  // Action Pending States
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [isScanningIntegrity, setIsScanningIntegrity] = useState<boolean>(false);
  const [isTriggeringBackup, setIsTriggeringBackup] = useState<boolean>(false);

  // Initial Data Load
  const fetchInitialStaticData = useCallback(async () => {
    try {
      const [serversRes, configRes, integrityRes, locksRes, backupRes, rulesRes] = await Promise.all([
        fetch('/api/db/servers'),
        fetch('/api/db/config'),
        fetch('/api/db/integrity'),
        fetch('/api/db/locks'),
        fetch('/api/db/backups'),
        fetch('/api/db/alerts/rules')
      ]);

      if (serversRes.ok) {
        const sData = await serversRes.json();
        if (sData.servers && sData.servers.length > 0) {
          setFleetServers(sData.servers);
          setSelectedServerId((prev) => prev || sData.servers[0].id);
          setSelectedDatabaseName((prev) => prev || (sData.servers[0].databases[0]?.datname || 'postgres'));
        }
      }

      if (configRes.ok) {
        const cData = await configRes.json();
        setSysConfig(cData.config);
        setSqlConfigQuery(cData.sqlQuery);
      }

      if (integrityRes.ok) {
        const iData = await integrityRes.json();
        setIntegrity(iData);
      }

      if (locksRes.ok) {
        const lData = await locksRes.json();
        setStuckQueries(lData.stuckQueries);
        setActiveLocks(lData.activeLocks);
      }

      if (backupRes.ok) {
        const bData = await backupRes.json();
        setBackupOverview(bData);
      }

      if (rulesRes.ok) {
        const rData = await rulesRes.json();
        setAlertRules(rData);
      }
    } catch (err) {
      console.error('Error loading initial static data:', err);
    }
  }, []);

  useEffect(() => {
    fetchInitialStaticData();
  }, [fetchInitialStaticData]);

  const handleSelectServer = (serverId: string, preferredDbName?: string) => {
    setSelectedServerId(serverId);
    const targetServer = fleetServers.find((s) => s.id === serverId);
    if (targetServer) {
      if (preferredDbName) {
        setSelectedDatabaseName(preferredDbName);
      } else if (targetServer.databases && targetServer.databases.length > 0) {
        const dbExists = targetServer.databases.some((d) => d.datname === selectedDatabaseName);
        if (!dbExists) {
          setSelectedDatabaseName(targetServer.databases[0].datname);
        }
      } else {
        setSelectedDatabaseName('postgres');
      }
    }
  };

  const activeServerObject = fleetServers.find((s) => s.id === selectedServerId) || fleetServers[0];
  const activeDb = activeServerObject
    ? activeServerObject.databases.find((d) => d.datname === selectedDatabaseName) || activeServerObject.databases[0]
    : undefined;

  // Fetch live active connections for current server and database
  const fetchLiveConnectionsForActiveDb = useCallback(async () => {
    if (!activeServerObject) return;
    const targetDb = activeDb ? activeDb.datname : selectedDatabaseName || activeServerObject.databases[0]?.datname || 'postgres';

    try {
      const res = await fetch('/api/db/fetch-live-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: activeServerObject.host,
          port: activeServerObject.port,
          dbUser: activeServerObject.dbUser,
          dbPassword: activeServerObject.dbPassword,
          database: targetDb,
          serverId: activeServerObject.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.queries)) {
          setStuckQueries(data.queries);
          setFleetServers((prev) =>
            prev.map((srv) => {
              if (srv.id !== activeServerObject.id) return srv;
              const updatedDatabases = srv.databases.map((db) => ({
                ...db,
                activeConnections: data.queries.filter((q: StuckQuery) => q.datname === db.datname).length
              }));
              return {
                ...srv,
                stuckQueries: data.queries,
                databases: updatedDatabases,
                totalActiveConnections: data.queries.length
              };
            })
          );
        } else {
          // If not live PG TCP or in simulation mode, fetch default simulation state
          const lockRes = await fetch('/api/db/locks');
          if (lockRes.ok) {
            const lData = await lockRes.json();
            setStuckQueries(lData.stuckQueries || []);
            setActiveLocks(lData.activeLocks || []);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live connections:', err);
    }
  }, [activeServerObject, activeDb, selectedDatabaseName]);

  // Re-fetch live connections when active server or database changes
  useEffect(() => {
    if (selectedServerId && selectedDatabaseName) {
      fetchLiveConnectionsForActiveDb();
    }
  }, [selectedServerId, selectedDatabaseName, fetchLiveConnectionsForActiveDb]);

  // Real-time Polling Engine
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/db/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setActiveAlerts(data.alerts || []);
          setIsLoadSpike(data.isLoadSpike);
        }
        await fetchLiveConnectionsForActiveDb();
      } catch (err) {
        console.error('Metrics fetch error:', err);
      }
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [isLive, refreshIntervalMs, fetchLiveConnectionsForActiveDb]);

  // Handler for Toggling Load Spike
  const handleToggleLoadSpike = async () => {
    const nextState = !isLoadSpike;
    setIsLoadSpike(nextState);
    try {
      await fetch('/api/db/metrics/simulate-spike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextState })
      });
    } catch (err) {
      console.error('Error toggling spike:', err);
    }
  };

  // Handler for Terminating Backend PID
  const handleKillPid = async (pid: number) => {
    setKillingPid(pid);

    // Optimistically mark PID as terminated immediately
    setKilledPids((prev) => [...prev, pid]);
    setStuckQueries((prev) => prev.filter((q) => q.pid !== pid));
    setActiveLocks((prev) => prev.filter((l) => l.pid !== pid));

    setFleetServers((prev) =>
      prev.map((srv) => ({
        ...srv,
        stuckQueries: srv.stuckQueries ? srv.stuckQueries.filter((q) => q.pid !== pid) : []
      }))
    );

    const targetDb = activeDb ? activeDb.datname : selectedDatabaseName || 'postgres';

    try {
      await fetch('/api/db/kill-pid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pid,
          host: activeServerObject?.host,
          port: activeServerObject?.port,
          dbUser: activeServerObject?.dbUser,
          dbPassword: activeServerObject?.dbPassword,
          database: targetDb
        })
      });

      setTimeout(() => {
        fetchLiveConnectionsForActiveDb();
      }, 600);
    } catch (err) {
      console.error('Error terminating PID:', err);
    } finally {
      setKillingPid(null);
    }
  };

  // Handler for AI Query Analysis
  const handleAnalyzeWithAi = async (queryItem: StuckQuery) => {
    setSelectedAiQuery(queryItem);
    setAiAnalysisResult(null);
    setIsAnalyzingAi(true);

    try {
      const analysis = await analyzeQueryWithAI(
        queryItem.query,
        queryItem.durationSeconds,
        queryItem.wait_event,
        queryItem.blocking_pid
      );
      setAiAnalysisResult(analysis);
    } catch (err) {
      setAiAnalysisResult('Erro ao obter diagnóstico de IA.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Handler for Integrity Scan
  const handleRunScan = async () => {
    setIsScanningIntegrity(true);
    try {
      const res = await fetch('/api/db/integrity/scan', { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setIntegrity(updated);
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanningIntegrity(false);
    }
  };

  // Handler for Manual Backup
  const handleTriggerBackup = async (
    type: 'pg_dump' | 'pg_basebackup',
    customPath?: string,
    targetServerObj?: ServerInstance,
    targetDbNameParam?: string,
    targetLocationType: 'local' | 'remote' = 'local',
    sshUser?: string,
    sshPassword?: string,
    sshHost?: string,
    sshPort?: number
  ) => {
    setIsTriggeringBackup(true);
    const srv = targetServerObj || activeServerObject;
    const targetDbName = targetDbNameParam || activeDb?.datname || selectedDatabaseName || srv?.databases[0]?.datname || 'postgres';

    if (srv && srv.id) {
      setSelectedServerId(srv.id);
    }
    if (targetDbName) {
      setSelectedDatabaseName(targetDbName);
    }
    try {
      const res = await fetch('/api/db/backups/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          location: customPath,
          serverId: srv?.id,
          serverName: srv?.name || srv?.host,
          serverHost: srv?.host,
          databaseName: targetDbName,
          targetLocationType,
          sshUser,
          sshPassword,
          sshHost: sshHost || srv?.host,
          sshPort
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.entry) {
          setBackupOverview((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              lastBackupTimestamp: data.entry.startTime,
              timeSinceLastBackupFormatted: 'Agora mesmo',
              recentBackups: [data.entry, ...prev.recentBackups]
            };
          });
        }
      }
    } catch (err) {
      console.error('Backup trigger error:', err);
    } finally {
      setIsTriggeringBackup(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    try {
      const res = await fetch(`/api/db/backups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBackupOverview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recentBackups: prev.recentBackups.filter((b) => b.id !== id)
          };
        });
      }
    } catch (err) {
      console.error('Delete backup error:', err);
    }
  };

  const handleClearAllBackups = async () => {
    try {
      const res = await fetch('/api/db/backups', { method: 'DELETE' });
      if (res.ok) {
        setBackupOverview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recentBackups: [],
            timeSinceLastBackupFormatted: 'Sem histórico recente'
          };
        });
      }
    } catch (err) {
      console.error('Clear backups error:', err);
    }
  };

  // Alert Rule Handlers
  const handleAddRule = async (rule: Omit<AlertRule, 'id'>) => {
    try {
      const res = await fetch('/api/db/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      if (res.ok) {
        const created = await res.json();
        setAlertRules((prev) => [...prev, created]);
      }
    } catch (err) {
      console.error('Add rule error:', err);
    }
  };

  const handleToggleRule = async (id: string) => {
    setAlertRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    try {
      await fetch('/api/db/alerts/rules/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) {
      console.error('Toggle rule error:', err);
    }
  };

  // CSV Export Trigger
  const handleExportCSV = (options: ReportFilterOptions) => {
    if (!metrics || !sysConfig || !integrity || !backupOverview) return;
    exportToCSV(
      options,
      metrics,
      sysConfig.fileLocations,
      integrity,
      backupOverview,
      stuckQueries,
      activeLocks
    );
    setShowExportModal(false);
  };

  // PDF Export Trigger
  const handleExportPDF = (options: ReportFilterOptions) => {
    if (!metrics || !sysConfig || !integrity || !backupOverview) return;
    const currentLocs = (activeServerObject?.fileLocations && activeServerObject.fileLocations.length > 0)
      ? activeServerObject.fileLocations
      : sysConfig.fileLocations;
    exportToPDF(
      options,
      metrics,
      currentLocs,
      integrity,
      backupOverview,
      stuckQueries,
      activeLocks
    );
    setShowExportModal(false);
  };

  const handleUpdateServer = async (updatedServer: ServerInstance) => {
    setFleetServers((prev) =>
      prev.map((srv) => (srv.id === updatedServer.id ? updatedServer : srv))
    );
    try {
      await fetch(`/api/db/servers/${updatedServer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedServer)
      });
    } catch (err) {
      console.error('Error updating server:', err);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    setFleetServers((prev) => {
      const next = prev.filter((srv) => srv.id !== serverId);
      if (selectedServerId === serverId && next.length > 0) {
        setSelectedServerId(next[0].id);
        if (next[0].databases.length > 0) {
          setSelectedDatabaseName(next[0].databases[0].datname);
        }
      }
      return next;
    });
    try {
      await fetch(`/api/db/servers/${serverId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting server:', err);
    }
  };

  const handleAddServer = async (newServer: ServerInstance) => {
    setFleetServers((prev) => [...prev, newServer]);
    setSelectedServerId(newServer.id);
    if (newServer.databases.length > 0) {
      setSelectedDatabaseName(newServer.databases[0].datname);
    }
    try {
      await fetch('/api/db/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });
    } catch (err) {
      console.error('Error saving new server:', err);
    }
  };

  const handleSaveConnectionServer = async (serverData: {
    name: string;
    host: string;
    port: number;
    user: string;
    password?: string;
    database?: string;
    pgVersion?: string;
    uptimeFormatted?: string;
    uptimeSeconds?: number;
    sharedBuffers?: string;
    workMem?: string;
    maintenanceWorkMem?: string;
    effectiveCacheSize?: string;
    maxConnections?: number;
    ramTotalMb?: number;
    environment?: 'Produção' | 'Desenvolvimento' | 'Homologação';
    liveDatabases?: DatabaseInfo[];
    liveQueries?: any[];
    liveFileLocations?: any[];
  }) => {
    const newServerId = `srv-${Date.now().toString().slice(-4)}`;
    const serverPgVersion = serverData.pgVersion || 'PostgreSQL';

    const defaultDbName = serverData.database || 'postgres';
    const databasesList: DatabaseInfo[] = serverData.liveDatabases || [];

    // Primary database is strictly the first database returned or defaultDbName
    const primaryDb = databasesList[0]?.datname || defaultDbName;

    const totalBytesSum = databasesList.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
    const sizeFormatted = formatBytes(totalBytesSum);

    const newServer: ServerInstance = {
      id: newServerId,
      name: serverData.name || 'Servidor PostgreSQL',
      host: serverData.host || '127.0.0.1',
      port: serverData.port || 5432,
      dbUser: serverData.user || 'postgres',
      dbPassword: serverData.password || '',
      environment: serverData.environment || 'Produção',
      pgVersion: serverPgVersion,
      uptimeFormatted: serverData.uptimeFormatted || '0d 0h 0m',
      uptimeSeconds: serverData.uptimeSeconds || 86400,
      cpuUsagePercent: 12,
      avgLatencyMs: 1.8,
      ramTotalMb: serverData.ramTotalMb || 16384,
      sharedBuffers: serverData.sharedBuffers || '128MB',
      workMem: serverData.workMem || '4MB',
      maintenanceWorkMem: serverData.maintenanceWorkMem || '64MB',
      effectiveCacheSize: serverData.effectiveCacheSize || '4GB',
      maxConnections: serverData.maxConnections || 100,
      totalDatabasesCount: databasesList.length,
      totalActiveConnections: databasesList.reduce((acc, d) => acc + (d.activeConnections || 0), 0),
      totalSizeFormatted: sizeFormatted,
      status: 'healthy',
      databases: databasesList,
      fileLocations: serverData.liveFileLocations && serverData.liveFileLocations.length > 0 ? serverData.liveFileLocations : undefined,
      stuckQueries: serverData.liveQueries && serverData.liveQueries.length > 0 ? serverData.liveQueries : undefined
    };

    setFleetServers((prev) => [...prev, newServer]);
    setSelectedServerId(newServerId);
    setSelectedDatabaseName(primaryDb);
    setShowConnectionModal(false);

    try {
      await fetch('/api/db/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });
    } catch (err) {
      console.error('Error saving connection server:', err);
    }
  };

  const activeServerMetrics = activeServerObject && metrics
    ? {
        ...metrics,
        currentCpu: {
          ...metrics.currentCpu,
          usagePercent: Math.min(99, Math.max(2, Math.round(activeServerObject.cpuUsagePercent || 15))),
          userPercent: parseFloat(((activeServerObject.cpuUsagePercent || 15) * 0.75).toFixed(1)),
          systemPercent: parseFloat(((activeServerObject.cpuUsagePercent || 15) * 0.2).toFixed(1)),
          iowaitPercent: parseFloat(((activeServerObject.cpuUsagePercent || 15) * 0.05).toFixed(1))
        },
        currentLatency: {
          ...metrics.currentLatency,
          avgLatencyMs: parseFloat((activeServerObject.avgLatencyMs || 1.8).toFixed(2)),
          readLatencyMs: parseFloat(((activeServerObject.avgLatencyMs || 1.8) * 0.75).toFixed(2)),
          writeLatencyMs: parseFloat(((activeServerObject.avgLatencyMs || 1.8) * 1.35).toFixed(2)),
          p95LatencyMs: parseFloat(((activeServerObject.avgLatencyMs || 1.8) * 2.1).toFixed(2))
        },
        currentResources: {
          ...metrics.currentResources,
          activeConnections: activeDb ? activeDb.activeConnections : activeServerObject.totalActiveConnections,
          maxConnections: activeDb ? activeDb.maxConnections : (activeServerObject.maxConnections || 100),
          tps: activeDb ? activeDb.tps : 0,
          cacheHitRatio: activeDb ? activeDb.cacheHitRatio : 99.8,
          ramTotalMb: activeServerObject.ramTotalMb || 16384,
          ramUsagePercent: activeServerObject.ramUsagePercent || Math.min(95, Math.round((activeServerObject.cpuUsagePercent || 15) * 0.5 + 35)),
          ramUsedMb: activeServerObject.ramUsedMb || Math.round((activeServerObject.ramTotalMb || 16384) * ((activeServerObject.ramUsagePercent || Math.min(95, Math.round((activeServerObject.cpuUsagePercent || 15) * 0.5 + 35))) / 100))
        }
      }
    : null;

  const currentDbName = selectedDatabaseName || (activeDb ? activeDb.datname : 'postgres');

  const activeServerStuckQueries = useMemo(() => {
    if (!activeServerObject) return [];

    const hostIp = (activeServerObject.host && activeServerObject.host !== 'localhost' && activeServerObject.host !== '127.0.0.1')
      ? activeServerObject.host
      : '192.168.1.50';

    let matched: StuckQuery[] = [];
    if (activeServerObject.stuckQueries && activeServerObject.stuckQueries.length > 0) {
      matched = activeServerObject.stuckQueries.filter((q) => q.datname === currentDbName);
    } else if (stuckQueries.length > 0) {
      matched = stuckQueries.filter((q) => q.datname === currentDbName);
    }

    const activeMatched = matched.filter((q) => !killedPids.includes(q.pid));

    return activeMatched.map((q) => ({
      ...q,
      client_addr: q.client_addr && q.client_addr !== '127.0.0.1' ? q.client_addr : hostIp
    }));
  }, [activeServerObject, stuckQueries, currentDbName, killedPids]);

  const activeServerLocks = activeServerObject
    ? activeLocks
        .filter((l) => l.datname === currentDbName)
        .map((l) => {
          const ownerUser = activeServerObject.dbUser || 'postgres';
          return {
            ...l,
            usename: ownerUser,
            datname: currentDbName
          };
        })
    : [];

  const renderEmptyServerState = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto my-8 shadow-lg">
      <div className="p-3 bg-slate-800 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto text-slate-400">
        <Server className="w-6 h-6 text-cyan-400" />
      </div>
      <h3 className="text-base font-bold text-white">Nenhum Servidor Selecionado</h3>
      <p className="text-xs text-slate-400">
        Sua frota de servidores está vazia ou nenhum servidor foi selecionado. Adicione um novo servidor na aba Frota para monitorar métricas, queries e logs.
      </p>
      <button
        onClick={() => setShowConnectionModal(true)}
        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-xs rounded-xl shadow hover:from-blue-500 hover:to-cyan-500 transition-all inline-flex items-center space-x-2 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Adicionar Novo Servidor</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLive={isLive}
        setIsLive={setIsLive}
        refreshIntervalMs={refreshIntervalMs}
        setRefreshIntervalMs={setRefreshIntervalMs}
        onOpenExportModal={() => setShowExportModal(true)}
        onOpenAlertModal={() => setShowAlertModal(true)}
        onOpenConnectionModal={() => setShowConnectionModal(true)}
        activeAlertCount={activeAlerts.length}
        selectedServerHost={activeServerObject ? activeServerObject.host : 'Nenhum servidor'}
        selectedDatabaseName={activeDb ? activeDb.datname : 'Nenhum banco'}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Context Selector Bar for Detail Tabs */}
        {activeTab !== 'dashboard' && activeTab !== 'fleet' && activeServerObject && (
          <SelectedServerContextBar
            servers={fleetServers}
            selectedServerId={activeServerObject.id}
            selectedDatabaseName={activeDb?.datname || selectedDatabaseName}
            onSelectServer={(serverId) => handleSelectServer(serverId)}
            onSelectDatabase={(datname) => setSelectedDatabaseName(datname)}
          />
        )}

        {/* TAB 0: FROTA DE SERVIDORES & BANCOS (MENU LATERAL) */}
        {activeTab === 'fleet' && (
          <ServerSidebarDashboard
            servers={fleetServers}
            selectedServerId={selectedServerId}
            selectedDatabaseName={selectedDatabaseName}
            onSelectServer={(serverId) => handleSelectServer(serverId)}
            onSelectDatabase={(datname) => setSelectedDatabaseName(datname)}
            metrics={metrics}
            stuckQueries={stuckQueries}
            activeLocks={activeLocks}
            onKillPid={handleKillPid}
            onAnalyzeWithAi={handleAnalyzeWithAi}
            killingPid={killingPid}
            onUpdateServer={handleUpdateServer}
            onDeleteServer={handleDeleteServer}
            onAddServer={handleAddServer}
            onOpenConnectionsModal={() => setShowConnectionsModal(true)}
          />
        )}

        {/* TAB 0: GLOBAL DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <GlobalDashboardView
            servers={fleetServers}
            activeAlerts={activeAlerts}
            metrics={metrics}
            onSelectServer={(serverId) => handleSelectServer(serverId)}
            onSwitchTab={(tab) => setActiveTab(tab)}
            onOpenConnectionsModal={() => setShowConnectionsModal(true)}
          />
        )}

        {/* TAB 1: DATABASE SPECIFIC METRICS */}
        {activeTab === 'metrics' && (
          activeServerMetrics ? (
            <div className="space-y-6">
              {/* Top KPI Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Latência Média de Consultas"
                  value={formatMs(activeServerMetrics.currentLatency.avgLatencyMs)}
                  subtitle={`P95: ${formatMs(activeServerMetrics.currentLatency.p95LatencyMs)}`}
                  icon={Clock}
                  status={activeServerMetrics.currentLatency.avgLatencyMs > 10 ? 'warning' : 'normal'}
                  details={[
                    { label: 'Leitura', value: `${formatMs(activeServerMetrics.currentLatency.readLatencyMs)}` },
                    { label: 'Escrita', value: `${formatMs(activeServerMetrics.currentLatency.writeLatencyMs)}` }
                  ]}
                />

                <MetricCard
                  title="Uso de CPU do Servidor"
                  value={`${activeServerMetrics.currentCpu.usagePercent}%`}
                  subtitle={`Servidor: ${activeServerObject?.name || 'PostgreSQL'}`}
                  icon={Cpu}
                  status={activeServerMetrics.currentCpu.usagePercent > 80 ? 'critical' : 'normal'}
                  progressPercent={activeServerMetrics.currentCpu.usagePercent}
                  details={[
                    { label: 'Usuário', value: `${activeServerMetrics.currentCpu.userPercent}%` },
                    { label: 'Sistema', value: `${activeServerMetrics.currentCpu.systemPercent}%` }
                  ]}
                />

                <MetricCard
                  title="Conexões Ativas"
                  value={activeServerStuckQueries.length}
                  subtitle={`Banco: ${currentDbName}`}
                  icon={Users}
                  status={activeServerStuckQueries.length > 150 ? 'warning' : 'normal'}
                  details={[
                    { label: 'Sessões Ativas', value: `${activeServerStuckQueries.length}` },
                    { label: 'Transações/s', value: `${activeServerMetrics.currentResources.tps}` }
                  ]}
                  onClick={() => setShowConnectionsModal(true)}
                  clickableHint="Clique para ver conexões ativas"
                />

                <MetricCard
                  title="Hit Ratio do Cache Shared Buffers"
                  value={`${activeServerMetrics.currentResources.cacheHitRatio}%`}
                  subtitle="Eficiência de Memória RAM"
                  icon={Activity}
                  status={activeServerMetrics.currentResources.cacheHitRatio < 98 ? 'warning' : 'normal'}
                  progressPercent={activeServerMetrics.currentResources.cacheHitRatio}
                  details={[
                    { label: 'Uso de RAM', value: `${activeServerMetrics.currentResources.ramUsagePercent}%` },
                    { label: 'RAM Usada', value: `${(activeServerMetrics.currentResources.ramUsedMb / 1024).toFixed(1)} GB` }
                  ]}
                />
              </div>

              {/* Realtime Performance Charts */}
              <MetricsCharts
                latencyHistory={activeServerMetrics.latencyHistory}
                cpuHistory={activeServerMetrics.cpuHistory}
                currentCpu={activeServerMetrics.currentCpu}
                currentLatency={activeServerMetrics.currentLatency}
              />

              {/* Embedded Quick Stuck Queries Table */}
              <StuckQueriesTable
                stuckQueries={activeServerStuckQueries}
                onKillPid={handleKillPid}
                onAnalyzeWithAi={handleAnalyzeWithAi}
                killingPid={killingPid}
              />
            </div>
          ) : (
            renderEmptyServerState()
          )
        )}

        {/* TAB 2: STUCK QUERIES AND LOCKS */}
        {activeTab === 'stuck_locks' && (
          activeServerObject ? (
            <div className="space-y-6">
              <StuckQueriesTable
                stuckQueries={activeServerStuckQueries}
                onKillPid={handleKillPid}
                onAnalyzeWithAi={handleAnalyzeWithAi}
                killingPid={killingPid}
              />

              <ActiveLocksView activeLocks={activeServerLocks} />
            </div>
          ) : (
            renderEmptyServerState()
          )
        )}

        {/* TAB 3: FILE LOCATIONS & SYSTEM CONFIG */}
        {activeTab === 'config' && sysConfig && (
          activeServerObject ? (
            <ConfigViewer
              config={sysConfig}
              sqlQuery={sqlConfigQuery}
              server={activeServerObject}
              databaseName={activeDb?.datname || selectedDatabaseName}
            />
          ) : (
            renderEmptyServerState()
          )
        )}

        {/* TAB 4: SAÚDE E INTEGRIDADE */}
        {activeTab === 'integrity' && integrity && (
          activeServerObject ? (
            <IntegrityHealthCard
              health={integrity}
              onRunScan={handleRunScan}
              isScanning={isScanningIntegrity}
              server={activeServerObject}
              databaseName={activeDb?.datname || selectedDatabaseName}
            />
          ) : (
            renderEmptyServerState()
          )
        )}

        {/* TAB 5: BACKUPS */}
        {activeTab === 'backups' && backupOverview && (
          activeServerObject ? (
            <BackupTracker
              backupOverview={backupOverview}
              onTriggerBackup={handleTriggerBackup}
              onDeleteBackup={handleDeleteBackup}
              onClearAllBackups={handleClearAllBackups}
              isTriggering={isTriggeringBackup}
              server={activeServerObject}
              databaseName={activeDb?.datname || selectedDatabaseName}
              servers={fleetServers}
              onSelectServer={(srvId) => handleSelectServer(srvId)}
              onSelectDatabase={(dbName) => setSelectedDatabaseName(dbName)}
            />
          ) : (
            renderEmptyServerState()
          )
        )}
      </main>

      {/* MODALS */}
      {showExportModal && (
        <ExportReportModal
          servers={fleetServers}
          initialServerId={selectedServerId}
          initialDatabaseName={selectedDatabaseName}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showConnectionsModal && (
        <ActiveConnectionsModal
          isOpen={showConnectionsModal}
          onClose={() => setShowConnectionsModal(false)}
          serverName={activeServerObject?.name || 'PostgreSQL Server'}
          databaseName={activeDb?.datname || selectedDatabaseName || 'postgres'}
          activeConnectionsCount={activeServerMetrics?.currentResources.activeConnections || 0}
          maxConnectionsCount={activeServerMetrics?.currentResources.maxConnections || 100}
          tps={activeServerMetrics?.currentResources.tps || 0}
          connectionsList={activeServerStuckQueries}
          serverHost={activeServerObject?.host || 'localhost'}
          killedPids={killedPids}
          onRefresh={fetchLiveConnectionsForActiveDb}
          onKillPid={handleKillPid}
          onAnalyzeWithAi={handleAnalyzeWithAi}
          killingPid={killingPid}
        />
      )}

      {showAlertModal && (
        <AlertRulesManager
          rules={alertRules}
          activeAlerts={activeAlerts}
          onAddRule={handleAddRule}
          onToggleRule={handleToggleRule}
          onClose={() => setShowAlertModal(false)}
          onAcknowledgeAlert={(id) => {
            setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
          }}
        />
      )}

      {showConnectionModal && (
        <ConnectionSettingsModal
          onClose={() => setShowConnectionModal(false)}
          onSaveServer={handleSaveConnectionServer}
        />
      )}

      {selectedAiQuery && (
        <AiQueryModal
          query={selectedAiQuery}
          analysis={aiAnalysisResult}
          isLoading={isAnalyzingAi}
          onClose={() => setSelectedAiQuery(null)}
        />
      )}
    </div>
  );
}
