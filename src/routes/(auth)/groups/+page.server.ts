import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
    withLdapClient,
    searchDN,
    toArray,
    toSingle,
    cnFromDN,
    ouFromDN,
    parseGroupType
} from '$lib/server/ldap';

export interface ADGroupListItem {
    cn: string;
    sAMAccountName: string;
    description?: string;
    category: 'Security' | 'Distribution';
    scope: 'Global' | 'Universal' | 'Domain Local';
    ou: string;
    distinguishedName: string;
    memberCount: number;
    managedBy?: string;
}

const GROUP_ATTRIBUTES = [
    'cn',
    'sAMAccountName',
    'description',
    'groupType',
    'distinguishedName',
    'member',
    'managedBy'
];

export const load: PageServerLoad = async () => {
    try {
        const groups: ADGroupListItem[] = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: '(objectCategory=group)',
                attributes: GROUP_ATTRIBUTES,
                paged: true,
                sizeLimit: 0
            });

            return searchEntries.map((entry) => {
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                const { category, scope } = parseGroupType(toSingle(entry.groupType));

                return {
                    cn: toSingle(entry.cn) ?? '',
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    description: toSingle(entry.description),
                    category,
                    scope,
                    ou: ouFromDN(dn),
                    distinguishedName: dn,
                    memberCount: toArray(entry.member).length,
                    managedBy: cnFromDN(toSingle(entry.managedBy))
                };
            });
        });

        groups.sort((a, b) => a.cn.localeCompare(b.cn));

        const securityGroups = groups.filter((g) => g.category === 'Security').length;
        const distributionGroups = groups.filter((g) => g.category === 'Distribution').length;

        return {
            groups,
            totalGroups: groups.length,
            securityGroups,
            distributionGroups
        };
    } catch (err) {
        console.error('Failed to load groups from Active Directory:', err);
        throw error(500, 'Unable to load groups from Active Directory');
    }
};