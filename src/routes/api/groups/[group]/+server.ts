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

export const GET: RequestHandler = async ({ params }) => {
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

export const PATCH: RequestHandler = async ({ params, request }) => {
    const sAMAccountName = params.group as string;
    const body = await request.json();

    try {
        await withLdapClient(async (client) => {
            const dn = await findGroupDN(client, sAMAccountName);
            if (!dn) throw error(404, 'Group not found');

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
        });

        return json({ success: true });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to update group:', err);
        throw error(500, 'Failed to update group');
    }
};

export const DELETE: RequestHandler = async ({ params }) => {
    const sAMAccountName = params.group as string;

    try {
        await withLdapClient(async (client) => {
            const dn = await findGroupDN(client, sAMAccountName);
            if (!dn) throw error(404, 'Group not found');

            await client.del(dn);
        });

        return json({ success: true });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        console.error('Failed to delete group:', err);
        throw error(500, 'Failed to delete group');
    }
};