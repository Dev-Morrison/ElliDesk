import type { RequestHandler } from './$types';
import { Client } from 'ldapts';
import { env } from '$env/dynamic/private';

const ACCOUNTDISABLE = 0x0002;
const LOCKOUT = 0x0010;

// Escapes LDAP filter special characters per RFC 4515 so search input
// can't break out of the filter or inject additional clauses.
function escapeLdapFilter(value: string): string {
    return value
        .replace(/\\/g, '\\5c')
        .replace(/\*/g, '\\2a')
        .replace(/\(/g, '\\28')
        .replace(/\)/g, '\\29')
        .replace(/\u0000/g, '\\00');
}

export const GET: RequestHandler = async ({ url }) => {
    const search = url.searchParams.get('search')?.trim() ?? '';
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const client = new Client({
        url: env.LDAP_URL
    });

    try {
        await client.bind(
            env.LDAP_SERVICE_USER_DN,
            env.LDAP_SERVICE_PASSWORD
        );

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

        const result = await client.search(env.LDAP_SEARCH_DN, {
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

        await client.unbind();

        let users = result.searchEntries.map((entry: any) => {

            const uac = Number(entry.userAccountControl ?? 0);

            return {
                dn: entry.distinguishedName ?? '',
                cn: entry.cn ?? '',
                displayName: entry.displayName ?? '',
                sAMAccountName: entry.sAMAccountName ?? '',
                mail: entry.userPrincipalName ?? '',
                department: entry.department ?? '',

                enabled: (uac & ACCOUNTDISABLE) === 0,

                // lockoutTime > 0 usually indicates a locked account
                locked: Number(entry.lockoutTime ?? 0) > 0,

                lastLogon: entry.lastLogonTimestamp ?? null
            };
        });

        users.sort((a, b) =>
            String(a.displayName).localeCompare(String(b.displayName))
        );

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

        try {
            await client.unbind();
        } catch {}

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