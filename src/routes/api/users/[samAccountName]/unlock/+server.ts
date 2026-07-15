import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unlockUser } from '$lib/server/ad/users';

export const POST: RequestHandler = async ({ params }) => {
    try {
        await unlockUser(params.samAccountName);

        return json({
            success: true
        });

    } catch (err) {
        console.error(err);

        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
    }
};