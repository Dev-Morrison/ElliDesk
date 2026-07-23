import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, buildChange } from '$lib/server/ldap';

export const POST: RequestHandler = async ({ params, request }) => {
    const sAMAccountName = params.group as string;
    const body = await request.json();
    const members: string[] = Array.isArray(body.members) ? body.members : [];

    if (members.length === 0) {
        return json({ success: true, removed: 0 });
    }

    try {
        await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: ['distinguishedName']
            });

            if (searchEntries.length === 0) throw error(404, 'Group not found');

            const groupDN = toSingle(searchEntries[0].distinguishedName) ?? (searchEntries[0].dn as string);

            await client.modify(groupDN, [buildChange('delete', 'member', members)]);
        });

        return json({ success: true, removed: members.length });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to remove group members:', err);
        throw error(500, 'Failed to remove one or more members.');
    }
};