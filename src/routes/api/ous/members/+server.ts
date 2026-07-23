import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, toSingle, ACCOUNTDISABLE } from '$lib/server/ldap';
import type { ADUser } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
    const dn = url.searchParams.get('dn');
    const includeSubOUs = url.searchParams.get('includeSubOUs') === 'true';

    if (!dn) {
        throw error(400, 'A dn query parameter is required.');
    }

    try {
        const users = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(dn, {
                scope: includeSubOUs ? 'sub' : 'one',
                filter: '(&(objectCategory=person)(objectClass=user))',
                attributes: [
                    'distinguishedName',
                    'cn',
                    'displayName',
                    'sAMAccountName',
                    'userPrincipalName',
                    'department',
                    'userAccountControl',
                    'lockoutTime',
                    'lastLogonTimestamp'
                ]
            });

            return searchEntries.map((entry): ADUser => {
                const uac = Number(entry.userAccountControl ?? 0);

                return {
                    dn: toSingle(entry.distinguishedName) ?? (entry.dn as string),
                    cn: toSingle(entry.cn) ?? '',
                    displayName: toSingle(entry.displayName) ?? toSingle(entry.cn) ?? '',
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    mail: toSingle(entry.userPrincipalName),
                    department: toSingle(entry.department),
                    enabled: (uac & ACCOUNTDISABLE) === 0,
                    locked: Number(toSingle(entry.lockoutTime) ?? 0) > 0,
                    lastLogon: toSingle(entry.lastLogonTimestamp)
                };
            }).sort((a, b) => a.displayName.localeCompare(b.displayName));
        });

        return json(users);
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;

        console.error('Failed to load OU members:', err);
        throw error(500, 'Failed to load members for this organizational unit. The OU may no longer exist.');
    }
};
