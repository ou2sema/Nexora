import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';

import { parseServerEnv, type ServerEnv } from '@mystock/config';

// Workspace scripts run with the app directory as cwd, while the documented
// `.env` lives at the repository root. Load whichever exists without
// overriding values already present in the process environment.
for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    config({ path: candidate, quiet: true });
    break;
  }
}

export const SERVER_ENV = Symbol('SERVER_ENV');

export function loadServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
