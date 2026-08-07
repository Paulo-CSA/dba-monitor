import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { metricsEngineSingleton } from './src/services/metricsEngine';
import { configServiceSingleton } from './src/services/configService';
import { healthServiceSingleton } from './src/services/healthService';
import { lockAnalyzerSingleton } from './src/services/lockAnalyzer';
import { backupMonitorSingleton } from './src/services/backupMonitor';
import { alertEngineSingleton } from './src/services/alertEngine';
import { mockServerFleet } from './src/services/fleetService';

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

  // Fleet overview of servers and databases (Observability Mode)
  app.get('/api/db/servers', (req, res) => {
    res.json({
      observabilityMode: true,
      servers: mockServerFleet
    });
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
    const sysConfig = configServiceSingleton.getSystemConfig();
    const query = configServiceSingleton.getFileLocationsSqlQuery();
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

  // Kill stuck backend session (SELECT pg_terminate_backend(pid))
  app.post('/api/db/kill-pid', (req, res) => {
    const { pid } = req.body;
    if (!pid || typeof pid !== 'number') {
      res.status(400).json({ success: false, message: 'PID numérico inválido.' });
      return;
    }
    const result = lockAnalyzerSingleton.killBackendPid(pid);
    res.json(result);
  });

  // Backup status & history
  app.get('/api/db/backups', (req, res) => {
    const backupData = backupMonitorSingleton.getBackupOverview();
    res.json(backupData);
  });

  // Trigger manual backup
  app.post('/api/db/backups/trigger', (req, res) => {
    const { type } = req.body;
    const backupType = type === 'pg_dump' ? 'pg_dump' : 'pg_basebackup';
    const newEntry = backupMonitorSingleton.triggerManualBackup(backupType);
    res.json({ success: true, entry: newEntry });
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
