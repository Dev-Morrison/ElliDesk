import { Client, Change, type SearchOptions, Attribute } from 'ldapts';
import { env } from '$env/dynamic/private';
const url = 'ldap://BOS.local:389';
const bindDN = 'CN=Policy Test,OU=MIS_STAFF,OU=MIS,DC=BOS,DC=local';
const bindPW = 'Password@101';
const searchDN = 'DC=BOS,DC=local';

const client = new Client({
    url,
});

export async function ldapAuthenticate(username: string, password: string) {
    let userAuthenticated = false;
    try {
            await client.bind(env.LDAP_SERVICE_USER_DN, env.LDAP_SERVICE_PASSWORD);
            const { searchEntries, searchReferences } = await client.search(env.LDAP_SEARCH_DN, {
                filter: '(sAMAccountName=' + username + ')',
            });
            if (searchEntries.length === 0) {
                return {
                    username: null,
                    email: null,
                    name: null,
                    error: 'User not found'
                };
            } else {
                try {
                    await client.unbind();
                    await client.bind(searchEntries[0].dn, password);
                    userAuthenticated = true;
                    await client.unbind();
                    return {
                        username: searchEntries[0].sAMAccountName,
                        email: searchEntries[0].userPrincipalName,
                        name: searchEntries[0].name,
                        error: null
                    };
                } catch (ex) {
                    console.log(ex);
                    return {
                        username: null,
                        email: null,
                        name: null,
                        error: 'LDAP authentication failed: Incorrect Credentials'
                    };
                }
            }
        } catch (ex) {
            console.log(ex);
            return {
                username: null,
                email: null,
                name: null,
                error: 'LDAP authentication failed: Internal error'
            };
        } 
}



interface LdapAddUserParams {
    displayName: string;
    givenName: string;
    surname: string;
    samAccountName: string;
    userPrincipalName: string;
    password: string;
    targetOU: string;
    proxyAddresses: string[];
    department: string;
    baseDN: string;
}

export async function ldapAddUser(params: LdapAddUserParams): Promise<{ success: boolean; message: string }> {

    const {
        displayName,
        givenName,
        surname,
        samAccountName,
        userPrincipalName,
        password,
        targetOU,
        proxyAddresses,
        department,
    } = params;

    const client = new Client({ url: env.LDAP_URL });
    const userDN = `CN=${displayName},${targetOU}`;

    try {
        await client.bind(env.LDAP_SERVICE_USER_DN, env.LDAP_SERVICE_PASSWORD);

        // 🔎 DUPLICATE PRE-CHECK
        const searchFilter = `
            (|
                (sAMAccountName=${samAccountName})
                (userPrincipalName=${userPrincipalName})
                ${proxyAddresses.map(p => `(proxyAddresses=${p})`).join('')}
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
            userAccountControl: '544' // Disabled
        });

        // Set password (UTF-16LE quoted)
        const quotedPassword = `"${password}"`;
        const passwordBuffer = Buffer.from(quotedPassword, 'utf16le');

        await client.modify(
            userDN,
            new Change({
                operation: 'replace',
                modification: new Attribute({
                    type: 'unicodePwd',
                    values: [passwordBuffer]
                })
            })
        );
        //Enable Account
        await client.modify(
            userDN,
            new Change({
                operation: 'replace',
                modification: new Attribute({
                    type: 'userAccountControl',
                    values: ['512'] // Enabled
                })
            })
        );
        // Force password change at next login
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

        return {
            success: true,
            message: `User ${displayName} created successfully`
        };

    } catch (error: any) {
        console.error('LDAP Add User Error:', error);

        return {
            success: false,
            message: error?.message || 'Failed to create user'
        };

    } finally {
        await client.unbind();
    }
}