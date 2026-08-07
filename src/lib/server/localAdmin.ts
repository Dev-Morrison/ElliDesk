// Break-glass local administrator — a single account not tied to LDAP at
// all, configured entirely via env vars. It exists so the app is always
// configurable (create the first role assignment, recover from a bad AD
// config, bootstrap a fresh container deployment before any AD group has
// been wired up) without depending on Active Directory being reachable or
// any particular OU/group already existing there.
//
// Uses Node's built-in scrypt rather than adding a bcrypt-style dependency -
// one less native/npm dependency to carry into a container image.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) return false;

    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, salt, KEY_LENGTH);

    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** True if `username` is the configured local admin account, regardless of
 *  whether `password` is correct — used to decide whether to even attempt
 *  an LDAP bind, since the local admin username is reserved and shouldn't
 *  also be looked up in AD. */
export function isLocalAdminUsername(username: string): boolean {
    const configured = env.LOCAL_ADMIN_USERNAME;
    if (!configured) return false;
    return username.toLowerCase() === configured.toLowerCase();
}

export function verifyLocalAdminPassword(password: string): boolean {
    const configuredHash = env.LOCAL_ADMIN_PASSWORD_HASH;
    if (!configuredHash) return false;
    return verifyPassword(password, configuredHash);
}
