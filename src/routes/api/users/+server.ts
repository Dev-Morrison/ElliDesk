import type { RequestHandler } from './$types';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, ACCOUNTDISABLE } from '$lib/server/ldap';

export const GET: RequestHandler = async ({ url }) => {
    const search = url.searchParams.get('search')?.trim() ?? '';
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    try {
        let users = await withLdapClient(async (client) => {
            // Only return actual user accounts
            let filter = '(&(objectCategory=person)(objectClass=user))';

            if (search) {
                const term = escapeLdapFilter(search);

                // Match against display name, username, UPN, or CN — typeahead
                // style, so we use a leading+trailing wildcard.
                filter = `(&(objectCategory=person)(objectClass=user)(|` +
                    `(displayName=*${term}*)` +
                    `(sAMAccountName=*${term}*)` +
                    `(userPrincipalName=*${term}*)` +
                    `(cn=*${term}*)` +
                    `))`;
            }

            const result = await client.search(searchDN(), {
                scope: 'sub',
                filter,

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
                ],

                // Ask the DC to cap results itself when a limit is given —
                // cheaper than fetching everything and slicing after.
                ...(limit ? { sizeLimit: limit } : {})
            });

            return result.searchEntries.map((entry) => {
                const uac = Number(toSingle(entry.userAccountControl) ?? 0);

                return {
                    dn: toSingle(entry.distinguishedName) ?? (entry.dn as string),
                    cn: toSingle(entry.cn) ?? '',
                    displayName: toSingle(entry.displayName) ?? '',
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    mail: toSingle(entry.userPrincipalName) ?? '',
                    department: toSingle(entry.department) ?? '',

                    enabled: (uac & ACCOUNTDISABLE) === 0,

                    // lockoutTime > 0 usually indicates a locked account
                    locked: Number(toSingle(entry.lockoutTime) ?? 0) > 0,

                    lastLogon: toSingle(entry.lastLogonTimestamp) ?? null
                };
            });
        });

        users.sort((a, b) => a.displayName.localeCompare(b.displayName));

        // Belt-and-braces in case the LDAP server ignores sizeLimit
        if (limit) {
            users = users.slice(0, limit);
        }

        return new Response(JSON.stringify(users), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (err) {
        console.error(err);

        return new Response(
            JSON.stringify({
                error: 'Failed to retrieve users.'
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
};
