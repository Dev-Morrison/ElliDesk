import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setComputerEnabled } from '$lib/server/ad/computers';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

export const POST: RequestHandler = async ({ params, locals }) => {
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    try {
        const { dn } = await setComputerEnabled(params.cn, true);

        await writeAuditLog({
            actor,
            action: 'computer-enabled',
            targetDn: dn,
            targetSam: params.cn,
            success: true
        });

        return json({ success: true });
    } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'computer-enabled',
            targetSam: params.cn,
            success: false,
            error: message
        });

        return json({ success: false, error: message }, { status: 500 });
    }
};
