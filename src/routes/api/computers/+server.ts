import type { RequestHandler } from './$types';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, toArray, ouFromDN, ACCOUNTDISABLE } from '$lib/server/ldap';
import type { ADComputer } from '$lib/types';
import { requireAnyCapability } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ url, locals }) => {
    requireAnyCapability(locals, ['computers.view', 'computers.manage']);

    const search = url.searchParams.get('search')?.trim() ?? '';

    try {
        const computers = await withLdapClient(async (client) => {
            let filter = '(objectCategory=computer)';

            if (search) {
                const term = escapeLdapFilter(search);
                filter = `(&(objectCategory=computer)(|` +
                    `(cn=*${term}*)` +
                    `(dNSHostName=*${term}*)` +
                    `(operatingSystem=*${term}*)` +
                    `))`;
            }

            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter,
                attributes: [
                    'distinguishedName',
                    'cn',
                    'sAMAccountName',
                    'dNSHostName',
                    'operatingSystem',
                    'operatingSystemVersion',
                    'description',
                    'userAccountControl',
                    'lastLogonTimestamp',
                    'whenCreated',
                    'whenChanged',
                    'servicePrincipalName'
                ]
            });

            return searchEntries.map((entry): ADComputer => {
                const uac = Number(toSingle(entry.userAccountControl) ?? 0);
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);

                return {
                    dn,
                    cn: toSingle(entry.cn) ?? '',
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    dnsHostName: toSingle(entry.dNSHostName),
                    operatingSystem: toSingle(entry.operatingSystem),
                    operatingSystemVersion: toSingle(entry.operatingSystemVersion),
                    description: toSingle(entry.description),
                    ou: ouFromDN(dn),
                    enabled: (uac & ACCOUNTDISABLE) === 0,
                    lastLogon: toSingle(entry.lastLogonTimestamp),
                    whenCreated: toSingle(entry.whenCreated),
                    whenChanged: toSingle(entry.whenChanged),
                    servicePrincipalNameCount: toArray(entry.servicePrincipalName).length
                };
            });
        });

        computers.sort((a, b) => a.cn.localeCompare(b.cn));

        return new Response(JSON.stringify(computers), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Failed to retrieve computers:', err);

        return new Response(JSON.stringify({ error: 'Failed to retrieve computers.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
