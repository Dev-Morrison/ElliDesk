import { Attribute, Change, Client } from 'ldapts';
import { env } from '$env/dynamic/private';

const ACCOUNTDISABLE = 0x0002;

async function getClient() {
    const client = new Client({
        url: env.LDAP_URL
    });

    await client.bind(
        env.LDAP_SERVICE_USER_DN,
        env.LDAP_SERVICE_PASSWORD
    );

    return client;
}

export async function setUserEnabled(
    sAMAccountName: string,
    enabled: boolean
) {
    const client = await getClient();

    try {

        const result = await client.search(env.LDAP_SEARCH_DN, {
            scope: 'sub',
            filter: `(sAMAccountName=${sAMAccountName})`,
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

    } finally {
        await client.unbind();
    }
}

export async function unlockUser(username: string) {
    const client = await getClient();

    try {
        const result = await client.search(env.LDAP_SEARCH_DN, {
            scope: 'sub',
            filter: `(sAMAccountName=${username})`,
            attributes: ['distinguishedName']
        });

        if (result.searchEntries.length === 0) {
            throw new Error('User not found');
        }

        const dn = String(result.searchEntries[0].distinguishedName);

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

    } finally {
        await client.unbind();
    }
}