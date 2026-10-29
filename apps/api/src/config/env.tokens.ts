import 'dotenv/config';

import { parseServerEnv, type ServerEnv } from '@mystock/config';

export const SERVER_ENV = Symbol('SERVER_ENV');

export function loadServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
