import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, toSingle, ouFromDN, ACCOUNTDISABLE, DONT_EXPIRE_PASSWD } from '$lib/server/ldap';
import { fileTimeToDate } from '$lib/index';
import type { NonExpiringPasswordRow } from '$lib/types';
import { requireCapability } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ locals }) => {
    requireCapability(locals, 'maintenance.reports');

    try {
        const rows = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=${DONT_EXPIRE_PASSWD}))`,
                attributes: [
                    'distinguishedName',
                    'sAMAccountName',
                    'displayName',
                    'department',
                    'userAccountControl',
                    'pwdLastSet'
                ]
            });

            const results: NonExpiringPasswordRow[] = searchEntries.map((entry) => {
                const uac = Number(toSingle(entry.userAccountControl) ?? 0);
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                const pwdLastSetDate = fileTimeToDate(toSingle(entry.pwdLastSet));

                return {
                    dn,
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    displayName: toSingle(entry.displayName) ?? toSingle(entry.sAMAccountName) ?? '',
                    department: toSingle(entry.department) ?? '',
                    ou: ouFromDN(dn),
                    enabled: (uac & ACCOUNTDISABLE) === 0,
                    passwordLastSet: pwdLastSetDate ? pwdLastSetDate.toISOString() : null
                };
            });

            results.sort((a, b) => Number(b.enabled) - Number(a.enabled));

            return results;
        });

        return json(rows);
    } catch (err) {
        console.error('Failed to build non-expiring passwords report:', err);
        throw error(500, 'Failed to load non-expiring passwords report.');
    }
};
