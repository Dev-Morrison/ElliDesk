import type { RequestHandler } from './$types';
import { Client } from 'ldapts';
import { env } from '$env/dynamic/private';

const ACCOUNTDISABLE = 0x0002;
const LOCKOUT = 0x0010;

export const GET: RequestHandler = async () => {
    const client = new Client({
        url: env.LDAP_URL
    });

    try {
        await client.bind(
            env.LDAP_SERVICE_USER_DN,
            env.LDAP_SERVICE_PASSWORD
        );

        const result = await client.search(env.LDAP_SEARCH_DN, {
            scope: 'sub',

            // Only return actual user accounts
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


        await client.unbind();

        const users = result.searchEntries.map((entry: any) => {

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

        // console.log('Retrieved users:', users);

        users.sort((a, b) =>
            String(a.displayName).localeCompare(String(b.displayName))
        );

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