import { RealtimeMetricsPayload } from '../types/metrics';
import { FileLocationSetting } from '../types/config';
import { StuckQuery, ActiveLock } from '../types/locks';
import { BackupOverview } from '../types/backup';
import { DatabaseIntegrityOverview } from '../types/health';
import { ReportFilterOptions } from '../types/export';

export function exportToCSV(
  options: ReportFilterOptions,
  metrics: RealtimeMetricsPayload,
  fileLocations: FileLocationSetting[],
  health: DatabaseIntegrityOverview,
  backup: BackupOverview,
  stuckQueries: StuckQuery[],
  activeLocks: ActiveLock[]
): void {
  const sections: string[] = [];

  // Header
  sections.push(`"RELATÓRIO DE MONITORAMENTO DE BANCO DE DADOS POSTGRESQL"`);
  sections.push(`"Título:","${options.reportTitle}"`);
  sections.push(`"Gerado por:","${options.preparedBy}"`);
  sections.push(`"Data do Relatório:","${new Date().toLocaleString('pt-BR')}"`);
  sections.push(`"Período:","${options.startDate} até ${options.endDate}"`);
  sections.push(`""`);

  // Section 1: Metrics Summary
  if (options.includeMetricsSummary) {
    sections.push(`"--- RESUMO DE MÉTRICAS EM TEMPO REAL ---"`);
    sections.push(`"Métrica","Valor Atual","Timestamp"`);
    sections.push(`"Latência Média (ms)","${metrics.currentLatency.avgLatencyMs}","${metrics.currentLatency.timestamp}"`);
    sections.push(`"Latência P95 (ms)","${metrics.currentLatency.p95LatencyMs}","${metrics.currentLatency.timestamp}"`);
    sections.push(`"Uso de CPU (%)","${metrics.currentCpu.usagePercent}%","${metrics.currentCpu.timestamp}"`);
    sections.push(`"Conexões Ativas","${metrics.currentResources.activeConnections} / ${metrics.currentResources.maxConnections}","${metrics.currentResources.timestamp}"`);
    sections.push(`"Taxa de Hits no Cache (%)","${metrics.currentResources.cacheHitRatio}%","${metrics.currentResources.timestamp}"`);
    sections.push(`"Transações por Segundo (TPS)","${metrics.currentResources.tps}","${metrics.currentResources.timestamp}"`);
    sections.push(`""`);

    sections.push(`"--- HISTÓRICO RECENTE DE DESEMPENHO (LATÊNCIA E CPU) ---"`);
    sections.push(`"Horário","Latência Média (ms)","Read Latency (ms)","Write Latency (ms)","CPU Total (%)","CPU User (%)","CPU System (%)"`);
    
    for (let i = 0; i < metrics.latencyHistory.length; i++) {
      const lat = metrics.latencyHistory[i];
      const cpu = metrics.cpuHistory[i] || { usagePercent: 0, userPercent: 0, systemPercent: 0 };
      sections.push(`"${lat.timestamp}","${lat.avgLatencyMs}","${lat.readLatencyMs}","${lat.writeLatencyMs}","${cpu.usagePercent}","${cpu.userPercent}","${cpu.systemPercent}"`);
    }
    sections.push(`""`);
  }

  // Section 2: File Locations
  if (options.includeFileLocations) {
    sections.push(`"--- LOCALIZAÇÃO DOS ARQUIVOS DE CONFIGURAÇÃO (pg_settings: File Locations) ---"`);
    sections.push(`"Configuração","Caminho no Sistema","Categoria","Descrição"`);
    for (const loc of fileLocations) {
      sections.push(`"${loc.name}","${loc.setting}","${loc.category}","${loc.short_desc}"`);
    }
    sections.push(`""`);
  }

  // Section 3: Health & Integrity
  if (options.includeHealthIntegrity) {
    sections.push(`"--- INTEGRIDADE E SAÚDE DO BANCO DE DADOS ---"`);
    sections.push(`"Score Geral de Integridade:","${health.overallIntegrityScore}%"`);
    sections.push(`"Status do Sistema:","${health.status}"`);
    sections.push(`"Checksums de Blocos:","${health.checksumsEnabled ? 'Ativado' : 'Desativado'}"`);
    sections.push(`"Lag de Replicação:","${health.replicationLagBytes} bytes"`);
    sections.push(`""`);
    sections.push(`"Componente","Status","Mensagem","Detalhes"`);
    for (const item of health.healthChecks) {
      sections.push(`"${item.component}","${item.status.toUpperCase()}","${item.message}","${item.details}"`);
    }
    sections.push(`""`);
  }

  // Section 4: Backup Status
  if (options.includeBackupStatus) {
    sections.push(`"--- STATUS E HISTÓRICO DE BACKUPS ---"`);
    sections.push(`"Último Backup:","${backup.lastBackupTimestamp}"`);
    sections.push(`"Status de Saúde:","${backup.backupHealthStatus.toUpperCase()}"`);
    sections.push(`"Tamanho Total Armazenado:","${backup.totalBackupSizeFormatted}"`);
    sections.push(`"Arquivamento WAL:","${backup.walArchiveStatus.toUpperCase()}"`);
    sections.push(`""`);
    sections.push(`"ID Backup","Tipo","Status","Data de Início","Tamanho","Localização","Checksum"`);
    for (const bkp of backup.recentBackups) {
      sections.push(`"${bkp.id}","${bkp.type}","${bkp.status}","${bkp.startTime}","${bkp.sizeFormatted}","${bkp.location}","${bkp.checksum}"`);
    }
    sections.push(`""`);
  }

  // Section 5: Stuck Queries and Active Locks
  if (options.includeStuckQueriesAndLocks) {
    sections.push(`"--- CONSULTAS PRESAS E BLOQUEIOS ATIVOS (pg_stat_activity & pg_locks) ---"`);
    sections.push(`"PID","Usuário","Banco","Duração (s)","Bloqueado por PID","Estado","Evento de Espera","Consulta"`);
    for (const sq of stuckQueries) {
      const sanitizedQuery = sq.query.replace(/"/g, '""');
      sections.push(`"${sq.pid}","${sq.usename}","${sq.datname}","${sq.durationSeconds}","${sq.blocking_pid || 'Nenhum'}","${sq.state}","${sq.wait_event || 'N/A'}","${sanitizedQuery}"`);
    }
    sections.push(`""`);
    
    sections.push(`"--- BLOQUEIOS ATIVOS NO BANCO ---"`);
    sections.push(`"PID","Tabela/Relação","Modo de Lock","Concedido","Duração (s)","PID Bloqueador"`);
    for (const lock of activeLocks) {
      sections.push(`"${lock.pid}","${lock.relation}","${lock.mode}","${lock.granted ? 'SIM' : 'NÃO'}","${lock.durationSeconds}","${lock.blocking_pid || 'Nenhum'}"`);
    }
    sections.push(`""`);
  }

  // Join content
  const csvContent = sections.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = `Relatorio_BD_PostgreSQL_${new Date().toISOString().slice(0,10)}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
