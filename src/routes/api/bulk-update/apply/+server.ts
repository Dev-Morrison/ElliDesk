import { json, error } from '@sveltejs/kit';
import { Change, Attribute } from 'ldapts';
import type { RequestHandler } from './$types';
import {
    getADClient,
    isBulkEditableAttribute,
    isInProtectedGroup,
    toArray,
    toSingle
} from '$lib/server/ad-utils';
import { writeAuditLogs, type AuditEvent } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

interface ApplyRequestBody {
    targets: string[];
    attribute: string;
    value: string;
}

interface ApplyResult {
    dn: string;
    sAMAccountName: string;
    displayName: string;
    success: boolean;
    error?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
    const { targets, attribute, value } = (await request.json()) as ApplyRequestBody;

    if (!isBulkEditableAttribute(attribute)) {
        throw error(400, `Attribute "${attribute}" is not editable via bulk update.`);
    }

    if (!value || value.trim() === '') {
        throw error(400, 'A value is required.');
    }

    if (!targets || targets.length === 0) {
        throw error(400, 'No target users were provided.');
    }

    // Swap this for whatever your auth layer exposes once it's wired up.
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'system';

    const client = await getADClient();
    const results: ApplyResult[] = [];
    const auditEntries: AuditEvent[] = [];

    try {
        // Processed sequentially rather than in parallel to avoid hammering
        // the domain controller with a burst of simultaneous writes.
        for (const dn of targets) {
            let sAMAccountName = '';
            let displayName = dn;
            let oldValue = '';

            try {
                const { searchEntries } = await client.search(dn, {
                    scope: 'base',
                    filter: '(&(objectCategory=person)(objectClass=user))',
                    attributes: ['sAMAccountName', 'displayName', 'memberOf', attribute]
                });

                const entry = searchEntries[0];

                if (!entry) {
                    throw new Error('User not found');
                }

                sAMAccountName = toSingle(entry.sAMAccountName) ?? '';
                displayName = toSingle(entry.displayName) ?? sAMAccountName ?? dn;
                oldValue = toSingle((entry as any)[attribute]) ?? '';

                // Defense in depth: re-check protection at write time too,
                // in case membership changed between preview and apply.
                if (isInProtectedGroup(toArray(entry.memberOf))) {
                    throw new Error('Blocked: this account belongs to a protected group');
                }

                await client.modify(
                    dn,
                    new Change({
                        operation: 'replace',
                        modification: new Attribute({ type: attribute, values: [value] })
                    })
                );

                results.push({ dn, sAMAccountName, displayName, success: true });

                auditEntries.push({
                    actor,
                    action: 'user-updated',
                    targetDn: dn,
                    targetSam: sAMAccountName,
                    targetDisplayName: displayName,
                    attribute,
                    oldValue,
                    newValue: value,
                    success: true
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';

                results.push({
                    dn,
                    sAMAccountName,
                    displayName,
                    success: false,
                    error: message
                });

                auditEntries.push({
                    actor,
                    action: 'user-updated',
                    targetDn: dn,
                    targetSam: sAMAccountName,
                    targetDisplayName: displayName,
                    attribute,
                    oldValue,
                    newValue: value,
                    success: false,
                    error: message
                });
            }
        }

        await writeAuditLogs(auditEntries);

        return json(results);
    } finally {
        await client.unbind();
    }
};