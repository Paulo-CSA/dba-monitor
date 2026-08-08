export interface ReportFilterOptions {
  includeMetricsSummary: boolean;
  includeFileLocations: boolean;
  includeHealthIntegrity: boolean;
  includeBackupStatus: boolean;
  includeStuckQueriesAndLocks: boolean;
  includeAlertsLog: boolean;
  startDate: string;
  endDate: string;
  reportTitle: string;
  preparedBy: string;
  targetServerName?: string;
  targetDatabaseName?: string;
  notes?: string;
}
