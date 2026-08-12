import type { RowDataPacket } from 'mysql2/promise';
import { getPool, QUERY_TIMEOUT_MS } from '$lib/server/db';

// Audit trail backed by a real table (see ensureAuditTable below) instead
// of the local JSONL file this used to write — durable across deploys and
// queryable from the /audit-logs page.

// Sessions are stateless signed cookies with no server-side store (see
// hooks.server.ts/resolveSessionUser) — there's no session table to query
// for "who's logged in." This is the single source of truth for how long a
// session is considered valid; the login action (src/routes/(public)/login)
// imports it when setting the cookie's own expiry, and listActiveSessions()
// below uses it to decide whether a past login is still active.
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 hours

export type AuditAction =
    | 'login'
    | 'login-failed'
    | 'login-denied'
    | 'logout'
    | 'user-created'
    | 'user-updated'
    | 'user-enabled'
    | 'user-disabled'
    | 'user-unlocked'
    | 'password-reset'
    | 'group-member-added'
    | 'group-member-removed'
    | 'group-updated'
    | 'computer-enabled'
    | 'computer-disabled'
    | 'group-deleted'
    | 'user-offboarded'
    | 'event-log-imported'
    | 'event-log-cleanup'
    | 'role-created'
    | 'role-updated'
    | 'role-deleted'
    | 'role-assignment-created'
    | 'role-assignment-deleted';

export interface AuditEvent {
    actor: string;
    action: AuditAction;
    targetDn?: string | null;
    targetSam?: string | null;
    targetDisplayName?: string | null;
    attribute?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    success: boolean;
    error?: string | null;
    // Free-form extra context that doesn't warrant its own column (e.g. the
    // list of member DNs touched by a group membership change).
    details?: Record<string, unknown> | null;
}

export interface AuditLogRow {
    id: number;
    occurredAt: string;
    actor: string;
    action: string;
    targetDn: string | null;
    targetSam: string | null;
    targetDisplayName: string | null;
    attribute: string | null;
    oldValue: string | null;
    newValue: string | null;
    success: boolean;
    error: string | null;
    details: Record<string, unknown> | null;
}

export interface AuditLogFilters {
    actor?: string;
    action?: string;
    success?: boolean;
    search?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
}

let tableReady: Promise<void> | null = null;

function ensureAuditTable(): Promise<void> {
    if (!tableReady) {
        tableReady = getPool()
            .query({
                timeout: QUERY_TIMEOUT_MS,
                sql: `CREATE TABLE IF NOT EXISTS audit_logs (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                    actor VARCHAR(128) NOT NULL,
                    action VARCHAR(64) NOT NULL,
                    target_dn VARCHAR(512) NULL,
                    target_sam VARCHAR(128) NULL,
                    target_display_name VARCHAR(256) NULL,
                    attribute_name VARCHAR(128) NULL,
                    old_value TEXT NULL,
                    new_value TEXT NULL,
                    success TINYINT(1) NOT NULL DEFAULT 1,
                    error_message TEXT NULL,
                    details JSON NULL,
                    PRIMARY KEY (id),
                    KEY idx_occurred_at (occurred_at),
                    KEY idx_actor (actor),
                    KEY idx_action (action),
                    KEY idx_target_sam (target_sam)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
            })
            .then(() => undefined)
            .catch((err) => {
                // Let the next call retry rather than permanently wedging
                // every future audit write behind one transient failure.
                tableReady = null;
                throw err;
            });
    }

    return tableReady;
}

/**
 * Best-effort: a failure to record an audit entry should never fail the AD
 * operation it's describing, so errors are logged and swallowed here rather
 * than propagated to callers.
 */
export async function writeAuditLog(event: AuditEvent): Promise<void> {
    await writeAuditLogs([event]);
}

export async function writeAuditLogs(events: AuditEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
        await ensureAuditTable();

        const values = events.map((e) => [
            e.actor,
            e.action,
            e.targetDn ?? null,
            e.targetSam ?? null,
            e.targetDisplayName ?? null,
            e.attribute ?? null,
            e.oldValue ?? null,
            e.newValue ?? null,
            e.success ? 1 : 0,
            e.error ?? null,
            e.details ? JSON.stringify(e.details) : null
        ]);

        await getPool().query(
            {
                timeout: QUERY_TIMEOUT_MS,
                sql: `INSERT INTO audit_logs
                (actor, action, target_dn, target_sam, target_display_name, attribute_name, old_value, new_value, success, error_message, details)
             VALUES ?`
            },
            [values]
        );
    } catch (err) {
        console.error('Failed to write audit log entry:', err);
    }
}

interface AuditLogRowPacket extends RowDataPacket {
    id: number;
    occurred_at: Date;
    actor: string;
    action: string;
    target_dn: string | null;
    target_sam: string | null;
    target_display_name: string | null;
    attribute_name: string | null;
    old_value: string | null;
    new_value: string | null;
    success: number;
    error_message: string | null;
    // mysql2 decodes JSON columns into plain objects itself — this is never
    // a string to re-parse, despite what the column's SQL type suggests.
    details: Record<string, unknown> | null;
}

function buildWhere(filters: AuditLogFilters): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.actor) {
        clauses.push('actor = ?');
        params.push(filters.actor);
    }

    if (filters.action) {
        clauses.push('action = ?');
        params.push(filters.action);
    }

    if (filters.success !== undefined) {
        clauses.push('success = ?');
        params.push(filters.success ? 1 : 0);
    }

    if (filters.search) {
        clauses.push('(target_sam LIKE ? OR target_display_name LIKE ? OR target_dn LIKE ? OR actor LIKE ?)');
        const term = `%${filters.search}%`;
        params.push(term, term, term, term);
    }

    if (filters.from) {
        clauses.push('occurred_at >= ?');
        params.push(filters.from);
    }

    if (filters.to) {
        clauses.push('occurred_at <= ?');
        params.push(filters.to);
    }

    return {
        sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
}

export async function queryAuditLogs(
    filters: AuditLogFilters
): Promise<{ rows: AuditLogRow[]; total: number }> {
    await ensureAuditTable();

    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
        params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<AuditLogRowPacket[]>(
        `SELECT id, occurred_at, actor, action, target_dn, target_sam, target_display_name,
                attribute_name, old_value, new_value, success, error_message, details
         FROM audit_logs
         ${whereSql}
         ORDER BY occurred_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    );

    return {
        total,
        rows: rows.map((r) => ({
            id: r.id,
            occurredAt: r.occurred_at.toISOString(),
            actor: r.actor,
            action: r.action,
            targetDn: r.target_dn,
            targetSam: r.target_sam,
            targetDisplayName: r.target_display_name,
            attribute: r.attribute_name,
            oldValue: r.old_value,
            newValue: r.new_value,
            success: r.success === 1,
            error: r.error_message,
            details: r.details
        }))
    };
}

export async function listAuditActions(): Promise<string[]> {
    await ensureAuditTable();

    const [rows] = await getPool().query<RowDataPacket[]>(
        'SELECT DISTINCT action FROM audit_logs ORDER BY action'
    );

    return rows.map((r) => r.action as string);
}

export interface ActiveSession {
    actor: string;
    targetDn: string | null;
    authSource: 'ldap' | 'local' | null;
    loginAt: string;
    expiresAt: string;
}

interface ActiveSessionRowPacket extends RowDataPacket {
    actor: string;
    target_dn: string | null;
    occurred_at: Date;
    details: Record<string, unknown> | null;
}

/**
 * Approximates "who's currently logged in" from the audit trail rather than
 * a real session store (there isn't one - see SESSION_DURATION_MS above):
 * for each account, its most recent successful login counts as an active
 * session unless a logout has been recorded since, or the session's
 * SESSION_DURATION_MS has already elapsed. Best-effort by nature - a
 * browser closed without hitting Logout looks "active" until it expires,
 * the same way the cookie itself behaves.
 */
export async function listActiveSessions(): Promise<ActiveSession[]> {
    await ensureAuditTable();

    const [rows] = await getPool().query<ActiveSessionRowPacket[]>(
        {
            timeout: QUERY_TIMEOUT_MS,
            sql: `SELECT a.actor, a.target_dn, a.occurred_at, a.details
             FROM audit_logs a
             INNER JOIN (
                 SELECT actor, MAX(occurred_at) AS max_login
                 FROM audit_logs
                 WHERE action = 'login' AND success = 1
                 GROUP BY actor
             ) latest ON latest.actor = a.actor AND latest.max_login = a.occurred_at
             WHERE a.action = 'login' AND a.success = 1
               AND a.occurred_at > (NOW() - INTERVAL ? SECOND)
               AND NOT EXISTS (
                   SELECT 1 FROM audit_logs lo
                   WHERE lo.actor = a.actor AND lo.action = 'logout' AND lo.occurred_at > a.occurred_at
               )
             ORDER BY a.occurred_at DESC`
        },
        [SESSION_DURATION_MS / 1000]
    );

    return rows.map((r) => {
        const authSource = r.details?.authSource;

        return {
            actor: r.actor,
            targetDn: r.target_dn,
            authSource: authSource === 'ldap' || authSource === 'local' ? authSource : null,
            loginAt: r.occurred_at.toISOString(),
            expiresAt: new Date(r.occurred_at.getTime() + SESSION_DURATION_MS).toISOString()
        };
    });
}
