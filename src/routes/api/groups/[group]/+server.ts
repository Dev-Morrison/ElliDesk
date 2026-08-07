import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import type { Change } from 'ldapts';
import {
    withLdapClient,
    searchDN,
    escapeLdapFilter,
    toArray,
    toSingle,
    cnFromDN,
    ouFromDN,
    parseGroupType,
    buildChange
} from '$lib/server/ldap';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';
import { requireAnyCapability, requireCapability, dnWithinScope } from '$lib/server/permissions';

const GROUP_ATTRIBUTES = [
    'cn',
    'sAMAccountName',
    'description',
    'groupType',
    'distinguishedName',
    'member',
    'managedBy',
    'mail',
    'whenCreated',
    'whenChanged'
];

async function findGroupDN(client: any, sAMAccountName: string): Promise<string | null> {
    const { searchEntries } = await client.search(searchDN(), {
        scope: 'sub',
        filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
        attributes: ['distinguishedName']
    });

    if (searchEntries.length === 0) return null;
    return toSingle(searchEntries[0].distinguishedName) ?? (searchEntries[0].dn as string);
}

export const GET: RequestHandler = async ({ params, locals }) => {
    requireAnyCapability(locals, ['groups.view', 'groups.manage']);

    const sAMAccountName = params.group as string;

    try {
        const group = await withLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=group)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: GROUP_ATTRIBUTES
            });

            if (searchEntries.length === 0) return null;

            const entry = searchEntries[0];
            const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);

            if (!dnWithinScope(dn, locals.permissions.domainScope)) return null;

            const { category, scope } = parseGroupType(toSingle(entry.groupType));
            const managedByDN = toSingle(entry.managedBy);

            return {
                cn: toSingle(entry.cn) ?? '',
                sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                description: toSingle(entry.description) ?? '',
                mail: toSingle(entry.mail) ?? '',
                category,
                scope,
                ou: ouFromDN(dn),
                distinguishedName: dn,
                memberCount: toArray(entry.member).length,
                managedBy: managedByDN
                    ? { dn: managedByDN, displayName: cnFromDN(managedByDN) ?? managedByDN }
                    : null,
                whenCreated: toSingle(entry.whenCreated) ?? null,
                whenChanged: toSingle(entry.whenChanged) ?? null
            };
        });

        if (!group) {
            throw error(404, 'Group not found');
        }

        return json(group);
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to load group:', err);
        throw error(500, 'Failed to load group details');
    }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    requireCapability(locals, 'groups.manage');

    const sAMAccountName = params.group as string;
    const body = await request.json();
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    try {
        const dn = await withLdapClient(async (client) => {
            const dn = await findGroupDN(client, sAMAccountName);
            if (!dn) throw error(404, 'Group not found');

            // Verify scope before the write, not just at lookup - a scoped
            // admin must not be able to modify an out-of-scope group even
            // if they already know its sAMAccountName.
            if (!dnWithinScope(dn, locals.permissions.domainScope)) {
                throw error(404, 'Group not found');
            }

            const changes: Change[] = [];

            if ('description' in body) {
                changes.push(
                    buildChange(
                        body.description ? 'replace' : 'delete',
                        'description',
                        body.description ? [body.description] : []
                    )
                );
            }

            if ('mail' in body) {
                changes.push(
                    buildChange(body.mail ? 'replace' : 'delete', 'mail', body.mail ? [body.mail] : [])
                );
            }

            if ('managedBy' in body) {
                changes.push(
                    buildChange(
                        body.managedBy ? 'replace' : 'delete',
                        'managedBy',
                        body.managedBy ? [body.managedBy] : []
                    )
                );
            }

            if (changes.length > 0) {
                await client.modify(dn, changes);
            }

            return dn;
        });

        await writeAuditLog({
            actor,
            action: 'group-updated',
            targetDn: dn,
            targetSam: sAMAccountName,
            success: true,
            details: body
        });

        return json({ success: true });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            await writeAuditLog({
                actor,
                action: 'group-updated',
                targetSam: sAMAccountName,
                success: false,
                error: 'Group not found'
            });
            throw err;
        }
        console.error('Failed to update group:', err);

        await writeAuditLog({
            actor,
            action: 'group-updated',
            targetSam: sAMAccountName,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        });

        throw error(500, 'Failed to update group');
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    requireCapability(locals, 'groups.manage');

    const sAMAccountName = params.group as string;
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    try {
        const dn = await withLdapClient(async (client) => {
            const dn = await findGroupDN(client, sAMAccountName);
            if (!dn) throw error(404, 'Group not found');

            if (!dnWithinScope(dn, locals.permissions.domainScope)) {
                throw error(404, 'Group not found');
            }

            await client.del(dn);

            return dn;
        });

        await writeAuditLog({
            actor,
            action: 'group-deleted',
            targetDn: dn,
            targetSam: sAMAccountName,
            success: true
        });

        return json({ success: true });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            await writeAuditLog({
                actor,
                action: 'group-deleted',
                targetSam: sAMAccountName,
                success: false,
                error: 'Group not found'
            });
            throw err;
        }
        console.error('Failed to delete group:', err);

        await writeAuditLog({
            actor,
            action: 'group-deleted',
            targetSam: sAMAccountName,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        });

        throw error(500, 'Failed to delete group');
    }
};