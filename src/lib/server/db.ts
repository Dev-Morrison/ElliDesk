import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

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
