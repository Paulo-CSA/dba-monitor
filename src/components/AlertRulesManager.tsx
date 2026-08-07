import React, { useState } from 'react';
import { AlertRule, ActiveAlert, AlertMetricType } from '../types/alerts';
import { Bell, Plus, Check, Trash2, Volume2, VolumeX, ShieldAlert, X } from 'lucide-react';

interface AlertRulesManagerProps {
  rules: AlertRule[];
  activeAlerts: ActiveAlert[];
  onAddRule: (rule: Omit<AlertRule, 'id'>) => void;
  onToggleRule: (id: string) => void;
  onClose: () => void;
  onAcknowledgeAlert: (id: string) => void;
}

export const AlertRulesManager: React.FC<AlertRulesManagerProps> = ({
  rules,
  activeAlerts,
  onAddRule,
  onToggleRule,
  onClose,
  onAcknowledgeAlert
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<AlertMetricType>('cpu_usage');
  const [thresholdValue, setThresholdValue] = useState<number>(85);
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('critical');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let unit = '%';
    if (metric === 'avg_latency') unit = 'ms';
    if (metric === 'stuck_queries_count') unit = 'queries';

    onAddRule({
      name,
      metric,
      operator: '>',
      thresholdValue,
      unit,
      severity,
      enabled: true,
      notifySound: true,
      description: `Alerta personalizado para ${metric} > ${thresholdValue}${unit}`
    });

    setName('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Central de Alertas Personalizados</h2>
              <p className="text-xs text-slate-400">Regras de monitoramento de limites de CPU, Latência e Transações Presas</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Active Triggered Alerts Banner */}
          {activeAlerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>Alertas Disparados em Tempo Real ({activeAlerts.length})</span>
              </h3>

              <div className="space-y-2">
                {activeAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-rose-200">{a.ruleName}</div>
                      <p className="text-slate-300 mt-0.5">{a.message}</p>
                      <span className="text-[10px] text-rose-400 font-mono">Disparado às {a.triggeredAt}</span>
                    </div>

                    <button
                      onClick={() => onAcknowledgeAlert(a.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-semibold text-[11px] whitespace-nowrap"
                    >
                      Ciente
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Regras Configuradas</h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center space-x-1 text-xs font-bold text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddForm ? 'Cancelar Nova Regra' : 'Criar Regra'}</span>
              </button>
            </div>

            {/* Add Rule Form */}
            {showAddForm && (
              <form onSubmit={handleCreate} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nome do Alerta</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Latência Crítica de API > 20ms"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Métrica Monitorada</label>
                    <select
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as AlertMetricType)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="cpu_usage">Uso de CPU (%)</option>
                      <option value="avg_latency">Latência Média (ms)</option>
                      <option value="stuck_queries_count">Consultas Presas (Qtd)</option>
                      <option value="ram_usage">Uso de RAM (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Valor Limite Disparo</label>
                    <input
                      type="number"
                      required
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Salvar Nova Regra
                </button>
              </form>
            )}

            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{rule.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        rule.severity === 'critical' ? 'bg-rose-950 text-rose-400' : 'bg-amber-950 text-amber-400'
                      }`}>
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">{rule.description}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onToggleRule(rule.id)}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                        rule.enabled
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'Ativo' : 'Desativado'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
