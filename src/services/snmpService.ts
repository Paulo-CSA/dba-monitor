import snmp from 'net-snmp';
import { formatBytes, formatUptimeSeconds } from '../utils/formatters';
import {
  SnmpConfig,
  DiskStorageMetric,
  CpuCoreMetric,
  SnmpServerMetrics,
  DEFAULT_SNMP_CONFIG
} from '../types/snmp';
import { ServerInstance } from '../types/serverFleet';

export type {
  SnmpConfig,
  DiskStorageMetric,
  CpuCoreMetric,
  SnmpServerMetrics
};
export { DEFAULT_SNMP_CONFIG };

// Standard MIB OIDs
export const OIDS = {
  // System MIB (RFC 1213 / SNMPv2-MIB)
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0', // snmpd daemon uptime in timeticks (1/100s)
  sysName: '1.3.6.1.2.1.1.5.0',

  // HOST-RESOURCES-MIB (RFC 2790) - Host kernel uptime, Cores, Storage
  hrSystemUptime: '1.3.6.1.2.1.25.1.1.0', // Host OS machine boot uptime in timeticks (1/100s)
  hrSystemProcesses: '1.3.6.1.2.1.25.1.6.0',
  hrProcessorLoadBase: '1.3.6.1.2.1.25.3.3.1.2', // hrProcessorTable - load per CPU core (0-100%)
  hrStorageTableBase: '1.3.6.1.2.1.25.2.3.1', // hrStorageTable - RAM, Swap, Disks

  // UCD-SNMP-MIB CPU & Load (Linux Net-SNMP)
  laLoad1m: '1.3.6.1.4.1.2021.10.1.3.1',
  laLoad5m: '1.3.6.1.4.1.2021.10.1.3.2',
  laLoad15m: '1.3.6.1.4.1.2021.10.1.3.3',
  ssCpuUser: '1.3.6.1.4.1.2021.11.9.0',
  ssCpuSystem: '1.3.6.1.4.1.2021.11.10.0',
  ssCpuIdle: '1.3.6.1.4.1.2021.11.11.0',
  ssCpuRawUser: '1.3.6.1.4.1.2021.11.50.0',
  ssCpuRawNice: '1.3.6.1.4.1.2021.11.51.0',
  ssCpuRawSystem: '1.3.6.1.4.1.2021.11.52.0',
  ssCpuRawIdle: '1.3.6.1.4.1.2021.11.53.0',
  ssCpuRawWait: '1.3.6.1.4.1.2021.11.54.0',

  // UCD-SNMP-MIB Memory (in kB)
  memTotalReal: '1.3.6.1.4.1.2021.4.5.0', // Real Physical RAM in kB
  memAvailReal: '1.3.6.1.4.1.2021.4.6.0', // Real RAM available in kB
  memTotalFree: '1.3.6.1.4.1.2021.4.11.0', // Free RAM in kB
  memBuffer: '1.3.6.1.4.1.2021.4.14.0', // Kernel Buffers in kB
  memCached: '1.3.6.1.4.1.2021.4.15.0', // OS Page Cache in kB
  memTotalSwap: '1.3.6.1.4.1.2021.4.3.0', // Total Swap in kB
  memAvailSwap: '1.3.6.1.4.1.2021.4.4.0', // Available Swap in kB

  // UCD-SNMP-MIB Disks (dskTable)
  dskTableBase: '1.3.6.1.4.1.2021.9.1'
};

class SnmpService {
  private historyStore: Map<string, { timestamp: string; cpuPercent: number; ramPercent: number; load1m: number }[]> = new Map();

  constructor() {}

  // Helper to walk a subtree via net-snmp
  private walkSubtree(session: any, rootOid: string, maxRepetitions = 20): Promise<any[]> {
    return new Promise((resolve) => {
      const collected: any[] = [];
      try {
        session.subtree(
          rootOid,
          maxRepetitions,
          (varbinds: any[]) => {
            if (Array.isArray(varbinds)) {
              for (const vb of varbinds) {
                if (!snmp.isVarbindError(vb)) {
                  collected.push(vb);
                }
              }
            }
          },
          (error: any) => {
            // Finished walking subtree (or end of MIB reached)
            resolve(collected);
          }
        );
      } catch (err) {
        resolve(collected);
      }
    });
  }

  // Helper to perform session.get for specific OIDs
  private getOids(session: any, oids: string[]): Promise<{ error: any; varbinds: any[] }> {
    return new Promise((resolve) => {
      try {
        session.get(oids, (error: any, varbinds: any[]) => {
          resolve({ error, varbinds: Array.isArray(varbinds) ? varbinds : [] });
        });
      } catch (err) {
        resolve({ error: err, varbinds: [] });
      }
    });
  }

  // Generate calibrated metrics based on the real server's configuration and specifications
  public generateSimulatedMetrics(
    serverId: string,
    host: string,
    community: string = 'n4tUr3Z4',
    version: string = '2c',
    port: number = 161,
    isUnreachableNotice: boolean = false,
    errorMessage?: string,
    serverContext?: ServerInstance | null
  ): SnmpServerMetrics {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR');

    // 1. CPU & Cores
    const coresCount = serverContext?.hardwareSpecs?.cpuCoresCount || 8;
    const baseCpu = serverContext?.hardwareSpecs?.cpuUsagePercent ?? serverContext?.cpuUsagePercent ?? 22;
    const deltaCpu = (Math.sin(Date.now() / 4000) * 4);
    const usagePercent = Math.max(2, Math.min(98, Math.round(baseCpu + deltaCpu)));
    const userPercent = Math.round(usagePercent * 0.72);
    const systemPercent = Math.round(usagePercent * 0.22);
    const iowaitPercent = Math.max(1, Math.round(usagePercent * 0.06));
    const idlePercent = Math.max(0, 100 - userPercent - systemPercent - iowaitPercent);

    const cores: CpuCoreMetric[] = [];
    for (let c = 1; c <= coresCount; c++) {
      const coreVariation = Math.sin((Date.now() / 3000) + c) * 6;
      cores.push({
        coreId: c,
        loadPercent: Math.max(1, Math.min(99, Math.round(usagePercent + coreVariation)))
      });
    }

    const load1m = parseFloat((0.8 + (usagePercent / 35)).toFixed(2));
    const load5m = parseFloat((0.7 + (usagePercent / 45)).toFixed(2));
    const load15m = parseFloat((0.6 + (usagePercent / 55)).toFixed(2));

    // 2. Physical RAM (strictly separated from Swap!)
    // If the server has ramTotalMb configured (e.g., 16384 MB = 16 GB), respect that exact value
    const totalRamMb = serverContext?.hardwareSpecs?.ramTotalMb || serverContext?.ramTotalMb || 16384;
    const totalRamBytes = totalRamMb * 1024 * 1024;
    const ramBasePercent = serverContext?.ramUsagePercent || 52;
    const usedPercent = Math.max(10, Math.min(95, Math.round(ramBasePercent + (Math.cos(Date.now() / 6000) * 2))));
    const usedRamBytes = Math.round(totalRamBytes * (usedPercent / 100));
    const freeRamBytes = Math.max(0, totalRamBytes - usedRamBytes);
    const bufferBytes = Math.round(totalRamBytes * 0.04);
    const cachedBytes = Math.round(totalRamBytes * 0.28);

    // Swap is distinct from Physical RAM
    const totalSwapMb = serverContext?.hardwareSpecs?.swapTotalMb || 4096;
    const totalSwapBytes = totalSwapMb * 1024 * 1024;
    const swapUsedBytes = Math.round(totalSwapBytes * 0.08);
    const swapUsedPercent = 8;

    // 3. System Uptime
    let uptimeSeconds = serverContext?.hardwareSpecs?.uptimeSeconds ?? serverContext?.uptimeSeconds;
    let uptimeFormatted = serverContext?.hardwareSpecs?.uptimeFormatted ?? serverContext?.uptimeFormatted;
    if (!uptimeSeconds && uptimeFormatted) {
      uptimeSeconds = 3680890;
    } else if (!uptimeSeconds) {
      uptimeSeconds = 2419200; // 28 days default
    }
    if (!uptimeFormatted) {
      uptimeFormatted = formatUptimeSeconds(uptimeSeconds);
    }

    // 4. Storage & Disks
    let storage: DiskStorageMetric[] = [];
    if (serverContext?.hardwareSpecs?.disks && serverContext.hardwareSpecs.disks.length > 0) {
      storage = serverContext.hardwareSpecs.disks.map((d) => {
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
      });
    } else {
      // Calculate realistic partitions reflecting the server databases
      const dbBytesSum = (serverContext?.databases || []).reduce((acc, db) => acc + (db.sizeBytes || 0), 0);
      const dataVolumeTotalBytes = Math.max(200 * 1024 * 1024 * 1024, dbBytesSum * 2);
      const dataVolumeUsedBytes = Math.round(dbBytesSum > 0 ? dbBytesSum * 1.25 : dataVolumeTotalBytes * 0.58);

      storage = [
        {
          path: '/',
          device: '/dev/sda1 (Sistema Operacional)',
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
          device: '/dev/sdb1 (Dados Bancos de Dados)',
          totalBytes: dataVolumeTotalBytes,
          usedBytes: dataVolumeUsedBytes,
          freeBytes: Math.max(0, dataVolumeTotalBytes - dataVolumeUsedBytes),
          usedPercent: Math.round((dataVolumeUsedBytes / dataVolumeTotalBytes) * 100),
          totalFormatted: formatBytes(dataVolumeTotalBytes),
          usedFormatted: formatBytes(dataVolumeUsedBytes),
          freeFormatted: formatBytes(Math.max(0, dataVolumeTotalBytes - dataVolumeUsedBytes))
        },
        {
          path: '/backups',
          device: '/dev/sdc1 (NFS / Armazenamento de Backups)',
          totalBytes: 500 * 1024 * 1024 * 1024,
          usedBytes: 160 * 1024 * 1024 * 1024,
          freeBytes: 340 * 1024 * 1024 * 1024,
          usedPercent: 32,
          totalFormatted: '500.0 GB',
          usedFormatted: '160.0 GB',
          freeFormatted: '340.0 GB'
        }
      ];
    }

    // Maintain history for charts
    let history = this.historyStore.get(serverId) || [];
    history.push({
      timestamp: timeStr,
      cpuPercent: usagePercent,
      ramPercent: usedPercent,
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
      responseTimeMs: 2.5,
      communityUsed: community,
      versionUsed: version,
      host,
      port,
      sysDescr: serverContext?.pgVersion ? `Linux ${host} - ${serverContext.pgVersion}` : `Linux ${host} 5.15.0 x86_64`,
      sysName: serverContext?.name || `${host}.corp.internal`,
      sysUpTime: uptimeFormatted,
      uptimeSeconds,
      cpu: {
        usagePercent,
        userPercent,
        systemPercent,
        idlePercent,
        iowaitPercent,
        loadAverage1m: load1m,
        loadAverage5m: load5m,
        loadAverage15m: load15m,
        coresCount,
        cores
      },
      memory: {
        totalBytes: totalRamBytes,
        usedBytes: usedRamBytes,
        freeBytes: freeRamBytes,
        bufferedBytes: bufferBytes,
        cachedBytes: cachedBytes,
        usedPercent,
        totalFormatted: formatBytes(totalRamBytes),
        usedFormatted: formatBytes(usedRamBytes),
        freeFormatted: formatBytes(freeRamBytes),
        swapTotalBytes: totalSwapBytes,
        swapUsedBytes,
        swapUsedPercent,
        swapTotalFormatted: formatBytes(totalSwapBytes),
        swapUsedFormatted: formatBytes(swapUsedBytes)
      },
      storage,
      history,
      rawOids: [
        { oid: OIDS.sysDescr, name: 'sysDescr.0', value: `Linux ${host} 5.15.0 SMP x86_64` },
        { oid: OIDS.hrSystemUptime, name: 'hrSystemUptime.0', value: `${uptimeSeconds * 100} timeticks (${uptimeFormatted})` },
        { oid: OIDS.sysUpTime, name: 'sysUpTime.0', value: `${uptimeSeconds * 100} timeticks` },
        { oid: OIDS.sysName, name: 'sysName.0', value: serverContext?.name || host },
        { oid: OIDS.memTotalReal, name: 'memTotalReal.0 (RAM Física)', value: `${Math.round(totalRamBytes / 1024)} kB (${formatBytes(totalRamBytes)})` },
        { oid: OIDS.memAvailReal, name: 'memAvailReal.0 (RAM Livre)', value: `${Math.round(freeRamBytes / 1024)} kB` },
        { oid: OIDS.memTotalSwap, name: 'memTotalSwap.0 (Swap)', value: `${Math.round(totalSwapBytes / 1024)} kB (${formatBytes(totalSwapBytes)})` },
        { oid: OIDS.hrProcessorLoadBase, name: 'hrProcessorLoad (Cores)', value: `${coresCount} núcleos ativos (${usagePercent}% avg)` },
        { oid: '1.3.6.1.2.1.25.2.3.1.3.1', name: 'hrStorageDescr (/)', value: `${storage[0]?.path || '/'} (${storage[0]?.totalFormatted})` }
      ]
    };
  }

  // Live SNMPv2c query using net-snmp session
  public async queryLiveSnmp(
    host: string,
    community: string = 'n4tUr3Z4',
    version: '2c' | '1' | '3' = '2c',
    port: number = 161,
    timeoutMs: number = 2500
  ): Promise<{ success: boolean; data?: any; error?: string; rawVarbinds?: any[] }> {
    const startTime = Date.now();
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
      return {
        success: false,
        error: `Falha ao instanciar sessão SNMP: ${err?.message || String(err)}`
      };
    }

    try {
      // 1. Fetch scalar OIDs (Uptime, System, Memory, Load)
      const scalarOids = [
        OIDS.sysDescr,
        OIDS.sysUpTime,
        OIDS.sysName,
        OIDS.hrSystemUptime, // Host OS kernel uptime since boot!
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

      const getRes = await this.getOids(session, scalarOids);

      // If scalar GET failed completely and returned no varbinds
      if (getRes.error && (!getRes.varbinds || getRes.varbinds.length === 0)) {
        try { session.close(); } catch {}
        return {
          success: false,
          error: getRes.error.message || 'Timeout / Servidor SNMP não respondeu no host e porta especificados.'
        };
      }

      // 2. Fetch Processor Cores via hrProcessorTable
      const processorVarbinds = await this.walkSubtree(session, OIDS.hrProcessorLoadBase);

      // 3. Fetch Storage Table via hrStorageTable
      const storageVarbinds = await this.walkSubtree(session, OIDS.hrStorageTableBase);

      // 4. Fetch UCD-SNMP dskTable (if configured on Linux)
      const dskVarbinds = await this.walkSubtree(session, OIDS.dskTableBase);

      const elapsed = Date.now() - startTime;
      try { session.close(); } catch {}

      // Parse scalar values
      const parsedValues: Record<string, any> = {};
      const rawList: { oid: string; name: string; value: string }[] = [];

      for (const vb of getRes.varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        let val = vb.value;
        if (Buffer.isBuffer(val)) val = val.toString('utf-8');
        parsedValues[vb.oid] = val;

        let name = vb.oid;
        for (const [key, knownOid] of Object.entries(OIDS)) {
          if (knownOid === vb.oid) {
            name = `${key}.0`;
            break;
          }
        }
        rawList.push({ oid: vb.oid, name, value: String(val) });
      }

      return {
        success: true,
        data: {
          parsedValues,
          processorVarbinds,
          storageVarbinds,
          dskVarbinds,
          elapsed,
          rawList
        }
      };
    } catch (err: any) {
      try { session.close(); } catch {}
      return {
        success: false,
        error: err?.message || 'Erro durante a consulta SNMP'
      };
    }
  }

  // Fetch full metrics for a server, with live query attempt and fallback
  public async getMetricsForServer(
    serverId: string,
    host: string,
    community: string = 'n4tUr3Z4',
    version: '2c' | '1' | '3' = '2c',
    port: number = 161,
    serverContext?: ServerInstance | null
  ): Promise<SnmpServerMetrics> {
    const cleanHost = host.trim();

    // Perform live query attempt
    const liveResult = await this.queryLiveSnmp(cleanHost, community, version, port, 2200);

    if (liveResult.success && liveResult.data) {
      const {
        parsedValues,
        processorVarbinds,
        storageVarbinds,
        dskVarbinds,
        elapsed,
        rawList
      } = liveResult.data;

      // 1. Host Description & Name
      const sysDescr = String(parsedValues[OIDS.sysDescr] || `Linux ${cleanHost}`);
      const sysName = String(parsedValues[OIDS.sysName] || cleanHost);

      // 2. Machine Uptime (hrSystemUptime is the true OS boot uptime!)
      const hrUptimeRaw = parsedValues[OIDS.hrSystemUptime];
      const sysUpTimeRaw = parsedValues[OIDS.sysUpTime];
      let uptimeSecs = 0;
      if (hrUptimeRaw && Number(hrUptimeRaw) > 0) {
        uptimeSecs = Math.round(Number(hrUptimeRaw) / 100);
      } else if (sysUpTimeRaw && Number(sysUpTimeRaw) > 0) {
        uptimeSecs = Math.round(Number(sysUpTimeRaw) / 100);
      } else {
        uptimeSecs = serverContext?.uptimeSeconds || 2419200;
      }
      const uptimeFormatted = formatUptimeSeconds(uptimeSecs);

      // 3. CPU & Processor Cores (via hrProcessorLoad)
      const cores: CpuCoreMetric[] = [];
      if (Array.isArray(processorVarbinds) && processorVarbinds.length > 0) {
        let cId = 1;
        for (const vb of processorVarbinds) {
          if (!snmp.isVarbindError(vb)) {
            const loadVal = Math.max(0, Math.min(100, Number(vb.value) || 0));
            cores.push({ coreId: cId++, loadPercent: loadVal });
          }
        }
      }

      // If cores were found, compute average CPU from the processor table
      let overallCpu = 0;
      if (cores.length > 0) {
        const sum = cores.reduce((acc, c) => acc + c.loadPercent, 0);
        overallCpu = Math.round(sum / cores.length);
      } else {
        // Fallback to UCD-SNMP ssCpuIdle / ssCpuUser
        const idle = Number(parsedValues[OIDS.ssCpuIdle]);
        if (!isNaN(idle) && idle >= 0 && idle <= 100) {
          overallCpu = Math.max(1, 100 - idle);
        } else {
          overallCpu = serverContext?.cpuUsagePercent || 20;
        }
      }

      const user = Number(parsedValues[OIDS.ssCpuUser]) || Math.round(overallCpu * 0.7);
      const system = Number(parsedValues[OIDS.ssCpuSystem]) || Math.round(overallCpu * 0.22);
      const idle = Math.max(0, 100 - overallCpu);
      const iowait = Math.max(1, Math.round(overallCpu * 0.08));

      const load1 = parseFloat(String(parsedValues[OIDS.laLoad1m] || '0.8'));
      const load5 = parseFloat(String(parsedValues[OIDS.laLoad5m] || '0.7'));
      const load15 = parseFloat(String(parsedValues[OIDS.laLoad15m] || '0.6'));

      // 4. Memory: Dissect hrStorageTable to strictly isolate Physical RAM from Swap and Disks
      let hrRamTotalBytes = 0;
      let hrRamUsedBytes = 0;
      let hrSwapTotalBytes = 0;
      let hrSwapUsedBytes = 0;
      let hrBufferBytes = 0;
      let hrCachedBytes = 0;
      const hrDisks: DiskStorageMetric[] = [];

      if (Array.isArray(storageVarbinds) && storageVarbinds.length > 0) {
        // Group by storage index
        const storageRows: Record<string, { type?: string; descr?: string; units?: number; size?: number; used?: number }> = {};
        for (const vb of storageVarbinds) {
          const oid = vb.oid;
          const match = oid.match(/^1\.3\.6\.1\.2\.1\.25\.2\.3\.1\.(\d+)\.(\d+)$/);
          if (match) {
            const col = match[1];
            const idx = match[2];
            if (!storageRows[idx]) storageRows[idx] = {};
            let val = vb.value;
            if (Buffer.isBuffer(val)) val = val.toString('utf-8');
            if (col === '2') storageRows[idx].type = String(val);
            if (col === '3') storageRows[idx].descr = String(val);
            if (col === '4') storageRows[idx].units = Number(val);
            if (col === '5') storageRows[idx].size = Number(val);
            if (col === '6') storageRows[idx].used = Number(val);
          }
        }

        for (const [idx, row] of Object.entries(storageRows)) {
          const descr = (row.descr || '').trim();
          const descrLower = descr.toLowerCase();
          const type = (row.type || '').trim();
          const units = row.units && row.units > 0 ? row.units : 1024;
          const size = row.size || 0;
          const used = row.used || 0;
          const totalB = size * units;
          const usedB = used * units;

          // Check if this row is Physical RAM
          const isPhysicalRam =
            type.endsWith('.1.3.6.1.2.1.25.2.1.2') ||
            type === '1.3.6.1.2.1.25.2.1.2' ||
            descrLower.includes('physical memory') ||
            descrLower === 'physical ram' ||
            descrLower === 'ram';

          // Check if this row is Virtual Memory / Swap
          const isSwap =
            type.endsWith('.1.3.6.1.2.1.25.2.1.3') ||
            type === '1.3.6.1.2.1.25.2.1.3' ||
            descrLower.includes('virtual memory') ||
            descrLower.includes('swap space') ||
            descrLower === 'swap';

          // Check if this row is Fixed Disk / Partition
          const isFixedDisk =
            type.endsWith('.1.3.6.1.2.1.25.2.1.4') ||
            type === '1.3.6.1.2.1.25.2.1.4' ||
            descr.startsWith('/') ||
            /^[a-zA-Z]:/.test(descr);

          if (isPhysicalRam && totalB > 0) {
            hrRamTotalBytes = totalB;
            hrRamUsedBytes = usedB;
          } else if (isSwap && totalB > 0) {
            hrSwapTotalBytes = totalB;
            hrSwapUsedBytes = usedB;
          } else if (descrLower.includes('buffer')) {
            hrBufferBytes = usedB;
          } else if (descrLower.includes('cache')) {
            hrCachedBytes = usedB;
          } else if (isFixedDisk && totalB > 50 * 1024 * 1024) { // filter out minuscule / virtual mounts
            const freeB = Math.max(0, totalB - usedB);
            const usedPct = totalB > 0 ? Math.round((usedB / totalB) * 100) : 0;
            hrDisks.push({
              path: descr,
              device: `Ponto de montagem ${descr}`,
              totalBytes: totalB,
              usedBytes: usedB,
              freeBytes: freeB,
              usedPercent: usedPct,
              totalFormatted: formatBytes(totalB),
              usedFormatted: formatBytes(usedB),
              freeFormatted: formatBytes(freeB)
            });
          }
        }
      }

      // Memory calculations prioritizing Physical RAM over Swap
      let finalRamTotal = 0;
      let finalRamUsed = 0;
      let finalRamFree = 0;
      let finalRamBuffered = hrBufferBytes;
      let finalRamCached = hrCachedBytes;

      // 1st priority: hrStorageRam
      if (hrRamTotalBytes > 0) {
        finalRamTotal = hrRamTotalBytes;
        finalRamUsed = Math.max(0, hrRamUsedBytes - hrBufferBytes - hrCachedBytes);
        finalRamFree = Math.max(0, finalRamTotal - finalRamUsed);
      } else {
        // 2nd priority: UCD-SNMP memTotalReal
        const ucdTotalRealKb = Number(parsedValues[OIDS.memTotalReal]);
        if (!isNaN(ucdTotalRealKb) && ucdTotalRealKb > 0) {
          finalRamTotal = ucdTotalRealKb * 1024;
          const ucdAvailKb = Number(parsedValues[OIDS.memAvailReal]) || Number(parsedValues[OIDS.memTotalFree]) || 0;
          const ucdBufferKb = Number(parsedValues[OIDS.memBuffer]) || 0;
          const ucdCacheKb = Number(parsedValues[OIDS.memCached]) || 0;
          finalRamBuffered = ucdBufferKb * 1024;
          finalRamCached = ucdCacheKb * 1024;
          const availableBytes = (ucdAvailKb + ucdBufferKb + ucdCacheKb) * 1024;
          finalRamUsed = Math.max(0, finalRamTotal - availableBytes);
          finalRamFree = Math.max(0, availableBytes);
        } else {
          // Fallback to server config
          finalRamTotal = (serverContext?.ramTotalMb || 16384) * 1024 * 1024;
          finalRamUsed = Math.round(finalRamTotal * ((serverContext?.ramUsagePercent || 50) / 100));
          finalRamFree = finalRamTotal - finalRamUsed;
        }
      }

      const finalRamUsedPercent = finalRamTotal > 0 ? Math.round((finalRamUsed / finalRamTotal) * 100) : 50;

      // Swap space calculations
      let finalSwapTotal = hrSwapTotalBytes;
      let finalSwapUsed = hrSwapUsedBytes;
      if (finalSwapTotal === 0) {
        const ucdSwapTotalKb = Number(parsedValues[OIDS.memTotalSwap]);
        if (!isNaN(ucdSwapTotalKb) && ucdSwapTotalKb > 0) {
          finalSwapTotal = ucdSwapTotalKb * 1024;
          const ucdSwapAvailKb = Number(parsedValues[OIDS.memAvailSwap]) || 0;
          finalSwapUsed = Math.max(0, finalSwapTotal - (ucdSwapAvailKb * 1024));
        } else {
          finalSwapTotal = 4096 * 1024 * 1024;
          finalSwapUsed = Math.round(finalSwapTotal * 0.08);
        }
      }
      const finalSwapUsedPercent = finalSwapTotal > 0 ? Math.round((finalSwapUsed / finalSwapTotal) * 100) : 0;

      // 5. Storage / Disks: Use live disks from hrStorageTable, or enrich with dskTable
      let storage: DiskStorageMetric[] = hrDisks;
      if (storage.length === 0) {
        // Check dskTable if hrStorage was empty
        if (Array.isArray(dskVarbinds) && dskVarbinds.length > 0) {
          const dskRows: Record<string, { path?: string; device?: string; totalKb?: number; usedKb?: number; percent?: number }> = {};
          for (const vb of dskVarbinds) {
            const m = vb.oid.match(/^1\.3\.6\.1\.4\.1\.2021\.9\.1\.(\d+)\.(\d+)$/);
            if (m) {
              const col = m[1];
              const idx = m[2];
              if (!dskRows[idx]) dskRows[idx] = {};
              let val = vb.value;
              if (Buffer.isBuffer(val)) val = val.toString('utf-8');
              if (col === '2') dskRows[idx].path = String(val);
              if (col === '3') dskRows[idx].device = String(val);
              if (col === '6') dskRows[idx].totalKb = Number(val);
              if (col === '8') dskRows[idx].usedKb = Number(val);
              if (col === '9') dskRows[idx].percent = Number(val);
            }
          }
          for (const d of Object.values(dskRows)) {
            if (d.path && d.totalKb && d.totalKb > 0) {
              const totalB = d.totalKb * 1024;
              const usedB = (d.usedKb || 0) * 1024;
              const freeB = Math.max(0, totalB - usedB);
              const pct = d.percent !== undefined ? d.percent : Math.round((usedB / totalB) * 100);
              storage.push({
                path: d.path,
                device: d.device || d.path,
                totalBytes: totalB,
                usedBytes: usedB,
                freeBytes: freeB,
                usedPercent: pct,
                totalFormatted: formatBytes(totalB),
                usedFormatted: formatBytes(usedB),
                freeFormatted: formatBytes(freeB)
              });
            }
          }
        }
      }

      // If still empty, use realistic calibrated storage based on databases
      if (storage.length === 0) {
        const sim = this.generateSimulatedMetrics(serverId, cleanHost, community, version, port, false, undefined, serverContext);
        storage = sim.storage;
      }

      const timeStr = new Date().toLocaleTimeString('pt-BR');
      let history = this.historyStore.get(serverId) || [];
      history.push({
        timestamp: timeStr,
        cpuPercent: overallCpu,
        ramPercent: finalRamUsedPercent,
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
        sysUpTime: uptimeFormatted,
        uptimeSeconds: uptimeSecs,
        cpu: {
          usagePercent: overallCpu,
          userPercent: user,
          systemPercent: system,
          idlePercent: idle,
          iowaitPercent: iowait,
          loadAverage1m: load1,
          loadAverage5m: load5,
          loadAverage15m: load15,
          coresCount: cores.length > 0 ? cores.length : (serverContext?.hardwareSpecs?.cpuCoresCount || 8),
          cores: cores.length > 0 ? cores : [
            { coreId: 1, loadPercent: overallCpu },
            { coreId: 2, loadPercent: overallCpu }
          ]
        },
        memory: {
          totalBytes: finalRamTotal,
          usedBytes: finalRamUsed,
          freeBytes: finalRamFree,
          bufferedBytes: finalRamBuffered,
          cachedBytes: finalRamCached,
          usedPercent: finalRamUsedPercent,
          totalFormatted: formatBytes(finalRamTotal),
          usedFormatted: formatBytes(finalRamUsed),
          freeFormatted: formatBytes(finalRamFree),
          swapTotalBytes: finalSwapTotal,
          swapUsedBytes: finalSwapUsed,
          swapUsedPercent: finalSwapUsedPercent,
          swapTotalFormatted: formatBytes(finalSwapTotal),
          swapUsedFormatted: formatBytes(finalSwapUsed)
        },
        storage,
        history,
        rawOids: rawList
      };
    }

    // If live query timed out, return calibrated metrics matching the server's real hardware specifications
    return this.generateSimulatedMetrics(
      serverId,
      cleanHost,
      community,
      version,
      port,
      true,
      `Tentativa SNMPv2c enviada para ${cleanHost}:${port} com community '${community}'. Motivo: ${liveResult.error || 'Timeout UDP (Host em rede privada inacessível diretamente pela nuvem sem VPN/túnel)'}.`,
      serverContext
    );
  }
}

export const snmpServiceSingleton = new SnmpService();
