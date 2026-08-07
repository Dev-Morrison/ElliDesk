import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withLdapClient, toSingle, toArray, ouFromDN, cnFromDN, ACCOUNTDISABLE } from '$lib/server/ldap';
import { isInProtectedGroup } from '$lib/server/ad-utils';
import { RetentionOU } from '$lib/config/adconfig';
import type { OffboardingTarget } from '$lib/types';
import { requireCapability } from '$lib/server/permissions';

interface PreviewRequestBody {
    dns: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'maintenance.offboard');

    const { dns } = (await request.json()) as PreviewRequestBody;

    if (!dns || dns.length === 0) {
        throw error(400, 'No users were provided.');
    }

    try {
        const { targets, excluded } = await withLdapClient(async (client) => {
            const targets: OffboardingTarget[] = [];
            const excluded: OffboardingTarget[] = [];

            for (const dn of dns) {
                const { searchEntries } = await client.search(dn, {
                    scope: 'base',
                    filter: '(&(objectCategory=person)(objectClass=user))',
                    attributes: ['distinguishedName', 'sAMAccountName', 'displayName', 'memberOf', 'userAccountControl']
                });

                const entry = searchEntries[0];
                if (!entry) continue;

                const entryDn = toSingle(entry.distinguishedName) ?? dn;
                const memberOf = toArray(entry.memberOf);
                const uac = Number(toSingle(entry.userAccountControl) ?? 0);

                const target: OffboardingTarget = {
                    dn: entryDn,
                    sAMAccountName: toSingle(entry.sAMAccountName) ?? '',
                    displayName: toSingle(entry.displayName) ?? toSingle(entry.sAMAccountName) ?? entryDn,
                    currentOU: ouFromDN(entryDn),
                    enabled: (uac & ACCOUNTDISABLE) === 0,
                    groups: memberOf.map((groupDn) => ({ dn: groupDn, name: cnFromDN(groupDn) ?? groupDn })),
                    alreadyInRetention: entryDn.toLowerCase().endsWith(RetentionOU.toLowerCase())
                };

                if (isInProtectedGroup(memberOf)) {
                    excluded.push(target);
                } else {
                    targets.push(target);
                }
            }

            return { targets, excluded };
        });

        return json({ targets, excluded });
    } catch (err) {
        console.error('Failed to build offboarding preview:', err);
        throw error(500, 'Failed to load offboarding preview.');
    }
};
