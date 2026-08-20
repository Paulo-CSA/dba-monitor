import { AlertRule, ActiveAlert } from '../types/alerts';
import { RealtimeMetricsPayload } from '../types/metrics';
import { ServerInstance } from '../types/serverFleet';

export class AlertEngine {
  private rules: AlertRule[] = [];
  private activeAlerts: ActiveAlert[] = [];
  private acknowledgedIds: Set<string> = new Set();
  private silencedDbs: Set<string> = new Set();

  constructor() {
    this.rules = [
      {
        id: 'rule-conns-high',
        name: 'Alto Volume de Conexões',
        metric: 'active_connections',
        operator: '>',
        thresholdValue: 200,
        unit: 'conns',
        severity: 'warning',
        enabled: true,
        notifySound: false,
        description: 'Alerta disparado quando o número de conexões ativas ultrapassar 200.'
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
              const alertId = `alert-${rule.id}-${srv.id}-${db.datname}`;
              const isSilenced =
                this.acknowledgedIds.has(alertId) ||
                this.silencedDbs.has(`${srv.id}:${db.datname.toLowerCase()}`) ||
                this.silencedDbs.has(db.datname.toLowerCase());

              newActiveAlerts.push({
                id: alertId,
                ruleId: rule.id,
                ruleName: `${rule.name} (${db.datname})`,
                severity: rule.severity,
                message: `O banco de dados '${db.datname}' no servidor ${srv.host} possui ${val} tabelas (limite configurado: ${rule.operator} ${rule.thresholdValue} ${rule.unit}).`,
                currentValue: val,
                thresholdValue: rule.thresholdValue,
                triggeredAt: now,
                acknowledged: isSilenced
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
        const alertId = `alert-${rule.id}-${Math.floor(Date.now() / 10000)}`;
        const isSilenced = this.acknowledgedIds.has(alertId) || this.acknowledgedIds.has(rule.id);
        newActiveAlerts.push({
          id: alertId,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `${rule.name}: Valor atual (${val}${rule.unit}) viola o limite configurado (${rule.operator} ${rule.thresholdValue}${rule.unit}).`,
          currentValue: val,
          thresholdValue: rule.thresholdValue,
          triggeredAt: now,
          acknowledged: isSilenced
        });
      }
    }

    this.activeAlerts = newActiveAlerts;
    return this.activeAlerts;
  }

  public getActiveAlerts(): ActiveAlert[] {
    return [...this.activeAlerts];
  }

  public acknowledgeAlert(id: string, serverId?: string, dbName?: string): void {
    this.acknowledgedIds.add(id);
    if (serverId && dbName) {
      this.silencedDbs.add(`${serverId}:${dbName.toLowerCase()}`);
    } else if (dbName) {
      this.silencedDbs.add(dbName.toLowerCase());
    }
    // Also try to extract from id if formatted as alert-rule-*-srvId-dbName
    const parts = id.split('-');
    if (parts.length >= 4) {
      const extractedDb = parts[parts.length - 1];
      if (extractedDb) {
        this.silencedDbs.add(extractedDb.toLowerCase());
      }
    }
    const a = this.activeAlerts.find(x => x.id === id);
    if (a) a.acknowledged = true;
  }

  public unacknowledgeAlert(id: string): void {
    this.acknowledgedIds.delete(id);
    const parts = id.split('-');
    if (parts.length >= 4) {
      const extractedDb = parts[parts.length - 1];
      if (extractedDb) {
        this.silencedDbs.delete(extractedDb.toLowerCase());
      }
    }
    const a = this.activeAlerts.find(x => x.id === id);
    if (a) a.acknowledged = false;
  }

  public unsilenceDatabase(serverId: string, dbName: string): void {
    const key = `${serverId}:${dbName.toLowerCase()}`;
    this.silencedDbs.delete(key);
    this.silencedDbs.delete(dbName.toLowerCase());

    // Also remove any matching alert IDs
    for (const id of Array.from(this.acknowledgedIds)) {
      if (id.includes(dbName) || id.includes(serverId)) {
        this.acknowledgedIds.delete(id);
      }
    }

    for (const a of this.activeAlerts) {
      if (a.id.includes(dbName)) {
        a.acknowledged = false;
      }
    }
  }

  public isDatabaseSilenced(serverId: string, dbName: string): boolean {
    return (
      this.silencedDbs.has(`${serverId}:${dbName.toLowerCase()}`) ||
      this.silencedDbs.has(dbName.toLowerCase())
    );
  }

  public getSilencedDatabases(): string[] {
    return Array.from(this.silencedDbs);
  }
}

export const alertEngineSingleton = new AlertEngine();
