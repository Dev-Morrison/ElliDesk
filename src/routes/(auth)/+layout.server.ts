import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { hasCapability, requiredCapabilitiesForPath, serializePermissions } from '$lib/server/permissions';

export const ssr = true;

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {

    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // Re-verified on every request (not just trusted from login) so a
    // session outlives the authorization boundary as briefly as possible.
    if (locals.permissions.capabilities.size === 0) {
        cookies.delete('session', { path: '/' });
        throw redirect(302, '/login');
    }

    // Page-level capability gate — most pages aren't in this table at all
    // and only need the "logged in with some access" check above.
    const required = requiredCapabilitiesForPath(url.pathname);
    if (required && !required.some((cap) => hasCapability(locals.permissions, cap))) {
        throw error(403, 'You do not have permission to view this page.');
    }

    return {
        user: locals.user,
        permissions: serializePermissions(locals.permissions)
    };
};