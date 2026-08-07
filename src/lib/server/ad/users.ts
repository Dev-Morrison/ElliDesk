import { Attribute, Change } from 'ldapts';
import { env } from '$env/dynamic/private';
import { escapeLdapFilter, getBoundClient, ACCOUNTDISABLE } from '$lib/server/ldap';
import { dnWithinScope, type EffectivePermissions } from '$lib/server/permissions';

export async function setUserEnabled(
    sAMAccountName: string,
    enabled: boolean,
    domainScope: EffectivePermissions['domainScope'] = 'all'
): Promise<{ dn: string }> {
    const client = await getBoundClient();

    try {

        const result = await client.search(env.LDAP_SEARCH_DN, {
            scope: 'sub',
            filter: `(sAMAccountName=${escapeLdapFilter(sAMAccountName)})`,
            attributes: [
                'distinguishedName',
                'userAccountControl'
            ]
        });

        if (result.searchEntries.length === 0) {
            throw new Error('User not found');
        }

        const user = result.searchEntries[0];

        const dn = String(user.distinguishedName);

        // Identical to "not found" for an out-of-scope target - a restricted
        // admin shouldn't be able to confirm another domain's account exists.
        if (!dnWithinScope(dn, domainScope)) {
            throw new Error('User not found');
        }

        let uac = Number(user.userAccountControl);

        if (enabled) {
            uac &= ~ACCOUNTDISABLE;
        } else {
            uac |= ACCOUNTDISABLE;
        }

        await client.modify(
        dn,
        new Change({
            operation: 'replace',
            modification: new Attribute({
                type: 'userAccountControl',
                values: [String(uac)]
            })
        })
);

        return { dn };

    } finally {
        await client.unbind();
    }
}

export async function unlockUser(
    username: string,
    domainScope: EffectivePermissions['domainScope'] = 'all'
): Promise<{ dn: string }> {
    const client = await getBoundClient();

    try {
        const result = await client.search(env.LDAP_SEARCH_DN, {
            scope: 'sub',
            filter: `(sAMAccountName=${escapeLdapFilter(username)})`,
            attributes: ['distinguishedName']
        });

        if (result.searchEntries.length === 0) {
            throw new Error('User not found');
        }

        const dn = String(result.searchEntries[0].distinguishedName);

        if (!dnWithinScope(dn, domainScope)) {
            throw new Error('User not found');
        }

        await client.modify(
            dn,
            new Change({
                operation: 'replace',
                modification: new Attribute({
                    type: 'lockoutTime',
                    values: ['0']
                })
            })
        );

        return { dn };

    } finally {
        await client.unbind();
    }
}