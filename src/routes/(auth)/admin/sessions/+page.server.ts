import type { PageServerLoad } from './$types';
import { listActiveSessions } from '$lib/server/audit';

// Gated centrally by the /admin prefix entry in PAGE_CAPABILITIES
// ((auth)/+layout.server.ts), same as /admin/roles and /admin/assignments.
export const load: PageServerLoad = async () => {
    return { sessions: await listActiveSessions() };
};
