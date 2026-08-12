import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { isEventLogName, cleanupEventLogs, type EventLogName } from '$lib/server/eventlogs';
import { writeAuditLog } from '$lib/server/audit';
import { requireCapability } from '$lib/server/permissions';
import type { SessionUser } from '$lib/types';

function resolveLogName(value: unknown): EventLogName | undefined {
    if (!value) return undefined;
    const str = String(value);
    if (!isEventLogName(str)) throw error(400, 'Invalid log type.');
    return str;
}

// Streams progress the same way /api/event-logs/import does — a purge that
// matches millions of rows runs many delete batches under the hood (see
// cleanupEventLogs in $lib/server/eventlogs) and can take a while.
export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'event-logs.import');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    const body = await request.json().catch(() => ({}));
    const olderThanDays = Number(body.olderThanDays);
    const logName = resolveLogName(body.logName);

    if (!Number.isFinite(olderThanDays) || olderThanDays < 1) {
        throw error(400, 'olderThanDays must be a positive number.');
    }

    const beforeDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (obj: unknown) => {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
            };

            let deleted = 0;

            try {
                deleted = await cleanupEventLogs(beforeDate, logName, (deletedSoFar) => {
                    send({ type: 'progress', deleted: deletedSoFar });
                });

                await writeAuditLog({
                    actor,
                    action: 'event-log-cleanup',
                    success: true,
                    details: { olderThanDays, logName: logName ?? 'all', beforeDate: beforeDate.toISOString(), deleted }
                });

                send({ type: 'done', deleted });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';

                await writeAuditLog({
                    actor,
                    action: 'event-log-cleanup',
                    success: false,
                    error: message,
                    details: { olderThanDays, logName: logName ?? 'all', beforeDate: beforeDate.toISOString(), deleted }
                });

                send({ type: 'error', message });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-store'
        }
    });
};
