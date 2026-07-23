import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { withLdapClient, searchDN, toSingle, parseGroupType, ACCOUNTDISABLE } from '$lib/server/ldap';

export const load: PageServerLoad = async () => {
    try {
        const stats = await withLdapClient(async (client) => {
            const userSearch = await client.search(searchDN(), {
                scope: 'sub',
                filter: '(&(objectCategory=person)(objectClass=user))',
                attributes: ['userAccountControl', 'lockoutTime']
            });

            let enabledUsers = 0;
            let disabledUsers = 0;
            let lockedUsers = 0;

            for (const entry of userSearch.searchEntries) {
                const uac = Number(entry.userAccountControl ?? 0);
                const isEnabled = (uac & ACCOUNTDISABLE) === 0;

                if (isEnabled) enabledUsers += 1;
                else disabledUsers += 1;

                if (Number(entry.lockoutTime ?? 0) > 0) lockedUsers += 1;
            }

            const groupSearch = await client.search(searchDN(), {
                scope: 'sub',
                filter: '(objectCategory=group)',
                attributes: ['groupType']
            });

            let securityGroups = 0;
            let distributionGroups = 0;

            for (const entry of groupSearch.searchEntries) {
                const { category } = parseGroupType(toSingle(entry.groupType));
                if (category === 'Security') securityGroups += 1;
                else distributionGroups += 1;
            }

            return {
                totalUsers: userSearch.searchEntries.length,
                enabledUsers,
                disabledUsers,
                lockedUsers,
                totalGroups: groupSearch.searchEntries.length,
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