import { Attribute, Change } from 'ldapts';
import { withLdapClient, searchDN, escapeLdapFilter, toSingle, ACCOUNTDISABLE } from '$lib/server/ldap';

export async function setComputerEnabled(
    cn: string,
    enabled: boolean
): Promise<{ dn: string }> {
    return withLdapClient(async (client) => {
        const result = await client.search(searchDN(), {
            scope: 'sub',
            // Scoped to objectCategory=computer so this can never touch a
            // user (or other) object that happens to share the same cn.
            filter: `(&(objectCategory=computer)(cn=${escapeLdapFilter(cn)}))`,
            attributes: ['distinguishedName', 'userAccountControl']
        });

        if (result.searchEntries.length === 0) {
            throw new Error('Computer not found');
        }

        const entry = result.searchEntries[0];
        const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);

        let uac = Number(toSingle(entry.userAccountControl) ?? 0);

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
    });
}
