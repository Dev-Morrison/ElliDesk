import type { Client } from 'ldapts';
import { getBoundClient, baseDN, toArray, toSingle, cnFromDN, ouFromDN } from '$lib/server/ldap';

// --- Connection ----------------------------------------------------------
// Generic client/attribute plumbing lives in $lib/server/ldap — re-exported
// here so existing bulk-update imports don't need to change.

export { toArray, toSingle, cnFromDN, ouFromDN };

export const getADClient = getBoundClient;
export const getBaseDN = baseDN;

// --- Safety guardrails -----------------------------------------------------
// Accounts belonging to any of these groups are excluded from bulk operations,
// no matter how the scope was selected. This is a floor, not a full permissions
// model — pair it with real authorization checks once auth is wired up.
export const PROTECTED_GROUPS = [
    'Domain Admins',
    'Enterprise Admins',
    'Schema Admins',
    'Administrators'
];

// Whitelist of attributes the bulk-update tool is allowed to write. Keeping
// this explicit (rather than accepting any attribute name from the client)
// prevents the API from being used to write to sensitive attributes like
// userAccountControl, objectSid, or memberOf directly.
export const BULK_EDITABLE_ATTRIBUTES = [
    'department',
    'title',
    'company',
    'physicalDeliveryOfficeName',
    'description',
    'manager'
] as const;

export type BulkEditableAttribute = (typeof BULK_EDITABLE_ATTRIBUTES)[number];

export function isBulkEditableAttribute(attr: string): attr is BulkEditableAttribute {
    return (BULK_EDITABLE_ATTRIBUTES as readonly string[]).includes(attr);
}

// --- Attribute helpers -----------------------------------------------------
// toArray / toSingle / cnFromDN / ouFromDN come from $lib/server/ldap (see
// the re-export above).

// Resolves a friendly OU path (as produced by ouFromDN / shown in dropdowns)
// back to a distinguishedName by searching for organizationalUnit objects.
export async function resolveOUPathToDN(
    client: Client,
    ouPath: string
): Promise<string | undefined> {
    const { searchEntries } = await client.search(getBaseDN(), {
        scope: 'sub',
        filter: '(objectClass=organizationalUnit)',
        attributes: ['distinguishedName']
    });

    for (const entry of searchEntries) {
        const dn = toSingle(entry.distinguishedName) ?? (entry.dn as string);
        if (ouFromDN(`CN=x,${dn}`) === ouPath) {
            return dn;
        }
    }

    return undefined;
}

// Given a list of DNs, resolves each to a displayName. Used to turn manager
// DNs (both current and proposed) into something readable in the preview UI.
// Only queries unique DNs, and only reaches AD for DNs not already cached.
export async function resolveDisplayNames(
    client: Client,
    dns: string[]
): Promise<Map<string, string>> {
    const unique = Array.from(new Set(dns.filter(Boolean)));
    const result = new Map<string, string>();

    await Promise.all(
        unique.map(async (dn) => {
            try {
                const { searchEntries } = await client.search(dn, {
                    scope: 'base',
                    filter: '(objectClass=*)',
                    attributes: ['displayName', 'cn']
                });

                const entry = searchEntries[0];
                const name = toSingle(entry?.displayName) ?? toSingle(entry?.cn) ?? cnFromDN(dn);

                if (name) result.set(dn, name);
            } catch {
                // DN no longer resolves (e.g. deleted object) — fall back to CN parsed from the DN itself.
                const fallback = cnFromDN(dn);
                if (fallback) result.set(dn, fallback);
            }
        })
    );

    return result;
}

// Direct (non-nested) protected-group membership check, based on the
// `memberOf` values already fetched on the user entry. Cheap — no extra
// round trip per user. Nested membership (e.g. a user in a group that is
// itself a member of Domain Admins) is not covered; add an
// LDAP_MATCHING_RULE_IN_CHAIN (1.2.840.113556.1.4.1941) filter if you need
// that level of strictness.
export function isInProtectedGroup(memberOf: string[]): boolean {
    return memberOf.some((dn) => {
        const cn = cnFromDN(dn);
        return cn ? PROTECTED_GROUPS.includes(cn) : false;
    });
}