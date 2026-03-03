import { redirect } from '@sveltejs/kit';

export const GET = async ({ cookies }) => {

    // Delete session cookie
    cookies.delete('session', {
        path: '/'
    });

    throw redirect(302, '/login');
};