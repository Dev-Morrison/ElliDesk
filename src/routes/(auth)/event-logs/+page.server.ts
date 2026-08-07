import type { PageServerLoad } from './$types';
import { queryEventLogs, listEventLogFacets, type EventLogFilters } from '$lib/server/eventlogs';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
    const logName = url.searchParams.get('logName') ?? '';
    const level = url.searchParams.get('level') ?? '';
    const machineName = url.searchParams.get('machineName') ?? '';
    const eventIdParam = url.searchParams.get('eventId') ?? '';
    const search = url.searchParams.get('search') ?? '';
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

    const filters: EventLogFilters = {
        logName: logName || undefined,
        level: level || undefined,
        machineName: machineName || undefined,
        eventId: eventIdParam ? Number(eventIdParam) : undefined,
        search: search || undefined,
        from: from ? new Date(`${from}T00:00:00`) : undefined,
        to: to ? new Date(`${to}T23:59:59.999`) : undefined,
        page,
        pageSize: PAGE_SIZE
    };

    try {
        const [{ rows, total }, facets] = await Promise.all([
            queryEventLogs(filters),
            listEventLogFacets()
        ]);

        return {
            rows,
            total,
            page,
            pageSize: PAGE_SIZE,
            facets,
            filters: { logName, level, machineName, eventId: eventIdParam, search, from, to },
            error: null
        };
    } catch (err) {
        console.error('Failed to load event logs:', err);

        return {
            rows: [],
            total: 0,
            page: 1,
            pageSize: PAGE_SIZE,
            facets: { machines: [], levels: [] },
            filters: { logName, level, machineName, eventId: eventIdParam, search, from, to },
            error: 'Unable to load event logs. The database may be unreachable.'
        };
    }
};
