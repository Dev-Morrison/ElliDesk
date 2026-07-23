import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getADClient,
    resolveOUPathToDN,
    resolveDisplayNames,
    isInProtectedGroup,
    isBulkEditableAttribute,
    toArray,
    toSingle,
    ouFromDN
} from '$lib/server/ad-utils';

interface OUScope {
    mode: 'ou';
    ou: string;
    includeSubOUs: boolean;
}

interface ManualScope {
    mode: 'manual';
    dns: string[];
}

interface PreviewRequestBody {
    scope: OUScope | ManualScope;
    attribute: string;
    value: string;
}

interface PreviewTarget {
    dn: string;
    sAMAccountName: string;
    displayName: string;
    ou: string;
    currentValue: string;
    newValue: string;
}

const CANDIDATE_ATTRIBUTES = ['distinguishedName', 'sAMAccountName', 'displayName', 'memberOf'];

export const POST: RequestHandler = async ({ request }) => {
    const body = (await request.json()) as PreviewRequestBody;
    const { scope, attribute, value } = body;

    if (!isBulkEditableAttribute(attribute)) {
        throw error(400, `Attribute "${attribute}" is not editable via bulk update.`);
    }

    if (!value || value.trim() === '') {
        throw error(400, 'A value is required.');
    }

    if (scope.mode === 'manual' && scope.dns.length === 0) {
        throw error(400, 'No users were selected.');
    }

    const client = await getADClient();
    const attributesToFetch = Array.from(new Set([...CANDIDATE_ATTRIBUTES, attribute]));

    try {
        let entries: Record<string, unknown>[] = [];

        if (scope.mode === 'ou') {
            const ouDN = await resolveOUPathToDN(client, scope.ou);

            if (!ouDN) {
                throw error(404, `Could not find the selected OU ("${scope.ou}").`);
            }

            const { searchEntries } = await client.search(ouDN, {
                scope: scope.includeSubOUs ? 'sub' : 'one',
                filter: '(&(objectCategory=person)(objectClass=user))',
                attributes: attributesToFetch
            });

            entries = searchEntries as unknown as Record<string, unknown>[];
        } else {
            const results = await Promise.all(
                scope.dns.map(async (dn) => {
                    try {
                        const { searchEntries } = await client.search(dn, {
                            scope: 'base',
                            filter: '(&(objectCategory=person)(objectClass=user))',
                            attributes: attributesToFetch
                        });
                        return searchEntries[0];
                    } catch {
                        return undefined;
                    }
                })
            );

            entries = results.filter(Boolean) as unknown as Record<string, unknown>[];
        }

        // Collect every DN we'll need a human-readable name for: current
        // manager values (if that's the attribute in play) plus the new
        // value itself when it's a person reference.
        const namesNeeded: string[] = [];
        if (attribute === 'manager') {
            namesNeeded.push(value);
            for (const entry of entries) {
                const current = toSingle((entry as any).manager);
                if (current) namesNeeded.push(current);
            }
        }

        const displayNames =
            namesNeeded.length > 0 ? await resolveDisplayNames(client, namesNeeded) : new Map();

        const included: PreviewTarget[] = [];
        const excluded: PreviewTarget[] = [];

        for (const entry of entries as any[]) {
            const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
            const memberOf = toArray(entry.memberOf);

            const currentRaw = toSingle(entry[attribute]) ?? '';
            const currentValue =
                attribute === 'manager'
                    ? displayNames.get(currentRaw) ?? currentRaw
                    : currentRaw;

            const newValue =
                attribute === 'manager' ? displayNames.get(value) ?? value : value;

            const target: PreviewTarget = {
                dn,
                sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                displayName: toSingle(entry.displayName) ?? toSingle(entry.sAMAccountName) ?? dn,
                ou: ouFromDN(dn),
                currentValue,
                newValue
            };

            if (isInProtectedGroup(memberOf)) {
                excluded.push(target);
            } else {
                included.push(target);
            }
        }

        return json({ targets: included, excluded });
    } finally {
        await client.unbind();
    }
};