import type { Actions } from './$types';
import type { Cookies } from '@sveltejs/kit';
import { createHmac } from 'crypto';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ldapAuthenticate } from '$lib/ldap';
import { writeAuditLog } from '$lib/server/audit';
import { resolvePermissions } from '$lib/server/permissions';
import { isLocalAdminUsername, verifyLocalAdminPassword } from '$lib/server/localAdmin';
import type { SessionUser } from '$lib/types';

function sign(data: string) {
    return createHmac('sha256', env.SESSION_SECRET)
        .update(data)
        .digest('hex');
}

function issueSession(cookies: Cookies, sessionData: SessionUser & { exp: number }) {
    const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    const signature = sign(payload);

    cookies.set('session', `${payload}.${signature}`, {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'strict'
    });
}

export const actions: Actions = {
    default: async ({ request, cookies }) => {

        const formData = await request.formData();
        const username = formData.get('username')?.toString() ?? '';
        const password = formData.get('password')?.toString() ?? '';

        // The local admin username is reserved — never looked up in AD, so
        // there's no ambiguity if it happens to collide with a real
        // sAMAccountName there.
        if (isLocalAdminUsername(username)) {
            if (!verifyLocalAdminPassword(password)) {
                await writeAuditLog({
                    actor: username,
                    action: 'login-failed',
                    targetSam: username,
                    success: false,
                    error: 'Invalid local admin credentials'
                });

                return fail(401, { error: 'Invalid username or password.' });
            }

            const sessionData: SessionUser & { exp: number } = {
                username,
                name: 'Local Administrator',
                email: '',
                dn: 'local:admin',
                groups: [],
                authSource: 'local',
                createdAt: Date.now(),
                exp: Date.now() + (1000 * 60 * 60 * 8) // 8 hours
            };

            issueSession(cookies, sessionData);

            await writeAuditLog({
                actor: username,
                action: 'login',
                targetSam: username,
                success: true,
                details: { authSource: 'local' }
            });

            return { success: true };
        }

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

        // ldapAuthenticate's return type isn't a discriminated union, so TS
        // can't narrow these to non-null just from the error check above —
        // they're only ever null alongside an error, but assert that
        // explicitly rather than force it with a cast.
        if (!ldapUser.dn || !ldapUser.name || !ldapUser.email) {
            return fail(500, { error: 'Unexpected authentication response.' });
        }

        // Build session payload
        const sessionData: SessionUser & { exp: number } = {
            username,
            name: ldapUser.name,
            email: ldapUser.email,
            dn: ldapUser.dn,
            groups: ldapUser.groups,
            authSource: 'ldap',
            createdAt: Date.now(),
            exp: Date.now() + (1000 * 60 * 60 * 8) // 8 hours
        };

        // Access comes entirely from an explicit role assignment granted via
        // /admin (see resolvePermissions) — there is no OU-based shortcut.
        // An account can authenticate (valid password) but still not be let
        // into the app if nothing has assigned it a role yet.
        const permissions = await resolvePermissions(sessionData);

        if (permissions.capabilities.size === 0) {
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

        issueSession(cookies, sessionData);

        await writeAuditLog({
            actor: username,
            action: 'login',
            targetSam: username,
            targetDn: ldapUser.dn,
            success: true,
            details: { name: ldapUser.name, email: ldapUser.email, authSource: 'ldap' }
        });

        return { success: true };
    }
};