import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { requireCapability, domainAllowed } from '$lib/server/permissions';
import { ldapAddUser } from '$lib/ldap';
import { getGroupsForDepartment, getOUForDepartment, AD_CONFIG } from '$lib/config/adconfig';
import { writeAuditLog } from '$lib/server/audit';
import type { BulkUserRow } from '$lib/server/bulkUsers';
import type { SessionUser, LdapAddUserParams } from '$lib/types';

// Streams progress the same way /api/event-logs/import does. Takes the
// already-validated rows from the preview step (as JSON, not the original
// CSV) rather than re-validating from scratch, but still re-checks domain
// scope per row at write time - same defense-in-depth pattern as the
// protected-group re-check in offboarding/bulk-update.
export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'users.manage');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'system';
    const body = await request.json().catch(() => null);
    const rows = (body?.rows ?? []) as BulkUserRow[];

    if (!Array.isArray(rows) || rows.length === 0) {
        throw error(400, 'No rows to create.');
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (obj: unknown) => {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
            };

            let created = 0;
            let failed = 0;

            for (const row of rows) {
                if (!row.valid || !row.username) {
                    failed += 1;
                    send({ type: 'row', rowNumber: row.rowNumber, success: false, error: 'Row was not valid at preview time.' });
                    send({ type: 'progress', created, failed, total: rows.length });
                    continue;
                }

                if (!domainAllowed(locals.permissions, row.domain)) {
                    failed += 1;
                    send({ type: 'row', rowNumber: row.rowNumber, success: false, error: 'Not authorized for this domain.' });
                    send({ type: 'progress', created, failed, total: rows.length });
                    continue;
                }

                const displayName = `${row.givenName} ${row.surname}`;
                const formattedDepartment = row.department.split('_').join(' ').toUpperCase();

                const params: LdapAddUserParams = {
                    displayName,
                    givenName: row.givenName,
                    surname: row.surname,
                    samAccountName: row.username,
                    userPrincipalName: row.userPrincipalName,
                    // Same as single Add User: created disabled/passwordless
                    // on purpose - Reset Password both sets the password and
                    // enables the account.
                    password: '',
                    targetOU: getOUForDepartment(row.domain as keyof typeof AD_CONFIG.domains, row.department),
                    groupDNs: getGroupsForDepartment(row.domain as keyof typeof AD_CONFIG.domains, row.department),
                    proxyAddresses: [`SMTP:${row.userPrincipalName}`],
                    department: formattedDepartment,
                    baseDN: 'DC=BOS,DC=local'
                };

                const newUserDn = `CN=${displayName},${params.targetOU}`;

                try {
                    const result = await ldapAddUser(params);
                    if (!result.success) throw new Error(result.message);

                    created += 1;

                    await writeAuditLog({
                        actor,
                        action: 'user-created',
                        targetDn: newUserDn,
                        targetSam: row.username,
                        targetDisplayName: displayName,
                        success: true,
                        details: { department: formattedDepartment, domain: row.domain, bulk: true }
                    });

                    send({ type: 'row', rowNumber: row.rowNumber, success: true, username: row.username });
                } catch (err) {
                    failed += 1;
                    const message = err instanceof Error ? err.message : 'Unknown error';

                    await writeAuditLog({
                        actor,
                        action: 'user-created',
                        targetDn: newUserDn,
                        targetSam: row.username,
                        targetDisplayName: displayName,
                        success: false,
                        error: message,
                        details: { department: formattedDepartment, domain: row.domain, bulk: true }
                    });

                    send({ type: 'row', rowNumber: row.rowNumber, success: false, error: message });
                }

                send({ type: 'progress', created, failed, total: rows.length });
            }

            send({ type: 'done', created, failed });
            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-store'
        }
    });
};
