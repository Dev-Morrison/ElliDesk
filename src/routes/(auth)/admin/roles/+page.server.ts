import type { PageServerLoad } from './$types';
import { listRoles } from '$lib/server/permissions';

export const load: PageServerLoad = async () => {
    return { roles: await listRoles() };
};
