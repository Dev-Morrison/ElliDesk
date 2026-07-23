import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
    withLdapClient,
    searchDN,
    escapeLdapFilter,
    toArray,
    toSingle,
    cnFromDN,
    ouFromDN,
    parseGroupType
} from '$lib/server/ldap';

const GROUP_ATTRIBUTES = [
    'cn',
    'sAMAccountName',
    'description',
    'groupType',
    'distinguishedName',
    'member',
    'managedBy',
    'mail',
    'whenCreated',
    'whenChanged'
];

export const load: PageServerLoad = async ({ params }) => {
    const sAMAccountName = params.group;

    try {
        const group = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: GROUP_ATTRIBUTES
            });

            if (searchEntries.length === 0) return null;

            const entry = searchEntries[0];
            const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
            const { category, scope } = parseGroupType(toSingle(entry.groupType));
            const managedByDN = toSingle(entry.managedBy);

            return {
                cn: toSingle(entry.cn) ?? '',
                sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                description: toSingle(entry.description) ?? '',
                mail: toSingle(entry.mail) ?? '',
                category,
                scope,
                ou: ouFromDN(dn),
                distinguishedName: dn,
                memberCount: toArray(entry.member).length,
                managedBy: managedByDN
                    ? { dn: managedByDN, displayName: cnFromDN(managedByDN) ?? managedByDN }
                    : null,
                whenCreated: toSingle(entry.whenCreated) ?? null,
                whenChanged: toSingle(entry.whenChanged) ?? null
            };
        });

        if (!group) {
            throw error(404, 'Group not found');
        }

        return { group };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to load group:', err);
        throw error(500, 'Failed to load group details');
    }
};