import type { RequestHandler } from './$types';
import { withLdapClient, escapeLdapFilter, toSingle, ACCOUNTDISABLE } from '$lib/server/ldap';
import { requireCapability, allowedSearchBases } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ url, locals }) => {
    requireCapability(locals, 'users.view');

    const search = url.searchParams.get('search')?.trim() ?? '';
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // 'all' -> the normal global search root; a restricted scope maps to
    // one or more domain base OUs, searched individually and merged below.
    const bases = allowedSearchBases(locals.permissions.domainScope);

    if (bases.length === 0) {
        return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

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

            const attributes = [
                'distinguishedName',
                'cn',
                'displayName',
                'sAMAccountName',
                'userPrincipalName',
                'department',
                'userAccountControl',
                'lockoutTime',
                'lastLogonTimestamp'
            ];

            const seen = new Set<string>();
            const results: {
                dn: string;
                cn: string;
                displayName: string;
                sAMAccountName: string;
                mail: string;
                department: string;
                enabled: boolean;
                locked: boolean;
                lastLogon: string | null;
            }[] = [];

            // One search per allowed domain base (usually just one - 'all'
            // scope collapses to a single global base already).
            for (const base of bases) {
                const result = await client.search(base, {
                    scope: 'sub',
                    filter,
                    attributes,
                    // Ask the DC to cap results itself when a limit is given —
                    // cheaper than fetching everything and slicing after.
                    ...(limit ? { sizeLimit: limit } : {})
                });

                for (const entry of result.searchEntries) {
                    const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                    const key = dn.toLowerCase();
                    if (seen.has(key)) continue;
                    seen.add(key);

                    const uac = Number(toSingle(entry.userAccountControl) ?? 0);

                    results.push({
                        dn,
                        cn: toSingle(entry.cn) ?? '',
                        displayName: toSingle(entry.displayName) ?? '',
                        sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                        mail: toSingle(entry.userPrincipalName) ?? '',
                        department: toSingle(entry.department) ?? '',

                        enabled: (uac & ACCOUNTDISABLE) === 0,

                        // lockoutTime > 0 usually indicates a locked account
                        locked: Number(toSingle(entry.lockoutTime) ?? 0) > 0,

                        lastLogon: toSingle(entry.lastLogonTimestamp) ?? null
                    });
                }
            }

            return results;
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
