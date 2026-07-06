import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazy — do not throw at import time if DATABASE_URL is absent.
// This keeps the migration validator happy even when no DB is provisioned.
function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

let _pool: pg.Pool | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function pool(): pg.Pool {
  if (!_pool) _pool = getPool();
  return _pool;
}

export function db(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) _db = drizzle(pool(), { schema });
  return _db;
}

export * from "./schema";
