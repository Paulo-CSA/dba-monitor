import React, { useState } from 'react';
import { ReportFilterOptions } from '../types/export';
import { ServerInstance } from '../types/serverFleet';
import { FileText, Download, X, FileSpreadsheet, Server, Database } from 'lucide-react';

interface ExportReportModalProps {
  servers?: ServerInstance[];
  initialServerId?: string;
  initialDatabaseName?: string;
  onExportCSV: (options: ReportFilterOptions) => void;
  onExportPDF: (options: ReportFilterOptions) => void;
  onClose: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  servers = [],
  initialServerId = '',
  initialDatabaseName = '',
  onExportCSV,
  onExportPDF,
  onClose
}) => {
  const [title, setTitle] = useState('Relatório Técnico de Desempenho e Integridade PostgreSQL');
  const [preparedBy, setPreparedBy] = useState('Equipe DBA / DevOps');
  const [selectedServerId, setSelectedServerId] = useState<string>(
    initialServerId || (servers[0]?.id || 'all')
  );

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  const [selectedDatabaseName, setSelectedDatabaseName] = useState<string>(
    initialDatabaseName || (selectedServer?.databases[0]?.datname || 'all')
  );

  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeFileLocs, setIncludeFileLocs] = useState(true);
  const [includeHealth, setIncludeHealth] = useState(true);
  const [includeBackups, setIncludeBackups] = useState(true);
  const [includeStuckQueries, setIncludeStuckQueries] = useState(true);
  const [notes, setNotes] = useState('Análise de métricas em tempo real e verificação de parâmetros pg_settings.');

  const buildOptions = (): ReportFilterOptions => {
    let targetServerLabel = 'Todos os Servidores da Frota';
    if (selectedServerId !== 'all' && selectedServer) {
      targetServerLabel = `${selectedServer.name} (${selectedServer.host}:${selectedServer.port})`;
    }

    let targetDbLabel = 'Todos os Bancos de Dados';
    if (selectedDatabaseName !== 'all' && selectedDatabaseName) {
      targetDbLabel = selectedDatabaseName;
    }

    return {
      reportTitle: title,
      preparedBy,
      targetServerName: targetServerLabel,
      targetDatabaseName: targetDbLabel,
      includeMetricsSummary: includeMetrics,
      includeFileLocations: includeFileLocs,
      includeHealthIntegrity: includeHealth,
      includeBackupStatus: includeBackups,
      includeStuckQueriesAndLocks: includeStuckQueries,
      includeAlertsLog: true,
      startDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      notes
    };
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Exportação de Relatórios de Monitoramento</h2>
              <p className="text-xs text-slate-400">Geração de documentos em formato PDF e planilhas CSV com seleção de escopo</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Target Server and Database Selection */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Seleção do Alvo do Relatório</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Server Select */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Servidor Alvo:</label>
                <select
                  value={selectedServerId}
                  onChange={(e) => {
                    const srvId = e.target.value;
                    setSelectedServerId(srvId);
                    const srv = servers.find((s) => s.id === srvId);
                    if (srv && srv.databases.length > 0) {
                      setSelectedDatabaseName(srv.databases[0].datname);
                    } else {
                      setSelectedDatabaseName('all');
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="all">Todos os Servidores (Geral)</option>
                  {servers.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      [{srv.environment}] {srv.name} ({srv.host})
                    </option>
                  ))}
                </select>
              </div>

              {/* Database Select */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Banco de Dados Alvo:</label>
                <select
                  value={selectedDatabaseName}
                  onChange={(e) => setSelectedDatabaseName(e.target.value)}
                  disabled={selectedServerId === 'all'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="all">Todos os Bancos do Servidor</option>
                  {selectedServer?.databases.map((db) => (
                    <option key={db.datname} value={db.datname}>
                      {db.datname} ({db.sizeFormatted})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Título do Relatório</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Responsável / Supervisor DBA</label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-2">Seções Incluídas no Documento</label>
            <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetrics}
                  onChange={(e) => setIncludeMetrics(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Métricas de CPU e Latência em Tempo Real</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFileLocs}
                  onChange={(e) => setIncludeFileLocs(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Localização dos Arquivos de Configuração (`pg_settings`)</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHealth}
                  onChange={(e) => setIncludeHealth(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Saúde, Integridade e Bloat de Tabelas</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBackups}
                  onChange={(e) => setIncludeBackups(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Informações e Registros de Backup</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStuckQueries}
                  onChange={(e) => setIncludeStuckQueries(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Consultas Presas e Lock de Tabelas</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Notas Adicionais / Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 border-t border-slate-800 grid grid-cols-2 gap-3 bg-slate-950/50">
          <button
            onClick={() => onExportCSV(buildOptions())}
            className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Baixar Planilha CSV</span>
          </button>

          <button
            onClick={() => onExportPDF(buildOptions())}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Relatório PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

