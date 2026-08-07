import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
    withLdapClient,
    toArray,
    toSingle,
    cnFromDN,
    ouFromDN,
    parseGroupType
} from '$lib/server/ldap';
import { requireAnyCapability, allowedSearchBases } from '$lib/server/permissions';

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

export const load: PageServerLoad = async ({ locals }) => {
    requireAnyCapability(locals, ['groups.view', 'groups.manage']);

    const bases = allowedSearchBases(locals.permissions.domainScope);

    if (bases.length === 0) {
        return { groups: [], totalGroups: 0, securityGroups: 0, distributionGroups: 0 };
    }

    try {
        const groups: ADGroupListItem[] = await withLdapClient(async (client) => {
            const seen = new Set<string>();
            const results: ADGroupListItem[] = [];

            // One search per allowed domain base - 'all' scope collapses to
            // a single global base already.
            for (const base of bases) {
                const { searchEntries } = await client.search(base, {
                    scope: 'sub',
                    filter: '(objectCategory=group)',
                    attributes: GROUP_ATTRIBUTES,
                    paged: true,
                    sizeLimit: 0
                });

                for (const entry of searchEntries) {
                    const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                    const key = dn.toLowerCase();
                    if (seen.has(key)) continue;
                    seen.add(key);

                    const { category, scope } = parseGroupType(toSingle(entry.groupType));

                    results.push({
                        cn: toSingle(entry.cn) ?? '',
                        sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                        description: toSingle(entry.description),
                        category,
                        scope,
                        ou: ouFromDN(dn),
                        distinguishedName: dn,
                        memberCount: toArray(entry.member).length,
                        managedBy: cnFromDN(toSingle(entry.managedBy))
                    });
                }
            }

            return results;
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