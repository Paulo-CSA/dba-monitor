import React, { useState } from 'react';
import { Database, Server, CheckCircle2, X, RefreshCw, Lock, Key, User, Eye, EyeOff, AlertCircle, Sparkles, Layers, ShieldCheck, AlertTriangle, HelpCircle, ShieldOff, Shield, Link2, Terminal, Check } from 'lucide-react';
import { DatabaseInfo, TableSizeInfo } from '../types/serverFleet';
import { FileLocationSetting } from '../types/config';
import { DATABASE_ENGINES, DatabaseEngineType } from '../types/databaseEngines';
import { parseConnectionInput, isPrivateOrLocalHost } from '../utils/connectionParser';

interface ConnectionSettingsModalProps {
  onClose: () => void;
  onSaveServer?: (serverData: {
    name: string;
    host: string;
    port: number;
    user: string;
    password?: string;
    database?: string;
    engine?: DatabaseEngineType;
    authMode?: string;
    sslMode?: 'disable' | 'auto' | 'require';
    ssl?: boolean;
    pgVersion?: string;
    uptimeFormatted?: string;
    uptimeSeconds?: number;
    sharedBuffers?: string;
    workMem?: string;
    maintenanceWorkMem?: string;
    effectiveCacheSize?: string;
    maxConnections?: number;
    ramTotalMb?: number;
    environment?: 'Produção' | 'Desenvolvimento' | 'Homologação';
    liveDatabases?: DatabaseInfo[];
    liveQueries?: any[];
    liveFileLocations?: FileLocationSetting[];
    liveTopTables?: TableSizeInfo[];
  }) => void;
}

export const ConnectionSettingsModal: React.FC<ConnectionSettingsModalProps> = ({
  onClose,
  onSaveServer
}) => {
  const [engine, setEngine] = useState<DatabaseEngineType>('postgres');
  const [authMode, setAuthMode] = useState<string>('Nativa (SCRAM-SHA-256 / MD5)');
  const [serverName, setServerName] = useState('Servidor PostgreSQL');
  const [host, setHost] = useState('192.168.1.100');
  const [port, setPort] = useState(5432);
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('postgres');
  const [sslMode, setSslMode] = useState<'auto' | 'disable' | 'require'>('auto');
  const [environment, setEnvironment] = useState<'Produção' | 'Desenvolvimento' | 'Homologação'>('Produção');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [dbeaverInput, setDbeaverInput] = useState('');
  const [showDbeaverBox, setShowDbeaverBox] = useState(false);
  const [dbeaverNotice, setDbeaverNotice] = useState<string | null>(null);
  const [showNetworkTip, setShowNetworkTip] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    success: boolean;
    message: string;
    errorDetail?: string;
    pgVersion?: string;
    uptimeFormatted?: string;
    uptimeSeconds?: number;
    sharedBuffers?: string;
    workMem?: string;
    maintenanceWorkMem?: string;
    effectiveCacheSize?: string;
    maxConnections?: number;
    ramTotalMb?: number;
    liveDatabases?: DatabaseInfo[];
    liveQueries?: any[];
    liveFileLocations?: FileLocationSetting[];
    liveTopTables?: TableSizeInfo[];
  } | null>(null);

  const handleApplyDbeaverUrl = () => {
    if (!dbeaverInput.trim()) return;
    const parsed = parseConnectionInput(dbeaverInput.trim(), engine, port);

    setHost(parsed.host);
    if (parsed.port) setPort(parsed.port);
    if (parsed.database) setDatabase(parsed.database);
    if (parsed.user) setUser(parsed.user);
    if (parsed.password) setPassword(parsed.password);
    if (parsed.sslMode) setSslMode(parsed.sslMode);

    setDbeaverNotice(`Dados extraídos com sucesso! Host '${parsed.host}', Porta ${parsed.port}${parsed.database ? `, Banco '${parsed.database}'` : ''}${parsed.user ? `, Usuário '${parsed.user}'` : ''}`);
    setShowDbeaverBox(false);
    setTimeout(() => setDbeaverNotice(null), 8000);
  };

  const handleHostChange = (val: string) => {
    if (val.includes('jdbc:') || val.includes('://') || (val.includes('/') && val.length > 5)) {
      const parsed = parseConnectionInput(val, engine, port);
      setHost(parsed.host);
      if (parsed.port) setPort(parsed.port);
      if (parsed.database) setDatabase(parsed.database);
      if (parsed.user) setUser(parsed.user);
      if (parsed.password) setPassword(parsed.password);
      if (parsed.sslMode) setSslMode(parsed.sslMode);

      setDbeaverNotice(`URL do DBeaver/JDBC detectada e decomposta! (Host: ${parsed.host}:${parsed.port}${parsed.database ? ' / ' + parsed.database : ''})`);
      setTimeout(() => setDbeaverNotice(null), 8000);
      return;
    }
    setHost(val);
  };

  const handleEngineChange = (selectedEngine: DatabaseEngineType) => {
    setEngine(selectedEngine);
    setTestStatus(null);
    const meta = DATABASE_ENGINES[selectedEngine];
    setPort(meta.defaultPort);
    setUser(meta.defaultUser);
    setAuthMode(meta.defaultAuthMode);

    const defaultDb = selectedEngine === 'mssql' ? 'master' : (selectedEngine === 'mysql' ? 'mysql' : 'postgres');
    setDatabase(defaultDb);

    // Update server name if it's currently a default
    if (serverName === 'Servidor PostgreSQL' || serverName === 'Servidor MySQL' || serverName === 'Servidor Microsoft SQL Server' || !serverName) {
      setServerName(`Servidor ${meta.name}`);
    }
  };

  const performAutoQuery = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const targetDb = database.trim() || (engine === 'mssql' ? 'master' : (engine === 'mysql' ? 'mysql' : 'postgres'));
      const activeSsl = sslMode === 'disable' ? false : (sslMode === 'require' ? true : undefined);
      const res = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port,
          dbUser: user.trim(),
          dbPassword: password,
          database: targetDb,
          engine,
          authMode: engine === 'mssql' ? 'SQL Server Authentication' : authMode,
          sslMode: engine === 'postgres' ? sslMode : undefined,
          ssl: engine === 'postgres' ? activeSsl : undefined
        })
      });
      const data = await res.json();
      setIsTesting(false);

      if (data.success && data.isLive) {
        const detectedVersion = data.serverVersion || data.pgVersion || DATABASE_ENGINES[engine].name;
        const detectedDbs = data.databases || [];
        const fileLocs = data.sysConfig?.fileLocations || [];

        setTestStatus({
          success: true,
          message: data.message || `Conectado com sucesso ao ${DATABASE_ENGINES[engine].name}!`,
          pgVersion: detectedVersion,
          uptimeFormatted: data.uptimeFormatted,
          uptimeSeconds: data.uptimeSeconds,
          sharedBuffers: data.sharedBuffers,
          workMem: data.workMem,
          maintenanceWorkMem: data.maintenanceWorkMem,
          effectiveCacheSize: data.effectiveCacheSize,
          maxConnections: data.maxConnections,
          ramTotalMb: data.ramTotalMb,
          liveDatabases: detectedDbs,
          liveQueries: data.stuckQueries,
          liveFileLocations: fileLocs,
          liveTopTables: data.topTables
        });

        return {
          success: true,
          pgVersion: detectedVersion,
          uptimeFormatted: data.uptimeFormatted,
          uptimeSeconds: data.uptimeSeconds,
          sharedBuffers: data.sharedBuffers,
          workMem: data.workMem,
          maintenanceWorkMem: data.maintenanceWorkMem,
          effectiveCacheSize: data.effectiveCacheSize,
          maxConnections: data.maxConnections,
          ramTotalMb: data.ramTotalMb,
          databases: detectedDbs,
          queries: data.stuckQueries,
          fileLocations: fileLocs,
          topTables: data.topTables
        };
      } else {
        const errMsg = data.message || data.error || `Não foi possível conectar ao servidor ${DATABASE_ENGINES[engine].name} informado. Verifique Host, Porta, Login e Senha.`;
        setTestStatus({
          success: false,
          message: errMsg,
          errorDetail: data.error,
          liveDatabases: []
        });
        return { success: false, pgVersion: '', databases: [], queries: [], fileLocations: [] };
      }
    } catch (err) {
      setIsTesting(false);
      const errMsg = `Erro de comunicação com o backend da aplicação: ${(err as Error).message}`;
      setTestStatus({
        success: false,
        message: errMsg,
        liveDatabases: []
      });
      return { success: false, pgVersion: '', databases: [], queries: [], fileLocations: [] };
    }
  };

  const handleTestClick = async () => {
    await performAutoQuery();
  };

  const handleSave = async (forceSave = false) => {
    let versionStr = testStatus?.pgVersion;
    let databases = testStatus?.liveDatabases;
    let queries = testStatus?.liveQueries;
    let fileLocations = testStatus?.liveFileLocations;
    let topTables = testStatus?.liveTopTables;
    let uptimeFormatted = testStatus?.uptimeFormatted;
    let uptimeSeconds = testStatus?.uptimeSeconds;
    let sharedBuffers = testStatus?.sharedBuffers;
    let workMem = testStatus?.workMem;
    let maintenanceWorkMem = testStatus?.maintenanceWorkMem;
    let effectiveCacheSize = testStatus?.effectiveCacheSize;
    let maxConnections = testStatus?.maxConnections;
    let ramTotalMb = testStatus?.ramTotalMb;

    if (!forceSave) {
      if (!testStatus || (!databases && !testStatus.success)) {
        const res = await performAutoQuery();
        if (!res.success) {
          return; // Show error and wait for user to fix or force
        }
        versionStr = res.pgVersion;
        databases = res.databases;
        queries = res.queries;
        fileLocations = res.fileLocations;
        topTables = res.topTables;
        uptimeFormatted = res.uptimeFormatted;
        uptimeSeconds = res.uptimeSeconds;
        sharedBuffers = res.sharedBuffers;
        workMem = res.workMem;
        maintenanceWorkMem = res.maintenanceWorkMem;
        effectiveCacheSize = res.effectiveCacheSize;
        maxConnections = res.maxConnections;
        ramTotalMb = res.ramTotalMb;
      }

      if (testStatus && !testStatus.success) {
        return;
      }
    }

    const defaultDb = engine === 'mssql' ? 'master' : (engine === 'mysql' ? 'mysql' : 'postgres');
    const primaryDb = database.trim() || (databases && databases.length > 0 ? databases[0].datname : defaultDb);

    if (onSaveServer) {
      onSaveServer({
        name: serverName,
        host: host.trim(),
        port,
        user: user.trim(),
        password,
        database: primaryDb,
        engine,
        authMode: engine === 'mssql' ? 'SQL Server Authentication' : authMode,
        sslMode: engine === 'postgres' ? sslMode : undefined,
        ssl: engine === 'postgres' ? (sslMode === 'disable' ? false : (sslMode === 'require' ? true : undefined)) : undefined,
        pgVersion: versionStr || DATABASE_ENGINES[engine].name,
        uptimeFormatted,
        uptimeSeconds,
        sharedBuffers,
        workMem,
        maintenanceWorkMem,
        effectiveCacheSize,
        maxConnections,
        ramTotalMb,
        environment,
        liveDatabases: databases || [],
        liveQueries: queries || [],
        liveFileLocations: fileLocations || [],
        liveTopTables: topTables || []
      });
    } else {
      onClose();
    }
  };

  const selectedEngineMeta = DATABASE_ENGINES[engine];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Adicionar Novo Servidor de Banco</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${selectedEngineMeta.badgeBg} ${selectedEngineMeta.badgeBorder} ${selectedEngineMeta.badgeText}`}>
                  {selectedEngineMeta.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure a conexão com seu servidor PostgreSQL, MySQL ou MS SQL Server na rede local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Area */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Seletor de Mecanismo (Engine) */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-semibold flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mecanismo do Banco de Dados (SGBD)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DATABASE_ENGINES) as DatabaseEngineType[]).map((engKey) => {
                const item = DATABASE_ENGINES[engKey];
                const isSelected = engine === engKey;
                return (
                  <button
                    key={engKey}
                    type="button"
                    onClick={() => handleEngineChange(engKey)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/40'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs">{item.name}</span>
                      <span className="text-[10px] font-mono opacity-80">:{item.defaultPort}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight line-clamp-1">{item.authDescription}</span>
                  </button>
                );
              })}
            </div>
          </div>

          

         

          {/* Nome de Identificação do Servidor */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center space-x-1">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nome Amigável do Servidor</span>
            </label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Ex: ERP Principal - Produção"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* DBeaver JDBC Quick Importer */}
          <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Link2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-200">Importar / Colar URL do DBeaver</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDbeaverBox(!showDbeaverBox)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium"
              >
                {showDbeaverBox ? 'Ocultar' : 'Colar URL do DBeaver'}
              </button>
            </div>

            {showDbeaverBox && (
              <div className="mt-2.5 space-y-2">
                <p className="text-[11px] text-slate-400">
                  Cole a URL copiada do DBeaver (ex: <code className="text-cyan-300 font-mono">jdbc:postgresql://ip_do_servidor:5432/nomedobanco</code>). A aplicação preenche automaticamente Host, Porta, Banco e Usuário.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={dbeaverInput}
                    onChange={(e) => setDbeaverInput(e.target.value)}
                    placeholder="jdbc:postgresql://192.168.1.100:5432/meubanco"
                    className="flex-1 bg-slate-950 border border-cyan-800/60 rounded-lg px-3 py-1.5 text-xs text-cyan-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDbeaverUrl}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aplicar</span>
                  </button>
                </div>
              </div>
            )}

            {dbeaverNotice && (
              <div className="mt-2 flex items-center space-x-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-2.5 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{dbeaverNotice}</span>
              </div>
            )}
          </div>

          {/* Host & Porta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">
                <span>Endereço Host / IP da Máquina</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => handleHostChange(e.target.value)}
                placeholder={engine === 'mssql' ? '192.168.1.100 ou 192.168.1.100\\SQLEXPRESS' : '192.168.1.100 ou jdbc:postgresql://...'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {engine === 'mssql' ? 'IP da máquina na rede. Instâncias nomeadas (ex: \\SQLEXPRESS) são tratadas automaticamente.' : 'IP do servidor ou URL JDBC do DBeaver.'}
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Porta</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                Padrão: {selectedEngineMeta.defaultPort}
              </span>
            </div>
          </div>

          {/* Diagnóstico de Rede Privada / Local vs Nuvem */}
          {isPrivateOrLocalHost(host) && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs space-y-2">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">
                    Por que conecta pelo DBeaver e não pela aplicação?
                  </span>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    O host informado (<code className="text-amber-200 font-mono font-semibold">{host}</code>) é um endereço de <strong>rede local/privada</strong> (LAN/VPN/localhost). O DBeaver conecta perfeitamente porque ele roda instalado diretamente no seu computador físico dentro dessa mesma rede.
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Porém, esta aplicação web está rodando em um servidor em nuvem (Google Cloud Run), que não tem acesso à rede interna da sua empresa/casa sem um IP público ou túnel TCP.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-900/40 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Como liberar acesso ao seu banco de dados:</span>
                <button
                  type="button"
                  onClick={() => setShowNetworkTip(!showNetworkTip)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium flex items-center space-x-1"
                >
                  <Terminal className="w-3 h-3" />
                  <span>{showNetworkTip ? 'Ocultar Guia' : 'Ver 3 Soluções Rápidas'}</span>
                </button>
              </div>

              {showNetworkTip && (
                <div className="mt-2 p-3 bg-slate-950/95 rounded-lg border border-amber-900/40 text-[11px] text-slate-300 space-y-2.5">
                  <div>
                    <span className="font-semibold text-amber-300">Opção 1: Túnel Instantâneo com ngrok (30 segundos, grátis)</span>
                    <p className="text-slate-400 mt-0.5">
                      Na máquina onde o PostgreSQL está rodando, abra o terminal e digite:
                    </p>
                    <code className="block my-1 bg-black/80 px-2.5 py-1.5 rounded text-amber-300 font-mono">
                      ngrok tcp {port || 5432}
                    </code>
                    <p className="text-slate-400">
                      O ngrok exibirá um endereço público como <span className="text-cyan-300 font-mono">0.tcp.ngrok.io:12345</span>. Basta colocar <span className="text-cyan-300 font-mono">0.tcp.ngrok.io</span> no Host e <span className="text-cyan-300 font-mono">12345</span> na Porta!
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="font-semibold text-amber-300">Opção 2: IP Público com Redirecionamento de Porta (Port Forwarding)</span>
                    <p className="text-slate-400 mt-0.5">
                      No roteador da sua rede, configure o redirecionamento da porta {port || 5432} para o IP interno {host}, e informe o IP público da sua internet neste formulário.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="font-semibold text-amber-300">Opção 3: Executar a aplicação localmente</span>
                    <p className="text-slate-400 mt-0.5">
                      Você pode baixar o código ou clonar o projeto e rodar localmente no seu computador com <span className="text-cyan-300 font-mono">npm install && npm run dev</span>. Rodando localmente, a aplicação terá o mesmo acesso que o DBeaver.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Banco de Dados Inicial */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Banco de Dados Inicial / Catálogo</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {engine === 'mssql' ? 'master ou nome do banco' : (engine === 'mysql' ? 'mysql ou seu banco' : 'postgres ou seu banco')}
              </span>
            </label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder={engine === 'mssql' ? 'master' : (engine === 'mysql' ? 'mysql' : 'postgres')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Caso seu usuário não tenha permissão de acesso a <code className="text-cyan-400 font-mono">{engine === 'mssql' ? 'master' : (engine === 'mysql' ? 'mysql' : 'postgres')}</code>, informe aqui o nome exato do banco que você configurou no DBeaver.
            </span>
          </div>

          {/* Configuração de SSL / Criptografia para PostgreSQL */}
          {engine === 'postgres' && (
            <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  {sslMode === 'disable' ? (
                    <ShieldOff className="w-4 h-4 text-amber-400" />
                  ) : sslMode === 'require' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-cyan-400" />
                  )}
                  <span>Criptografia de Conexão (SSL)</span>
                </label>

                {sslMode === 'disable' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                    <ShieldOff className="w-3 h-3" />
                    <span>SSL Desativado (ssl = off)</span>
                  </span>
                ) : sslMode === 'require' ? (
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

              {/* Botão de Toggle Direto para Desativar SSL */}
              <button
                type="button"
                onClick={() => setSslMode(sslMode === 'disable' ? 'auto' : 'disable')}
                className={`w-full p-2.5 rounded-lg border flex items-center justify-between text-left transition-all cursor-pointer ${
                  sslMode === 'disable'
                    ? 'bg-amber-950/40 border-amber-600/80 text-amber-200 shadow-sm shadow-amber-950/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                    sslMode === 'disable'
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'border-slate-600 bg-slate-950'
                  }`}>
                    {sslMode === 'disable' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold flex items-center space-x-1.5">
                      <span>Desativar SSL (Conexão direta sem criptografia)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Conecta diretamente via TCP sem SSLRequest. Use se o PostgreSQL estiver configurado com <code>ssl = off</code> no postgresql.conf.
                    </div>
                  </div>
                </div>
              </button>

              {/* Seletor granular dos 3 modos */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSslMode('disable')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    sslMode === 'disable'
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Sem SSL (Desativado)
                </button>
                <button
                  type="button"
                  onClick={() => setSslMode('auto')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    sslMode === 'auto'
                      ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Automático (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => setSslMode('require')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    sslMode === 'require'
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  Exigir SSL (Nuvem)
                </button>
              </div>
            </div>
          )}

         

          {/* Usuário e Senha do Banco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>{engine === 'mssql' ? 'Login SQL (Usuário)' : 'Usuário do Banco'}</span>
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder={engine === 'mssql' ? 'sa' : (engine === 'mysql' ? 'root' : 'postgres')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>{engine === 'mssql' ? 'Senha do Login SQL' : 'Senha do Banco'}</span>
                </span>
                {engine === 'mssql' && (
                  <span className="text-[10px] text-red-400 font-mono font-medium">*obrigatória</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={engine === 'mssql' ? 'Senha do login SQL' : '••••••••'}
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
              <span>Consulta Automática de Versão e Bancos ({selectedEngineMeta.name})</span>
            </div>
            <p className="text-slate-300">
              Ao testar, a aplicação executará <code className="text-cyan-300 font-mono">{selectedEngineMeta.defaultVersionQuery}</code> e consultará o catálogo <code className="text-cyan-300 font-mono">{selectedEngineMeta.databasesCatalogQuery}</code> para mapear métricas e bancos automaticamente.
            </p>
          </div>

          {/* Status do Teste de Conexão */}
          {testStatus && (
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${
              testStatus.success
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                : 'bg-red-950/40 border-red-800/80 text-red-200'
            }`}>
              <div className="flex items-start space-x-2 text-xs font-mono">
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <span className="font-bold block">{testStatus.message}</span>
                  {!testStatus.success && (
                    <div className="p-2.5 bg-slate-950/80 border border-red-900/50 rounded-lg text-[11px] text-slate-300 space-y-1.5">
                      <span className="font-bold text-red-300 block">Checklist de verificação na rede local:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400">
                        <li><strong>Host/IP:</strong> Confirme se o IP <code className="text-cyan-300 font-mono">{host}</code> é o IP do servidor onde o banco está instalado (não use <code className="text-slate-300 font-mono">localhost</code> caso o aplicativo e o banco estejam em máquinas diferentes).</li>
                        <li><strong>Porta:</strong> Confirme se a porta <code className="text-cyan-300 font-mono">{port}</code> está correta e liberada no Firewall do Windows/Linux.</li>
                        <li><strong>Banco de Dados:</strong> O usuário <code className="text-cyan-300 font-mono">{user}</code> tem acesso ao banco <code className="text-cyan-300 font-mono">{database}</code>? No DBeaver, verifique se você conectou a um banco específico.</li>
                        {engine === 'mssql' && (
                          <li><strong>SQL Server:</strong> No SQL Server Configuration Manager, certifique-se de que o protocolo <strong>TCP/IP</strong> está Habilitado e o serviço <strong>SQL Server Browser</strong> ativo caso utilize instância nomeada (ex: SQLEXPRESS).</li>
                        )}
                        {engine === 'postgres' && (
                          <li><strong>PostgreSQL:</strong> Verifique se o <code className="text-slate-300 font-mono">postgresql.conf</code> possui <code className="text-slate-300 font-mono">listen_addresses = '*'</code> e se o <code className="text-slate-300 font-mono">pg_hba.conf</code> tem regra permitindo o IP da aplicação.</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {testStatus.success && testStatus.pgVersion && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-800/60">
                  <span className="text-[11px] text-emerald-300">Versão:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    {testStatus.pgVersion}
                  </span>
                </div>
              )}

              {testStatus.success && testStatus.liveDatabases && testStatus.liveDatabases.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-emerald-800/60">
                  <span className="text-[11px] text-emerald-300 block">Bancos Detectados no Servidor ({testStatus.liveDatabases.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {testStatus.liveDatabases.map((db, idx) => (
                      <span
                        key={db.datname}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          idx === 0
                            ? 'bg-emerald-900 text-emerald-200 border border-emerald-700'
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
        <div className="p-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
          <button
            onClick={handleTestClick}
            disabled={isTesting}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testando Conexão...' : 'Testar e Consultar Bancos'}</span>
          </button>

          <div className="flex items-center space-x-2">
            {testStatus && !testStatus.success && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                title="Salva as credenciais no painel mesmo que o teste de rede tenha falhado no momento"
              >
                Salvar Mesmo Assim
              </button>
            )}

            <button
              onClick={() => handleSave(false)}
              disabled={isTesting}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Salvar e Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
