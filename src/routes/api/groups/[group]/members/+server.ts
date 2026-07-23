import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, ACCOUNTDISABLE } from '$lib/server/ldap';

export const GET: RequestHandler = async ({ params }) => {
    const sAMAccountName = params.group as string;

    try {
        const result = await withLdapClient(async (client) => {
            const groupSearch = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: ['distinguishedName']
            });

            if (groupSearch.searchEntries.length === 0) return null;

            const groupDN =
                toSingle(groupSearch.searchEntries[0].distinguishedName) ??
                (groupSearch.searchEntries[0].dn as string);

            // Query users directly via memberOf rather than resolving each
            // `member` DN individually — one round trip instead of N.
            const { searchEntries } = await client.search(searchDN(), {
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

            const members = searchEntries.map((entry) => {
                const uac = Number(entry.userAccountControl ?? 0);

                return {
                    dn: toSingle(entry.distinguishedName) ?? (entry.dn as string),
                    cn: toSingle(entry.cn) ?? '',
                    displayName: toSingle(entry.displayName) ?? toSingle(entry.cn) ?? '',
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    department: toSingle(entry.department) ?? '',
                    enabled: (uac & ACCOUNTDISABLE) === 0
                };
            });

            members.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return members;
        });

        if (result === null) {
            throw error(404, 'Group not found');
        }

        return json(result);
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to load group members:', err);
        throw error(500, 'Failed to load group members');
    }
};