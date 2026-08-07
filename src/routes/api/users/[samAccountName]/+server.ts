import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle } from '$lib/server/ldap';
import { requireCapability, dnWithinScope } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ params, locals }) => {
    requireCapability(locals, 'users.view');

    try {
        const user = await withLdapClient(async (client) => {
            const result = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(sAMAccountName=${escapeLdapFilter(params.samAccountName ?? '')})`,
                attributes: ['*', '+']
            });

            return result.searchEntries[0] ?? null;
        });

        if (!user) {
            throw error(404, 'User not found');
        }

        const dn = toSingle(user.distinguishedName) ?? (user.dn as string);

        // Out-of-scope reads look identical to "doesn't exist" - a scoped
        // admin shouldn't be able to confirm another domain's accounts even
        // exist, let alone view them.
        if (!dnWithinScope(dn, locals.permissions.domainScope)) {
            throw error(404, 'User not found');
        }

        return json(user);
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;

        console.error(err);
        throw error(500, 'LDAP error');
    }
};
