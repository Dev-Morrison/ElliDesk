import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    withLdapClient,
    toSingle,
    toArray,
    cnFromDN,
    ouFromDN,
    escapeDN,
    buildChange,
    ACCOUNTDISABLE
} from '$lib/server/ldap';
import { isInProtectedGroup } from '$lib/server/ad-utils';
import { RetentionOU } from '$lib/config/adconfig';
import { writeAuditLogs, type AuditEvent } from '$lib/server/audit';
import type { SessionUser, OffboardResult } from '$lib/types';
import { requireCapability } from '$lib/server/permissions';

interface ApplyRequestBody {
    targets: string[];
    removeGroups: boolean;
    disable: boolean;
    moveToRetention: boolean;
}

export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'maintenance.offboard');

    const { targets, removeGroups, disable, moveToRetention } = (await request.json()) as ApplyRequestBody;
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    if (!targets || targets.length === 0) {
        throw error(400, 'No target users were provided.');
    }

    if (!removeGroups && !disable && !moveToRetention) {
        throw error(400, 'Select at least one offboarding action.');
    }

    const results: OffboardResult[] = [];
    const auditEntries: AuditEvent[] = [];

    await withLdapClient(async (client) => {
        // Processed sequentially, same as bulk-update — this hits multiple
        // group objects plus the user object per target, and running many
        // of these concurrently would hammer the DC for no real benefit.
        for (const dn of targets) {
            let sAMAccountName = '';
            let displayName = dn;
            const originalOU = ouFromDN(dn);

            const result: OffboardResult = {
                dn,
                sAMAccountName: '',
                displayName: dn,
                success: false,
                removedGroups: [],
                failedGroups: [],
                disabled: false,
                moved: false
            };

            try {
                const { searchEntries } = await client.search(dn, {
                    scope: 'base',
                    filter: '(&(objectCategory=person)(objectClass=user))',
                    attributes: ['distinguishedName', 'cn', 'sAMAccountName', 'displayName', 'memberOf', 'userAccountControl']
                });

                const entry = searchEntries[0];
                if (!entry) throw new Error('User not found');

                const cn = toSingle(entry.cn) ?? '';
                sAMAccountName = toSingle(entry.sAMAccountName) ?? '';
                displayName = toSingle(entry.displayName) ?? sAMAccountName ?? dn;
                result.sAMAccountName = sAMAccountName;
                result.displayName = displayName;

                const memberOf = toArray(entry.memberOf);

                // Defense in depth: re-check protection at write time too,
                // in case membership changed between preview and apply.
                if (isInProtectedGroup(memberOf)) {
                    throw new Error('Blocked: this account belongs to a protected group');
                }

                let currentDn = dn;
                let uac = Number(toSingle(entry.userAccountControl) ?? 0);

                if (removeGroups) {
                    for (const groupDn of memberOf) {
                        const groupName = cnFromDN(groupDn) ?? groupDn;
                        try {
                            await client.modify(groupDn, buildChange('delete', 'member', [currentDn]));
                            result.removedGroups.push(groupName);
                        } catch (groupErr) {
                            result.failedGroups.push({
                                name: groupName,
                                error: groupErr instanceof Error ? groupErr.message : 'Unknown error'
                            });
                        }
                    }
                }

                if (disable) {
                    await client.modify(
                        currentDn,
                        buildChange('replace', 'userAccountControl', [String(uac | ACCOUNTDISABLE)])
                    );
                    result.disabled = true;
                }

                if (moveToRetention) {
                    if (currentDn.toLowerCase().endsWith(RetentionOU.toLowerCase())) {
                        result.moved = true; // already there — nothing to do
                    } else {
                        const newDn = `CN=${escapeDN(cn || sAMAccountName)},${RetentionOU}`;
                        await client.modifyDN(currentDn, newDn);
                        currentDn = newDn;
                        result.moved = true;
                    }
                }

                result.dn = currentDn;

                const failedSubActions = result.failedGroups.length > 0;
                result.success = !failedSubActions;
                if (failedSubActions) {
                    result.error = `Failed to remove ${result.failedGroups.length} group(s)`;
                }
            } catch (err) {
                result.error = err instanceof Error ? err.message : 'Unknown error';
                result.success = false;
            }

            results.push(result);

            auditEntries.push({
                actor,
                action: 'user-offboarded',
                targetDn: result.dn,
                targetSam: sAMAccountName,
                targetDisplayName: displayName,
                success: result.success,
                error: result.error,
                details: {
                    removeGroupsRequested: removeGroups,
                    disableRequested: disable,
                    moveToRetentionRequested: moveToRetention,
                    removedGroups: result.removedGroups,
                    failedGroups: result.failedGroups,
                    disabled: result.disabled,
                    moved: result.moved,
                    movedFrom: originalOU,
                    movedTo: result.moved ? RetentionOU : null
                }
            });
        }
    });

    await writeAuditLogs(auditEntries);

    return json(results);
};
