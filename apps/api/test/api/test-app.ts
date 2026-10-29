import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { PGlite } from '@electric-sql/pglite';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pglite';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import { parseServerEnv, type ServerEnv } from '@mystock/config';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { SERVER_ENV } from '../../src/config/env.tokens';
import { DATABASE } from '../../src/database/database.tokens';
import type { AppDatabase } from '../../src/database/database.types';
import * as schema from '../../src/database/schema';
import { createTestDatabase } from '../db/harness';
import { seedFixtures } from '../db/fixtures';

export interface TokenOptions {
  email?: string;
  audience?: string;
  expiresIn?: string;
  signWith?: 'trusted' | 'attacker';
}

export interface TestContext {
  app: INestApplication;
  database: PGlite;
  jwksOrigin: string;
  tokenFor(userId: string, options?: TokenOptions): Promise<string>;
  close(): Promise<void>;
}

const ISSUER = 'https://testsupabase.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';

export async function createTestContext(): Promise<TestContext> {
  const testDatabase = await createTestDatabase();
  await seedFixtures(testDatabase.client);

  const trusted = await generateKeyPair('ES256');
  const attacker = await generateKeyPair('ES256');
  const trustedJwk = {
    ...(await exportJWK(trusted.publicKey)),
    kid: 'trusted-key',
    alg: 'ES256',
    use: 'sig',
  };

  const jwksServer: Server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [trustedJwk] }));
  });

  await new Promise<void>((resolve, reject) => {
    jwksServer.once('error', reject);
    jwksServer.listen(0, '127.0.0.1', resolve);
  });

  const { port } = jwksServer.address() as AddressInfo;
  const jwksOrigin = `http://127.0.0.1:${port}`;

  const env: ServerEnv = parseServerEnv({
    ...process.env,
    NODE_ENV: 'test',
    SUPABASE_URL: jwksOrigin,
    SUPABASE_JWT_ISSUER: ISSUER,
    SUPABASE_JWT_AUDIENCE: AUDIENCE,
  });

  const db = drizzle(testDatabase.client, { schema }) as unknown as AppDatabase;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue({ db, close: async () => undefined })
    .overrideProvider(SERVER_ENV)
    .useValue(env)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, env);
  await app.init();

  const tokenFor = async (userId: string, options: TokenOptions = {}): Promise<string> => {
    const key = options.signWith === 'attacker' ? attacker.privateKey : trusted.privateKey;
    const kid = options.signWith === 'attacker' ? 'attacker-key' : 'trusted-key';

    return new SignJWT({ email: options.email, role: 'authenticated', session_id: 'test-session' })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(options.audience ?? AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '10m')
      .sign(key);
  };

  return {
    app,
    database: testDatabase.client,
    jwksOrigin,
    tokenFor,
    close: async () => {
      await app.close();
      await testDatabase.client.close();
      await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
    },
  };
}
