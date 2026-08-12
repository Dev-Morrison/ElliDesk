import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

// mysql2 has no pool-wide query timeout, so callers on paths that must never
// hang indefinitely (login, permission resolution) pass this explicitly as
// `{ sql, timeout: QUERY_TIMEOUT_MS }`. Without it, a stuck query (e.g. the
// server silently waiting for free disk space instead of erroring) blocks
// forever - which once locked out even the local break-glass admin, since
// its login still writes an audit log entry.
export const QUERY_TIMEOUT_MS = 3000;

let pool: mysql.Pool | undefined;

// Lazily created, reused across requests — a fresh pool per request would
// exhaust MySQL's connection limit under any real load.
export function getPool(): mysql.Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: env.DB_HOST,
            port: Number(env.DB_PORT ?? 3306),
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10
        });
    }

    return pool;
}
