import express from 'express';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { currentUser, installSecureAuth, type AuthDb } from './secureAuth';
import { installEntitlementMiddleware } from '../entitlementMiddleware.mts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;
try {
  console.log('Initializing database...');
  const dbPath = process.env.AUTH_DB_PATH || path.join(__dirname, 'mifeco.db');
  db = new Database(dbPath);
  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      geminiKey TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      platform TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const NODE_ENV = process.env.NODE_ENV || 'development';

  console.log(`Starting server in ${NODE_ENV} mode on port ${PORT}...`);

  app.use(express.json({ limit: '50mb' }));
  app.use(helmet());

  const authDb: AuthDb = {
    exec: async (sql) => { db.exec(sql); },
    get: async (sql, params = []) => db.prepare(sql).get(...params),
    all: async (sql, params = []) => db.prepare(sql).all(...params),
    run: async (sql, params = []) => { const r = db.prepare(sql).run(...params); return { changes: r.changes, lastID: r.lastInsertRowid }; },
  };
  await installSecureAuth(app, authDb, 'password', true);
  await installEntitlementMiddleware(app, authDb, 'hypatia', currentUser);

  app.get('/health', (_req, res) => {
    try {
      db.prepare('SELECT 1 AS ok').get();
      res.status(200).json({ status: 'ok', service: 'hypatia-pro' });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({ status: 'error', service: 'hypatia-pro' });
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: NODE_ENV });
  });

  app.post('/api/artifacts', async (req, res) => {
    try {
      const { app: appName, projectId, source, prompt, timestamp, generator, model, data, mimeType, structuredData } = req.body || {};
      if (appName !== 'Hypatia' || !projectId || !source || !prompt || !data || generator !== 'Designer/Gemini') return res.status(400).json({ error: 'Invalid artifact payload' });
      const safeProjectId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeSource = String(source).replace(/[^a-zA-Z0-9_-]/g, '_');
      const dir = path.join(__dirname, 'artifacts', safeProjectId);
      await fs.mkdir(dir, { recursive: true });
      const imagePath = path.join(dir, `${Date.now()}-${safeSource}.png`);
      const tempPath = `${imagePath}.tmp`;
      await fs.writeFile(tempPath, Buffer.from(String(data).replace(/^data:image\/[^;]+;base64,/, ''), 'base64'));
      await fs.rename(tempPath, imagePath);
      const provenance = { app: appName, projectId: safeProjectId, source, prompt, timestamp: timestamp || new Date().toISOString(), generator, model, mimeType: mimeType || 'image/png', path: imagePath, structuredData };
      await fs.writeFile(`${imagePath}.provenance.json`, JSON.stringify(provenance, null, 2));
      res.status(201).json(provenance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/waitlist', async (req, res) => {
    const { email, platform } = req.body || {};
    if (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (platform !== undefined && (typeof platform !== 'string' || platform.length > 100)) return res.status(400).json({ error: 'Invalid platform' });
    try {
      const stmt = db.prepare('INSERT INTO waitlist (email, platform) VALUES (?, ?)');
      stmt.run(email, platform || 'unknown');
      res.status(201).json({ message: 'Successfully joined waitlist' });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: 'Email already on waitlist' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });


  
  // MARS MOXIE environment shim: same-origin proxy for Gemini API (browser egress to googleapis is blocked in sandbox)
  app.options('/gapi', (req: any, res: any) => { res.set('Access-Control-Allow-Origin','*').set('Access-Control-Allow-Headers','Content-Type,x-goog-api-key,Authorization').set('Access-Control-Allow-Methods','GET,POST,OPTIONS').sendStatus(204); });
  app.use('/gapi', async (req: any, res: any) => {
    try {
      const targetPath = req.originalUrl.replace(/^\/gapi/, '');
      const url = 'https://generativelanguage.googleapis.com' + targetPath;
      const fetchOpts: any = { method: req.method, headers: { 'Content-Type': 'application/json' } };
      const apiKey = req.headers['x-goog-api-key'] || req.query.key;
      if (apiKey) fetchOpts.headers['x-goog-api-key'] = apiKey;
      if (req.method !== 'GET' && req.method !== 'HEAD') fetchOpts.body = JSON.stringify(req.body);
      const r = await fetch(url, fetchOpts);
      const text = await r.text();
      res.status(r.status).set('Content-Type', r.headers.get('content-type') || 'application/json').set('Access-Control-Allow-Origin', '*').set('Access-Control-Allow-Headers', 'Content-Type,x-goog-api-key,Authorization').set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS').send(text);
    } catch (e: any) {
      res.status(502).json({ error: 'gemini proxy failed: ' + e.message });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`MIFECO Hub Server running on http://0.0.0.0:${PORT}`);
    console.log('Health check endpoint: http://0.0.0.0:' + PORT + '/api/health');
  });

  // Increase timeouts for long-running AI operations
  server.timeout = 900000; // 15 minutes
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
