import { Client, Change, Attribute } from 'ldapts';
import { env } from '$env/dynamic/private';

export const ACCOUNTDISABLE = 0x0002;
export const LOCKOUT = 0x0010;
export const DONT_EXPIRE_PASSWD = 0x10000;

/**
 * Escapes LDAP filter special characters per RFC 4515 so values coming
 * from user input or route params can never break out of a filter or
 * inject additional clauses.
 */
export function escapeLdapFilter(value: string): string {
    return value
        .replace(/\\/g, '\\5c')
        .replace(/\*/g, '\\2a')
        .replace(/\(/g, '\\28')
        .replace(/\)/g, '\\29')
        .replace(/\u0000/g, '\\00');
}

/**
 * Escapes a single DN component (an RDN's value) per RFC 4514 — distinct
 * from `escapeLdapFilter` (RFC 4515, for search filters). Needed whenever a
 * value coming from AD or user input is used to *build* a DN, e.g. moving
 * an object with `client.modifyDN()`.
 */
export function escapeDN(value: string): string {
    return value
        .replace(/[\\",+<>;]/g, (c) => `\\${c}`)
        .replace(/^ /, '\\ ')
        .replace(/^#/, '\\#')
        .replace(/ $/, '\\ ');
}

export function toArray(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? (value as string[]) : [value as string];
}

export function toSingle(value: unknown): string | undefined {
    const arr = toArray(value);
    return arr.length > 0 ? arr[0] : undefined;
}

// Pulls the CN value out of a DN, e.g. "CN=John Smith,OU=Users,DC=..." -> "John Smith"
export function cnFromDN(dn: string | undefined): string | undefined {
    if (!dn) return undefined;
    const match = dn.match(/^CN=([^,]+)/i);
    return match ? match[1] : undefined;
}

// Builds a readable OU path from a DN, e.g.
// "CN=ICT,OU=Security Groups,OU=Groups,DC=company,DC=local" -> "Groups › Security Groups"
export function ouFromDN(dn: string): string {
    const parts = dn.split(',').filter((p) => p.startsWith('OU='));
    const names = parts.map((p) => p.replace(/^OU=/i, ''));
    return names.reverse().join(' › ') || 'Root';
}

// groupType is a signed 32-bit int:
//   negative     -> Security group
//   non-negative -> Distribution group
// Scope is encoded in the low bits (checked against the unsigned value):
//   0x00000002 Global
//   0x00000004 Domain Local
//   0x00000008 Universal
export function parseGroupType(raw: string | undefined): {
    category: 'Security' | 'Distribution';
    scope: 'Global' | 'Universal' | 'Domain Local';
} {
    const value = parseInt(raw ?? '0', 10);
    const category = value < 0 ? 'Security' : 'Distribution';
    const unsigned = value >>> 0;

    let scope: 'Global' | 'Universal' | 'Domain Local' = 'Global';
    if (unsigned & 0x00000004) scope = 'Domain Local';
    else if (unsigned & 0x00000008) scope = 'Universal';
    else if (unsigned & 0x00000002) scope = 'Global';

    return { category, scope };
}

/**
 * Opens an LDAP client, binds using the service account, runs `fn`, and
 * always unbinds afterwards (even if `fn` throws). Centralizes the
 * connection lifecycle so individual routes only worry about their query.
 */
export async function withLdapClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({
        url: env.LDAP_URL
        
    });

    try {
        await client.bind(env.LDAP_SERVICE_USER_DN, env.LDAP_SERVICE_PASSWORD);
        return await fn(client);
    } finally {
        try {
            await client.unbind();
        } catch {
            // already disconnected — nothing to do
        }
    }
}

export function searchDN(): string {
    return env.LDAP_SEARCH_DN;
}

export function baseDN(): string {
    return env.LDAP_BASE_DN;
}

/**
 * Opens an LDAP client, binds using the service account, and returns it
 * still bound — unlike `withLdapClient`, the caller owns the connection
 * lifecycle (their own try/finally) rather than handing it to a callback.
 * Prefer `withLdapClient` for a single query; use this when a route needs
 * to hold the connection open across a loop or several sequential calls.
 */
export async function getBoundClient(): Promise<Client> {
    const client = new Client({
        url: env.LDAP_URL
    });

    await client.bind(env.LDAP_SERVICE_USER_DN, env.LDAP_SERVICE_PASSWORD);

    return client;
}

/**
 * The app's authorization boundary: only accounts whose DN falls under the
 * ICT OU (the same DN ldapAuthenticate searches within at login) are
 * treated as authorized users of anything behind the (auth) layout.
 *
 * Re-checked on every request (not just at login) against the DN embedded
 * in the signed session cookie, so a long-lived 8-hour session can't
 * outlive a narrowing of that scope without also being caught here. Fails
 * closed if LDAP_SEARCH_DN_ICT isn't configured.
 */
export function isAuthorizedDn(dn: string | null | undefined): boolean {
    const base = env.LDAP_SEARCH_DN_ICT;
    if (!dn || !base) return false;
    return dn.toLowerCase().endsWith(base.toLowerCase());
}

/**
 * ldapts' `client.modify()` requires actual `Change` instances wrapping
 * an `Attribute` instance — plain object literals with the matching
 * shape are rejected by its TypeScript types (and, in some versions, at
 * runtime too). This centralizes correct construction so routes never
 * hand-build the objects themselves.
 */
export function buildChange(
    operation: 'add' | 'delete' | 'replace',
    type: string,
    values: string[] | Buffer[]
): Change {
    return new Change({
        operation,
        modification: new Attribute({ type, values })
    });
}

/**
 * Some AD write operations — most notably setting `unicodePwd` — are
 * refused by the domain controller unless the connection itself is
 * encrypted, regardless of how the bind credentials are protected.
 *
 * This upgrades a normal `ldap://` connection to TLS via the StartTLS
 * extended operation before binding, so you don't need a separate
 * `ldaps://` URL/port just for password operations. The DC must have a
 * server certificate bound for LDAP-over-TLS for this to succeed — if it
 * doesn't, StartTLS (and ldaps://) will both fail identically, and that
 * has to be fixed on the DC/PKI side, not here.
 *
 * Uses LDAP_SECURE_URL if set, falling back to LDAP_URL otherwise. These
 * only need to differ if the domain-wide alias (e.g. BOS.local, which can
 * round-robin across multiple DCs) doesn't match the hostname the LDAPS
 * certificate was actually issued for — TLS hostname verification fails
 * against an alias even when the cert itself is trusted. Point
 * LDAP_SECURE_URL at that specific DC's hostname in that case, while
 * everything else keeps using the round-robin alias via LDAP_URL.
 *
 * Set LDAP_TLS_REJECT_UNAUTHORIZED=false in env only if the DC is using
 * a self-signed or internal-CA certificate that isn't in Node's trust
 * store — prefer adding the CA cert via NODE_EXTRA_CA_CERTS instead,
 * since disabling verification accepts any certificate.
 */
export async function withSecureLdapClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({
        url: env.LDAP_SECURE_URL || env.LDAP_URL
    });

    try {
        await client.startTLS({
            rejectUnauthorized: env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false'
        });
        await client.bind(env.LDAP_SERVICE_USER_DN, env.LDAP_SERVICE_PASSWORD);
        return await fn(client);
    } finally {
        try {
            await client.unbind();
        } catch {
            // already disconnected — nothing to do
        }
    }
}