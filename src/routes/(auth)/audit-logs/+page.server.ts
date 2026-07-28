import type { PageServerLoad } from './$types';
import { queryAuditLogs, listAuditActions, type AuditLogFilters } from '$lib/server/audit';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
    const actor = url.searchParams.get('actor') ?? '';
    const action = url.searchParams.get('action') ?? '';
    const search = url.searchParams.get('search') ?? '';
    const successParam = url.searchParams.get('success') ?? '';
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

    const filters: AuditLogFilters = {
        actor: actor || undefined,
        action: action || undefined,
        search: search || undefined,
        success: successParam === 'true' ? true : successParam === 'false' ? false : undefined,
        from: from ? new Date(`${from}T00:00:00`) : undefined,
        to: to ? new Date(`${to}T23:59:59.999`) : undefined,
        page,
        pageSize: PAGE_SIZE
    };

    try {
        const [{ rows, total }, actions] = await Promise.all([
            queryAuditLogs(filters),
            listAuditActions()
        ]);

        return {
            rows,
            total,
            page,
            pageSize: PAGE_SIZE,
            actions,
            filters: { actor, action, search, success: successParam, from, to },
            error: null
        };
    } catch (err) {
        console.error('Failed to load audit logs:', err);

        return {
            rows: [],
            total: 0,
            page: 1,
            pageSize: PAGE_SIZE,
            actions: [] as string[],
            filters: { actor, action, search, success: successParam, from, to },
            error: 'Unable to load audit logs. The audit database may be unreachable.'
        };
    }
};
