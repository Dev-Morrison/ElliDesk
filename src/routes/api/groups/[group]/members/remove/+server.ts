import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, buildChange } from '$lib/server/ldap';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';
import { requireCapability, dnWithinScope } from '$lib/server/permissions';

export const POST: RequestHandler = async ({ params, request, locals }) => {
    requireCapability(locals, 'groups.manage');

    const sAMAccountName = params.group as string;
    const body = await request.json();
    const members: string[] = Array.isArray(body.members) ? body.members : [];
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    if (members.length === 0) {
        return json({ success: true, removed: 0 });
    }

    try {
        const groupDN = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: ['distinguishedName']
            });

            if (searchEntries.length === 0) throw error(404, 'Group not found');

            const groupDN = toSingle(searchEntries[0].distinguishedName) ?? (searchEntries[0].dn as string);

            if (!dnWithinScope(groupDN, locals.permissions.domainScope)) {
                throw error(404, 'Group not found');
            }

            await client.modify(groupDN, [buildChange('delete', 'member', members)]);

            return groupDN;
        });

        await writeAuditLog({
            actor,
            action: 'group-member-removed',
            targetDn: groupDN,
            targetSam: sAMAccountName,
            success: true,
            details: { members }
        });

        return json({ success: true, removed: members.length });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            await writeAuditLog({
                actor,
                action: 'group-member-removed',
                targetSam: sAMAccountName,
                success: false,
                error: 'Group not found',
                details: { members }
            });
            throw err;
        }
        console.error('Failed to remove group members:', err);

        await writeAuditLog({
            actor,
            action: 'group-member-removed',
            targetSam: sAMAccountName,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            details: { members }
        });

        throw error(500, 'Failed to remove one or more members.');
    }
};
