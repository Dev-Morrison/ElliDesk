import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { withLdapClient, escapeLdapFilter, toSingle } from '$lib/server/ldap';
import { hasCapability, allowedSearchBases } from '$lib/server/permissions';
import type { SearchResultItem } from '$lib/types';

const RESULTS_PER_CATEGORY = 5;

// Global quick-search across the sections a given caller can actually see -
// each category is skipped entirely unless the caller holds its view/manage
// capability, and results are scoped to allowedSearchBases() the same way
// the dedicated list pages are, so a domain-restricted admin never sees a
// hit outside their own domain(s) here either.
export const GET: RequestHandler = async ({ url, locals }) => {
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return json([]);

    const bases = allowedSearchBases(locals.permissions.domainScope);
    if (bases.length === 0) return json([]);

    const term = escapeLdapFilter(q);
    const results: SearchResultItem[] = [];

    const canSeeUsers = hasCapability(locals.permissions, 'users.view') || hasCapability(locals.permissions, 'users.manage');
    const canSeeGroups = hasCapability(locals.permissions, 'groups.view') || hasCapability(locals.permissions, 'groups.manage');
    const canSeeComputers =
        hasCapability(locals.permissions, 'computers.view') || hasCapability(locals.permissions, 'computers.manage');

    if (!canSeeUsers && !canSeeGroups && !canSeeComputers) return json([]);

    try {
        await withLdapClient(async (client) => {
            for (const base of bases) {
                if (canSeeUsers) {
                    const { searchEntries } = await client.search(base, {
                        scope: 'sub',
                        filter: `(&(objectCategory=person)(objectClass=user)(|(displayName=*${term}*)(sAMAccountName=*${term}*)(userPrincipalName=*${term}*)))`,
                        attributes: ['sAMAccountName', 'displayName', 'userPrincipalName'],
                        sizeLimit: RESULTS_PER_CATEGORY
                    });

                    for (const entry of searchEntries) {
                        const sam = toSingle(entry.sAMAccountName) ?? '';
                        if (!sam) continue;

                        results.push({
                            type: 'user',
                            title: toSingle(entry.displayName) ?? sam,
                            subtitle: toSingle(entry.userPrincipalName) ?? sam,
                            href: `/users/${sam}`
                        });
                    }
                }

                if (canSeeGroups) {
                    const { searchEntries } = await client.search(base, {
                        scope: 'sub',
                        filter: `(&(objectCategory=group)(|(cn=*${term}*)(sAMAccountName=*${term}*)))`,
                        attributes: ['sAMAccountName', 'cn', 'description'],
                        sizeLimit: RESULTS_PER_CATEGORY
                    });

                    for (const entry of searchEntries) {
                        const sam = toSingle(entry.sAMAccountName) ?? '';
                        if (!sam) continue;

                        results.push({
                            type: 'group',
                            title: toSingle(entry.cn) ?? sam,
                            subtitle: toSingle(entry.description) ?? sam,
                            href: `/groups/${sam}`
                        });
                    }
                }

                if (canSeeComputers) {
                    const { searchEntries } = await client.search(base, {
                        scope: 'sub',
                        filter: `(&(objectCategory=computer)(|(cn=*${term}*)(dNSHostName=*${term}*)))`,
                        attributes: ['cn', 'dNSHostName', 'operatingSystem'],
                        sizeLimit: RESULTS_PER_CATEGORY
                    });

                    for (const entry of searchEntries) {
                        const cn = toSingle(entry.cn) ?? '';
                        if (!cn) continue;

                        results.push({
                            type: 'computer',
                            title: cn,
                            subtitle: toSingle(entry.operatingSystem) ?? toSingle(entry.dNSHostName) ?? '',
                            href: `/computers?search=${encodeURIComponent(cn)}`
                        });
                    }
                }
            }
        });
    } catch (err) {
        console.error('Global search failed:', err);
        return json({ error: 'Search is temporarily unavailable.' }, { status: 500 });
    }

    return json(results);
};
