import type { Actions } from './$types';
import { randomBytes, createHmac } from 'crypto';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ldapAuthenticate } from '$lib/ldap';
import { isAuthorizedDn } from '$lib/server/ldap';
import { writeAuditLog } from '$lib/server/audit';

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
            await writeAuditLog({
                actor: username,
                action: 'login-failed',
                targetSam: username,
                success: false,
                error: ldapUser.error
            });

            return fail(401, { error: ldapUser.error });
        }

        // Defense in depth: ldapAuthenticate already searches only within
        // LDAP_SEARCH_DN_ICT, so this should never trip in practice — but
        // authorization for the whole app hinges on that scope, so it's
        // worth verifying explicitly rather than trusting it implicitly.
        if (!isAuthorizedDn(ldapUser.dn)) {
            await writeAuditLog({
                actor: username,
                action: 'login-denied',
                targetSam: username,
                targetDn: ldapUser.dn,
                success: false,
                error: 'Account authenticated but is not authorized to use this application.'
            });

            return fail(403, { error: 'Your account is not authorized to use this application.' });
        }

        // Build session payload
        const sessionData = {
            username,
            name: ldapUser.name,
            email: ldapUser.email,
            dn: ldapUser.dn,
            exp: Date.now() + (1000 * 60 * 60 * 8) // 8 hours
        };

        const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        const signature = sign(payload);

        const cookieValue = `${payload}.${signature}`;

        cookies.set('session', cookieValue, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'strict'
        });

        await writeAuditLog({
            actor: username,
            action: 'login',
            targetSam: username,
            targetDn: ldapUser.dn,
            success: true,
            details: { name: ldapUser.name, email: ldapUser.email }
        });

        return { success: true };
    }
};