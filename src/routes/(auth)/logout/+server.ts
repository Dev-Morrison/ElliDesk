import { redirect } from '@sveltejs/kit';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

export const GET = async ({ cookies, locals }) => {
    const user = (locals as { user?: SessionUser }).user;

    // Delete session cookie
    cookies.delete('session', {
        path: '/'
    });

    if (user) {
        await writeAuditLog({
            actor: user.username,
            action: 'logout',
            targetSam: user.username,
            success: true
        });
    }

    throw redirect(302, '/login');
};