import type { PageServerLoad } from './$types';
import { withLdapClient, baseDN, toSingle, toArray, cnFromDN } from '$lib/server/ldap';
import type { DefaultPasswordPolicy, FineGrainedPolicy } from '$lib/types';

const DOMAIN_PASSWORD_COMPLEX = 0x1;
const DOMAIN_PASSWORD_STORE_CLEARTEXT = 0x10;

// AD stores these as negative 100-nanosecond intervals (e.g. "-864000000000"
// for one day). 0 has special, attribute-specific meaning — handled by the
// caller, not here.
function intervalToDays(raw: string | undefined): number | null {
    if (raw === undefined) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) return null;
    return Math.abs(value) / (10_000_000 * 60 * 60 * 24);
}

function intervalToMinutes(raw: string | undefined): number | null {
    if (raw === undefined) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) return null;
    return Math.abs(value) / (10_000_000 * 60);
}

export const load: PageServerLoad = async () => {
    try {
        const { defaultPolicy, fineGrainedPolicies, error: loadError } = await withLdapClient(async (client) => {
            const domainSearch = await client.search(baseDN(), {
                scope: 'base',
                filter: '(objectClass=domain)',
                attributes: [
                    'minPwdLength',
                    'pwdHistoryLength',
                    'maxPwdAge',
                    'minPwdAge',
                    'pwdProperties',
                    'lockoutThreshold',
                    'lockoutDuration',
                    'lockoutObservationWindow'
                ]
            });

            const domainEntry = domainSearch.searchEntries[0];

            if (!domainEntry) {
                return {
                    defaultPolicy: null,
                    fineGrainedPolicies: [],
                    error: 'Could not read the domain object to determine the default password policy.'
                };
            }

            const pwdProperties = Number(toSingle(domainEntry.pwdProperties) ?? 0);
            const lockoutThreshold = Number(toSingle(domainEntry.lockoutThreshold) ?? 0);

            const defaultPolicy: DefaultPasswordPolicy = {
                minLength: Number(toSingle(domainEntry.minPwdLength) ?? 0),
                historyLength: Number(toSingle(domainEntry.pwdHistoryLength) ?? 0),
                maxAgeDays: intervalToDays(toSingle(domainEntry.maxPwdAge)),
                minAgeDays: intervalToDays(toSingle(domainEntry.minPwdAge)),
                complexityEnabled: (pwdProperties & DOMAIN_PASSWORD_COMPLEX) !== 0,
                reversibleEncryption: (pwdProperties & DOMAIN_PASSWORD_STORE_CLEARTEXT) !== 0,
                lockoutThreshold: lockoutThreshold,
                lockoutDurationMinutes: intervalToMinutes(toSingle(domainEntry.lockoutDuration)),
                lockoutObservationMinutes: intervalToMinutes(toSingle(domainEntry.lockoutObservationWindow))
            };

            // Fine-Grained Password Policies (PSOs) — only present on domains
            // that use them; not every domain has this container populated.
            let fineGrainedPolicies: FineGrainedPolicy[] = [];

            try {
                const psoSearch = await client.search(`CN=Password Settings Container,CN=System,${baseDN()}`, {
                    scope: 'one',
                    filter: '(objectClass=msDS-PasswordSettings)',
                    attributes: [
                        'cn',
                        'msDS-PasswordSettingsPrecedence',
                        'msDS-MinimumPasswordLength',
                        'msDS-PasswordHistoryLength',
                        'msDS-MaximumPasswordAge',
                        'msDS-MinimumPasswordAge',
                        'msDS-PasswordComplexityEnabled',
                        'msDS-PasswordReversibleEncryptionEnabled',
                        'msDS-LockoutThreshold',
                        'msDS-LockoutDuration',
                        'msDS-LockoutObservationWindow',
                        'msDS-PSOAppliesTo'
                    ]
                });

                fineGrainedPolicies = psoSearch.searchEntries
                    .map((entry): FineGrainedPolicy => ({
                        name: toSingle(entry.cn) ?? 'Unnamed Policy',
                        precedence: entry['msDS-PasswordSettingsPrecedence']
                            ? Number(toSingle(entry['msDS-PasswordSettingsPrecedence']))
                            : null,
                        minLength: entry['msDS-MinimumPasswordLength']
                            ? Number(toSingle(entry['msDS-MinimumPasswordLength']))
                            : null,
                        historyLength: entry['msDS-PasswordHistoryLength']
                            ? Number(toSingle(entry['msDS-PasswordHistoryLength']))
                            : null,
                        maxAgeDays: intervalToDays(toSingle(entry['msDS-MaximumPasswordAge'])),
                        minAgeDays: intervalToDays(toSingle(entry['msDS-MinimumPasswordAge'])),
                        complexityEnabled: toSingle(entry['msDS-PasswordComplexityEnabled']) === 'TRUE',
                        reversibleEncryption: toSingle(entry['msDS-PasswordReversibleEncryptionEnabled']) === 'TRUE',
                        lockoutThreshold: entry['msDS-LockoutThreshold']
                            ? Number(toSingle(entry['msDS-LockoutThreshold']))
                            : null,
                        lockoutDurationMinutes: intervalToMinutes(toSingle(entry['msDS-LockoutDuration'])),
                        lockoutObservationMinutes: intervalToMinutes(toSingle(entry['msDS-LockoutObservationWindow'])),
                        appliesTo: toArray(entry['msDS-PSOAppliesTo']).map((dn) => cnFromDN(dn) ?? dn)
                    }))
                    .sort((a, b) => (a.precedence ?? Infinity) - (b.precedence ?? Infinity));
            } catch {
                // Container doesn't exist on this domain — no PSOs, not an error.
                fineGrainedPolicies = [];
            }

            return { defaultPolicy, fineGrainedPolicies, error: null };
        });

        return { defaultPolicy, fineGrainedPolicies, error: loadError };
    } catch (err) {
        console.error('Failed to load password policy:', err);
        return {
            defaultPolicy: null as DefaultPasswordPolicy | null,
            fineGrainedPolicies: [] as FineGrainedPolicy[],
            error: 'Unable to load password policy from Active Directory.'
        };
    }
};
