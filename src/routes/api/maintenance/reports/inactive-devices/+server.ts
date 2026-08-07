import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, toSingle, ouFromDN, ACCOUNTDISABLE } from '$lib/server/ldap';
import { fileTimeToDate } from '$lib/index';
import type { InactiveDeviceRow } from '$lib/types';
import { requireCapability } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ url, locals }) => {
    requireCapability(locals, 'maintenance.reports');

    const days = Math.max(1, parseInt(url.searchParams.get('days') ?? '90', 10) || 90);

    try {
        const rows = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: '(objectCategory=computer)',
                attributes: [
                    'distinguishedName',
                    'cn',
                    'dNSHostName',
                    'operatingSystem',
                    'userAccountControl',
                    'lastLogonTimestamp'
                ]
            });

            const results: InactiveDeviceRow[] = [];

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
                    cn: toSingle(entry.cn) ?? '',
                    dnsHostName: toSingle(entry.dNSHostName) ?? '',
                    operatingSystem: toSingle(entry.operatingSystem) ?? '',
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
        console.error('Failed to build inactive devices report:', err);
        throw error(500, 'Failed to load inactive devices report.');
    }
};
