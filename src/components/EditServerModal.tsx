import React, { useState, useEffect } from 'react';
import { ServerInstance } from '../types/serverFleet';
import { Server, X, Trash2, Save, Lock, Key, User, Eye, EyeOff, ShieldAlert, Sparkles, RefreshCw, CheckCircle2, ShieldCheck, Database, AlertTriangle, ShieldOff, Shield } from 'lucide-react';

interface EditServerModalProps {
  isOpen: boolean;
  server: ServerInstance | null;
  onClose: () => void;
  onSave: (updatedServer: ServerInstance) => void;
  onDelete: (serverId: string) => void;
}

export const EditServerModal: React.FC<EditServerModalProps> = ({
  isOpen,
  server,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Partial<ServerInstance> & { database?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRequerying, setIsRequerying] = useState(false);
  const [queryResult, setQueryResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (server) {
      const defaultDb = server.engine === 'mssql' ? 'master' : (server.engine === 'mysql' ? 'mysql' : 'postgres');
      const currentDb = server.databases?.[0]?.datname || defaultDb;
      setFormData({
        id: server.id,
        name: server.name,
        host: server.host,
        port: server.port,
        engine: server.engine || 'postgres',
        authMode: server.authMode || (server.engine === 'mssql' ? 'SQL Server Authentication' : undefined),
        sslMode: server.sslMode ?? (server.ssl === false ? 'disable' : (server.ssl === true ? 'require' : 'auto')),
        ssl: server.ssl,
        dbUser: server.dbUser || 'postgres',
        dbPassword: server.dbPassword || '',
        database: currentDb,
        environment: server.environment,
        pgVersion: server.pgVersion
      });
      setShowConfirmDelete(false);
      setShowPassword(false);
      setQueryResult(null);
    }
  }, [server]);

  if (!isOpen || !server) return null;

  const handleRequeryServer = async () => {
    setIsRequerying(true);
    setQueryResult(null);
    try {
      const activeEngine = formData.engine || server.engine || 'postgres';
      const defaultDb = activeEngine === 'mssql' ? 'master' : (activeEngine === 'mysql' ? 'mysql' : 'postgres');
      const targetDb = formData.database?.trim() || defaultDb;

      const activeSslMode = formData.sslMode || (formData.ssl === false ? 'disable' : (formData.ssl === true ? 'require' : 'auto'));

      const res = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: (formData.host || server.host).trim(),
          port: Number(formData.port) || server.port,
          dbUser: (formData.dbUser || server.dbUser || 'postgres').trim(),
          dbPassword: formData.dbPassword || server.dbPassword || '',
          database: targetDb,
          engine: activeEngine,
          authMode: activeEngine === 'mssql' ? 'SQL Server Authentication' : undefined,
          sslMode: activeSslMode,
          ssl: activeSslMode === 'disable' ? false : (activeSslMode === 'require' ? true : undefined)
        })
      });
      const data = await res.json();
      setIsRequerying(false);

      if (data.success && data.isLive) {
        if (data.pgVersion || data.serverVersion) {
          setFormData((prev) => ({ ...prev, pgVersion: data.serverVersion || data.pgVersion }));
        }
        if (data.databases && data.databases.length > 0) {
          server.databases = data.databases;
          server.totalDatabasesCount = data.databases.length;
        }
        if (data.uptimeFormatted) server.uptimeFormatted = data.uptimeFormatted;
        if (data.uptimeSeconds) server.uptimeSeconds = data.uptimeSeconds;
        if (data.sharedBuffers) server.sharedBuffers = data.sharedBuffers;
        if (data.workMem) server.workMem = data.workMem;
        if (data.maintenanceWorkMem) server.maintenanceWorkMem = data.maintenanceWorkMem;
        if (data.effectiveCacheSize) server.effectiveCacheSize = data.effectiveCacheSize;
        if (data.maxConnections) server.maxConnections = data.maxConnections;
        if (data.ramTotalMb) server.ramTotalMb = data.ramTotalMb;

        setQueryResult({
          success: true,
          message: `Conectado com sucesso! Versão: ${data.serverVersion || data.pgVersion}. ${data.databases?.length || 0} banco(s) identificados.`
        });
      } else {
        setQueryResult({
          success: false,
          message: data.message || data.error || 'Falha ao conectar no servidor com estas credenciais.'
        });
      }
    } catch (err) {
      setIsRequerying(false);
      setQueryResult({
        success: false,
        message: `Erro ao tentar conectar: ${(err as Error).message}`
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;

    const activeEngine = formData.engine || server.engine || 'postgres';
    const activeSslMode = formData.sslMode || (formData.ssl === false ? 'disable' : (formData.ssl === true ? 'require' : 'auto'));

    const updated: ServerInstance = {
      ...server,
      name: formData.name || server.name,
      host: (formData.host || server.host).trim(),
      port: Number(formData.port) || server.port,
      engine: activeEngine,
      authMode: formData.authMode || (activeEngine === 'mssql' ? 'SQL Server Authentication' : undefined),
      sslMode: activeSslMode,
      ssl: activeSslMode === 'disable' ? false : (activeSslMode === 'require' ? true : undefined),
      dbUser: (formData.dbUser || 'postgres').trim(),
      dbPassword: formData.dbPassword || '',
      environment: (formData.environment as ServerInstance['environment']) || server.environment,
      pgVersion: formData.pgVersion || server.pgVersion,
      totalDatabasesCount: server.databases.length,
      databases: server.databases
    };

    onSave(updated);
    onClose();
  };

  const handleDelete = () => {
    if (server) {
      onDelete(server.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Editar Configurações do Servidor</span>
              </h2>
              <p className="text-xs text-slate-400">
                Ajuste credenciais de rede, usuário, senha e banco de dados
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome do Servidor para Exibição */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Nome do Servidor para Exibição
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: ERP Principal - Produção"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>

          {/* IP / Host e Porta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Endereço IP / Host
              </label>
              <input
                type="text"
                required
                value={formData.host || ''}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="Ex: 192.168.1.100"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Porta
              </label>
              <input
                type="number"
                required
                value={formData.port || 5432}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Banco de Dados Inicial */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Banco de Dados Inicial / Catálogo</span>
              </span>
            </label>
            <input
              type="text"
              value={formData.database || ''}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              placeholder={server.engine === 'mssql' ? 'master' : (server.engine === 'mysql' ? 'mysql' : 'postgres')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>

          {/* Configuração de SSL / Criptografia para PostgreSQL */}
          {(formData.engine || server.engine || 'postgres') === 'postgres' && (
            <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  {formData.sslMode === 'disable' ? (
                    <ShieldOff className="w-4 h-4 text-amber-400" />
                  ) : formData.sslMode === 'require' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-cyan-400" />
                  )}
                  <span>Criptografia de Conexão (SSL)</span>
                </label>

                {formData.sslMode === 'disable' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                    <ShieldOff className="w-3 h-3" />
                    <span>SSL Desativado (ssl = off)</span>
                  </span>
                ) : formData.sslMode === 'require' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>SSL Obrigatório</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    Modo Automático
                  </span>
                )}
              </div>

              {/* Botão de Toggle Direto / Card de Seleção para Desativar SSL */}
              <button
                type="button"
                onClick={() => {
                  const newMode = formData.sslMode === 'disable' ? 'auto' : 'disable';
                  setFormData({
                    ...formData,
                    sslMode: newMode,
                    ssl: newMode === 'disable' ? false : undefined
                  });
                }}
                className={`w-full p-2.5 rounded-lg border flex items-center justify-between text-left transition-all cursor-pointer ${
                  formData.sslMode === 'disable'
                    ? 'bg-amber-950/40 border-amber-600/80 text-amber-200 shadow-sm shadow-amber-950/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                    formData.sslMode === 'disable'
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'border-slate-600 bg-slate-950'
                  }`}>
                    {formData.sslMode === 'disable' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold flex items-center space-x-1.5">
                      <span>Desativar SSL (Conexão direta sem criptografia)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Conecta em modo texto puro via TCP direto. Ideal para PostgreSQL com <code>ssl = off</code> no postgresql.conf ou servidores locais.
                    </div>
                  </div>
                </div>
              </button>

              {/* Seletor granular dos 3 modos */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sslMode: 'disable', ssl: false })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    formData.sslMode === 'disable'
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Sem SSL (Desativado)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sslMode: 'auto', ssl: undefined })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    !formData.sslMode || formData.sslMode === 'auto'
                      ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Automático (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sslMode: 'require', ssl: true })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    formData.sslMode === 'require'
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Exigir SSL (Nuvem)
                </button>
              </div>
            </div>
          )}

          {/* Modo de Autenticação para MS SQL */}
          {(formData.engine || server.engine) === 'mssql' && (
            <div className="p-2.5 bg-red-950/40 rounded-xl border border-red-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-red-300">
                <ShieldCheck className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="font-semibold">Autenticação: SQL Server Authentication</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-200 border border-red-500/40">
                Login SQL + Senha
              </span>
            </div>
          )}

          {/* Usuário e Senha de Login no Banco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>{(formData.engine || server.engine) === 'mssql' ? 'Login SQL (sa/usuário)' : 'Usuário do Banco'}</span>
              </label>
              <input
                type="text"
                required
                value={formData.dbUser || ''}
                onChange={(e) => setFormData({ ...formData, dbUser: e.target.value })}
                placeholder={(formData.engine || server.engine) === 'mssql' ? 'sa' : 'postgres'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>{(formData.engine || server.engine) === 'mssql' ? 'Senha do Login SQL' : 'Senha do Banco'}</span>
                </span>
                {(formData.engine || server.engine) === 'mssql' && (
                  <span className="text-[10px] text-red-400 font-mono font-medium">*obrigatória</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.dbPassword || ''}
                  onChange={(e) => setFormData({ ...formData, dbPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
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

          {/* Versão e Bancos Consultados no Servidor */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                <span>Informações do Servidor</span>
              </span>
              <button
                type="button"
                onClick={handleRequeryServer}
                disabled={isRequerying}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRequerying ? 'animate-spin' : ''}`} />
                <span>{isRequerying ? 'Conectando...' : 'Reconsultar via SQL'}</span>
              </button>
            </div>

            {queryResult && (
              <div className={`p-2.5 rounded-lg border text-[11px] flex items-start space-x-2 ${
                queryResult.success
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                  : 'bg-red-950/40 border-red-800/80 text-red-300'
              }`}>
                {queryResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <span>{queryResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400">Versão:</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                {formData.pgVersion || server.pgVersion}
              </span>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400 block">Bancos de Dados ({server.databases.length}):</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {server.databases.map((db, idx) => (
                  <span
                    key={db.datname}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      idx === 0
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {db.datname}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Ambiente */}
          <div className="pt-2 border-t border-slate-800/60">
            <label className="block text-xs font-semibold text-slate-200 mb-1">Ambiente</label>
            <select
              value={formData.environment || 'Produção'}
              onChange={(e) => setFormData({ ...formData, environment: e.target.value as ServerInstance['environment'] })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            >
              <option value="Produção">Produção (PROD)</option>
              <option value="Desenvolvimento">Desenvolvimento (DEV)</option>
              <option value="Homologação">Homologação (HOMO)</option>
            </select>
          </div>

          {/* Confirmation Box for Delete */}
          {showConfirmDelete ? (
            <div className="bg-rose-950/80 border border-rose-600/60 p-4 rounded-xl space-y-3 text-rose-200">
              <div className="flex items-center space-x-2 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Confirmar Remoção do Servidor</span>
              </div>
              <p className="text-xs text-rose-300">
                Tem certeza que deseja remover o servidor <strong>{server.name}</strong> ({server.host}) da frota? Esta ação removerá a configuração do painel.
              </p>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, Remover Servidor</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remover Servidor</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center space-x-1.5 transition-colors shadow-lg shadow-cyan-600/20 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
