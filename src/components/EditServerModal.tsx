import React, { useState, useEffect } from 'react';
import { ServerInstance } from '../types/serverFleet';
import { Server, X, Trash2, Save, Lock, Key, User, Eye, EyeOff, ShieldAlert } from 'lucide-react';

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
  const [formData, setFormData] = useState<Partial<ServerInstance>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (server) {
      setFormData({
        id: server.id,
        name: server.name,
        host: server.host,
        port: server.port,
        dbUser: server.dbUser || 'postgres',
        dbPassword: server.dbPassword || '',
        region: server.region,
        environment: server.environment,
        pgVersion: server.pgVersion
      });
      setDatabaseNames(server.databases.map((d) => d.datname).join(', '));
      setShowConfirmDelete(false);
      setShowPassword(false);
    }
  }, [server]);

  const [databaseNames, setDatabaseNames] = useState('');

  if (!isOpen || !server) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;

    // Parse entered database names comma-separated
    const parsedDbs = databaseNames
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newDatabases =
      parsedDbs.length > 0
        ? parsedDbs.map((datname) => {
            const existing = server.databases.find((d) => d.datname === datname);
            if (existing) return existing;
            return {
              datname,
              sizeBytes: 1024 * 1024 * 1024,
              sizeFormatted: '1.0 GB',
              activeConnections: 5,
              maxConnections: 100,
              tps: 50,
              cacheHitRatio: 99.5,
              owner: formData.dbUser || 'postgres',
              encoding: 'UTF8',
              status: 'online' as const
            };
          })
        : server.databases;

    const updated: ServerInstance = {
      ...server,
      name: formData.name || server.name,
      host: formData.host || server.host,
      port: Number(formData.port) || server.port,
      dbUser: formData.dbUser || 'postgres',
      dbPassword: formData.dbPassword || '',
      region: formData.region || server.region,
      environment: (formData.environment as ServerInstance['environment']) || server.environment,
      pgVersion: formData.pgVersion || server.pgVersion,
      totalDatabasesCount: newDatabases.length,
      databases: newDatabases
    };

    onSave(updated);
    onClose();
  };

  const handleDelete = () => {
    onDelete(server.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Server className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Configuração do Servidor</h2>
              <p className="text-xs text-slate-400 font-mono">Credenciais de conexão e identificação do cluster</p>
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
              placeholder="Ex: PostgreSQL Prod Principal (US-East)"
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
                placeholder="Ex: 192.168.1.100 ou pg.dominio.com"
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

          {/* Usuário e Senha de Login no Banco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Usuário do Banco</span>
              </label>
              <input
                type="text"
                required
                value={formData.dbUser || ''}
                onChange={(e) => setFormData({ ...formData, dbUser: e.target.value })}
                placeholder="postgres"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center space-x-1">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Senha do Banco</span>
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

          {/* Versão do PostgreSQL e Bancos Existentes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Versão do PostgreSQL
              </label>
              <input
                type="text"
                required
                value={formData.pgVersion || ''}
                onChange={(e) => setFormData({ ...formData, pgVersion: e.target.value })}
                placeholder="Ex: PostgreSQL 15.4 ou PostgreSQL 16.2"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Bancos de Dados no Servidor (separados por vírgula)
              </label>
              <input
                type="text"
                required
                value={databaseNames}
                onChange={(e) => setDatabaseNames(e.target.value)}
                placeholder="Ex: meubanco_prod, postgres"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Região e Ambiente */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Região / Datacenter</label>
              <input
                type="text"
                value={formData.region || ''}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">Ambiente / Tag</label>
              <select
                value={formData.environment || 'Produção'}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as ServerInstance['environment'] })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
              >
                <option value="Produção">Produção (PROD)</option>
                <option value="Desenvolvimento">Desenvolvimento (DEV)</option>
                <option value="Homologação">Homologação (HOMO)</option>
                <option value="Teste">Teste (TEST)</option>
              </select>
            </div>
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
                  <span>Sim, Remover</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {!showConfirmDelete && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/60 transition-all flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remover Servidor</span>
              </button>
            )}

            <div className="flex items-center space-x-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 transition-all flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configuração</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
