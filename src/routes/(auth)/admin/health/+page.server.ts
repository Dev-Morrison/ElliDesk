import type { PageServerLoad } from './$types';
import { getSystemHealth } from '$lib/server/health';

// Gated centrally by the /admin prefix entry in PAGE_CAPABILITIES
// ((auth)/+layout.server.ts), same as the other /admin/* pages.
export const load: PageServerLoad = async () => {
    return { health: await getSystemHealth() };
};
