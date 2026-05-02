import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { config } from '../config.js';
import * as schema from './schema.js';

// One connection pool per process. `prepare: false` keeps things compatible
// with serverless poolers (PgBouncer transaction mode); flip to true if you
// know you're on a direct connection.
const queryClient = postgres(config.DATABASE_URL, { prepare: false });

export const db = drizzle(queryClient, { schema });
export { schema };
export type Database = typeof db;
