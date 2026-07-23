import { env } from '$env/dynamic/public';
import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

// Minimal, dependency-free audit trail: appends one JSON object per line to
// a local file. This is enough to get bulk-update actions logged today and
// to back a future /maintenance/audit-log page. Swap the writeAuditLog body
// for a real table (Postgres/SQLite/whatever you're already using) whenever
// that's in place — the AuditLogEntry shape below is what that table's rows
// should look like.

const AUDIT_LOG_PATH = './logs/audit-log.jsonl';

export interface AuditLogEntry {
    timestamp: string;
    actor: string;
    action: string;
    targetDn: string;
    targetSam: string;
    attribute: string;
    oldValue: string;
    newValue: string;
    success: boolean;
    error?: string;
}

export interface NewUserAuditLogEntry {
    timestamp: string;
    actor: string;
    action: 'user-creation';
    newUserDn: string;
    newUserSamAccountName: string;
    newUserDisplayName: string;
    newUserDepartment: string;
    success: boolean;
    error?: string;
}

export async function writeAuditLog(entries: AuditLogEntry[] | NewUserAuditLogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    await mkdir(dirname(AUDIT_LOG_PATH), { recursive: true });

    const lines = entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';

    await appendFile(AUDIT_LOG_PATH, lines, 'utf-8');
}