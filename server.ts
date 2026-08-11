import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { metricsEngineSingleton } from './src/services/metricsEngine';
import { configServiceSingleton } from './src/services/configService';
import { healthServiceSingleton } from './src/services/healthService';
import { lockAnalyzerSingleton } from './src/services/lockAnalyzer';
import { backupMonitorSingleton } from './src/services/backupMonitor';
import { alertEngineSingleton } from './src/services/alertEngine';
import { mockServerFleet } from './src/services/fleetService';
import pg from 'pg';
import { testAndFetchLivePgData, fetchLiveConnectionsForDb } from './src/services/pgLiveService';
import { ServerInstance } from './src/types/serverFleet';

const SERVERS_PERSISTENCE_FILE = path.join(process.cwd(), 'data', 'servers.json');

function loadServersFromDisk(): ServerInstance[] {
  try {
    if (fs.existsSync(SERVERS_PERSISTENCE_FILE)) {
      const data = fs.readFileSync(SERVERS_PERSISTENCE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading servers.json:', err);
  }
  return mockServerFleet;
}

function saveServersToDisk(servers: ServerInstance[]) {
  try {
    const dir = path.dirname(SERVERS_PERSISTENCE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SERVERS_PERSISTENCE_FILE, JSON.stringify(servers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving servers.json:', err);
  }
}

let activeServersStore: ServerInstance[] = loadServersFromDisk();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini Client server-side
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  // API Routes

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Test connection to live PostgreSQL database endpoint
  app.post('/api/db/test-connection', async (req, res) => {
    const { host, port, dbUser, dbPassword, database } = req.body;
    const result = await testAndFetchLivePgData({
      host,
      port: Number(port) || 5432,
      dbUser,
      dbPassword,
      database
    });
    res.json(result);
  });

  // Fleet overview of servers and databases (Observability Mode)
  app.get('/api/db/servers', (req, res) => {
    res.json({
      observabilityMode: true,
      servers: activeServersStore
    });
  });

  // Save new server instance (persisted)
  app.post('/api/db/servers', (req, res) => {
    const newServer: ServerInstance = req.body;
    if (!newServer.id) {
      newServer.id = `srv-${Date.now().toString().slice(-4)}`;
    }
    // Remove if duplicate id
    activeServersStore = activeServersStore.filter((s) => s.id !== newServer.id);
    activeServersStore.push(newServer);
    saveServersToDisk(activeServersStore);
    res.json({ success: true, server: newServer, servers: activeServersStore });
  });

  // Update server instance (persisted)
  app.put('/api/db/servers/:id', (req, res) => {
    const { id } = req.params;
    const updated: ServerInstance = req.body;
    activeServersStore = activeServersStore.map((s) => (s.id === id ? { ...s, ...updated } : s));
    saveServersToDisk(activeServersStore);
    res.json({ success: true, servers: activeServersStore });
  });

  // Delete server instance (persisted)
  app.delete('/api/db/servers/:id', (req, res) => {
    const { id } = req.params;
    activeServersStore = activeServersStore.filter((s) => s.id !== id);
    saveServersToDisk(activeServersStore);
    res.json({ success: true, servers: activeServersStore });
  });

  // Realtime metrics route
  app.get('/api/db/metrics', (req, res) => {
    const data = metricsEngineSingleton.tickNextMetrics();
    const activeAlerts = alertEngineSingleton.evaluateMetrics(
      data,
      lockAnalyzerSingleton.getLocksAndQueries().stuckQueries.length
    );
    res.json({
      metrics: data,
      alerts: activeAlerts,
      isLoadSpike: metricsEngineSingleton.getIsLoadSpike()
    });
  });

  // Toggle load spike simulation
  app.post('/api/db/metrics/simulate-spike', (req, res) => {
    const { active } = req.body;
    metricsEngineSingleton.setLoadSpike(!!active);
    res.json({ success: true, isLoadSpike: metricsEngineSingleton.getIsLoadSpike() });
  });

  // Database configuration & File locations (SELECT name, setting FROM pg_settings WHERE category = 'File Locations')
  app.get('/api/db/config', (req, res) => {
    const { serverId } = req.query;
    const sysConfig = configServiceSingleton.getSystemConfig();
    const query = configServiceSingleton.getFileLocationsSqlQuery();

    if (serverId && typeof serverId === 'string') {
      const server = activeServersStore.find((s) => s.id === serverId);
      if (server && server.fileLocations && server.fileLocations.length > 0) {
        res.json({
          config: {
            ...sysConfig,
            version: server.pgVersion || sysConfig.version,
            fileLocations: server.fileLocations
          },
          sqlQuery: query
        });
        return;
      }
    }

    res.json({ config: sysConfig, sqlQuery: query });
  });

  // Database integrity and health check
  app.get('/api/db/integrity', (req, res) => {
    const integrity = healthServiceSingleton.getIntegrityOverview();
    res.json(integrity);
  });

  // Run on-demand integrity scan
  app.post('/api/db/integrity/scan', (req, res) => {
    const updated = healthServiceSingleton.runFullIntegrityScan();
    res.json(updated);
  });

  // Active locks & stuck queries (pg_stat_activity & pg_locks)
  app.get('/api/db/locks', (req, res) => {
    const locksData = lockAnalyzerSingleton.getLocksAndQueries();
    res.json(locksData);
  });

  // Fetch live active connections specifically for a database
  app.post('/api/db/fetch-live-connections', async (req, res) => {
    const { host, port, dbUser, dbPassword, database, serverId } = req.body;
    
    let targetHost = host;
    let targetPort = port;
    let targetUser = dbUser;
    let targetPassword = dbPassword;

    if (serverId && typeof serverId === 'string') {
      const foundSrv = activeServersStore.find((s) => s.id === serverId);
      if (foundSrv) {
        targetHost = targetHost || foundSrv.host;
        targetPort = targetPort || foundSrv.port;
        targetUser = targetUser || foundSrv.dbUser;
        targetPassword = targetPassword || foundSrv.dbPassword;
      }
    }

    const result = await fetchLiveConnectionsForDb({
      host: targetHost,
      port: Number(targetPort) || 5432,
      dbUser: targetUser,
      dbPassword: targetPassword,
      database
    });

    if (result.success && result.databases && serverId) {
      activeServersStore = activeServersStore.map((srv) => {
        if (srv.id === serverId) {
          return {
            ...srv,
            databases: result.databases || srv.databases,
            totalDatabasesCount: result.databases ? result.databases.length : srv.totalDatabasesCount,
            pgVersion: result.pgVersion || srv.pgVersion,
            uptimeFormatted: result.uptimeFormatted || srv.uptimeFormatted,
            uptimeSeconds: result.uptimeSeconds ?? srv.uptimeSeconds
          };
        }
        return srv;
      });
      saveServersToDisk(activeServersStore);
    }

    res.json(result);
  });

  // Kill stuck backend session (SELECT pg_terminate_backend(pid))
  app.post('/api/db/kill-pid', async (req, res) => {
    const { pid, host, port, dbUser, dbPassword, database } = req.body;
    if (!pid || typeof pid !== 'number') {
      res.status(400).json({ success: false, message: 'PID numérico inválido.' });
      return;
    }

    // Try live pg termination if external host provided
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      const client = new pg.Client({
        host,
        port: Number(port) || 5432,
        user: dbUser || 'postgres',
        password: dbPassword || '',
        database: database || 'postgres',
        connectionTimeoutMillis: 3500
      });

      try {
        await client.connect();
        await client.query(`SELECT pg_terminate_backend($1);`, [pid]);
        await client.end();
        lockAnalyzerSingleton.killBackendPid(pid);
        res.json({
          success: true,
          message: `Comando SELECT pg_terminate_backend(${pid}) executado no banco ${database || 'postgres'}. Sessão encerrada.`
        });
        return;
      } catch (err) {
        try { await client.end(); } catch {}
        console.error('Error executing pg_terminate_backend on live server:', err);
      }
    }

    const result = lockAnalyzerSingleton.killBackendPid(pid);
    res.json(result);
  });

  // Backup status & history
  app.get('/api/db/backups', (req, res) => {
    const backupData = backupMonitorSingleton.getBackupOverview();
    res.json(backupData);
  });

  // Trigger manual backup with custom path
  app.post('/api/db/backups/trigger', (req, res) => {
    const {
      type,
      location,
      serverId,
      serverName,
      serverHost,
      databaseName,
      targetLocationType,
      sshUser,
      sshPassword,
      sshHost,
      sshPort
    } = req.body;

    const backupType = type === 'pg_dump' ? 'pg_dump' : 'pg_basebackup';
    const newEntry = backupMonitorSingleton.triggerManualBackup({
      type: backupType,
      customPath: location,
      serverId,
      serverName,
      serverHost,
      databaseName,
      targetLocationType: targetLocationType === 'remote' ? 'remote' : 'local',
      sshUser,
      sshPassword,
      sshHost: sshHost || serverHost,
      sshPort: Number(sshPort) || 22
    });
    res.json({ success: true, entry: newEntry });
  });

  // Delete individual backup entry log
  app.delete('/api/db/backups/:id', (req, res) => {
    const { id } = req.params;
    const success = backupMonitorSingleton.deleteBackupEntry(id);
    res.json({ success });
  });

  // Clear all backup logs
  app.delete('/api/db/backups', (req, res) => {
    backupMonitorSingleton.clearAllBackups();
    res.json({ success: true });
  });

  // Execute SSH transfer command directly on server
  app.post('/api/db/backups/transfer-ssh', (req, res) => {
    try {
      const { backupId, location, sshHost, sshUser, sshPassword, sshPort } = req.body || {};

      if (!location) {
        res.status(400).json({ success: false, error: 'Caminho do arquivo de backup não informado.' });
        return;
      }

      const host = sshHost || '192.168.10.113';
      const user = sshUser || 'debian';
      const pass = sshPassword || '';
      const portNum = Number(sshPort) || 22;

      const parts = location.split('/');
      if (parts.length > 1) {
        parts.pop();
      }
      const targetDir = parts.join('/') || '/backups';

      const sshPortFlag = portNum !== 22 ? `-p ${portNum} ` : '';
      const scpPortFlag = portNum !== 22 ? `-P ${portNum} ` : '';

      const escapedPass = pass.replace(/'/g, "'\\''");

      // StrictHostKeyChecking=no and UserKnownHostsFile=/dev/null prevent SSH interactive prompts from hanging
      const sshOpts = `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10`;

      const cmdMkdir = `sshpass -p '${escapedPass}' ssh ${sshOpts} ${sshPortFlag}${user}@${host} "mkdir -p ${targetDir}"`;
      const cmdScp = `sshpass -p '${escapedPass}' scp ${sshOpts} ${scpPortFlag}${location} ${user}@${host}:${targetDir}/`;
      const cmdRm = `rm -f ${location}`;

      const fullCommand = `${cmdMkdir} && ${cmdScp} && ${cmdRm}`;

      console.log(`[SSH Transfer Executing]: sshpass ... to ${user}@${host}:${targetDir}`);

      exec(fullCommand, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Error executing SSH transfer:', error, stderr);
          res.json({
            success: false,
            error: stderr || error.message || 'Falha na conexão SSH/SCP.',
            stdout,
            message: `Falha na execução do comando SSH/SCP no servidor: ${stderr || error.message}`
          });
        } else {
          if (backupId) {
            backupMonitorSingleton.deleteBackupEntry(backupId);
          }
          res.json({
            success: true,
            message: 'Transferência SSH/SCP concluída com sucesso e arquivo local removido.',
            stdout,
            stderr
          });
        }
      });
    } catch (err) {
      console.error('Unhandled error in transfer-ssh route:', err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        message: 'Erro interno ao tentar executar a transferência no servidor.'
      });
    }
  });

  // Alert Rules
  app.get('/api/db/alerts/rules', (req, res) => {
    res.json(alertEngineSingleton.getRules());
  });

  app.post('/api/db/alerts/rules', (req, res) => {
    const ruleData = req.body;
    const created = alertEngineSingleton.addRule(ruleData);
    res.json(created);
  });

  app.post('/api/db/alerts/rules/toggle', (req, res) => {
    const { id } = req.body;
    alertEngineSingleton.toggleRule(id);
    res.json({ success: true });
  });

  // AI Diagnostic endpoint for analyzing slow queries & deadlock scenarios
  app.post('/api/db/ai-diagnostic', async (req, res) => {
    try {
      const { query, duration, waitEvent, blockingPid } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Consulta SQL é necessária.' });
        return;
      }

      if (!ai) {
        res.json({
          analysis: `### Análise de Desempenho (Modo Diagnóstico Automático)\n\n**Consulta Analisada:**\n\`\`\`sql\n${query}\n\`\`\`\n\n**Recomendações de Otimização:**\n1. **Criação de Índices:** A consulta possui junções e agrupamentos. Verifique se existem índices B-Tree nas chaves de JOIN (\`order_id\`) e filtro (\`created_at\`).\n2. **Evite Locks de Tabela:** O tempo de espera de ${duration}s indica concorrência com escrita em lote. Considere usar índices parciais ou particionamento de tabelas.\n3. **Configuração de WorkMem:** Aumente \`work_mem\` para acelerar operações de \`GROUP BY\` e \`ORDER BY\` em memória RAM sem usar arquivos temporários no disco.`
        });
        return;
      }

      const prompt = `Você é um especialista DBA especialista em PostgreSQL. Analise a seguinte consulta presa/lenta que está causando bloqueio no banco de dados e forneça uma explicação sucinta, causa raiz provável e 3 sugestões técnicas práticas de otimização (ex: índices, alteração no SQL, reconfiguração do pg_settings).

Consulta SQL:
${query}

Duração Atual da Transação: ${duration} segundos
Wait Event: ${waitEvent || 'None'}
Blocking PID: ${blockingPid || 'None'}

Responda em formato Markdown estruturado em Português.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });

      res.json({ analysis: response.text || 'Análise concluída sem detalhes adicionais.' });
    } catch (err) {
      console.error('Erro na rota do Gemini:', err);
      res.status(500).json({
        error: 'Falha ao processar análise inteligente via IA.',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Vite Middleware for Dev, Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Monitoramento PostgreSQL ativo na porta ${PORT}`);
  });
}

startServer();
