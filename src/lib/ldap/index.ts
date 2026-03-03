import { Client } from 'ldapts';

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
            await client.bind(bindDN, bindPW);
            const { searchEntries, searchReferences } = await client.search(searchDN, {
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
