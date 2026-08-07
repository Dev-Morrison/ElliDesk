import { Change, type SearchOptions, Attribute } from 'ldapts';
import type { LdapAddUserParams } from '$lib/types';
import { env } from '$env/dynamic/private';
import { escapeLdapFilter, withLdapClient, searchDN, toArray, toSingle } from '$lib/server/ldap';

export async function ldapAuthenticate(username: string, password: string) {
    try {
        return await withLdapClient(async (client) => {
            // Searches the whole directory, not just the ICT OU - finding a
            // candidate account by username doesn't grant access on its own
            // (the bind below still has to succeed with their real password),
            // and *whether* an authenticated account is actually allowed to
            // use the app is decided afterward by resolvePermissions(), which
            // covers both ICT-OU staff and anyone else with a role assignment.
            const { searchEntries } = await client.search(searchDN(), {
                filter: `(sAMAccountName=${escapeLdapFilter(username)})`,
                attributes: ['sAMAccountName', 'userPrincipalName', 'name', 'memberOf', 'distinguishedName']
            });

            if (searchEntries.length === 0) {
                return {
                    username: null,
                    email: null,
                    name: null,
                    dn: null,
                    groups: [] as string[],
                    error: 'User not found'
                };
            }

            try {
                await client.unbind();
                await client.bind(searchEntries[0].dn, password);
                return {
                    username: toSingle(searchEntries[0].sAMAccountName) ?? null,
                    email: toSingle(searchEntries[0].userPrincipalName) ?? null,
                    name: toSingle(searchEntries[0].name) ?? null,
                    dn: searchEntries[0].dn as string,
                    groups: toArray(searchEntries[0].memberOf),
                    error: null
                };
            } catch (ex) {
                console.log(ex);
                return {
                    username: null,
                    email: null,
                    name: null,
                    dn: null,
                    groups: [] as string[],
                    error: 'LDAP authentication failed: Incorrect Credentials'
                };
            }
        });
    } catch (ex) {
        console.log(ex);
        return {
            username: null,
            email: null,
            name: null,
            dn: null,
            groups: [] as string[],
            error: 'LDAP authentication failed: Internal error'
        };
    }
}

export async function ldapAddUser(params: LdapAddUserParams): Promise<{ success: boolean; message: string }> {

    const {
        displayName,
        givenName,
        surname,
        samAccountName,
        userPrincipalName,
        groupDNs,
        targetOU,
        proxyAddresses,
        department,
    } = params;

    const userDN = `CN=${displayName},${targetOU}`;

    try {
        return await withLdapClient(async (client) => {
            // 🔎 DUPLICATE PRE-CHECK
            const searchFilter = `
                (|
                    (sAMAccountName=${escapeLdapFilter(samAccountName)})
                    (userPrincipalName=${escapeLdapFilter(userPrincipalName)})
                    ${proxyAddresses.map(p => `(proxyAddresses=${escapeLdapFilter(p)})`).join('')}
                )
            `.replace(/\s+/g, '');

            const searchOptions: SearchOptions = {
                scope: 'sub',
                filter: searchFilter,
                attributes: ['dn', 'sAMAccountName', 'userPrincipalName']
            };

            const { searchEntries } = await client.search(env.LDAP_BASE_DN, searchOptions);

            if (searchEntries.length > 0) {
                return {
                    success: false,
                    message: `Duplicate account detected: ${searchEntries[0].dn}`
                };
            }

            // 🧱 Create disabled user first
            await client.add(userDN, {
                objectClass: ['top', 'person', 'organizationalPerson', 'user'],
                cn: displayName,
                sn: surname,
                givenName: givenName,
                displayName: displayName,
                sAMAccountName: samAccountName,
                userPrincipalName: userPrincipalName,
                department: department,
                proxyAddresses: proxyAddresses,
                userAccountControl: '546' // Disabled + no password req
            });

            //User must  change password at next login
            await client.modify(
                userDN,
                new Change({
                    operation: 'replace',
                    modification: new Attribute({
                        type: 'pwdLastSet',
                        values: ['0']
                    })
                })
            );

            //Add user to groups
            for (const groupDN of groupDNs) {
                try {
                    const change = new Change({
                        operation: 'add',
                        modification: new Attribute({
                            type: 'member',
                            values: [userDN]
                        })
                    });

                    await client.modify(groupDN, change);

                    console.log(`Added ${userDN} to ${groupDN}`);
                } catch (error) {
                    console.error(`Failed to add ${userDN} to ${groupDN}`, error);
                }
            }

            return {
                success: true,
                message: `User ${displayName} created successfully`
            };
        });
    } catch (error: any) {
        console.error('LDAP Add User Error:', error);

        return {
            success: false,
            message: error?.message || 'Failed to create user'
        };
    }
}

export async function ldapAddUserToGroups(
    userDN: string,
    groupDNs: string[],
) {
    await withLdapClient(async (client) => {
        for (const groupDN of groupDNs) {
            try {
                const change = new Change({
                    operation: 'add',
                    modification: new Attribute({
                        type: 'member',
                        values: [userDN]
                    })
                });

                await client.modify(groupDN, change);

                console.log(`Added ${userDN} to ${groupDN}`);
            } catch (error) {
                console.error(`Failed to add ${userDN} to ${groupDN}`, error);
            }
        }
    });
}
