import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { Client } from 'ldapts';
import { env } from '$env/dynamic/private';
import { escapeLdapFilter } from '$lib/server/ldap';

export const GET: RequestHandler = async ({ params }) => {

    const client = new Client({
        url: env.LDAP_URL
    });

    try {

        await client.bind(
            env.LDAP_SERVICE_USER_DN,
            env.LDAP_SERVICE_PASSWORD
        );


        const result = await client.search(
            env.LDAP_SEARCH_DN,
            {
                scope: 'sub',
                filter: `(sAMAccountName=${escapeLdapFilter(params.samAccountName ?? '')})`,

                attributes: [
                    '*',
                    '+'
                ]
            }
        );


        await client.unbind();


        if(result.searchEntries.length === 0){

            return json(
                {error:"User not found"},
                {status:404}
            );

        }


        const user = result.searchEntries[0];


        return json(user);


    } catch(err){

        console.error(err);

        return json(
            {
                error:"LDAP error"
            },
            {
                status:500
            }
        );
    }

};