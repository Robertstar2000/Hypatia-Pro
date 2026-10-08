import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Express, Request, Response } from 'express';

export type AuthDb = {
  exec(sql: string): Promise<void>;
  get(sql: string, params?: unknown[]): Promise<any>;
  all(sql: string, params?: unknown[]): Promise<any[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes?: number; lastID?: number | bigint }>;
};

const CODE_COUNT = 10;
const RESET_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 24 * 60 * 60_000;
const RATE_WINDOW_MS = 15 * 60_000;
const RATE_LIMIT = 5;
const DUMMY_PASSWORD_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const GENERIC = 'If the account and recovery code are valid, password reset can continue.';
const SESSION_COOKIE = 'mifeco_session';

const now = () => Date.now();
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const recoveryDigest = (userId: string, code: string) => digest(`mifeco-recovery-v1\0${userId}\0${code.trim().toUpperCase()}`);
const safeEqualHex = (a: string, b: string) => {
  try { const aa = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex'); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); } catch { return false; }
};
const clientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';
const identifierKey = (identifier: string) => digest(identifier.trim().toLowerCase());
const validPassword = (password: unknown) => typeof password === 'string' && password.length >= 12 && password.length <= 256;
const parseCookie = (req: Request, name: string) => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
const cookieFlags = (req: Request, httpOnly = false) => `Path=/; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${httpOnly ? '; HttpOnly' : ''}${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
const setSessionCookie = (req: Request, res: Response, token: string) => res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieFlags(req, true)}`);
const clearSessionCookie = (req: Request, res: Response) => res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0; HttpOnly${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);

const safeRollback = async (db: AuthDb) => { try { await db.exec('ROLLBACK'); } catch { /* no active transaction */ } };

export async function migrateAuth(db: AuthDb) {
  try { await db.exec('PRAGMA busy_timeout = 5000'); } catch { /* driver may not support */ }
  const columns = await db.all('PRAGMA table_info(users)');
  const names = new Set(columns.map((c: any) => c.name));
  for (const [name, spec] of [['password_setup_required', 'INTEGER NOT NULL DEFAULT 0'], ['session_version', 'INTEGER NOT NULL DEFAULT 0']]) {
    if (!names.has(name)) await db.exec(`ALTER TABLE users ADD COLUMN ${name} ${spec}`);
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS recovery_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, used_at INTEGER);
    CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id);
    CREATE TABLE IF NOT EXISTS reset_capabilities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used_at INTEGER, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_auth_session_user ON auth_sessions(user_id);
    CREATE TABLE IF NOT EXISTS recovery_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, identifier_hash TEXT NOT NULL, ip_hash TEXT NOT NULL, attempted_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_recovery_attempts ON recovery_attempts(identifier_hash, ip_hash, attempted_at);
    CREATE TABLE IF NOT EXISTS auth_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, event TEXT NOT NULL, success INTEGER NOT NULL, ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
    INSERT OR IGNORE INTO schema_migrations(name, applied_at) VALUES ('20260918_secure_password_recovery_v2', CAST(strftime('%s','now') AS INTEGER) * 1000);
  `);
}

function publicUser(user: any) {
  return { id: user.id, username: user.username, email: user.email, geminiKey: user.geminiKey, role: user.role, avatar: user.avatar, passwordSetupRequired: !!user.password_setup_required };
}

async function issueCodes(db: AuthDb, userId: string) {
  const codes = Array.from({ length: CODE_COUNT }, () => `${randomToken(12).toUpperCase()}-${randomToken(12).toUpperCase()}`);
  await db.exec('BEGIN IMMEDIATE');
  try {
    await db.run('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
    for (const code of codes) await db.run('INSERT INTO recovery_codes(user_id, code_hash, created_at) VALUES (?, ?, ?)', [userId, recoveryDigest(userId, code), now()]);
    await db.exec('COMMIT');
  } catch (e) { await safeRollback(db); throw e; }
  return codes;
}

async function issueSession(db: AuthDb, userId: string) {
  const token = randomToken();
  await db.run('INSERT INTO auth_sessions(user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)', [userId, digest(token), now() + SESSION_TTL_MS, now()]);
  return token;
}

export async function currentUser(db: AuthDb, req: Request) {
  const token = parseCookie(req, SESSION_COOKIE) || '';
  if (!token) return null;
  return db.get('SELECT u.* FROM auth_sessions s JOIN users u ON CAST(u.id AS TEXT)=s.user_id WHERE s.token_hash=? AND s.expires_at>?', [digest(token), now()]);
}

async function audit(db: AuthDb, req: Request, event: string, success: boolean, userId?: string) {
  await db.run('INSERT INTO auth_audit(user_id,event,success,ip_hash,created_at) VALUES (?,?,?,?,?)', [userId || null, event, success ? 1 : 0, digest(clientIp(req)), now()]);
}

export async function installSecureAuth(app: Express, db: AuthDb, passwordColumn: 'password' | 'passwordHash', autoIntegerId = false) {
  await migrateAuth(db);
  app.get('/api/auth/csrf', (req, res) => { const token = randomToken(); res.setHeader('Cache-Control', 'no-store'); res.append('Set-Cookie', `mifeco_csrf=${token}; ${cookieFlags(req)}`); res.json({ csrfToken: token }); });
  app.use('/api/auth', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') return next();
    const header = String(req.headers['x-csrf-token'] || ''); const stored = parseCookie(req, 'mifeco_csrf') || '';
    if (!header || header.length > 200 || !stored || header.length !== stored.length || !crypto.timingSafeEqual(Buffer.from(header), Buffer.from(stored))) return res.status(403).json({ error: 'Request could not be verified' });
    next();
  });
  app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, geminiKey } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || typeof email !== 'string' || !email.trim() || !validPassword(password)) return res.status(400).json({ error: 'Username, email, and a password of 12-256 characters are required' });
    try {
      let id: string = crypto.randomUUID(); const hash = await bcrypt.hash(password, 12);
      if (autoIntegerId) { const info = await db.run(`INSERT INTO users (username,email,${passwordColumn},geminiKey,password_setup_required) VALUES (?,?,?,?,0)`, [username.trim(), email.trim(), hash, geminiKey || null]); id = String(info.lastID); }
      else await db.run(`INSERT INTO users (id,username,email,${passwordColumn},geminiKey,password_setup_required) VALUES (?,?,?,?,?,0)`, [id, username.trim(), email.trim(), hash, geminiKey || null]);
      const recoveryCodes = await issueCodes(db, id); const token = await issueSession(db, id); const user = await db.get('SELECT * FROM users WHERE CAST(id AS TEXT)=?', [id]);
      setSessionCookie(req, res, token); await audit(db, req, 'signup', true, id); res.status(201).json({ user: publicUser(user), recoveryCodes });
    } catch (e) { console.error('signup error', e); res.status(409).json({ error: 'Account could not be created' }); }
  });
  app.post('/api/auth/login', async (req, res) => {
    const identifier = String(req.body?.emailOrUsername ?? req.body?.email ?? ''); const password = req.body?.password;
    const user = identifier ? await db.get('SELECT * FROM users WHERE lower(email)=lower(?) OR lower(username)=lower(?)', [identifier, identifier]) : null;
    const ok = !!user && !user.password_setup_required && typeof user[passwordColumn] === 'string' && user[passwordColumn].length > 0 && typeof password === 'string' && password.length > 0 && await bcrypt.compare(password, user[passwordColumn]);
    if (!ok) { await bcrypt.compare(typeof password === 'string' ? password : '', DUMMY_PASSWORD_HASH).catch(() => false); await audit(db, req, 'login', false, user?.id); return res.status(401).json({ error: 'Invalid credentials' }); }
    const token = await issueSession(db, String(user.id)); setSessionCookie(req, res, token); await audit(db, req, 'login', true, String(user.id)); res.json({ success: true, user: publicUser(user) });
  });
  app.post('/api/auth/recovery/start', async (req, res) => {
   try {
    const identifier = String(req.body?.identifier || ''); const code = String(req.body?.recoveryCode || ''); const ik = identifierKey(identifier); const ipk = digest(clientIp(req)); const cutoff = now() - RATE_WINDOW_MS;
    const count = Number((await db.get('SELECT count(*) n FROM recovery_attempts WHERE (identifier_hash=? OR ip_hash=?) AND attempted_at>?', [ik, ipk, cutoff]))?.n || 0);
    if (count >= RATE_LIMIT) { await audit(db, req, 'recovery_start', false); return res.status(429).json({ error: 'Too many attempts. Try again later.' }); }
    await db.run('INSERT INTO recovery_attempts(identifier_hash,ip_hash,attempted_at) VALUES (?,?,?)', [ik, ipk, now()]);
    const user = identifier ? await db.get('SELECT * FROM users WHERE lower(email)=lower(?) OR lower(username)=lower(?)', [identifier, identifier]) : null;
    let matched: any = null;
    if (user && code) { const rows = await db.all('SELECT * FROM recovery_codes WHERE user_id=? AND used_at IS NULL', [String(user.id)]); const wanted = recoveryDigest(String(user.id), code); matched = rows.find(r => safeEqualHex(r.code_hash, wanted)); }
    if (!matched) { recoveryDigest('00000000-0000-0000-0000-000000000000', code || randomToken(16)); await audit(db, req, 'recovery_start', false, user?.id); return res.json({ message: GENERIC }); }
    const resetToken = randomToken();
    const used = await db.run('UPDATE recovery_codes SET used_at=? WHERE id=? AND used_at IS NULL', [now(), matched.id]);
    if (used.changes !== 1) { await audit(db, req, 'recovery_start', false, String(user.id)); return res.json({ message: GENERIC }); }
    try { await db.run('INSERT INTO reset_capabilities(user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?)', [String(user.id), digest(resetToken), now() + RESET_TTL_MS, now()]); }
    catch { await audit(db, req, 'recovery_start', false, String(user.id)); return res.json({ message: GENERIC }); }
    await audit(db, req, 'recovery_start', true, String(user.id)); res.json({ message: GENERIC, resetToken });
   } catch { try { await safeRollback(db); } catch { /* ignore rollback errors */ } return res.json({ message: GENERIC }); }
  });
  app.post('/api/auth/recovery/complete', async (req, res) => {
   try {
    const { resetToken, password, passwordConfirmation } = req.body || {};
    if (!validPassword(password) || password !== passwordConfirmation || typeof resetToken !== 'string') return res.status(400).json({ error: 'Reset request or password is invalid' });
    const cap = await db.get('SELECT * FROM reset_capabilities WHERE token_hash=? AND used_at IS NULL AND expires_at>?', [digest(resetToken), now()]);
    if (!cap) { await audit(db, req, 'recovery_complete', false); return res.status(400).json({ error: 'Reset request or password is invalid' }); }
    const hash = await bcrypt.hash(password, 12);
    const used = await db.run('UPDATE reset_capabilities SET used_at=? WHERE id=? AND used_at IS NULL', [now(), cap.id]);
    if (used.changes !== 1) return res.status(400).json({ error: 'Reset request or password is invalid' });
    try {
      await db.run(`UPDATE users SET ${passwordColumn}=?, password_setup_required=0, session_version=session_version+1 WHERE CAST(id AS TEXT)=?`, [hash, cap.user_id]);
      await db.run('DELETE FROM auth_sessions WHERE user_id=?', [cap.user_id]);
      await db.run('DELETE FROM reset_capabilities WHERE user_id=? AND id<>?', [cap.user_id, cap.id]);
    } catch { return res.status(400).json({ error: 'Reset request or password is invalid' }); }
    clearSessionCookie(req, res); await audit(db, req, 'recovery_complete', true, cap.user_id); res.json({ success: true });
   } catch { try { await safeRollback(db); } catch { /* ignore rollback errors */ } return res.status(400).json({ error: 'Reset request or password is invalid' }); }
  });
  app.post('/api/auth/recovery/regenerate', async (req, res) => {
    const user = await currentUser(db, req); const password = req.body?.currentPassword;
    if (!user || typeof password !== 'string' || !user[passwordColumn] || !await bcrypt.compare(password, user[passwordColumn])) { await audit(db, req, 'recovery_regenerate', false, user?.id); return res.status(401).json({ error: 'Authentication required' }); }
    const recoveryCodes = await issueCodes(db, String(user.id)); await audit(db, req, 'recovery_regenerate', true, String(user.id)); res.json({ recoveryCodes });
  });
  app.get('/api/auth/me', async (req, res) => { const user = await currentUser(db, req); if (!user) return res.status(401).json({ error: 'Authentication required' }); res.json({ user: publicUser(user) }); });
  app.post('/api/auth/logout', async (req, res) => { const token = parseCookie(req, SESSION_COOKIE) || ''; if (token) await db.run('DELETE FROM auth_sessions WHERE token_hash=?', [digest(token)]); clearSessionCookie(req, res); res.json({ success: true }); });
}
