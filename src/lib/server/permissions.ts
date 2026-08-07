import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { searchDN } from '$lib/server/ldap';
import { AD_CONFIG } from '$lib/config/adconfig';
import type { SessionUser } from '$lib/types';
import { CAPABILITIES, isCapability, type Capability } from '$lib/capabilities';

// Two authorization tiers coexist:
//   1. The local break-glass admin (see $lib/server/localAdmin) - not tied to
//      LDAP at all, always grants every capability across every domain. Exists
//      so the app is configurable even before any AD role assignment exists.
//   2. Explicit role assignments (this module) - every LDAP account is
//      granted nothing by default. Access comes entirely from roles assigned
//      (via the /admin section) to an AD group they belong to, or to their
//      own account DN directly. There is no OU-based auto-grant anymore —
//      that made the app's authorization boundary depend on a specific AD
//      layout, which didn't sit well with the goal of a redeployable,
//      config-driven container.

// Re-exported for existing server-side imports (`from '$lib/server/permissions'`) -
// the canonical definitions live in $lib/capabilities, which is also
// imported directly by client-side admin pages that render capability
// checkboxes and can't pull in this server-only module.
export { CAPABILITIES, isCapability, type Capability };

export interface EffectivePermissions {
    capabilities: Set<Capability>;
    domainScope: 'all' | string[]; // domain keys from adconfig.ts, e.g. ['ncra.org.jm']
}

// Client-safe shape (Set -> array) for handing to the browser via `load`.
export interface SerializedPermissions {
    capabilities: Capability[];
    domainScope: 'all' | string[];
}

export function serializePermissions(p: EffectivePermissions): SerializedPermissions {
    return { capabilities: Array.from(p.capabilities), domainScope: p.domainScope };
}

const NO_ACCESS: EffectivePermissions = { capabilities: new Set(), domainScope: [] };

export function hasCapability(p: EffectivePermissions, capability: Capability): boolean {
    return p.capabilities.has(capability);
}

export function domainAllowed(p: EffectivePermissions, domainKey: string): boolean {
    return p.domainScope === 'all' || p.domainScope.includes(domainKey);
}

/** Throws a 403 unless the request's resolved permissions include `capability`. */
export function requireCapability(
    locals: { permissions?: EffectivePermissions },
    capability: Capability
): void {
    if (!locals.permissions || !hasCapability(locals.permissions, capability)) {
        throw error(403, `Missing required permission: ${capability}`);
    }
}

export function hasAnyCapability(p: EffectivePermissions, capabilities: Capability[]): boolean {
    return capabilities.some((c) => p.capabilities.has(c));
}

/** Throws a 403 unless the request's resolved permissions include at least
 *  one of `capabilities` - for actions like viewing groups where either
 *  groups.view or groups.manage is sufficient. */
export function requireAnyCapability(
    locals: { permissions?: EffectivePermissions },
    capabilities: Capability[]
): void {
    if (!locals.permissions || !hasAnyCapability(locals.permissions, capabilities)) {
        throw error(403, `Missing required permission: one of ${capabilities.join(', ')}`);
    }
}

/** Throws a 403 unless the domain is within the request's resolved scope. */
export function requireDomainAllowed(
    locals: { permissions?: EffectivePermissions },
    domainKey: string
): void {
    if (!locals.permissions || !domainAllowed(locals.permissions, domainKey)) {
        throw error(403, `Not authorized for domain: ${domainKey}`);
    }
}

// --- Page-level gating ------------------------------------------------------
// Central path -> required-capability table, checked once in the (auth)
// layout so most pages need no individual code changes. A page not listed
// here needs no specific capability beyond being logged in at all (e.g.
// /dashboard, /help) - the table only needs entries for what's actually
// restricted. Where a capability is an array, any one of them is enough
// (e.g. groups.view OR groups.manage can both view the Groups page; the
// write actions on it separately require groups.manage specifically).
const PAGE_CAPABILITIES: { prefix: string; capability: Capability | Capability[] }[] = [
    { prefix: '/add-user', capability: 'users.manage' },
    { prefix: '/all-users', capability: 'users.view' },
    { prefix: '/users', capability: 'users.view' },
    { prefix: '/groups', capability: ['groups.view', 'groups.manage'] },
    { prefix: '/ous', capability: 'ous.view' },
    { prefix: '/computers', capability: ['computers.view', 'computers.manage'] },
    { prefix: '/maintenance/offboarding', capability: 'maintenance.offboard' },
    { prefix: '/maintenance/bulk-update', capability: 'maintenance.bulk-update' },
    { prefix: '/maintenance/reports', capability: 'maintenance.reports' },
    {
        prefix: '/maintenance',
        capability: ['maintenance.offboard', 'maintenance.bulk-update', 'maintenance.reports']
    },
    { prefix: '/audit-logs', capability: 'audit-logs.view' },
    { prefix: '/event-logs/import', capability: 'event-logs.import' },
    { prefix: '/event-logs', capability: 'event-logs.view' },
    { prefix: '/policies/password', capability: 'password-policy.view' },
    { prefix: '/admin', capability: 'admin.manage' }
];

/** Longest (most specific) matching entry wins - e.g. /maintenance/offboarding
 *  over the more general /maintenance. Returns null for unlisted paths. */
export function requiredCapabilitiesForPath(pathname: string): Capability[] | null {
    let best: { prefix: string; capability: Capability | Capability[] } | null = null;

    for (const entry of PAGE_CAPABILITIES) {
        const matches = pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`);
        if (matches && (!best || entry.prefix.length > best.prefix.length)) {
            best = entry;
        }
    }

    if (!best) return null;
    return Array.isArray(best.capability) ? best.capability : [best.capability];
}

/**
 * The LDAP search bases a caller is allowed to query/act within, given
 * their resolved domain scope. 'all' collapses to the app's normal global
 * search root; a restricted scope maps each allowed domain key to that
 * domain's baseOU from adconfig.ts (unset/unknown keys are dropped rather
 * than widening access).
 */
export function allowedSearchBases(domainScope: 'all' | string[]): string[] {
    if (domainScope === 'all') return [searchDN()];

    const domains = AD_CONFIG.domains as Record<string, { baseOU?: string }>;
    return domainScope
        .map((key) => domains[key]?.baseOU)
        .filter((ou): ou is string => Boolean(ou));
}

/** True if `dn` falls under at least one of the caller's allowed search bases. */
export function dnWithinScope(dn: string, domainScope: 'all' | string[]): boolean {
    if (domainScope === 'all') return true;
    const lower = dn.toLowerCase();
    return allowedSearchBases(domainScope).some((base) => lower.endsWith(base.toLowerCase()));
}

let tableReady: Promise<void> | null = null;

export function ensurePermissionTables(): Promise<void> {
    if (!tableReady) {
        tableReady = (async () => {
            const pool = getPool();

            await pool.query(`
                CREATE TABLE IF NOT EXISTS roles (
                    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    name VARCHAR(64) NOT NULL,
                    description VARCHAR(256) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uniq_role_name (name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS role_capabilities (
                    role_id INT UNSIGNED NOT NULL,
                    capability VARCHAR(64) NOT NULL,
                    PRIMARY KEY (role_id, capability),
                    CONSTRAINT fk_role_capabilities_role
                        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS role_assignments (
                    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    principal_dn VARCHAR(512) NOT NULL,
                    principal_name VARCHAR(256) NOT NULL,
                    principal_type ENUM('group', 'user') NOT NULL DEFAULT 'group',
                    role_id INT UNSIGNED NOT NULL,
                    scope_all_domains TINYINT(1) NOT NULL DEFAULT 0,
                    created_by VARCHAR(128) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_principal_dn (principal_dn),
                    CONSTRAINT fk_role_assignments_role
                        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS role_assignment_domains (
                    assignment_id INT UNSIGNED NOT NULL,
                    domain_key VARCHAR(64) NOT NULL,
                    PRIMARY KEY (assignment_id, domain_key),
                    CONSTRAINT fk_role_assignment_domains_assignment
                        FOREIGN KEY (assignment_id) REFERENCES role_assignments(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        })().catch((err) => {
            tableReady = null;
            throw err;
        });
    }

    return tableReady;
}

interface PermissionRow extends RowDataPacket {
    scope_all_domains: number;
    capability: string;
    domain_key: string | null;
}

/**
 * Resolves what a session is actually allowed to do, right now. Re-run on
 * every request (see hooks.server.ts) rather than cached in the session, so
 * revoking a role takes effect within the session instead of waiting out
 * the full 8-hour cookie expiry.
 */
export async function resolvePermissions(user: SessionUser | null): Promise<EffectivePermissions> {
    if (!user) return NO_ACCESS;

    // Tier 1: the local break-glass admin - always full access, no DB or
    // LDAP lookup involved (see $lib/server/localAdmin).
    if (user.authSource === 'local') {
        return { capabilities: new Set(CAPABILITIES), domainScope: 'all' };
    }

    // Tier 2: explicit role assignments, matched against the account's own
    // DN and its group memberships captured at login.
    const principalDns = [user.dn, ...(user.groups ?? [])]
        .filter(Boolean)
        .map((dn) => dn.toLowerCase());

    if (principalDns.length === 0) return NO_ACCESS;

    try {
        await ensurePermissionTables();

        const placeholders = principalDns.map(() => '?').join(',');
        const [rows] = await getPool().query<PermissionRow[]>(
            `SELECT ra.scope_all_domains, rc.capability, rad.domain_key
             FROM role_assignments ra
             JOIN role_capabilities rc ON rc.role_id = ra.role_id
             LEFT JOIN role_assignment_domains rad ON rad.assignment_id = ra.id
             WHERE LOWER(ra.principal_dn) IN (${placeholders})`,
            principalDns
        );

        const capabilities = new Set<Capability>();
        const domainKeys = new Set<string>();
        let scopeAll = false;

        for (const row of rows) {
            if (isCapability(row.capability)) capabilities.add(row.capability);
            if (row.scope_all_domains) scopeAll = true;
            if (row.domain_key) domainKeys.add(row.domain_key);
        }

        if (capabilities.size === 0) return NO_ACCESS;

        return {
            capabilities,
            domainScope: scopeAll ? 'all' : Array.from(domainKeys)
        };
    } catch (err) {
        // Fail closed: a DB hiccup should deny access, not silently grant it.
        console.error('Failed to resolve role-based permissions:', err);
        return NO_ACCESS;
    }
}

// --- Admin CRUD: roles ------------------------------------------------------

export interface RoleSummary {
    id: number;
    name: string;
    description: string | null;
    capabilities: Capability[];
    assignmentCount: number;
}

export async function listRoles(): Promise<RoleSummary[]> {
    await ensurePermissionTables();
    const pool = getPool();

    const [roleRows] = await pool.query<RowDataPacket[]>('SELECT id, name, description FROM roles ORDER BY name');
    const [capRows] = await pool.query<RowDataPacket[]>('SELECT role_id, capability FROM role_capabilities');
    const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT role_id, COUNT(*) AS cnt FROM role_assignments GROUP BY role_id'
    );

    const capsByRole = new Map<number, Capability[]>();
    for (const r of capRows) {
        if (!isCapability(r.capability)) continue;
        const list = capsByRole.get(r.role_id) ?? [];
        list.push(r.capability);
        capsByRole.set(r.role_id, list);
    }

    const countByRole = new Map<number, number>();
    for (const r of countRows) countByRole.set(r.role_id, Number(r.cnt));

    return roleRows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        capabilities: capsByRole.get(r.id) ?? [],
        assignmentCount: countByRole.get(r.id) ?? 0
    }));
}

export async function getRole(id: number): Promise<RoleSummary | null> {
    const roles = await listRoles();
    return roles.find((r) => r.id === id) ?? null;
}

export async function createRole(
    name: string,
    description: string | null,
    capabilities: Capability[]
): Promise<number> {
    await ensurePermissionTables();
    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>('INSERT INTO roles (name, description) VALUES (?, ?)', [
        name,
        description
    ]);
    const roleId = result.insertId;

    if (capabilities.length > 0) {
        await pool.query('INSERT INTO role_capabilities (role_id, capability) VALUES ?', [
            capabilities.map((c) => [roleId, c])
        ]);
    }

    return roleId;
}

export async function updateRole(
    id: number,
    name: string,
    description: string | null,
    capabilities: Capability[]
): Promise<void> {
    await ensurePermissionTables();
    const pool = getPool();

    await pool.query('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description, id]);
    await pool.query('DELETE FROM role_capabilities WHERE role_id = ?', [id]);

    if (capabilities.length > 0) {
        await pool.query('INSERT INTO role_capabilities (role_id, capability) VALUES ?', [
            capabilities.map((c) => [id, c])
        ]);
    }
}

export async function deleteRole(id: number): Promise<void> {
    await ensurePermissionTables();
    // Cascades to role_capabilities and role_assignments (which in turn
    // cascades to role_assignment_domains) via the foreign keys.
    await getPool().query('DELETE FROM roles WHERE id = ?', [id]);
}

// --- Admin CRUD: role assignments -------------------------------------------

export interface RoleAssignmentSummary {
    id: number;
    principalDn: string;
    principalName: string;
    principalType: 'group' | 'user';
    roleId: number;
    roleName: string;
    scopeAllDomains: boolean;
    domainKeys: string[];
    createdBy: string;
    createdAt: string;
}

export async function listAssignments(): Promise<RoleAssignmentSummary[]> {
    await ensurePermissionTables();
    const pool = getPool();

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ra.id, ra.principal_dn, ra.principal_name, ra.principal_type, ra.role_id, r.name AS role_name,
                ra.scope_all_domains, ra.created_by, ra.created_at
         FROM role_assignments ra
         JOIN roles r ON r.id = ra.role_id
         ORDER BY ra.created_at DESC`
    );
    const [domainRows] = await pool.query<RowDataPacket[]>(
        'SELECT assignment_id, domain_key FROM role_assignment_domains'
    );

    const domainsByAssignment = new Map<number, string[]>();
    for (const d of domainRows) {
        const list = domainsByAssignment.get(d.assignment_id) ?? [];
        list.push(d.domain_key);
        domainsByAssignment.set(d.assignment_id, list);
    }

    return rows.map((r) => ({
        id: r.id,
        principalDn: r.principal_dn,
        principalName: r.principal_name,
        principalType: r.principal_type,
        roleId: r.role_id,
        roleName: r.role_name,
        scopeAllDomains: r.scope_all_domains === 1,
        domainKeys: domainsByAssignment.get(r.id) ?? [],
        createdBy: r.created_by,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
    }));
}

export interface CreateAssignmentInput {
    principalDn: string;
    principalName: string;
    principalType: 'group' | 'user';
    roleId: number;
    scopeAllDomains: boolean;
    domainKeys: string[];
    createdBy: string;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<number> {
    await ensurePermissionTables();
    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO role_assignments (principal_dn, principal_name, principal_type, role_id, scope_all_domains, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            input.principalDn,
            input.principalName,
            input.principalType,
            input.roleId,
            input.scopeAllDomains ? 1 : 0,
            input.createdBy
        ]
    );
    const assignmentId = result.insertId;

    if (!input.scopeAllDomains && input.domainKeys.length > 0) {
        await pool.query('INSERT INTO role_assignment_domains (assignment_id, domain_key) VALUES ?', [
            input.domainKeys.map((k) => [assignmentId, k])
        ]);
    }

    return assignmentId;
}

export async function deleteAssignment(id: number): Promise<void> {
    await ensurePermissionTables();
    await getPool().query('DELETE FROM role_assignments WHERE id = ?', [id]);
}

/** The four domains defined in adconfig.ts, for the scope-picker in the
 *  assignment-creation UI. */
export function listDomainOptions(): { key: string; label: string }[] {
    return Object.keys(AD_CONFIG.domains).map((key) => ({ key, label: key }));
}
