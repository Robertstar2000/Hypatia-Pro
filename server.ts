import express from 'express';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'mifeco-secret-key-2026';

let db: Database.Database;
try {
  console.log('Initializing database...');
  const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/mifeco.db' : 'mifeco.db';
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

  app.use(express.json());
  app.use(helmet());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: NODE_ENV });
  });

  app.post('/api/waitlist', async (req, res) => {
    const { email, platform } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
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

  app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, geminiKey } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password, geminiKey) VALUES (?, ?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword, geminiKey || '');
      
      const user = { id: info.lastInsertRowid, username, email, geminiKey };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      res.status(201).json({ user, token });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: 'Username or email already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { emailOrUsername, password } = req.body;
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?');
      const user: any = stmt.get(emailOrUsername, emailOrUsername);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const userPayload = { id: user.id, username: user.username, email: user.email, geminiKey: user.geminiKey };
      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });

      res.json({ user: userPayload, token });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
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

  const server = app.listen(PORT, '0.0.0.0', () => {
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
