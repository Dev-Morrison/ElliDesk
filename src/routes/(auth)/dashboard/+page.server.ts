import type { PageServerLoad } from './$types';
import { withLdapClient, toSingle, parseGroupType, ACCOUNTDISABLE } from '$lib/server/ldap';
import { allowedSearchBases } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
    // Scoped to whatever domain(s) the signed-in account can see - a
    // restricted admin (e.g. NCRA-only) gets counts for their own domain(s)
    // only, not the whole directory. 'all' scope collapses to the normal
    // single global base, same as everywhere else this pattern is used.
    const bases = allowedSearchBases(locals.permissions.domainScope);

    if (bases.length === 0) {
        return {
            stats: {
                totalUsers: 0,
                enabledUsers: 0,
                disabledUsers: 0,
                lockedUsers: 0,
                totalGroups: 0,
                securityGroups: 0,
                distributionGroups: 0
            }
        };
    }

    try {
        const stats = await withLdapClient(async (client) => {
            let enabledUsers = 0;
            let disabledUsers = 0;
            let lockedUsers = 0;
            const seenUsers = new Set<string>();

            let securityGroups = 0;
            let distributionGroups = 0;
            const seenGroups = new Set<string>();

            for (const base of bases) {
                const userSearch = await client.search(base, {
                    scope: 'sub',
                    filter: '(&(objectCategory=person)(objectClass=user))',
                    attributes: ['distinguishedName', 'userAccountControl', 'lockoutTime']
                });

                for (const entry of userSearch.searchEntries) {
                    const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                    const key = dn.toLowerCase();
                    if (seenUsers.has(key)) continue;
                    seenUsers.add(key);

                    const uac = Number(entry.userAccountControl ?? 0);
                    const isEnabled = (uac & ACCOUNTDISABLE) === 0;

                    if (isEnabled) enabledUsers += 1;
                    else disabledUsers += 1;

                    if (Number(entry.lockoutTime ?? 0) > 0) lockedUsers += 1;
                }

                const groupSearch = await client.search(base, {
                    scope: 'sub',
                    filter: '(objectCategory=group)',
                    attributes: ['distinguishedName', 'groupType']
                });

                for (const entry of groupSearch.searchEntries) {
                    const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                    const key = dn.toLowerCase();
                    if (seenGroups.has(key)) continue;
                    seenGroups.add(key);

                    const { category } = parseGroupType(toSingle(entry.groupType));
                    if (category === 'Security') securityGroups += 1;
                    else distributionGroups += 1;
                }
            }

            return {
                totalUsers: seenUsers.size,
                enabledUsers,
                disabledUsers,
                lockedUsers,
                totalGroups: seenGroups.size,
                securityGroups,
                distributionGroups
            };
        });

        return { stats };
    } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        // Don't fail the whole dashboard if AD is briefly unreachable —
        // render with nulls and let the UI show a friendly empty state.
        return {
            stats: null as null | {
                totalUsers: number;
                enabledUsers: number;
                disabledUsers: number;
                lockedUsers: number;
                totalGroups: number;
                securityGroups: number;
                distributionGroups: number;
            }
        };
    }
};