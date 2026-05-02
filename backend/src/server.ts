import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';

import { config } from './config.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { diagnosticRoutes } from './routes/diagnostic.js';
import { matchesRoutes } from './routes/matches.js';
import { reportsRoutes } from './routes/reports.js';
import { webhooksRoutes } from './routes/webhooks.js';
import { startGenerateReportWorker } from './workers/generate-report.js';
import { startProcessMatchWorker } from './workers/process-match.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
          : undefined,
    },
  });

  registerErrorHandler(app);

  await app.register(cors, { origin: true, credentials: true });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 * 1024 } }); // 5 GB

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(matchesRoutes, { prefix: '/api' });
  await app.register(reportsRoutes, { prefix: '/api' });
  await app.register(webhooksRoutes, { prefix: '/api' });
  await app.register(diagnosticRoutes);

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();

  // Workers run in-process for dev. In prod, split them into separate
  // processes (`node dist/workers/process-match-runner.js`, etc.).
  const processMatchWorker = startProcessMatchWorker();
  const generateReportWorker = startGenerateReportWorker();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down...`);
    await Promise.allSettled([
      processMatchWorker.close(),
      generateReportWorker.close(),
      app.close(),
    ]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
