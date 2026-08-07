import { RealtimeMetricsPayload, LatencyMetric, CpuMetric, SystemResourceMetric } from '../types/metrics';
import { generateHistoricalMetrics } from '../utils/mockGenerator';

export class MetricsEngine {
  private historyLength = 30;
  private latencyHistory: LatencyMetric[] = [];
  private cpuHistory: CpuMetric[] = [];
  private resourceHistory: SystemResourceMetric[] = [];
  private simulatedLoadSpike = false;

  constructor() {
    const initial = generateHistoricalMetrics(20);
    this.latencyHistory = initial.latencyHistory;
    this.cpuHistory = initial.cpuHistory;
    this.resourceHistory = initial.resourceHistory;
  }

  public setLoadSpike(active: boolean): void {
    this.simulatedLoadSpike = active;
  }

  public getIsLoadSpike(): boolean {
    return this.simulatedLoadSpike;
  }

  public tickNextMetrics(): RealtimeMetricsPayload {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    let baseCpu = 22 + Math.random() * 12;
    let baseLatency = 1.5 + Math.random() * 0.8;
    let connections = Math.round(45 + Math.random() * 10);

    if (this.simulatedLoadSpike) {
      baseCpu = 88 + Math.random() * 10;
      baseLatency = 12.5 + Math.random() * 8.0;
      connections = Math.round(140 + Math.random() * 30);
    }

    const currentLatency: LatencyMetric = {
      timestamp: timeStr,
      readLatencyMs: parseFloat((baseLatency * 0.75).toFixed(2)),
      writeLatencyMs: parseFloat((baseLatency * 1.35).toFixed(2)),
      avgLatencyMs: parseFloat(baseLatency.toFixed(2)),
      p95LatencyMs: parseFloat((baseLatency * 2.2).toFixed(2))
    };

    const currentCpu: CpuMetric = {
      timestamp: timeStr,
      usagePercent: parseFloat(baseCpu.toFixed(1)),
      userPercent: parseFloat((baseCpu * 0.72).toFixed(1)),
      systemPercent: parseFloat((baseCpu * 0.23).toFixed(1)),
      iowaitPercent: parseFloat((baseCpu * 0.05).toFixed(1))
    };

    const currentResources: SystemResourceMetric = {
      timestamp: timeStr,
      ramUsagePercent: parseFloat((61 + Math.random() * 3).toFixed(1)),
      ramUsedMb: Math.round(10000 + Math.random() * 400),
      ramTotalMb: 16384,
      activeConnections: connections,
      maxConnections: 200,
      tps: Math.round(1350 + Math.random() * 250),
      cacheHitRatio: parseFloat((99.4 + Math.random() * 0.4).toFixed(2)),
      diskUsagePercent: 64.2
    };

    this.latencyHistory.push(currentLatency);
    this.cpuHistory.push(currentCpu);
    this.resourceHistory.push(currentResources);

    if (this.latencyHistory.length > this.historyLength) this.latencyHistory.shift();
    if (this.cpuHistory.length > this.historyLength) this.cpuHistory.shift();
    if (this.resourceHistory.length > this.historyLength) this.resourceHistory.shift();

    return {
      currentLatency,
      currentCpu,
      currentResources,
      latencyHistory: [...this.latencyHistory],
      cpuHistory: [...this.cpuHistory],
      resourceHistory: [...this.resourceHistory]
    };
  }

  public getCurrentPayload(): RealtimeMetricsPayload {
    const lastIdx = this.latencyHistory.length - 1;
    return {
      currentLatency: this.latencyHistory[lastIdx],
      currentCpu: this.cpuHistory[lastIdx],
      currentResources: this.resourceHistory[lastIdx],
      latencyHistory: [...this.latencyHistory],
      cpuHistory: [...this.cpuHistory],
      resourceHistory: [...this.resourceHistory]
    };
  }
}

export const metricsEngineSingleton = new MetricsEngine();
