import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const ssr = true;

export const load: LayoutServerLoad = async ({ locals,cookies }) => {

    if (!locals.user) {
        throw redirect(302, '/login');
    }

    return {
        user: locals.user
    };
};