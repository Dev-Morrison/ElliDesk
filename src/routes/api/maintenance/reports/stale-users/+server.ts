import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, toSingle, ouFromDN, ACCOUNTDISABLE } from '$lib/server/ldap';
import { fileTimeToDate } from '$lib/index';
import type { StaleUserRow } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
    const days = Math.max(1, parseInt(url.searchParams.get('days') ?? '90', 10) || 90);

    try {
        const rows = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: '(&(objectCategory=person)(objectClass=user))',
                attributes: [
                    'distinguishedName',
                    'sAMAccountName',
                    'displayName',
                    'department',
                    'userAccountControl',
                    'lastLogonTimestamp'
                ]
            });

            const results: StaleUserRow[] = [];

            for (const entry of searchEntries) {
                const uac = Number(toSingle(entry.userAccountControl) ?? 0);
                if ((uac & ACCOUNTDISABLE) !== 0) continue; // already disabled — not an actionable finding

                const lastLogonRaw = toSingle(entry.lastLogonTimestamp);
                const lastLogonDate = fileTimeToDate(lastLogonRaw);
                const daysSinceLogon = lastLogonDate
                    ? Math.floor((Date.now() - lastLogonDate.getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                if (daysSinceLogon !== null && daysSinceLogon < days) continue;

                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);

                results.push({
                    dn,
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    displayName: toSingle(entry.displayName) ?? toSingle(entry.sAMAccountName) ?? '',
                    department: toSingle(entry.department) ?? '',
                    ou: ouFromDN(dn),
                    lastLogon: lastLogonDate ? lastLogonDate.toISOString() : null,
                    daysSinceLogon
                });
            }

            results.sort((a, b) => (b.daysSinceLogon ?? Infinity) - (a.daysSinceLogon ?? Infinity));

            return results;
        });

        return json(rows);
    } catch (err) {
        console.error('Failed to build stale users report:', err);
        throw error(500, 'Failed to load stale user accounts report.');
    }
};
