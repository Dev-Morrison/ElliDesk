import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { withSecureLdapClient, searchDN, escapeLdapFilter, toSingle, buildChange } from '$lib/server/ldap';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

// AD expects the new password as a UTF-16LE-encoded, quote-wrapped string
// when set via the `unicodePwd` attribute.
function encodePassword(password: string): Buffer {
    return Buffer.from(`"${password}"`, 'utf16le');
}

function validatePassword(password: string): string | null {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters long.';
    }

    const categoriesMet = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
        re.test(password)
    ).length;

    if (categoriesMet < 3) {
        return 'Password must include at least 3 of: lowercase, uppercase, numbers, symbols.';
    }

    return null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
    const sAMAccountName = params.samAccountName as string;
    const body = await request.json().catch(() => ({}));
    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';

    const newPassword: string = body.newPassword ?? '';
    const forceChangeAtLogon: boolean = Boolean(body.forceChangeAtLogon);
    const unlockAccount: boolean = body.unlockAccount !== false;

    const validationError = validatePassword(newPassword);
    if (validationError) {
        throw error(400, validationError);
    }

    try {
        const targetDn = await withSecureLdapClient(async (client) => {
            const { searchEntries } = await client.search(searchDN(), {
                scope: 'sub',
                filter: `(&(objectCategory=person)(objectClass=user)(sAMAccountName=${escapeLdapFilter(sAMAccountName)}))`,
                attributes: ['distinguishedName']
            });

            if (searchEntries.length === 0) {
                throw error(404, 'User not found');
            }

            const dn = toSingle(searchEntries[0].distinguishedName) ?? (searchEntries[0].dn as string);

            const changes = [buildChange('replace', 'unicodePwd', [encodePassword(newPassword)])];

            // pwdLastSet = 0 forces a password change at next interactive logon
            if (forceChangeAtLogon) {
                changes.push(buildChange('replace', 'pwdLastSet', ['0']));
            }

            if (unlockAccount) {
                changes.push(buildChange('replace', 'lockoutTime', ['0']));
            }

            await client.modify(dn, changes);

            return dn;
        });

        // The password itself is never recorded — only that a reset happened.
        await writeAuditLog({
            actor,
            action: 'password-reset',
            targetDn,
            targetSam: sAMAccountName,
            success: true,
            details: { forceChangeAtLogon, unlockAccount }
        });

        return json({ success: true });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            // The only HttpError this can throw is the 404 above.
            await writeAuditLog({
                actor,
                action: 'password-reset',
                targetSam: sAMAccountName,
                success: false,
                error: 'User not found'
            });

            throw err;
        }

        console.error('Failed to reset password:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'password-reset',
            targetSam: sAMAccountName,
            success: false,
            error: message
        });

        throw error(
            500,
            `Failed to reset password: ${message}. If this mentions "confidentiality" or ` +
                `"unwilling to perform," the connection isn't encrypted — confirm the domain ` +
                `controller has a certificate bound for LDAP-over-TLS and that StartTLS is reachable.`
        );
    }
};