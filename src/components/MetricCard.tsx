import React from 'react';
import { LucideIcon, ExternalLink } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'normal' | 'warning' | 'critical';
  progressPercent?: number;
  details?: { label: string; value: string }[];
  onClick?: () => void;
  clickableHint?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  status = 'normal',
  progressPercent,
  details,
  onClick,
  clickableHint
}) => {
  const getStatusBg = () => {
    switch (status) {
      case 'critical':
        return 'bg-rose-950/40 border-rose-800/80 text-rose-300';
      case 'warning':
        return 'bg-amber-950/40 border-amber-800/80 text-amber-300';
      default:
        return 'bg-slate-900 border-slate-800 text-slate-100';
    }
  };

  const getIconBg = () => {
    switch (status) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-400';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-blue-500/20 text-cyan-400';
    }
  };

  const getBarColor = () => {
    switch (status) {
      case 'critical':
        return 'bg-rose-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-cyan-500';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-2xl border ${getStatusBg()} shadow-sm transition-all ${
        onClick
          ? 'cursor-pointer hover:border-cyan-500/80 hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-950/30 group'
          : 'hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
            {onClick && (
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 opacity-70 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{value}</span>
            {unit && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className={`p-2.5 rounded-xl ${getIconBg()}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {progressPercent !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-mono">
            <span>Capacidade</span>
            <span>{Math.min(100, Math.max(0, progressPercent))}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${getBarColor()}`}
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>
      )}

      {details && details.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          {details.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="text-slate-400">{item.label}:</span>
              <span className="font-mono font-medium text-slate-200">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {onClick && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-cyan-400 font-semibold group-hover:underline">
          <span>{clickableHint || 'Clique para ver conexões ativas'}</span>
          <span>&rarr;</span>
        </div>
      )}
    </div>
  );
};

