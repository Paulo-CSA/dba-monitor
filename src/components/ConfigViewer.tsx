import React, { useState } from 'react';
import { FileLocationSetting, PgSystemConfig } from '../types/config';
import { ServerInstance } from '../types/serverFleet';
import { FileText, Copy, Check, Search, Terminal, FolderCheck, HardDrive, Server, Database } from 'lucide-react';

interface ConfigViewerProps {
  config: PgSystemConfig;
  sqlQuery: string;
  server?: ServerInstance;
  databaseName?: string;
}

export const ConfigViewer: React.FC<ConfigViewerProps> = ({ config, sqlQuery, server, databaseName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(id);
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Use file locations queried directly from pg_settings (category = 'File Locations')
  const getActiveLocations = (): FileLocationSetting[] => {
    if (server?.fileLocations && server.fileLocations.length > 0) {
      return server.fileLocations;
    }

    if (config.fileLocations && config.fileLocations.length > 0) {
      return config.fileLocations;
    }

    // Dynamic default locations derived from server version and info
    const pgVer = server?.pgVersion || '14';
    const matchVer = pgVer.match(/(?:PostgreSQL\s+)?(\d+)/i);
    const verNum = matchVer ? matchVer[1] : '14';

    return [
      {
        name: 'config_file',
        setting: `/etc/postgresql/${verNum}/main/postgresql.conf`,
        category: 'File Locations',
        short_desc: `Arquivo principal de parâmetros do servidor ${server ? server.name : 'PostgreSQL'}`,
        is_writable: false,
        status: 'valid'
      },
      {
        name: 'hba_file',
        setting: `/etc/postgresql/${verNum}/main/pg_hba.conf`,
        category: 'File Locations',
        short_desc: `Regras de autenticação de cliente (HBA) do servidor ${server ? server.name : 'PostgreSQL'}`,
        is_writable: false,
        status: 'valid'
      },
      {
        name: 'ident_file',
        setting: `/etc/postgresql/${verNum}/main/pg_ident.conf`,
        category: 'File Locations',
        short_desc: 'Mapeamento de identidades de usuários do sistema operacional',
        is_writable: false,
        status: 'valid'
      },
      {
        name: 'data_directory',
        setting: `/var/lib/postgresql/${verNum}/main`,
        category: 'File Locations',
        short_desc: `Diretório de armazenamento físico dos dados (${server ? server.totalSizeFormatted : '14 GB'})`,
        is_writable: true,
        status: 'valid'
      },
      {
        name: 'external_pid_file',
        setting: `/var/run/postgresql/${verNum}-main.pid`,
        category: 'File Locations',
        short_desc: `Arquivo de identificação do processo mestre na porta ${server ? server.port : 5432}`,
        is_writable: false,
        status: 'valid'
      }
    ];
  };

  const activeLocations = getActiveLocations();

  const filteredLocations = activeLocations.filter(
    item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.setting.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.short_desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Server & PG Version Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white">{server ? server.name : 'Servidor PostgreSQL'}</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                {server?.pgVersion || config.version}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Host: <span className="text-slate-200">{server ? `${server.host}:${server.port}` : '127.0.0.1:5432'}</span> | Banco Ativo: <span className="text-emerald-400 font-bold">{databaseName || 'postgres'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Query Banner Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Consulta SQL de Localização de Arquivos</h2>
              <p className="text-xs text-slate-400">Comando PostgreSQL para consultar as rotas de sistema ativas</p>
            </div>
          </div>
          <button
            onClick={handleCopySql}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedSql ? 'Copiado SQL' : 'Copiar SQL'}</span>
          </button>
        </div>

        <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-cyan-300 flex items-center justify-between overflow-x-auto">
          <code>{sqlQuery}</code>
        </div>
      </div>

      {/* Main File Locations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <FolderCheck className="w-4 h-4 text-emerald-400" />
              <span>Arquivos de Configuração Ativos (`pg_settings`)</span>
            </h3>
            <p className="text-xs text-slate-400">Diretórios de dados, arquivos de autenticação HBA e parâmetros mestre</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por arquivo, caminho ou descrição..."
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-9 pr-4 py-2 w-full sm:w-72 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Parâmetro (pg_settings.name)</th>
                <th className="py-3 px-4">Caminho do Arquivo (setting)</th>
                <th className="py-3 px-4">Descrição do Arquivo</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredLocations.length > 0 ? (
                filteredLocations.map((item) => (
                  <tr key={item.name} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-cyan-300">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 select-all">
                      <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 inline-block">
                        {item.setting}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs">{item.short_desc}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleCopy(item.setting, item.name)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Copiar caminho para a área de transferência"
                      >
                        {copiedSetting === item.name ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    Nenhum arquivo de configuração corresponde à busca "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Engine Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Shared Buffers</span>
          <span className="text-lg font-bold font-mono text-white">{server?.sharedBuffers || config.sharedBuffersSetting}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Memória compartilhada de cache ({server?.ramTotalMb ? `Total RAM: ${Math.round(server.ramTotalMb / 1024)} GB` : 'RAM do Servidor'})</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Work Mem / Maint Work Mem</span>
          <span className="text-lg font-bold font-mono text-white">
            {server?.workMem || config.workMemSetting} / {server?.maintenanceWorkMem || config.maintenanceWorkMemSetting}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Memória por operação de ordenação e manutenção</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Effective Cache Size / WAL</span>
          <span className="text-lg font-bold font-mono text-cyan-400 uppercase">
            {server?.effectiveCacheSize || config.effectiveCacheSizeSetting} ({config.walLevelSetting})
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Estimativa de cache em disco e nível de WAL</span>
        </div>
      </div>
    </div>
  );
};
