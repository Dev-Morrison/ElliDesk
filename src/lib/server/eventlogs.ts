import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db';

// Windows Event Log entries (Application/Security/Setup/System), exported
// from the DC as CSV via scripts/Export-EventLogsToCsv.ps1 and imported here
// for browsing. See docs on that script for why CSV rather than parsing
// raw .evtx directly — accuracy and format complexity, mainly.

export const EVENT_LOG_NAMES = ['Application', 'Security', 'Setup', 'System'] as const;
export type EventLogName = (typeof EVENT_LOG_NAMES)[number];

export function isEventLogName(value: string): value is EventLogName {
    return (EVENT_LOG_NAMES as readonly string[]).includes(value as EventLogName);
}

export interface ParsedEventRow {
    recordId: number;
    timeCreated: Date;
    eventId: number;
    level: string;
    providerName: string;
    machineName: string;
    userId: string | null;
    message: string | null;
}

export interface EventLogRow {
    id: number;
    recordId: number;
    logName: string;
    machineName: string;
    timeCreated: string;
    eventId: number;
    level: string;
    providerName: string;
    userId: string | null;
    message: string | null;
    sourceFile: string | null;
}

export interface EventLogFilters {
    logName?: string;
    level?: string;
    eventId?: number;
    machineName?: string;
    search?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
}

// Collapses "FALCON.BOS.local" and "FALCON" to the same identity for
// dedup/filtering — the same source machine renders differently across
// exports depending on how PowerShell resolved its own hostname that day.
export function normalizeMachineName(raw: string): string {
    return raw.split('.')[0].toUpperCase();
}

/**
 * PowerShell's Export-Csv renders TimeCreated using the exporting session's
 * culture — historically "D/M/YYYY h:mm:ss AM/PM" (day-first) in exports
 * taken before this was noticed, which JS's Date constructor cannot be
 * trusted to parse correctly (it's prone to reading it as month-first).
 * Newer exports use ISO 8601 instead (see Export-EventLogsToCsv.ps1) and
 * are parsed directly. Both are supported here so already-exported CSVs
 * don't need to be regenerated.
 */
export function parseExportedTimestamp(raw: string): Date | null {
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        const iso = new Date(raw);
        return isNaN(iso.getTime()) ? null : iso;
    }

    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;

    const [, dd, mm, yyyy, hh, min, ss, ampm] = m;
    let hour = parseInt(hh, 10) % 12;
    if (ampm.toUpperCase() === 'PM') hour += 12;

    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), hour, Number(min), Number(ss));
    return isNaN(date.getTime()) ? null : date;
}

let tableReady: Promise<void> | null = null;

export function ensureEventLogsTable(): Promise<void> {
    if (!tableReady) {
        tableReady = getPool()
            .query(
                `CREATE TABLE IF NOT EXISTS event_logs (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    record_id BIGINT UNSIGNED NOT NULL,
                    log_name VARCHAR(32) NOT NULL,
                    machine_name VARCHAR(128) NOT NULL,
                    time_created DATETIME(3) NOT NULL,
                    event_id INT UNSIGNED NOT NULL,
                    level VARCHAR(32) NOT NULL,
                    provider_name VARCHAR(256) NOT NULL,
                    user_id VARCHAR(64) NULL,
                    message TEXT NULL,
                    source_file VARCHAR(256) NULL,
                    imported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                    PRIMARY KEY (id),
                    UNIQUE KEY uniq_event (log_name, machine_name, record_id),
                    KEY idx_time_created (time_created),
                    KEY idx_event_id (event_id),
                    KEY idx_level (level),
                    FULLTEXT KEY ft_message (message)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
            )
            .then(() => undefined)
            .catch((err) => {
                // Let the next call retry rather than permanently wedging
                // every future import behind one transient failure.
                tableReady = null;
                throw err;
            });
    }

    return tableReady;
}

/**
 * Batched, idempotent insert keyed on (log, machine, record id) — repeated
 * imports of overlapping date-folder exports (the norm, since Windows event
 * logs roll over and successive exports re-capture still-live records)
 * update in place rather than duplicating.
 */
export async function insertEventLogBatch(
    logName: EventLogName,
    sourceFile: string,
    rows: ParsedEventRow[]
): Promise<void> {
    if (rows.length === 0) return;

    const values = rows.map((r) => [
        r.recordId,
        logName,
        normalizeMachineName(r.machineName),
        r.timeCreated,
        r.eventId,
        r.level,
        r.providerName,
        r.userId,
        r.message,
        sourceFile
    ]);

    await getPool().query(
        `INSERT INTO event_logs
            (record_id, log_name, machine_name, time_created, event_id, level, provider_name, user_id, message, source_file)
         VALUES ?
         ON DUPLICATE KEY UPDATE message = VALUES(message), source_file = VALUES(source_file)`,
        [values]
    );
}

interface EventLogRowPacket extends RowDataPacket {
    id: number;
    record_id: number;
    log_name: string;
    machine_name: string;
    time_created: Date;
    event_id: number;
    level: string;
    provider_name: string;
    user_id: string | null;
    message: string | null;
    source_file: string | null;
}

// MySQL boolean-mode fulltext only supports trailing wildcards (no leading
// or mid-token substring search) — a real limitation, but at millions of
// rows a plain LIKE '%term%' table scan isn't a realistic alternative.
// Requiring every search word as a prefix (+word*) keeps results precise.
function toBooleanFulltextQuery(search: string): string {
    return search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => `+${word.replace(/[+\-<>()~*"@]/g, '')}*`)
        .join(' ');
}

function buildWhere(filters: EventLogFilters): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.logName) {
        clauses.push('log_name = ?');
        params.push(filters.logName);
    }

    if (filters.level) {
        clauses.push('level = ?');
        params.push(filters.level);
    }

    if (filters.eventId !== undefined) {
        clauses.push('event_id = ?');
        params.push(filters.eventId);
    }

    if (filters.machineName) {
        clauses.push('machine_name = ?');
        params.push(filters.machineName);
    }

    if (filters.search) {
        clauses.push('MATCH(message) AGAINST (? IN BOOLEAN MODE)');
        params.push(toBooleanFulltextQuery(filters.search));
    }

    if (filters.from) {
        clauses.push('time_created >= ?');
        params.push(filters.from);
    }

    if (filters.to) {
        clauses.push('time_created <= ?');
        params.push(filters.to);
    }

    return {
        sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
}

export async function queryEventLogs(
    filters: EventLogFilters
): Promise<{ rows: EventLogRow[]; total: number }> {
    await ensureEventLogsTable();

    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM event_logs ${whereSql}`,
        params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<EventLogRowPacket[]>(
        `SELECT id, record_id, log_name, machine_name, time_created, event_id, level, provider_name, user_id, message, source_file
         FROM event_logs
         ${whereSql}
         ORDER BY time_created DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    );

    return {
        total,
        rows: rows.map((r) => ({
            id: r.id,
            recordId: r.record_id,
            logName: r.log_name,
            machineName: r.machine_name,
            timeCreated: r.time_created.toISOString(),
            eventId: r.event_id,
            level: r.level,
            providerName: r.provider_name,
            userId: r.user_id,
            message: r.message,
            sourceFile: r.source_file
        }))
    };
}

export async function listEventLogFacets(): Promise<{ machines: string[]; levels: string[] }> {
    await ensureEventLogsTable();

    const pool = getPool();

    const [machineRows] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT machine_name FROM event_logs ORDER BY machine_name'
    );
    const [levelRows] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT level FROM event_logs ORDER BY level'
    );

    return {
        machines: machineRows.map((r) => r.machine_name as string),
        levels: levelRows.map((r) => r.level as string)
    };
}
