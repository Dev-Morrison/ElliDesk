import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getADClient, getBaseDN, ouFromDN, toSingle } from '$lib/server/ad-utils';

export const load: PageServerLoad = async () => {
    const client = await getADClient();

    try {
        const { searchEntries } = await client.search(getBaseDN(), {
            scope: 'sub',
            filter: '(objectClass=organizationalUnit)',
            attributes: ['distinguishedName']
        });

        const ous = searchEntries
            .map((entry) => {
                const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
                // Reuse ouFromDN by treating the OU's own DN as if it were a
                // leaf object's DN, so only the OU= segments are kept.
                return ouFromDN(`CN=x,${dn}`);
            })
            .sort();

        return { ous };
    } catch (err) {
        console.error('Failed to load OUs from Active Directory:', err);
        throw error(500, 'Unable to load organizational units from Active Directory');
    } finally {
        await client.unbind();
    }
};