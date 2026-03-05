import type { Actions, PageServerLoad } from './$types';
import {ldapAddUser, ldapAddUserToGroups} from '$lib/ldap';
import type { LdapAddUserParams } from '$lib/types';
import { AD_CONFIG, getGroupsForDepartment, getOUForDepartment } from '$lib/config/adconfig';
import { fail } from '@sveltejs/kit';

export const load = (async () => {
    return {};
}) satisfies PageServerLoad;

export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();
        let givenName = formData.get('givenName')?.toString() ?? '';
        let surname = formData.get('surname')?.toString() ?? '';
        let username = formData.get('username')?.toString() ?? '';
        let userPrincipalName = formData.get('userPrincipalName')?.toString() ?? '';
        let department = formData.get('department')?.toString() ?? '';
        let displayName = `${givenName} ${surname}`;
        let domain: keyof typeof AD_CONFIG.domains = formData.get('domain')?.toString() as keyof typeof AD_CONFIG.domains || 'bsj.org.jm';
        
        let params: LdapAddUserParams = {
            displayName,
            givenName,
            surname,
            samAccountName: username,
            userPrincipalName,
            password: 'Password123', // In a real application, you would want to generate a secure password or allow the admin to set it
            targetOU: getOUForDepartment(domain, department),
            groupDNs: getGroupsForDepartment(domain, department),
            proxyAddresses: [`SMTP:${userPrincipalName}`],
            department,
            baseDN: 'DC=BOS,DC=local'
        };
        console.log(params);
        try {
            // throw new Error('This functionality is currently disabled for testing purposes');
            // ldapAddUser(params);
        } catch (error: any) {
            return fail(500, { success: false, message: 'Failed to add user: ' + error.message });
        }
        return { success: true, message: 'User added successfully'}
    }
};