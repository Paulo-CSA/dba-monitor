import React, { useState } from 'react';
import { Database, Server, CheckCircle2, X, RefreshCw, Lock, Key, User, Eye, EyeOff, AlertCircle, Sparkles, Layers } from 'lucide-react';
import { DatabaseInfo } from '../types/serverFleet';

interface ConnectionSettingsModalProps {
  onClose: () => void;
  onSaveServer?: (serverData: {
    name: string;
    host: string;
    port: number;
    user: string;
    password?: string;
    database?: string;
    pgVersion?: string;
    environment?: 'Produção' | 'Desenvolvimento' | 'Homologação';
    liveDatabases?: DatabaseInfo[];
    liveQueries?: any[];
  }) => void;
}

export const ConnectionSettingsModal: React.FC<ConnectionSettingsModalProps> = ({
  onClose,
  onSaveServer
}) => {
  const [serverName, setServerName] = useState('Servidor PostgreSQL');
  const [host, setHost] = useState('192.168.1.100');
  const [port, setPort] = useState(5432);
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState<'Produção' | 'Desenvolvimento' | 'Homologação'>('Produção');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    success: boolean;
    message: string;
    pgVersion?: string;
    liveDatabases?: DatabaseInfo[];
    liveQueries?: any[];
  } | null>(null);

  const performAutoQuery = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port,
          dbUser: user,
          dbPassword: password,
          database: 'postgres'
        })
      });
      const data = await res.json();
      setIsTesting(false);

      if (data.success && data.isLive) {
        const detectedDbs: DatabaseInfo[] = data.databases || [];
        const versionStr = data.pgVersion || 'PostgreSQL';
        setTestStatus({
          success: true,
          message: `Conexão efetuada com sucesso! Versão obtida via SELECT version(): ${versionStr}. ${detectedDbs.length} banco(s) retornado(s) via SELECT datname FROM pg_database.`,
          pgVersion: versionStr,
          liveDatabases: detectedDbs,
          liveQueries: data.stuckQueries
        });
        return { success: true, pgVersion: versionStr, databases: detectedDbs, queries: data.stuckQueries };
      } else {
        const errMsg = data.message || data.error || 'Não foi possível conectar ao servidor PostgreSQL informado. Verifique Host, Porta e Credenciais.';
        setTestStatus({
          success: false,
          message: errMsg,
          liveDatabases: []
        });
        return { success: false, pgVersion: '', databases: [], queries: [] };
      }
    } catch (err) {
      setIsTesting(false);
      const errMsg = `Erro de comunicação: ${(err as Error).message}`;
      setTestStatus({
        success: false,
        message: errMsg,
        liveDatabases: []
      });
      return { success: false, pgVersion: '', databases: [], queries: [] };
    }
  };

  const handleTestClick = async () => {
    await performAutoQuery();
  };

  const handleSave = async () => {
    let versionStr = testStatus?.pgVersion;
    let databases = testStatus?.liveDatabases;
    let queries = testStatus?.liveQueries;

    if (!testStatus || (!databases && !testStatus.success)) {
      const res = await performAutoQuery();
      if (!res.success) {
        return; // Don't save if connection failed
      }
      versionStr = res.pgVersion;
      databases = res.databases;
      queries = res.queries;
    }

    if (testStatus && !testStatus.success) {
      return; // Cannot save invalid/unreachable server
    }

    const primaryDb = databases && databases.length > 0 ? databases[0].datname : 'postgres';

    if (onSaveServer) {
      onSaveServer({
        name: serverName,
        host,
        port,
        user,
        password,
        database: primaryDb,
        pgVersion: versionStr || 'PostgreSQL',
        environment,
        liveDatabases: databases || [],
        liveQueries: queries || []
      });
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Adicionar Novo Servidor PostgreSQL</h2>
              <p className="text-xs text-slate-400">Informe apenas os dados de acesso do servidor</p>
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
        <div className="p-5 space-y-4 text-xs">
          {/* Nome do Servidor */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nome do Servidor</label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Ex: Servidor Principal PostgreSQL"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Endereço IP / Host e Porta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Endereço IP / Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="Ex: 192.168.1.100 ou db.empresa.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Porta</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Usuário e Senha do Banco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Usuário do Banco</span>
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="postgres"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center space-x-1">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Senha do Banco</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Ambiente */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Ambiente</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="Produção">Produção (PROD)</option>
              <option value="Desenvolvimento">Desenvolvimento (DEV)</option>
              <option value="Homologação">Homologação (HOMO)</option>
            </select>
          </div>

          {/* Auto-Discovery Badge Info */}
          <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-800/60 space-y-1 text-[11px] text-cyan-200">
            <div className="flex items-center space-x-1.5 font-bold text-cyan-300">
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Consulta Automática de Versão e Bancos</span>
            </div>
            <p className="text-slate-300">
              A aplicação executará <code>SELECT version();</code> e consultará a tabela de sistema <code>pg_database</code> para identificar a versão exata do PostgreSQL e registrar automaticamente todos os bancos de dados do servidor.
            </p>
          </div>

          {testStatus && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{testStatus.message}</span>
              </div>

              {testStatus.pgVersion && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">Versão:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                    {testStatus.pgVersion}
                  </span>
                </div>
              )}

              {testStatus.liveDatabases && testStatus.liveDatabases.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] text-slate-400 block">Bancos Detectados no Servidor ({testStatus.liveDatabases.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {testStatus.liveDatabases.map((db, idx) => (
                      <span
                        key={db.datname}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          idx === 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {db.datname} {idx === 0 ? '(Principal)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex justify-between bg-slate-950/50">
          <button
            onClick={handleTestClick}
            disabled={isTesting}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Consultando Servidor...' : 'Testar e Consultar Bancos'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isTesting}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Salvar e Conectar
          </button>
        </div>
      </div>
    </div>
  );
};


