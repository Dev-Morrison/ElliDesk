import type { RowDataPacket } from 'mysql2/promise';
import { getPool, QUERY_TIMEOUT_MS } from '$lib/server/db';
import { withLdapClient, searchDN } from '$lib/server/ldap';
import { listActiveSessions } from '$lib/server/audit';

// Every check here is independently bounded and independently caught - a
// diagnostics page is exactly the place that must never itself hang or
// blank-page when the thing it's checking is unhealthy (see the disk-full
// incident this was built in response to: DB calls with no timeout on the
// login path very nearly bricked the app entirely).

export interface HealthCheckResult {
    ok: boolean;
    latencyMs: number;
    message?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

export async function checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        await getPool().query({ sql: 'SELECT 1', timeout: QUERY_TIMEOUT_MS });
        return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
        return {
            ok: false,
            latencyMs: Date.now() - start,
            message: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

export async function checkLdap(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        await withTimeout(
            withLdapClient(async (client) => {
                await client.search(searchDN(), {
                    scope: 'base',
                    filter: '(objectClass=*)',
                    attributes: ['dn'],
                    sizeLimit: 1
                });
            }),
            5000,
            'LDAP check'
        );
        return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
        return {
            ok: false,
            latencyMs: Date.now() - start,
            message: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

export interface TableStats {
    name: string;
    rows: number;
    sizeMb: number;
}

export async function getTableStats(): Promise<TableStats[]> {
    // information_schema columns come back as TABLE_NAME/TABLE_ROWS
    // (uppercase) when left unaliased - explicit aliases here force the
    // lowercase result keys the code below actually reads, regardless of
    // MySQL/MariaDB version quirks around information_schema casing.
    const [rows] = await getPool().query<RowDataPacket[]>({
        timeout: QUERY_TIMEOUT_MS,
        sql: `SELECT table_name AS table_name, table_rows AS table_rows,
                     ROUND((data_length + index_length) / 1024 / 1024, 1) AS size_mb
              FROM information_schema.tables
              WHERE table_schema = DATABASE()
              ORDER BY (data_length + index_length) DESC`
    });

    return rows.map((r) => ({
        name: r.table_name as string,
        rows: Number(r.table_rows ?? 0),
        sizeMb: Number(r.size_mb ?? 0)
    }));
}

export async function getLastEventLogImport(): Promise<string | null> {
    const [rows] = await getPool().query<RowDataPacket[]>({
        timeout: QUERY_TIMEOUT_MS,
        sql: 'SELECT MAX(imported_at) AS last FROM event_logs'
    });

    const last = rows[0]?.last;
    return last ? new Date(last).toISOString() : null;
}

export interface SystemHealth {
    database: HealthCheckResult;
    ldap: HealthCheckResult;
    tables: TableStats[] | null;
    lastEventLogImport: string | null;
    activeSessionCount: number | null;
    uptimeSeconds: number;
}

export async function getSystemHealth(): Promise<SystemHealth> {
    const [database, ldap, tablesResult, lastImportResult, sessionsResult] = await Promise.all([
        checkDatabase(),
        checkLdap(),
        getTableStats().catch(() => null),
        getLastEventLogImport().catch(() => null),
        listActiveSessions()
            .then((s) => s.length)
            .catch(() => null)
    ]);

    return {
        database,
        ldap,
        tables: tablesResult,
        lastEventLogImport: lastImportResult,
        activeSessionCount: sessionsResult,
        uptimeSeconds: process.uptime()
    };
}
