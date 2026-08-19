export type AlertMetricType =
  | 'cpu_usage'
  | 'avg_latency'
  | 'active_connections'
  | 'stuck_queries_count'
  | 'ram_usage'
  | 'disk_usage'
  | 'bloat_percentage'
  | 'tables_count';

export type AlertOperator = '>' | '>=' | '<' | '<=' | '==';

export interface AlertRule {
  id: string;
  name: string;
  metric: AlertMetricType;
  operator: AlertOperator;
  thresholdValue: number;
  unit: string; // '%', 'ms', 'queries', etc.
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notifySound: boolean;
  description: string;
}

export interface ActiveAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  thresholdValue: number;
  triggeredAt: string;
  acknowledged: boolean;
}
