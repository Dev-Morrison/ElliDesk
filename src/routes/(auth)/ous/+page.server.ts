import type { PageServerLoad } from './$types';
import { withLdapClient, searchDN, baseDN, toSingle } from '$lib/server/ldap';
import type { OuNode } from '$lib/types';

export const load: PageServerLoad = async () => {
    try {
        const tree = await withLdapClient(async (client) => {
            const ouSearch = await client.search(baseDN(), {
                scope: 'sub',
                filter: '(objectClass=organizationalUnit)',
                attributes: ['distinguishedName']
            });

            const nodes = new Map<string, OuNode>();

            for (const entry of ouSearch.searchEntries) {
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                const match = dn.match(/^OU=([^,]+)/i);
                const name = match ? match[1] : dn;

                nodes.set(dn.toLowerCase(), { dn, name, directUsers: 0, totalUsers: 0, children: [] });
            }

            // Direct (non-nested) user counts per OU, from a single pass over
            // every user's DN rather than one search per OU.
            const userSearch = await client.search(searchDN(), {
                scope: 'sub',
                filter: '(&(objectCategory=person)(objectClass=user))',
                attributes: ['distinguishedName']
            });

            for (const entry of userSearch.searchEntries) {
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                const parentDN = dn.slice(dn.indexOf(',') + 1).toLowerCase();
                const parent = nodes.get(parentDN);
                if (parent) parent.directUsers += 1;
            }

            const roots: OuNode[] = [];

            for (const node of nodes.values()) {
                const parentDN = node.dn.slice(node.dn.indexOf(',') + 1).toLowerCase();
                const parent = nodes.get(parentDN);
                if (parent) parent.children.push(node);
                else roots.push(node);
            }

            // Post-order: sort children, then roll direct counts up into
            // totalUsers (each node's own users plus every descendant's).
            function finalize(node: OuNode): number {
                node.children.sort((a, b) => a.name.localeCompare(b.name));
                node.totalUsers =
                    node.directUsers + node.children.reduce((sum, child) => sum + finalize(child), 0);
                return node.totalUsers;
            }

            roots.sort((a, b) => a.name.localeCompare(b.name));
            for (const root of roots) finalize(root);

            return roots;
        });

        return { tree, error: null };
    } catch (err) {
        console.error('Failed to load OU structure:', err);
        return {
            tree: [] as OuNode[],
            error: 'Unable to load organizational units from Active Directory.'
        };
    }
};
