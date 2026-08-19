import { AlertRule, ActiveAlert } from '../types/alerts';
import { RealtimeMetricsPayload } from '../types/metrics';
import { ServerInstance } from '../types/serverFleet';

export class AlertEngine {
  private rules: AlertRule[] = [];
  private activeAlerts: ActiveAlert[] = [];

  constructor() {
    this.rules = [
      {
        id: 'rule-cpu-high',
        name: 'Uso de CPU Elevado',
        metric: 'cpu_usage',
        operator: '>',
        thresholdValue: 80,
        unit: '%',
        severity: 'critical',
        enabled: true,
        notifySound: true,
        description: 'Alerta disparado quando a CPU do servidor ultrapassar 80%.'
      },
      {
        id: 'rule-lat-high',
        name: 'Latência Média Crítica',
        metric: 'avg_latency',
        operator: '>',
        thresholdValue: 10,
        unit: 'ms',
        severity: 'warning',
        enabled: true,
        notifySound: false,
        description: 'Alerta quando a latência média de leitura/escrita exceder 10ms.'
      },
      {
        id: 'rule-stuck-queries',
        name: 'Consultas Presas Detectadas',
        metric: 'stuck_queries_count',
        operator: '>=',
        thresholdValue: 2,
        unit: 'queries',
        severity: 'critical',
        enabled: true,
        notifySound: true,
        description: 'Alerta quando houver 2 ou mais consultas bloqueadas em transação.'
      },
      {
        id: 'rule-ram-high',
        name: 'Consumo da RAM Alto',
        metric: 'ram_usage',
        operator: '>',
        thresholdValue: 85,
        unit: '%',
        severity: 'warning',
        enabled: true,
        notifySound: false,
        description: 'Alerta quando o uso de memória do PostgreSQL exceder 85%.'
      },
      {
        id: 'rule-zero-tables',
        name: 'Banco de Dados Sem Tabelas',
        metric: 'tables_count',
        operator: '<',
        thresholdValue: 1,
        unit: 'tabelas',
        severity: 'warning',
        enabled: true,
        notifySound: false,
        description: 'Alerta quando um banco de dados (exceto o sistema postgres) possui menos de 1 tabela.'
      }
    ];
  }

  public getRules(): AlertRule[] {
    return [...this.rules];
  }

  public addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`
    };
    this.rules.push(newRule);
    return newRule;
  }

  public toggleRule(id: string): void {
    const r = this.rules.find(x => x.id === id);
    if (r) r.enabled = !r.enabled;
  }

  public deleteRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id);
  }

  public evaluateMetrics(
    metrics: RealtimeMetricsPayload,
    stuckQueriesCount: number,
    servers: ServerInstance[] = []
  ): ActiveAlert[] {
    const newActiveAlerts: ActiveAlert[] = [];
    const now = new Date().toLocaleTimeString();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (rule.metric === 'tables_count') {
        for (const srv of servers) {
          if (!srv.databases) continue;
          for (const db of srv.databases) {
            if (['postgres', 'root'].includes(db.datname.toLowerCase())) continue;
            const val = db.tablesCount ?? 0;
            let triggered = false;
            if (rule.operator === '<' && val < rule.thresholdValue) triggered = true;
            if (rule.operator === '<=' && val <= rule.thresholdValue) triggered = true;
            if (rule.operator === '==' && val === rule.thresholdValue) triggered = true;

            if (triggered) {
              newActiveAlerts.push({
                id: `alert-${rule.id}-${srv.id}-${db.datname}`,
                ruleId: rule.id,
                ruleName: `${rule.name} (${db.datname})`,
                severity: rule.severity,
                message: `O banco de dados '${db.datname}' no servidor ${srv.host} possui ${val} tabelas (limite configurado: ${rule.operator} ${rule.thresholdValue} ${rule.unit}).`,
                currentValue: val,
                thresholdValue: rule.thresholdValue,
                triggeredAt: now,
                acknowledged: false
              });
            }
          }
        }
        continue;
      }

      let val = 0;
      if (rule.metric === 'cpu_usage') val = metrics.currentCpu.usagePercent;
      else if (rule.metric === 'avg_latency') val = metrics.currentLatency.avgLatencyMs;
      else if (rule.metric === 'ram_usage') val = metrics.currentResources.ramUsagePercent;
      else if (rule.metric === 'active_connections') val = metrics.currentResources.activeConnections;
      else if (rule.metric === 'stuck_queries_count') val = stuckQueriesCount;

      let triggered = false;
      if (rule.operator === '>' && val > rule.thresholdValue) triggered = true;
      if (rule.operator === '>=' && val >= rule.thresholdValue) triggered = true;
      if (rule.operator === '<' && val < rule.thresholdValue) triggered = true;
      if (rule.operator === '==' && val === rule.thresholdValue) triggered = true;

      if (triggered) {
        newActiveAlerts.push({
          id: `alert-${rule.id}-${Date.now()}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `${rule.name}: Valor atual (${val}${rule.unit}) viola o limite configurado (${rule.operator} ${rule.thresholdValue}${rule.unit}).`,
          currentValue: val,
          thresholdValue: rule.thresholdValue,
          triggeredAt: now,
          acknowledged: false
        });
      }
    }

    this.activeAlerts = newActiveAlerts;
    return this.activeAlerts;
  }

  public getActiveAlerts(): ActiveAlert[] {
    return [...this.activeAlerts];
  }

  public acknowledgeAlert(id: string): void {
    const a = this.activeAlerts.find(x => x.id === id);
    if (a) a.acknowledged = true;
  }
}

export const alertEngineSingleton = new AlertEngine();
