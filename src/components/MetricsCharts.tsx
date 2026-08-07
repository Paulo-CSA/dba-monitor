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
import { Cpu, Clock } from 'lucide-react';

interface MetricsChartsProps {
  latencyHistory: LatencyMetric[];
  cpuHistory: CpuMetric[];
  currentCpu: CpuMetric;
  currentLatency: LatencyMetric;
}

export const MetricsCharts: React.FC<MetricsChartsProps> = ({
  latencyHistory,
  cpuHistory,
  currentCpu,
  currentLatency
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CPU Usage Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Uso de CPU do Servidor (%)</h2>
              <p className="text-xs text-slate-400">Distribuição entre Usuário, Sistema e I/O Wait</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xl font-bold text-cyan-400">{currentCpu?.usagePercent || 0}%</span>
            <span className="block text-[11px] text-slate-400">Total Atual</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cpuHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px', color: '#f8fafc' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Limite Crítico 80%', fill: '#f43f5e', fontSize: 10 }} />
              <Area type="monotone" dataKey="usagePercent" name="CPU Total (%)" stroke="#06b6d4" fillOpacity={1} fill="url(#cpuGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="userPercent" name="Processos Usuário (%)" stroke="#3b82f6" fillOpacity={1} fill="url(#userGradient)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency History Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Latência de Transação (ms)</h2>
              <p className="text-xs text-slate-400">Tempo de resposta para Leitura, Escrita e Média P95</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xl font-bold text-emerald-400">{currentLatency?.avgLatencyMs || 0} ms</span>
            <span className="block text-[11px] text-slate-400">Média Atual</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px', color: '#f8fafc' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Alerta 15ms', fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="avgLatencyMs" name="Latência Média" stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="p95LatencyMs" name="Percentil P95" stroke="#a855f7" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="writeLatencyMs" name="Escrita" stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
