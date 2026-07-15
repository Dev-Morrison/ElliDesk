import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {

    const res = await fetch('/api/users');

    return {
        users: await res.json()
    };

};