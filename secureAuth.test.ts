import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { getDummyPasswordHash, installSecureAuth, type AuthDb } from './secureAuth';

async function runTests() {
  console.log('Running secureAuth security fix tests...');

  // 1. Verify no hardcoded dummy password hash in secureAuth.ts source file
  const secureAuthSource = fs.readFileSync(path.join(process.cwd(), 'secureAuth.ts'), 'utf-8');
  const oldHardcodedHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  if (secureAuthSource.includes(oldHardcodedHash)) {
    throw new Error('FAILED: Hardcoded dummy password hash is still present in secureAuth.ts!');
  }
  console.log('✓ Passed: Hardcoded dummy hash is not present in secureAuth.ts');

  // 2. Test getDummyPasswordHash dynamic generation
  delete process.env.DUMMY_PASSWORD_HASH;
  const generatedHash = await getDummyPasswordHash();
  if (!generatedHash.startsWith('$2b$12$') || generatedHash.length < 50) {
    throw new Error(`FAILED: Generated hash invalid format: ${generatedHash}`);
  }
  console.log('✓ Passed: Dynamically generated dummy password hash has valid bcrypt format');

  // 3. Test process.env.DUMMY_PASSWORD_HASH override
  const customHash = '$2b$12$e0MYzXyjpJS7Pd0RVvHwHe1f1G8u4X.9uH1mS2X5q6z.4e5f6g7h8';
  process.env.DUMMY_PASSWORD_HASH = customHash;
  const loadedHash = await getDummyPasswordHash();
  if (loadedHash !== customHash) {
    throw new Error(`FAILED: Expected custom env hash ${customHash}, got ${loadedHash}`);
  }
  delete process.env.DUMMY_PASSWORD_HASH;
  console.log('✓ Passed: process.env.DUMMY_PASSWORD_HASH override works');

  // 4. Test login handler via HTTP request
  const mockDb: AuthDb = {
    exec: async () => {},
    get: async () => null, // return null for user lookup to trigger non-existent user path
    all: async () => [],
    run: async () => ({ changes: 0, lastID: 1 })
  };

  const app = express();
  app.use(express.json());
  await installSecureAuth(app, mockDb, 'password', true);

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    // Obtain CSRF token
    const csrfRes = await fetch(`http://127.0.0.1:${port}/api/auth/csrf`);
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    const cookies = csrfRes.headers.get('set-cookie') || '';

    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Cookie': cookies
      },
      body: JSON.stringify({ emailOrUsername: 'nonexistent@example.com', password: 'wrongpassword123' })
    });

    const status = res.status;
    const data = await res.json();

    if (status !== 401 || data?.error !== 'Invalid credentials') {
      throw new Error(`FAILED: Expected 401 Invalid credentials, got status ${status} body ${JSON.stringify(data)}`);
    }
    console.log('✓ Passed: Login route correctly handles invalid credentials using dummy password comparison');
  } finally {
    server.close();
  }

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
