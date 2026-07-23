import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAuthorizedDn } from '$lib/server/ldap';

export const ssr = true;

export const load: LayoutServerLoad = async ({ locals, cookies }) => {

    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // Re-verified on every request (not just trusted from login) so a
    // session outlives the authorization boundary as briefly as possible.
    if (!isAuthorizedDn(locals.user.dn)) {
        cookies.delete('session', { path: '/' });
        throw redirect(302, '/login');
    }

    return {
        user: locals.user
    };
};