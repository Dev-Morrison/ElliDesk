import type { Actions, PageServerLoad } from './$types';
import { ldapAddUser } from '$lib/ldap';
import type { LdapAddUserParams, SessionUser } from '$lib/types';
import { AD_CONFIG, getGroupsForDepartment, getOUForDepartment } from '$lib/config/adconfig';
import { fail } from '@sveltejs/kit';
import { writeAuditLog } from '$lib/server/audit';
import { requireCapability, domainAllowed } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
    requireCapability(locals, 'users.manage');

    const allDomains = Object.keys(AD_CONFIG.domains);
    const allowedDomains =
        locals.permissions.domainScope === 'all'
            ? allDomains
            : allDomains.filter((d) => locals.permissions.domainScope.includes(d));

    return { allowedDomains };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        requireCapability(locals, 'users.manage');

        const actor = (locals as { user?: SessionUser })?.user?.username ?? 'system';
        const formData = await request.formData();

        const givenName = formData.get('givenName')?.toString().trim() ?? '';
        const surname = formData.get('surname')?.toString().trim() ?? '';
        const username = formData.get('username')?.toString().trim() ?? '';
        const userPrincipalName = formData.get('userPrincipalName')?.toString().trim() ?? '';
        const department = formData.get('department')?.toString() ?? '';
        const domain =
            (formData.get('domain')?.toString() as keyof typeof AD_CONFIG.domains) || 'bsj.org.jm';

        if (!givenName || !surname || !username || !userPrincipalName || !department) {
            return fail(400, {
                success: false,
                message: 'Please fill in all required fields before submitting.'
            });
        }

        // Defense in depth: the dropdown only ever offers domains within
        // scope, but a restricted admin could still submit another value
        // directly against the form action.
        if (!domainAllowed(locals.permissions, domain)) {
            return fail(403, {
                success: false,
                message: 'You are not authorized to create users in that domain.'
            });
        }

        const displayName = `${givenName} ${surname}`;
        const formattedDepartment = department.split('_').join(' ').toUpperCase();

        const params: LdapAddUserParams = {
            displayName,
            givenName,
            surname,
            samAccountName: username,
            userPrincipalName,
            // Intentionally blank: accounts are created disabled and without
            // a password. An admin sets a password (which also enables the
            // account) via the Reset Password action once the account is ready.
            password: '',
            targetOU: getOUForDepartment(domain, department),
            groupDNs: getGroupsForDepartment(domain, department),
            proxyAddresses: [`SMTP:${userPrincipalName}`],
            department: formattedDepartment,
            baseDN: 'DC=BOS,DC=local'
        };

        const newUserDn = `CN=${displayName},${params.targetOU}`;

        try {
            await ldapAddUser(params);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            await writeAuditLog({
                actor,
                action: 'user-created',
                targetDn: newUserDn,
                targetSam: username,
                targetDisplayName: displayName,
                success: false,
                error: message,
                details: { department: formattedDepartment, domain }
            });

            return fail(500, { success: false, message: 'Failed to add user: ' + message });
        }

        await writeAuditLog({
            actor,
            action: 'user-created',
            targetDn: newUserDn,
            targetSam: username,
            targetDisplayName: displayName,
            success: true,
            details: { department: formattedDepartment, domain }
        });

        return { success: true, message: 'User added successfully' };
    }
};
