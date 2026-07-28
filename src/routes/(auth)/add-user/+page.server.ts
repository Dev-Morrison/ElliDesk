import type { Actions, PageServerLoad } from './$types';
import { ldapAddUser } from '$lib/ldap';
import type { LdapAddUserParams, SessionUser } from '$lib/types';
import { AD_CONFIG, getGroupsForDepartment, getOUForDepartment } from '$lib/config/adconfig';
import { fail } from '@sveltejs/kit';
import { writeAuditLog } from '$lib/server/audit';

export const load = (async () => {
    return {};
}) satisfies PageServerLoad;

export const actions: Actions = {
    default: async ({ request, locals }) => {
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
