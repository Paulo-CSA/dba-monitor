import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RealtimeMetricsPayload } from '../types/metrics';
import { FileLocationSetting } from '../types/config';
import { StuckQuery, ActiveLock } from '../types/locks';
import { BackupOverview } from '../types/backup';
import { DatabaseIntegrityOverview } from '../types/health';
import { ReportFilterOptions } from '../types/export';
import { formatDateTime, formatMs } from './formatters';

export function exportToPDF(
  options: ReportFilterOptions,
  metrics: RealtimeMetricsPayload,
  fileLocations: FileLocationSetting[],
  health: DatabaseIntegrityOverview,
  backup: BackupOverview,
  stuckQueries: StuckQuery[],
  activeLocks: ActiveLock[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [37, 99, 235]; // Blue 600

  // Title / Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Monitoramento - PostgreSQL BD', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Por: ${options.preparedBy}`, 14, 18);
  doc.text(`Servidor: ${options.targetServerName || 'Geral'} | Banco: ${options.targetDatabaseName || 'Geral'}`, 14, 23);

  let currentY = 35;

  // Document Title Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(options.reportTitle, 14, currentY);
  currentY += 8;

  if (options.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    doc.text(`Observações: ${options.notes}`, 14, currentY);
    currentY += 8;
  }

  // 1. Metrics Summary
  if (options.includeMetricsSummary) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('1. Métricas em Tempo Real (CPU e Latência)', 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [['Métrica de Desempenho', 'Valor Atual', 'Status', 'Referência']],
      body: [
        ['Latência Média de Consultas', `${formatMs(metrics.currentLatency.avgLatencyMs)}`, metrics.currentLatency.avgLatencyMs < 10 ? 'Excelente' : 'Atenção', '< 15 ms'],
        ['Latência P95 (Percentil 95)', `${formatMs(metrics.currentLatency.p95LatencyMs)}`, metrics.currentLatency.p95LatencyMs < 30 ? 'Normal' : 'Elevada', '< 50 ms'],
        ['Uso Total de CPU', `${metrics.currentCpu.usagePercent}%`, metrics.currentCpu.usagePercent < 80 ? 'Normal' : 'Crítico', '< 80%'],
        ['Conexões Ativas', `${metrics.currentResources.activeConnections} / ${metrics.currentResources.maxConnections}`, 'Estável', 'Limite: 200'],
        ['Hit Ratio do Cache', `${metrics.currentResources.cacheHitRatio}%`, metrics.currentResources.cacheHitRatio > 98 ? 'Excelente' : 'Regular', '> 98%'],
        ['Transações / Segundo (TPS)', `${metrics.currentResources.tps} tps`, 'Normal', 'Atividade Realtime']
      ],
      theme: 'grid',
      headStyles: { fillColor: accentColor as [number, number, number], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 2. File Locations
  if (options.includeFileLocations) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('2. Localização dos Arquivos de Configuração (pg_settings)', 14, currentY);
    currentY += 4;

    const fileRows = fileLocations.map(f => [
      f.name,
      f.setting,
      f.short_desc
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Nome do Arquivo', 'Caminho Absoluto no Disco', 'Função / Descrição']],
      body: fileRows,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 80 },
        2: { cellWidth: 67 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 3. Health & Integrity
  if (options.includeHealthIntegrity) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`3. Diagnóstico de Saúde e Integridade (Score: ${health.overallIntegrityScore}%)`, 14, currentY);
    currentY += 4;

    const healthRows = health.healthChecks.map(h => [
      h.component,
      h.status.toUpperCase(),
      h.message,
      h.details
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Componente', 'Status', 'Diagnóstico Principal', 'Detalhes Técnicos']],
      body: healthRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 60 },
        3: { cellWidth: 62 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 4. Backup Status
  if (options.includeBackupStatus) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`4. Informações de Backup (Último: ${formatDateTime(backup.lastBackupTimestamp)})`, 14, currentY);
    currentY += 4;

    const backupRows = backup.recentBackups.map(b => [
      b.id,
      b.serverName || 'Servidor',
      b.databaseName || 'postgres',
      b.type,
      b.status.toUpperCase(),
      b.sizeFormatted,
      b.location,
      b.verifiedIntegrity ? 'Sim (CRC OK)' : 'Pendente'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['ID Backup', 'Servidor', 'Banco', 'Tipo', 'Status', 'Tamanho', 'Caminho / Bucket', 'Integridade']],
      body: backupRows,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 5. Stuck Queries & Active Locks
  if (options.includeStuckQueriesAndLocks) {
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('5. Identificação de Consultas Presas e Bloqueios Ativos', 14, currentY);
    currentY += 4;

    const stuckRows = stuckQueries.map(s => [
      s.pid.toString(),
      s.usename,
      s.datname,
      `${s.durationSeconds}s`,
      s.blocking_pid ? `PID ${s.blocking_pid}` : 'Nenhum',
      s.query.length > 50 ? s.query.substring(0, 50) + '...' : s.query
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['PID', 'Usuário', 'Database', 'Duração', 'Bloqueado por', 'SQL Executado']],
      body: stuckRows,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 18 },
        4: { cellWidth: 25 },
        5: { cellWidth: 74 }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Footer with Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`PgMonitor PostgreSQL - Página ${i} de ${pageCount}`, 14, 288);
    doc.text('Documento confidencial gerado pelo sistema de monitoramento', 130, 288);
  }

  doc.save(`Relatorio_PostgreSQL_${new Date().toISOString().slice(0,10)}.pdf`);
}
