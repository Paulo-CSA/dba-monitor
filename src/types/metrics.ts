export interface LatencyMetric {
  timestamp: string;
  readLatencyMs: number;
  writeLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface CpuMetric {
  timestamp: string;
  usagePercent: number;
  userPercent: number;
  systemPercent: number;
  iowaitPercent: number;
}

export interface SystemResourceMetric {
  timestamp: string;
  ramUsagePercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  activeConnections: number;
  maxConnections: number;
  tps: number; // Transactions per second
  cacheHitRatio: number; // Percentage 0-100
  diskUsagePercent: number;
}

export interface RealtimeMetricsPayload {
  currentLatency: LatencyMetric;
  currentCpu: CpuMetric;
  currentResources: SystemResourceMetric;
  latencyHistory: LatencyMetric[];
  cpuHistory: CpuMetric[];
  resourceHistory: SystemResourceMetric[];
}
