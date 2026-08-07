import React from 'react';
import { Database, Activity, FileText, Bell, RefreshCw, Zap, ShieldCheck, HardDrive, Settings, Server, Eye, Lock, BarChart2 } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  refreshIntervalMs: number;
  setRefreshIntervalMs: (ms: number) => void;
  isLoadSpike?: boolean;
  onToggleLoadSpike?: () => void;
  onOpenExportModal: () => void;
  onOpenAlertModal: () => void;
  onOpenConnectionModal: () => void;
  activeAlertCount: number;
  selectedServerHost?: string;
  selectedDatabaseName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isLive,
  setIsLive,
  refreshIntervalMs,
  setRefreshIntervalMs,
  onOpenExportModal,
  onOpenAlertModal,
  onOpenConnectionModal,
  activeAlertCount,
  selectedServerHost = 'pg-prod-us1.internal.cloud',
  selectedDatabaseName = 'production_db'
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-mono">
                  Pg<span className="text-cyan-400">Monitor</span>
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  <span>v16.2</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                <span>{selectedServerHost}</span>
                <span className="text-slate-600">/</span>
                <span className="text-cyan-300 font-bold">{selectedDatabaseName}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Live Stream Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live Indicator Toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isLive
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900/80'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span>{isLive ? 'Ao Vivo' : 'Pausado'}</span>
            </button>

            {/* Refresh Interval Selector */}
            <select
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value={1000}>Atualizar 1s</option>
              <option value={2000}>Atualizar 2s</option>
              <option value={5000}>Atualizar 5s</option>
              <option value={10000}>Atualizar 10s</option>
            </select>

            {/* Alerts Drawer Button */}
            <button
              onClick={onOpenAlertModal}
              className="relative p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Alertas e Regras de Notificação"
            >
              <Bell className="w-4 h-4" />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                  {activeAlertCount}
                </span>
              )}
            </button>

            {/* Connection Settings */}
            <button
              onClick={onOpenConnectionModal}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Configurações de Conexão com o Banco"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Export Reports Button */}
            <button
              onClick={onOpenExportModal}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'fleet'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Server className="w-4 h-4 text-blue-400" />
            <span>Frota de Servidores & Bancos</span>
          </button>

          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'metrics'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Métricas do Banco Selecionado</span>
          </button>

          <button
            onClick={() => setActiveTab('stuck_locks')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'stuck_locks'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Queries Presas e Bloqueios</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'config'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Arquivos de Configuração</span>
          </button>

          <button
            onClick={() => setActiveTab('integrity')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'integrity'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Saúde e Integridade</span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === 'backups'
                ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span>Backups</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
