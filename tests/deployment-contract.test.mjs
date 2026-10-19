import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
test('server listens on the container network and honors its configured port', () => {
  const begin = source.indexOf('  const server = app.listen(');
  const end = source.indexOf('  // Increase timeouts', begin);
  assert.ok(begin >= 0 && end > begin);
  let called;
  const server = {};
  runInNewContext(source.slice(begin, end), {
    PORT: 8080, console: { log() {} },
    app: { listen(port, host, callback) { called = { port, host }; callback(); return server; } },
  });
  assert.equal(called.port, 8080);
  assert.equal(called.host, '0.0.0.0');
});
test('unknown API routes return JSON 404 before either SPA middleware', () => {
  const begin = source.indexOf("  app.use('/api',");
  const end = source.indexOf('  // Vite middleware', begin);
  assert.ok(begin > source.indexOf("app.post('/api/waitlist'"));
  assert.ok(end > begin && end < source.indexOf('app.use(vite.middlewares)'));
  let handler;
  runInNewContext(source.slice(begin, end), { app: { use(path, fn) {
    assert.equal(path, '/api'); handler = fn;
  } } });
  let status, payload;
  handler({}, { status(value) { status = value; return this; }, json(value) { payload = value; } });
  assert.equal(status, 404);
  assert.equal(payload.error, 'API endpoint not found');
});
