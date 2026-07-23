import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, cnFromDN } from '$lib/server/ldap';

export const load: PageServerLoad = async ({ params }) => {
    const sAMAccountName = params.group;

    try {
        const group = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: ['cn', 'sAMAccountName', 'description', 'mail', 'managedBy']
            });

            if (searchEntries.length === 0) return null;

            const entry = searchEntries[0];
            const managedByDN = toSingle(entry.managedBy);

            return {
                cn: toSingle(entry.cn) ?? '',
                sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                description: toSingle(entry.description) ?? '',
                mail: toSingle(entry.mail) ?? '',
                managedBy: managedByDN
                    ? { dn: managedByDN, displayName: cnFromDN(managedByDN) ?? managedByDN }
                    : null
            };
        });

        if (!group) {
            throw error(404, 'Group not found');
        }

        return { group };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to load group for editing:', err);
        throw error(500, 'Failed to load group details');
    }
};