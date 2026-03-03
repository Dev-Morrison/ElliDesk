import type { Handle } from '@sveltejs/kit';
import { createHmac } from 'crypto';
import { env } from '$env/dynamic/private';
import type { SessionUser } from '$lib/types';

function sign(data: string) {
    return createHmac('sha256', env.SESSION_SECRET)
        .update(data)
        .digest('hex');
}

export const handle: Handle = async ({ event, resolve }) => {
    const cookie = event.cookies.get('session');
    if (!cookie) {
        event.locals.user = null;     
        return resolve(event);
    }

    const [payload, signature] = cookie.split('.');

    if (sign(payload) !== signature) {
        event.locals.user = null;
        return resolve(event);
    }

    const user = JSON.parse(Buffer.from(payload, 'base64').toString());

    if (user.exp < Date.now()) {
        event.locals.user = null;
        return resolve(event);
    }

    event.locals.user = user as SessionUser;

    return resolve(event);
};