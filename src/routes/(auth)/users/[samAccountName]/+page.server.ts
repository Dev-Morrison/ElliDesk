import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({params, fetch}) => {


    const response = await fetch(
        `/api/users/${params.samAccountName}`
    );


    return {
        selectedUser: await response.json()
    };

};