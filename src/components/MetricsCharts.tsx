import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { LatencyMetric, CpuMetric } from '../types/metrics';
import { Users, Zap, HardDrive } from 'lucide-react';

interface MetricsChartsProps {
  latencyHistory: LatencyMetric[];
  cpuHistory: CpuMetric[];
  currentCpu: CpuMetric;
  currentLatency: LatencyMetric;
  stuckQueriesCount?: number;
  tps?: number;
}

export const MetricsCharts: React.FC<MetricsChartsProps> = ({
  latencyHistory,
  cpuHistory,
  stuckQueriesCount = 12,
  tps = 240
}) => {
  // Transform data for Server Sessions and Transactions (TPS)
  const chartData = cpuHistory.map((item, idx) => {
    const lat = latencyHistory[idx] || { avgLatencyMs: 2.1 };
    const simulatedSessions = Math.max(3, Math.round((item.usagePercent * 0.4) + (idx % 5)));
    const simulatedTps = Math.round((item.usagePercent * 18) + (tps || 200) * 0.5 + (idx * 3));
    const blockReads = Math.round(item.systemPercent * 42 + 10);
    const blockHits = Math.round(item.userPercent * 380 + 1200);

    return {
      timestamp: item.timestamp,
      sessions: simulatedSessions,
      maxSessions: 100,
      tps: simulatedTps,
      blockReads,
      blockHits
    };
  });

  const lastPoint = chartData[chartData.length - 1] || { sessions: stuckQueriesCount, tps: tps || 240 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Server Sessions Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Sessões e Conexões do Servidor (`Server Sessions`)</h2>
              <p className="text-xs text-slate-400">Sessões ativas no pool de conexões do PostgreSQL</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xl font-bold text-cyan-400">{lastPoint.sessions}</span>
            <span className="block text-[11px] text-slate-400">Sessões Ativas</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 'dataMax + 10']} stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px', color: '#f8fafc' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Limite 80 Conexões', fill: '#f43f5e', fontSize: 10 }} />
              <Area type="monotone" dataKey="sessions" name="Sessões Ativas" stroke="#06b6d4" fillOpacity={1} fill="url(#sessionsGradient)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Throughput (TPS) & Block I/O Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Transações e Block I/O (`Transactions & Block I/O`)</h2>
              <p className="text-xs text-slate-400">Throughput de Transações/s e leituras de bloco em disco</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xl font-bold text-purple-300">{lastPoint.tps} tps</span>
            <span className="block text-[11px] text-slate-400">Transações/seg</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px', color: '#f8fafc' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="tps" name="Transações por Segundo (TPS)" stroke="#a855f7" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="blockReads" name="Block I/O Reads (Disco)" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
