import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

import type * as schema from './schema';

export type AppDatabase = PostgresJsDatabase<typeof schema>;

export type AppTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Either the pool-level handle or an open transaction. */
export type AppExecutor = AppDatabase | AppTransaction;

export interface DatabaseHandle {
  db: AppDatabase;
  close(): Promise<void>;
}
