import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, ACCOUNTDISABLE } from '$lib/server/ldap';
import { requireCapability, dnWithinScope } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ params, locals }) => {
    requireCapability(locals, 'groups.manage');

    const sAMAccountName = params.group;

    try {
        const result = await withLdapClient(async (client) => {
            const groupSearch = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: ['cn', 'sAMAccountName', 'distinguishedName']
            });

            if (groupSearch.searchEntries.length === 0) return null;

            const groupEntry = groupSearch.searchEntries[0];
            const groupDN =
                toSingle(groupEntry.distinguishedName) ?? (groupEntry.dn as string);

            if (!dnWithinScope(groupDN, locals.permissions.domainScope)) return null;

            const memberSearch = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=person)(objectClass=user)(memberOf=${escapeLdapFilter(groupDN)}))`,
                attributes: [
                    'distinguishedName',
                    'cn',
                    'displayName',
                    'sAMAccountName',
                    'department',
                    'userAccountControl'
                ]
            });

            const members = memberSearch.searchEntries.map((entry) => {
                const uac = Number(entry.userAccountControl ?? 0);

                return {
                    dn: toSingle(entry.distinguishedName) ?? (entry.dn as string),
                    displayName: toSingle(entry.displayName) ?? toSingle(entry.cn) ?? '',
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    department: toSingle(entry.department) ?? '',
                    enabled: (uac & ACCOUNTDISABLE) === 0
                };
            });

            members.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return {
                group: {
                    cn: toSingle(groupEntry.cn) ?? '',
                    sAMAccountName: toSingle(groupEntry.sAMAccountName) ?? ''
                },
                members
            };
        });

        if (!result) {
            throw error(404, 'Group not found');
        }

        return result;
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to load group members:', err);
        throw error(500, 'Failed to load group members');
    }
};
