import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { setUserEnabled } from '$lib/server/ad/users';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

export const POST: RequestHandler = async ({ params, locals }) => {
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    try {

        const { dn } = await setUserEnabled(
            params.samAccountName,
            true
        );

        await writeAuditLog({
            actor,
            action: 'user-enabled',
            targetDn: dn,
            targetSam: params.samAccountName,
            success: true
        });

        return json({
            success: true
        });

    } catch (err) {

        console.error(err);

        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'user-enabled',
            targetSam: params.samAccountName,
            success: false,
            error: message
        });

        return json({
            success: false,
            error: message
        }, {
            status: 500
        });

    }

};
