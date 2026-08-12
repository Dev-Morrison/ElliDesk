import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isEventLogName, previewEventLogCleanup, type EventLogName } from '$lib/server/eventlogs';
import { requireCapability } from '$lib/server/permissions';

function resolveLogName(value: unknown): EventLogName | undefined {
    if (!value) return undefined;
    const str = String(value);
    if (!isEventLogName(str)) throw error(400, 'Invalid log type.');
    return str;
}

export const POST: RequestHandler = async ({ request, locals }) => {
    // Reuses event-logs.import - cleanup is the other half of "manage this
    // data," the same way users.manage bundles create/enable/disable/reset
    // rather than getting its own capability per action.
    requireCapability(locals, 'event-logs.import');

    const body = await request.json().catch(() => ({}));
    const olderThanDays = Number(body.olderThanDays);
    const logName = resolveLogName(body.logName);

    if (!Number.isFinite(olderThanDays) || olderThanDays < 1) {
        throw error(400, 'olderThanDays must be a positive number.');
    }

    const beforeDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const preview = await previewEventLogCleanup(beforeDate, logName);

    return json({ ...preview, beforeDate: beforeDate.toISOString() });
};
