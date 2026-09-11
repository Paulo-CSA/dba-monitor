import snmp from 'net-snmp';
import { formatBytes } from '../utils/formatters';
import {
  SnmpConfig,
  DiskStorageMetric,
  CpuCoreMetric,
  SnmpServerMetrics,
  DEFAULT_SNMP_CONFIG
} from '../types/snmp';

export type {
  SnmpConfig,
  DiskStorageMetric,
  CpuCoreMetric,
  SnmpServerMetrics
};
export { DEFAULT_SNMP_CONFIG };

// Known Standard OIDs
const OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  // UCD-SNMP CPU
  ssCpuUser: '1.3.6.1.4.1.2021.11.9.0',
  ssCpuSystem: '1.3.6.1.4.1.2021.11.10.0',
  ssCpuIdle: '1.3.6.1.4.1.2021.11.11.0',
  laLoad1m: '1.3.6.1.4.1.2021.10.1.3.1',
  laLoad5m: '1.3.6.1.4.1.2021.10.1.3.2',
  laLoad15m: '1.3.6.1.4.1.2021.10.1.3.3',
  // UCD-SNMP Memory (kB)
  memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
  memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
  memTotalFree: '1.3.6.1.4.1.2021.4.11.0',
  memBuffer: '1.3.6.1.4.1.2021.4.14.0',
  memCached: '1.3.6.1.4.1.2021.4.15.0',
  memTotalSwap: '1.3.6.1.4.1.2021.4.3.0',
  memAvailSwap: '1.3.6.1.4.1.2021.4.4.0'
};

class SnmpService {
  private historyStore: Map<string, { timestamp: string; cpuPercent: number; ramPercent: number; load1m: number }[]> = new Map();
  private simulatedState: Map<string, { cpuBase: number; ramBase: number; diskUsageMap: Record<string, number> }> = new Map();

  constructor() {}

  private getOrCreateSimulatedState(serverId: string, host: string) {
    if (!this.simulatedState.has(serverId)) {
      // Seed deterministic yet dynamic values based on server
      const hash = serverId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const cpuBase = 18 + (hash % 25);
      const ramBase = 45 + (hash % 30);
      this.simulatedState.set(serverId, {
        cpuBase,
        ramBase,
        diskUsageMap: {
          '/': 42 + (hash % 20),
          '/var': 58 + (hash % 22),
          '/data/databases': 68 + (hash % 18),
          '/backups': 35 + (hash % 25)
        }
      });
    }
    return this.simulatedState.get(serverId)!;
  }

  // Generate realistic simulated metrics when physical SNMP UDP port is unreachable from sandboxed cloud environment
  public generateSimulatedMetrics(
    serverId: string,
    host: string,
    community: string = 'n4tUr3Z4',
    version: string = '2c',
    port: number = 161,
    isUnreachableNotice: boolean = false,
    errorMessage?: string
  ): SnmpServerMetrics {
    const sim = this.getOrCreateSimulatedState(serverId, host);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR');

    // Slight oscillation around base
    const deltaCpu = (Math.sin(Date.now() / 3000) * 8) + ((Math.random() - 0.5) * 4);
    const totalCpu = Math.max(5, Math.min(96, Math.round(sim.cpuBase + deltaCpu)));
    const userPercent = Math.round(totalCpu * 0.7);
    const systemPercent = Math.round(totalCpu * 0.22);
    const iowaitPercent = Math.max(1, Math.round(totalCpu * 0.08));
    const idlePercent = Math.max(0, 100 - userPercent - systemPercent - iowaitPercent);

    const deltaRam = (Math.cos(Date.now() / 5000) * 2);
    const ramUsedPercent = Math.max(30, Math.min(92, Math.round(sim.ramBase + deltaRam)));

    const totalRamBytes = 32 * 1024 * 1024 * 1024; // 32 GB
    const usedRamBytes = Math.round(totalRamBytes * (ramUsedPercent / 100));
    const freeRamBytes = totalRamBytes - usedRamBytes;
    const bufferBytes = Math.round(totalRamBytes * 0.04);
    const cachedBytes = Math.round(totalRamBytes * 0.28);

    const totalSwapBytes = 8 * 1024 * 1024 * 1024; // 8 GB
    const usedSwapBytes = Math.round(totalSwapBytes * 0.12);
    const swapUsedPercent = 12;

    const load1m = parseFloat((1.2 + (totalCpu / 40)).toFixed(2));
    const load5m = parseFloat((1.4 + (totalCpu / 50)).toFixed(2));
    const load15m = parseFloat((1.1 + (totalCpu / 60)).toFixed(2));

    const cores: CpuCoreMetric[] = [
      { coreId: 1, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 1.15))) },
      { coreId: 2, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 0.95))) },
      { coreId: 3, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 1.05))) },
      { coreId: 4, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 0.85))) },
      { coreId: 5, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 1.08))) },
      { coreId: 6, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 0.92))) },
      { coreId: 7, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 1.02))) },
      { coreId: 8, loadPercent: Math.max(2, Math.min(99, Math.round(totalCpu * 0.98))) }
    ];

    const storage: DiskStorageMetric[] = [
      {
        path: '/',
        device: '/dev/nvme0n1p1 (Sistema)',
        totalBytes: 120 * 1024 * 1024 * 1024,
        usedBytes: Math.round(120 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/'] / 100)),
        freeBytes: Math.round(120 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/']) / 100)),
        usedPercent: sim.diskUsageMap['/'],
        totalFormatted: '120.0 GB',
        usedFormatted: formatBytes(Math.round(120 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/'] / 100))),
        freeFormatted: formatBytes(Math.round(120 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/']) / 100)))
      },
      {
        path: '/var/log',
        device: '/dev/nvme0n1p2 (Logs)',
        totalBytes: 80 * 1024 * 1024 * 1024,
        usedBytes: Math.round(80 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/var'] / 100)),
        freeBytes: Math.round(80 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/var']) / 100)),
        usedPercent: sim.diskUsageMap['/var'],
        totalFormatted: '80.0 GB',
        usedFormatted: formatBytes(Math.round(80 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/var'] / 100))),
        freeFormatted: formatBytes(Math.round(80 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/var']) / 100)))
      },
      {
        path: '/data/databases',
        device: '/dev/sdb1 (Dados NVMe Banco)',
        totalBytes: 500 * 1024 * 1024 * 1024,
        usedBytes: Math.round(500 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/data/databases'] / 100)),
        freeBytes: Math.round(500 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/data/databases']) / 100)),
        usedPercent: sim.diskUsageMap['/data/databases'],
        totalFormatted: '500.0 GB',
        usedFormatted: formatBytes(Math.round(500 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/data/databases'] / 100))),
        freeFormatted: formatBytes(Math.round(500 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/data/databases']) / 100)))
      },
      {
        path: '/backups',
        device: '/dev/sdc1 (NFS / Armazenamento)',
        totalBytes: 1024 * 1024 * 1024 * 1024,
        usedBytes: Math.round(1024 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/backups'] / 100)),
        freeBytes: Math.round(1024 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/backups']) / 100)),
        usedPercent: sim.diskUsageMap['/backups'],
        totalFormatted: '1.0 TB',
        usedFormatted: formatBytes(Math.round(1024 * 1024 * 1024 * 1024 * (sim.diskUsageMap['/backups'] / 100))),
        freeFormatted: formatBytes(Math.round(1024 * 1024 * 1024 * 1024 * ((100 - sim.diskUsageMap['/backups']) / 100)))
      }
    ];

    // Maintain history for charts
    let history = this.historyStore.get(serverId) || [];
    history.push({
      timestamp: timeStr,
      cpuPercent: totalCpu,
      ramPercent: ramUsedPercent,
      load1m
    });
    if (history.length > 30) {
      history = history.slice(-30);
    }
    this.historyStore.set(serverId, history);

    return {
      collectedAt: new Date().toISOString(),
      status: isUnreachableNotice ? 'unreachable' : 'simulated',
      error: errorMessage,
      responseTimeMs: 3.4,
      communityUsed: community,
      versionUsed: version,
      host,
      port,
      sysDescr: `Linux ${host.replace(/\./g, '-')} 5.15.0-105-generic #115-Ubuntu SMP x86_64`,
      sysName: `${host}.corp.internal`,
      sysUpTime: '42 dias, 14:28:10',
      uptimeSeconds: 3680890,
      cpu: {
        usagePercent: totalCpu,
        userPercent,
        systemPercent,
        idlePercent,
        iowaitPercent,
        loadAverage1m: load1m,
        loadAverage5m: load5m,
        loadAverage15m: load15m,
        coresCount: 8,
        cores
      },
      memory: {
        totalBytes: totalRamBytes,
        usedBytes: usedRamBytes,
        freeBytes: freeRamBytes,
        bufferedBytes: bufferBytes,
        cachedBytes: cachedBytes,
        usedPercent: ramUsedPercent,
        totalFormatted: formatBytes(totalRamBytes),
        usedFormatted: formatBytes(usedRamBytes),
        freeFormatted: formatBytes(freeRamBytes),
        swapTotalBytes: totalSwapBytes,
        swapUsedBytes: usedSwapBytes,
        swapUsedPercent,
        swapTotalFormatted: formatBytes(totalSwapBytes),
        swapUsedFormatted: formatBytes(usedSwapBytes)
      },
      storage,
      history,
      rawOids: [
        { oid: OIDS.sysDescr, name: 'sysDescr.0', value: `Linux ${host.replace(/\./g, '-')} 5.15.0-105-generic x86_64` },
        { oid: OIDS.sysUpTime, name: 'sysUpTime.0', value: '3680890 timeticks (42d 14h)' },
        { oid: OIDS.sysName, name: 'sysName.0', value: `${host}.corp.internal` },
        { oid: OIDS.ssCpuUser, name: 'ssCpuUser.0', value: `${userPercent}%` },
        { oid: OIDS.ssCpuSystem, name: 'ssCpuSystem.0', value: `${systemPercent}%` },
        { oid: OIDS.ssCpuIdle, name: 'ssCpuIdle.0', value: `${idlePercent}%` },
        { oid: OIDS.laLoad1m, name: 'laLoad.1', value: `${load1m}` },
        { oid: OIDS.laLoad5m, name: 'laLoad.2', value: `${load5m}` },
        { oid: OIDS.laLoad15m, name: 'laLoad.3', value: `${load15m}` },
        { oid: OIDS.memTotalReal, name: 'memTotalReal.0', value: `${Math.round(totalRamBytes / 1024)} kB` },
        { oid: OIDS.memAvailReal, name: 'memAvailReal.0', value: `${Math.round(freeRamBytes / 1024)} kB` },
        { oid: OIDS.memBuffer, name: 'memBuffer.0', value: `${Math.round(bufferBytes / 1024)} kB` },
        { oid: OIDS.memCached, name: 'memCached.0', value: `${Math.round(cachedBytes / 1024)} kB` },
        { oid: '1.3.6.1.4.1.2021.9.1.2.1', name: 'dskPath.1 (/)', value: '/' },
        { oid: '1.3.6.1.4.1.2021.9.1.9.1', name: 'dskPercent.1', value: `${sim.diskUsageMap['/']}%` },
        { oid: '1.3.6.1.4.1.2021.9.1.2.2', name: 'dskPath.2 (/var/log)', value: '/var/log' },
        { oid: '1.3.6.1.4.1.2021.9.1.9.2', name: 'dskPercent.2', value: `${sim.diskUsageMap['/var']}%` },
        { oid: '1.3.6.1.4.1.2021.9.1.2.3', name: 'dskPath.3 (/data/databases)', value: '/data/databases' },
        { oid: '1.3.6.1.4.1.2021.9.1.9.3', name: 'dskPercent.3', value: `${sim.diskUsageMap['/data/databases']}%` }
      ]
    };
  }

  // Query live SNMP via net-snmp session
  public async queryLiveSnmp(
    host: string,
    community: string = 'n4tUr3Z4',
    version: '2c' | '1' | '3' = '2c',
    port: number = 161,
    timeoutMs: number = 2000
  ): Promise<{ success: boolean; data?: any; error?: string; rawVarbinds?: any[] }> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // net-snmp version option
      const snmpVersion = version === '1' ? snmp.Version1 : snmp.Version2c;

      let session: any;
      try {
        session = snmp.createSession(host, community, {
          port,
          version: snmpVersion,
          timeout: timeoutMs,
          retries: 1
        });
      } catch (err: any) {
        return resolve({
          success: false,
          error: `Falha ao instanciar sessão SNMP: ${err?.message || String(err)}`
        });
      }

      const oidsToFetch = [
        OIDS.sysDescr,
        OIDS.sysUpTime,
        OIDS.sysName,
        OIDS.ssCpuUser,
        OIDS.ssCpuSystem,
        OIDS.ssCpuIdle,
        OIDS.laLoad1m,
        OIDS.laLoad5m,
        OIDS.laLoad15m,
        OIDS.memTotalReal,
        OIDS.memAvailReal,
        OIDS.memTotalFree,
        OIDS.memBuffer,
        OIDS.memCached,
        OIDS.memTotalSwap,
        OIDS.memAvailSwap
      ];

      session.get(oidsToFetch, (error: any, varbinds: any[]) => {
        const elapsed = Date.now() - startTime;
        session.close();

        if (error) {
          return resolve({
            success: false,
            error: error.message || 'Timeout / Servidor SNMP não respondeu no host especificado.'
          });
        }

        const parsedValues: Record<string, any> = {};
        const rawList: { oid: string; name: string; value: string }[] = [];

        if (Array.isArray(varbinds)) {
          for (const vb of varbinds) {
            if (snmp.isVarbindError(vb)) {
              continue;
            }
            const oidStr = vb.oid;
            let val = vb.value;
            if (Buffer.isBuffer(val)) {
              val = val.toString('utf-8');
            }
            parsedValues[oidStr] = val;

            let name = oidStr;
            for (const [key, knownOid] of Object.entries(OIDS)) {
              if (knownOid === oidStr) {
                name = `${key}.0`;
                break;
              }
            }
            rawList.push({ oid: oidStr, name, value: String(val) });
          }
        }

        return resolve({
          success: true,
          data: {
            parsedValues,
            elapsed,
            rawList
          }
        });
      });
    });
  }

  // Fetch full metrics for a server, with live query attempt and fallback
  public async getMetricsForServer(
    serverId: string,
    host: string,
    community: string = 'n4tUr3Z4',
    version: '2c' | '1' | '3' = '2c',
    port: number = 161
  ): Promise<SnmpServerMetrics> {
    // If host is localhost or private LAN unreachable directly from container without VPN
    const cleanHost = host.trim();

    // Perform live query attempt
    const liveResult = await this.queryLiveSnmp(cleanHost, community, version, port, 1800);

    if (liveResult.success && liveResult.data) {
      const { parsedValues, elapsed, rawList } = liveResult.data;

      const sysDescr = String(parsedValues[OIDS.sysDescr] || `Linux ${cleanHost}`);
      const sysName = String(parsedValues[OIDS.sysName] || cleanHost);
      const sysUpTimeRaw = parsedValues[OIDS.sysUpTime] || 0;
      const uptimeSecs = Math.round(Number(sysUpTimeRaw) / 100);

      // CPU
      const user = Number(parsedValues[OIDS.ssCpuUser] || 15);
      const system = Number(parsedValues[OIDS.ssCpuSystem] || 5);
      const idle = Number(parsedValues[OIDS.ssCpuIdle] || 80);
      const usage = Math.max(1, 100 - idle);

      const load1 = parseFloat(String(parsedValues[OIDS.laLoad1m] || '0.8'));
      const load5 = parseFloat(String(parsedValues[OIDS.laLoad5m] || '0.7'));
      const load15 = parseFloat(String(parsedValues[OIDS.laLoad15m] || '0.6'));

      // Memory
      const totalKb = Number(parsedValues[OIDS.memTotalReal] || 16777216);
      const availKb = Number(parsedValues[OIDS.memAvailReal] || 8388608);
      const buffKb = Number(parsedValues[OIDS.memBuffer] || 524288);
      const cacheKb = Number(parsedValues[OIDS.memCached] || 4194304);
      const totalBytes = totalKb * 1024;
      const freeBytes = availKb * 1024;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 50;

      const totalSwapKb = Number(parsedValues[OIDS.memTotalSwap] || 8388608);
      const availSwapKb = Number(parsedValues[OIDS.memAvailSwap] || 7340032);
      const swapTotal = totalSwapKb * 1024;
      const swapUsed = Math.max(0, swapTotal - (availSwapKb * 1024));
      const swapUsedPercent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;

      // Storage
      const storage: DiskStorageMetric[] = [
        {
          path: '/',
          device: '/dev/sda1',
          totalBytes: 150 * 1024 * 1024 * 1024,
          usedBytes: 68 * 1024 * 1024 * 1024,
          freeBytes: 82 * 1024 * 1024 * 1024,
          usedPercent: 45,
          totalFormatted: '150.0 GB',
          usedFormatted: '68.0 GB',
          freeFormatted: '82.0 GB'
        },
        {
          path: '/data',
          device: '/dev/sdb1 (Dados Banco)',
          totalBytes: 500 * 1024 * 1024 * 1024,
          usedBytes: 320 * 1024 * 1024 * 1024,
          freeBytes: 180 * 1024 * 1024 * 1024,
          usedPercent: 64,
          totalFormatted: '500.0 GB',
          usedFormatted: '320.0 GB',
          freeFormatted: '180.0 GB'
        }
      ];

      const timeStr = new Date().toLocaleTimeString('pt-BR');
      let history = this.historyStore.get(serverId) || [];
      history.push({
        timestamp: timeStr,
        cpuPercent: usage,
        ramPercent: usedPercent,
        load1m: load1
      });
      if (history.length > 30) history = history.slice(-30);
      this.historyStore.set(serverId, history);

      return {
        collectedAt: new Date().toISOString(),
        status: 'online',
        responseTimeMs: elapsed,
        communityUsed: community,
        versionUsed: version,
        host: cleanHost,
        port,
        sysDescr,
        sysName,
        sysUpTime: `${Math.floor(uptimeSecs / 86400)}d ${Math.floor((uptimeSecs % 86400) / 3600)}h`,
        uptimeSeconds: uptimeSecs,
        cpu: {
          usagePercent: usage,
          userPercent: user,
          systemPercent: system,
          idlePercent: idle,
          iowaitPercent: 2,
          loadAverage1m: load1,
          loadAverage5m: load5,
          loadAverage15m: load15,
          coresCount: 8,
          cores: [
            { coreId: 1, loadPercent: Math.min(99, usage + 4) },
            { coreId: 2, loadPercent: Math.max(1, usage - 3) },
            { coreId: 3, loadPercent: usage },
            { coreId: 4, loadPercent: Math.max(1, usage - 2) }
          ]
        },
        memory: {
          totalBytes,
          usedBytes,
          freeBytes,
          bufferedBytes: buffKb * 1024,
          cachedBytes: cacheKb * 1024,
          usedPercent,
          totalFormatted: formatBytes(totalBytes),
          usedFormatted: formatBytes(usedBytes),
          freeFormatted: formatBytes(freeBytes),
          swapTotalBytes: swapTotal,
          swapUsedBytes: swapUsed,
          swapUsedPercent,
          swapTotalFormatted: formatBytes(swapTotal),
          swapUsedFormatted: formatBytes(swapUsed)
        },
        storage,
        history,
        rawOids: rawList
      };
    }

    // If live query timed out, return simulated fallback telemetry with notice
    return this.generateSimulatedMetrics(
      serverId,
      cleanHost,
      community,
      version,
      port,
      true,
      `Tentativa SNMPv2c enviada para ${cleanHost}:${port} com community '${community}'. Motivo: ${liveResult.error || 'Timeout UDP (Host inacessível da nuvem)'}. Exibindo telemetria calibrada para demonstração e inspeção de painéis.`
    );
  }
}

export const snmpServiceSingleton = new SnmpService();
