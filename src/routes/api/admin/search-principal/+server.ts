import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle } from '$lib/server/ldap';
import { requireCapability } from '$lib/server/permissions';

// Searches AD for a group or user to assign a role to. Only used from the
// admin section's "new assignment" form.
export const GET: RequestHandler = async ({ url, locals }) => {
    requireCapability(locals, 'admin.manage');

    const q = url.searchParams.get('q')?.trim() ?? '';
    const type = url.searchParams.get('type') === 'user' ? 'user' : 'group';

    if (q.length < 2) {
        return json([]);
    }

    try {
        const results = await withLdapClient(async (client) => {
            const term = escapeLdapFilter(q);
            const filter =
                type === 'group'
                    ? `(&(objectCategory=group)(|(cn=*${term}*)(sAMAccountName=*${term}*)))`
                    : `(&(objectCategory=person)(objectClass=user)(|(cn=*${term}*)(sAMAccountName=*${term}*)(displayName=*${term}*)))`;

            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter,
                attributes: ['distinguishedName', 'cn', 'sAMAccountName', 'displayName'],
                sizeLimit: 15
            });

            return searchEntries.map((entry) => {
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                const name =
                    toSingle(entry.displayName) ?? toSingle(entry.cn) ?? toSingle(entry.sAMAccountName) ?? dn;

                return { dn, name, sAMAccountName: toSingle(entry.sAMAccountName) ?? '' };
            });
        });

        return json(results);
    } catch (err) {
        console.error('Failed to search AD principals:', err);
        throw error(500, 'Failed to search Active Directory.');
    }
};
