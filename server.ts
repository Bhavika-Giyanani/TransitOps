import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { seedDatabaseIfEmpty } from './src/server/db';
import { initRealtime } from './src/server/realtime';
import { swaggerDocument } from './src/server/swagger';

import { authRouter } from './src/server/routes/auth';
import { vehiclesRouter } from './src/server/routes/vehicles';
import { driversRouter } from './src/server/routes/drivers';
import { tripsRouter } from './src/server/routes/trips';
import { maintenanceRouter } from './src/server/routes/maintenance';
import { expensesRouter } from './src/server/routes/expenses';
import { kpiRouter } from './src/server/routes/kpi';
import { reportsRouter } from './src/server/routes/reports';
import { adminRouter } from './src/server/routes/admin';
import { onboardingRouter } from './src/server/routes/onboarding';

const app = express();
const server = http.createServer(app);
const port = 3000;

// Initialize Socket.io Realtime Server
initRealtime(server);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Swagger Documentation UI
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/api/docs/swagger.json', (_req: Request, res: Response) => {
  return res.json(swaggerDocument);
});
app.get('/docs/swagger.json', (_req: Request, res: Response) => {
  return res.json(swaggerDocument);
});

// Mount Modular API Routers
app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/kpi', kpiRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/onboarding', onboardingRouter);

// SignalR Compatibility Bridge (supports legacy frontend client handshakes alongside Socket.io)
app.post('/hubs/transitops/negotiate', (_req: Request, res: Response) => {
  return res.json({
    negotiateVersion: 1,
    connectionId: `conn-${Date.now()}`,
    availableTransports: [
      { transport: 'ServerSentEvents', transferFormats: ['Text'] },
      { transport: 'LongPolling', transferFormats: ['Text'] },
    ],
  });
});

app.get('/hubs/transitops', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('data: {"type": "connected"}\n\n');
  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 15000);
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Vite & Static Asset Handling
async function startServer() {
  // Seed database in background with timeout protection
  const seedWithTimeout = Promise.race([
    seedDatabaseIfEmpty(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Database seed timed out')), 5000)),
  ]);
  seedWithTimeout.catch((err) => {
    console.warn('[TransitOps Database Notice] Could not seed database immediately:', err?.message || err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[TransitOps Node.js Backend] Listening on http://0.0.0.0:${port}`);
    console.log(`[TransitOps Swagger Docs] Available at http://localhost:${port}/swagger`);
  });
}

void startServer();
