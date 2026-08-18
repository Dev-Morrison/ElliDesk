// In-memory login-attempt throttle, keyed by client IP. Deliberately not
// backed by the database - this has to keep working independently of DB
// health (see QUERY_TIMEOUT_MS in db.ts for the reasoning: the login path
// specifically shouldn't gain new dependencies on the DB being up), and
// resets on process restart, which is an acceptable tradeoff for a
// defense-in-depth throttle rather than the sole security boundary.
//
// Exists because the local break-glass admin account (see
// $lib/server/localAdmin) has no lockout of its own the way AD accounts do
// - unlimited password guesses against it otherwise. Applied to every login
// attempt (local admin and LDAP alike) rather than just the local admin
// path, since the app is also a convenient proxy for hammering LDAP binds
// against real AD accounts.

interface AttemptRecord {
    failures: number;
    firstFailureAt: number;
    blockedUntil: number | null;
    blockCount: number;
}

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // failures must land within this window to count together
const BASE_BLOCK_MS = 5 * 60 * 1000; // first block: 5 minutes
const MAX_BLOCK_MS = 60 * 60 * 1000; // escalates up to 1 hour for repeat offenders
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const attempts = new Map<string, AttemptRecord>();
let lastCleanup = Date.now();

// Opportunistic sweep (no persistent timer needed) so the map doesn't grow
// unbounded from one-off failures that never escalate to a block.
function cleanup(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;

    for (const [key, record] of attempts) {
        const stillBlocked = record.blockedUntil !== null && record.blockedUntil > now;
        const withinWindow = now - record.firstFailureAt < WINDOW_MS;
        if (!stillBlocked && !withinWindow) attempts.delete(key);
    }
}

export interface RateLimitStatus {
    limited: boolean;
    retryAfterMs?: number;
}

export function checkRateLimit(key: string): RateLimitStatus {
    const now = Date.now();
    cleanup(now);

    const record = attempts.get(key);
    if (!record || record.blockedUntil === null) return { limited: false };

    if (now < record.blockedUntil) {
        return { limited: true, retryAfterMs: record.blockedUntil - now };
    }

    // Block has expired - drop the record so the next failure starts a
    // fresh window, but blockCount already lives in a fresh record either
    // way since this path only runs once the old one is stale.
    attempts.delete(key);
    return { limited: false };
}

export function recordLoginFailure(key: string): void {
    const now = Date.now();
    const record = attempts.get(key);

    if (!record || now - record.firstFailureAt > WINDOW_MS) {
        attempts.set(key, {
            failures: 1,
            firstFailureAt: now,
            blockedUntil: null,
            blockCount: record?.blockCount ?? 0
        });
        return;
    }

    record.failures += 1;

    if (record.failures >= MAX_FAILURES) {
        record.blockCount += 1;
        const blockMs = Math.min(BASE_BLOCK_MS * 2 ** (record.blockCount - 1), MAX_BLOCK_MS);
        record.blockedUntil = now + blockMs;
    }
}

export function recordLoginSuccess(key: string): void {
    attempts.delete(key);
}

export function formatRetryAfter(ms: number): string {
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
}
