import type { PageServerLoad } from './$types';
import { listAssignments, listRoles, listDomainOptions } from '$lib/server/permissions';

export const load: PageServerLoad = async () => {
    const [assignments, roles] = await Promise.all([listAssignments(), listRoles()]);

    return {
        assignments,
        roles,
        domainOptions: listDomainOptions()
    };
};
