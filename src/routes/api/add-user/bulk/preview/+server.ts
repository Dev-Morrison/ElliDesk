import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { requireCapability } from '$lib/server/permissions';
import { AD_CONFIG } from '$lib/config/adconfig';
import { parseBulkUserCsv, validateBulkUserRows } from '$lib/server/bulkUsers';

const MAX_ROWS = 200;

export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'users.manage');

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
        throw error(400, 'No file uploaded.');
    }

    const csvText = await file.text();

    let rawRows;
    try {
        rawRows = parseBulkUserCsv(csvText);
    } catch (err) {
        throw error(400, `Could not parse CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    if (rawRows.length === 0) {
        throw error(400, 'The CSV has no data rows.');
    }

    if (rawRows.length > MAX_ROWS) {
        throw error(400, `Bulk import is limited to ${MAX_ROWS} rows per file — split into smaller batches.`);
    }

    // Same scoping as the single Add User page - a restricted admin can
    // only ever validate rows into domain(s) they're actually allowed to
    // create users in.
    const allDomains = Object.keys(AD_CONFIG.domains);
    const allowedDomains =
        locals.permissions.domainScope === 'all'
            ? allDomains
            : allDomains.filter((d) => locals.permissions.domainScope.includes(d));

    const rows = await validateBulkUserRows(rawRows, allowedDomains);

    return json(rows);
};
