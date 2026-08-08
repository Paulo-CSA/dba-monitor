import React, { useState } from 'react';
import { Database, Server, CheckCircle2, X, RefreshCw, Lock, Key, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
    environment?: 'Produção' | 'Desenvolvimento' | 'Homologação' | 'Teste';
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
  const [environment, setEnvironment] = useState<'Produção' | 'Desenvolvimento' | 'Homologação' | 'Teste'>('Produção');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    success: boolean;
    message: string;
    pgVersion?: string;
    liveDatabases?: DatabaseInfo[];
    liveQueries?: any[];
  } | null>(null);

  const handleTest = async () => {
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
        setTestStatus({
          success: true,
          message: `Conectado com sucesso! Versão obtida via SELECT version(): ${data.pgVersion || 'PostgreSQL'}`,
          pgVersion: data.pgVersion,
          liveDatabases: data.databases,
          liveQueries: data.stuckQueries
        });
      } else {
        setTestStatus({
          success: false,
          message: data.message || 'Não foi possível conectar via TCP diretamente ao host informado.'
        });
      }
    } catch (err) {
      setIsTesting(false);
      setTestStatus({
        success: false,
        message: 'Erro ao tentar comunicação com o servidor.'
      });
    }
  };

  const handleSave = () => {
    if (onSaveServer) {
      const liveDbs = testStatus?.liveDatabases;
      const primaryDbName = liveDbs && liveDbs.length > 0 ? liveDbs[0].datname : 'postgres';
      const versionStr = testStatus?.pgVersion || 'PostgreSQL 16.2';

      onSaveServer({
        name: serverName,
        host,
        port,
        user,
        password,
        database: primaryDbName,
        pgVersion: versionStr,
        environment,
        liveDatabases: liveDbs,
        liveQueries: testStatus?.liveQueries
      });
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Adicionar Novo Servidor PostgreSQL</h2>
              <p className="text-xs text-slate-400">Informe os dados de conexão do servidor</p>
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
              <option value="Teste">Teste (TEST)</option>
            </select>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Identificação Automática de Versão e Bancos</span>
            </div>
            <p className="text-[11px] text-slate-400">
              A versão do PostgreSQL será obtida via <code>SELECT version();</code> e o primeiro banco de dados retornado será definido como o principal do servidor.
            </p>
          </div>

          {testStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2 font-mono ${
                testStatus.success
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              )}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex justify-between bg-slate-950/50">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão Real'}</span>
          </button>

          <button
            onClick={handleSave}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Salvar e Conectar
          </button>
        </div>
      </div>
    </div>
  );
};

