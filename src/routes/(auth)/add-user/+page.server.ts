import type { Actions, PageServerLoad } from './$types';
import { ldapAddUser } from '$lib/ldap';
import type { LdapAddUserParams, SessionUser } from '$lib/types';
import { AD_CONFIG, getGroupsForDepartment, getOUForDepartment } from '$lib/config/adconfig';
import { fail } from '@sveltejs/kit';
import { writeAuditLog, type NewUserAuditLogEntry } from '$lib/server/audit';

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

        // Declared per-request (not at module scope) so concurrent
        // submissions never share or leak into each other's audit entries.
        const auditEntries: NewUserAuditLogEntry[] = [];

        try {
            await ldapAddUser(params);

            auditEntries.push({
                timestamp: new Date().toISOString(),
                actor,
                action: 'user-creation',
                newUserDn: `CN=${displayName},${params.targetOU}`,
                newUserSamAccountName: username,
                newUserDisplayName: displayName,
                newUserDepartment: formattedDepartment,
                success: true
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            // Best-effort audit of the failure too — a logging problem here
            // shouldn't hide the real error from the admin, so it's isolated
            // in its own try/catch.
            try {
                await writeAuditLog([
                    {
                        timestamp: new Date().toISOString(),
                        actor,
                        action: 'user-creation',
                        newUserDn: `CN=${displayName},${params.targetOU}`,
                        newUserSamAccountName: username,
                        newUserDisplayName: displayName,
                        newUserDepartment: formattedDepartment,
                        success: false
                    }
                ]);
            } catch (auditErr) {
                console.error('Failed to write audit log for failed user creation:', auditErr);
            }

            return fail(500, { success: false, message: 'Failed to add user: ' + message });
        }

        try {
            await writeAuditLog(auditEntries);
        } catch (auditErr) {
            console.error('User was created, but writing the audit log failed:', auditErr);

            // The user genuinely was created — don't turn this into an
            // error page over a logging problem, just soften the message.
            return {
                success: true,
                message: 'User added successfully, but the audit log entry could not be recorded.'
            };
        }

        return { success: true, message: 'User added successfully' };
    }
};