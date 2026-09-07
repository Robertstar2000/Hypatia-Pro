const Database = require('better-sqlite3');
const fs = require('fs');
const env = fs.readFileSync('/home/bob/.hermes/.env', 'utf8');
const m = env.match(/^GOOGLE_AI_STUDIO_KEY=(.+)$/m);
if (!m) { console.error('key not found'); process.exit(1); }
const key = m[1].trim().replace(/^["']|["']$/g, '');
const db = new Database('/tmp/mifeco.db');
db.prepare('UPDATE users SET geminiKey=? WHERE username=?').run(key, 'Bob Mills');
const row = db.prepare('SELECT username, length(geminiKey) as klen FROM users').get();
console.log('geminiKey stored, length:', row.klen);
