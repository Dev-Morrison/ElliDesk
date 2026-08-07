import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { parse } from 'csv-parse';
import {
    isEventLogName,
    parseExportedTimestamp,
    insertEventLogBatch,
    type ParsedEventRow
} from '$lib/server/eventlogs';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

const BATCH_SIZE = 500;

// Streams newline-delimited JSON progress events back to the client rather
// than buffering the whole file (which could be very large — years of
// Security.evtx exports) into memory or blocking one opaque request.
export const POST: RequestHandler = async ({ request, locals }) => {
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    const formData = await request.formData();
    const file = formData.get('file');
    const logName = formData.get('logName')?.toString() ?? '';

    if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'No file uploaded.' }), { status: 400 });
    }

    if (!isEventLogName(logName)) {
        return new Response(JSON.stringify({ error: 'Invalid log type.' }), { status: 400 });
    }

    const sourceFile = file.name;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (obj: unknown) => {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
            };

            let inserted = 0;
            let skipped = 0;
            let batch: ParsedEventRow[] = [];

            const flush = async () => {
                if (batch.length === 0) return;
                try {
                    await insertEventLogBatch(logName, sourceFile, batch);
                    inserted += batch.length;
                } catch (err) {
                    send({
                        type: 'error',
                        message: `Failed to write a batch to the database: ${err instanceof Error ? err.message : 'Unknown error'}`
                    });
                }
                batch = [];
                send({ type: 'progress', inserted, skipped });
            };

            try {
                // file.stream() returns the DOM lib's ReadableStream type, while
                // Readable.fromWeb expects Node's stream/web one — identical at
                // runtime, just declared twice across lib.dom.d.ts and Node's types.
                const nodeStream = Readable.fromWeb(file.stream() as unknown as NodeWebReadableStream<Uint8Array>);
                const parser = parse({
                    columns: true,
                    bom: true,
                    trim: true,
                    skip_empty_lines: true,
                    relax_quotes: true
                });

                nodeStream.pipe(parser);

                for await (const record of parser as AsyncIterable<Record<string, string>>) {
                    const recordId = Number(record.RecordId);
                    const eventId = Number(record.Id);
                    const timeCreated = parseExportedTimestamp(record.TimeCreated);

                    if (!Number.isFinite(recordId) || !Number.isFinite(eventId) || !timeCreated) {
                        skipped += 1;
                        continue;
                    }

                    batch.push({
                        recordId,
                        eventId,
                        timeCreated,
                        level: record.LevelDisplayName || 'Unknown',
                        providerName: record.ProviderName || '',
                        machineName: record.MachineName || 'UNKNOWN',
                        userId: record.UserId || null,
                        message: record.Message || null
                    });

                    if (batch.length >= BATCH_SIZE) {
                        await flush();
                    }
                }

                await flush();

                await writeAuditLog({
                    actor,
                    action: 'event-log-imported',
                    targetSam: logName,
                    success: true,
                    details: { logName, sourceFile, inserted, skipped }
                });

                send({ type: 'done', inserted, skipped });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';

                await writeAuditLog({
                    actor,
                    action: 'event-log-imported',
                    targetSam: logName,
                    success: false,
                    error: message,
                    details: { logName, sourceFile, inserted, skipped }
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
