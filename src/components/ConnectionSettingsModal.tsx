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
    database: string;
    pgVersion: string;
    environment: 'Produção' | 'Desenvolvimento' | 'Homologação' | 'Teste';
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
  const [database, setDatabase] = useState('meubanco_prod');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [pgVersion, setPgVersion] = useState('PostgreSQL 16.2');
  const [environment, setEnvironment] = useState<'Produção' | 'Desenvolvimento' | 'Homologação' | 'Teste'>('Produção');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string; liveDatabases?: DatabaseInfo[]; liveQueries?: any[] } | null>(null);

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
          database
        })
      });
      const data = await res.json();
      setIsTesting(false);

      if (data.success && data.isLive) {
        if (data.pgVersion) {
          setPgVersion(data.pgVersion);
        }
        setTestStatus({
          success: true,
          message: data.message || `Conectado com sucesso! ${data.pgVersion || ''}`,
          liveDatabases: data.databases,
          liveQueries: data.stuckQueries
        });
      } else {
        setTestStatus({
          success: false,
          message: data.message || 'Sem resposta TCP direta. O servidor será configurado em modo de telemetria personalizada.'
        });
      }
    } catch (err) {
      setIsTesting(false);
      setTestStatus({
        success: false,
        message: 'Não foi possível conectar ao backend de teste.'
      });
    }
  };

  const handleSave = () => {
    if (onSaveServer) {
      onSaveServer({
        name: serverName,
        host,
        port,
        user,
        password,
        database,
        pgVersion,
        environment,
        liveDatabases: testStatus?.liveDatabases,
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
              <h2 className="text-base font-bold text-white">Configurações do Servidor PostgreSQL</h2>
              <p className="text-xs text-slate-400">IP, porta, usuário e banco de dados real</p>
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
          {/* Nome de Exibição do Servidor */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nome do Servidor para Exibição</label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Ex: Servidor Principal PostgreSQL"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Host/IP e Porta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Endereço IP / Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100 ou db.meudominio.com"
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

          {/* Usuário e Senha de Login no Banco */}
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

          {/* Banco de Dados Real e Versão */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Banco de Dados Principal (`datname`)</label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="meubanco_prod"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Versão do PostgreSQL</label>
              <input
                type="text"
                value={pgVersion}
                onChange={(e) => setPgVersion(e.target.value)}
                placeholder="Ex: PostgreSQL 15.4 ou PostgreSQL 16.2"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
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
              <span>Conexão e Telemetria de Métricas</span>
            </div>
            <p className="text-[11px] text-slate-400">
              O painel exibirá estritamente o banco de dados configurado (<code>{database}</code>) e o usuário (<code>{user}</code>).
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

