import type { Handle } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';
import type { SessionUser } from '$lib/types';
import { isAuthorizedDn } from '$lib/server/ldap';

function sign(data: string) {
    return createHmac('sha256', env.SESSION_SECRET)
        .update(data)
        .digest('hex');
}

// Plain !== leaks timing information byte-by-byte; a signature is a secret
// derived value and should be compared in constant time.
function signaturesMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function resolveSessionUser(cookie: string | undefined): SessionUser | null {
    if (!cookie) return null;

    const [payload, signature] = cookie.split('.');
    if (!payload || !signature || !signaturesMatch(sign(payload), signature)) return null;

    try {
        const user = JSON.parse(Buffer.from(payload, 'base64').toString());
        if (user.exp < Date.now()) return null;
        return user as SessionUser;
    } catch {
        return null;
    }
}

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.user = resolveSessionUser(event.cookies.get('session'));

    // The (auth) layout only gates page navigation — /api/* routes live
    // outside that route group and perform the actual AD reads/writes, so
    // the authorization boundary has to be enforced here too, not just at
    // the page level.
    if (event.url.pathname.startsWith('/api/') && !isAuthorizedDn(event.locals.user?.dn)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return resolve(event);
};