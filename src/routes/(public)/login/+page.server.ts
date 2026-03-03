import type { Actions } from './$types';
import { randomBytes, createHmac } from 'crypto';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ldapAuthenticate } from '$lib/ldap';

function sign(data: string) {
    return createHmac('sha256', env.SESSION_SECRET)
        .update(data)
        .digest('hex');
}

export const actions: Actions = {
    default: async ({ request, cookies }) => {

        const formData = await request.formData();
        const username = formData.get('username')?.toString() ?? '';
        const password = formData.get('password')?.toString() ?? '';
        
        const ldapUser = await ldapAuthenticate(username, password);
        

        if (ldapUser?.error) {
            return fail(401, { error: ldapUser.error });
        }

        // Build session payload
        const sessionData = {
            username,
            name: ldapUser.name,
            email: ldapUser.email,
            exp: Date.now() + (1000 * 60 * 60 * 8) // 8 hours
        };

        const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        const signature = sign(payload);

        const cookieValue = `${payload}.${signature}`;

        cookies.set('session', cookieValue, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'strict'
        });
        return { success: true };
    }
};