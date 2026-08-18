import type { PageServerLoad } from './$types';
import { AD_CONFIG } from '$lib/config/adconfig';
import { requireCapability } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
    requireCapability(locals, 'users.manage');

    const allDomains = Object.keys(AD_CONFIG.domains);
    const allowedDomains =
        locals.permissions.domainScope === 'all'
            ? allDomains
            : allDomains.filter((d) => locals.permissions.domainScope.includes(d));

    return { allowedDomains };
};
