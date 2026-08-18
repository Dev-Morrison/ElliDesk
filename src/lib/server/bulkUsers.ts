import { parse } from 'csv-parse/sync';
import type { Client } from 'ldapts';
import { withLdapClient, searchDN, escapeLdapFilter } from '$lib/server/ldap';
import { AD_CONFIG, getOUForDepartment } from '$lib/config/adconfig';

export interface BulkUserRawRow {
    rowNumber: number;
    givenName: string;
    surname: string;
    middleName: string;
    domain: string;
    department: string;
    requestedUsername: string;
}

export interface BulkUserRow extends BulkUserRawRow {
    username: string;
    userPrincipalName: string;
    valid: boolean;
    error?: string;
}

// Same three-step fallback the single Add User page's "Generate" button
// uses (John Mark Doe -> jdoe, then jmdoe, then john.doe) - kept in one
// place so bulk and single-add can't drift apart.
export function candidateUsernames(givenName: string, middleName: string, surname: string): string[] {
    return [
        (givenName[0] + surname).toLowerCase(),
        middleName ? (givenName[0] + middleName[0] + surname).toLowerCase() : null,
        `${givenName}.${surname}`.toLowerCase()
    ].filter((c): c is string => Boolean(c));
}

function normalizeRecord(record: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
        out[key.trim().toLowerCase()] = String(value ?? '').trim();
    }
    return out;
}

export function parseBulkUserCsv(csvText: string): BulkUserRawRow[] {
    const records = parse(csvText, {
        columns: true,
        trim: true,
        skip_empty_lines: true,
        bom: true
    }) as Record<string, unknown>[];

    return records.map((raw, i) => {
        const r = normalizeRecord(raw);
        return {
            rowNumber: i + 2, // +1 for the header row, +1 for 1-based counting
            givenName: r.givenname ?? '',
            surname: r.surname ?? '',
            middleName: r.middlename ?? '',
            domain: r.domain ?? '',
            department: r.department ?? '',
            requestedUsername: r.username ?? ''
        };
    });
}

async function isUsernameFree(client: Client, username: string): Promise<boolean> {
    const { searchEntries } = await client.search(searchDN(), {
        scope: 'sub',
        filter: `(sAMAccountName=${escapeLdapFilter(username)})`
    });
    return searchEntries.length === 0;
}

function departmentExists(domain: string, department: string): boolean {
    try {
        getOUForDepartment(domain as keyof typeof AD_CONFIG.domains, department);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates every row and resolves a final username for it (generating one
 * when the CSV left it blank, the same way the single-add page's Generate
 * button does). Runs against live LDAP for both existing-account collisions
 * and duplicates within the same file, so two blank-username rows for two
 * different "John Doe"s can't both resolve to jdoe.
 */
export async function validateBulkUserRows(
    rawRows: BulkUserRawRow[],
    allowedDomains: string[]
): Promise<BulkUserRow[]> {
    return withLdapClient(async (client) => {
        const claimed = new Set<string>();
        const results: BulkUserRow[] = [];

        const isAvailable = async (candidate: string): Promise<boolean> => {
            const lower = candidate.toLowerCase();
            if (claimed.has(lower)) return false;
            return isUsernameFree(client, candidate);
        };

        for (const raw of rawRows) {
            const row: BulkUserRow = { ...raw, username: '', userPrincipalName: '', valid: true };

            if (!raw.givenName || !raw.surname || !raw.domain || !raw.department) {
                row.valid = false;
                row.error = 'Missing a required field (GivenName, Surname, Domain, Department).';
                results.push(row);
                continue;
            }

            if (!allowedDomains.includes(raw.domain)) {
                row.valid = false;
                row.error = `Domain "${raw.domain}" is not one you're authorized to create users in.`;
                results.push(row);
                continue;
            }

            if (!departmentExists(raw.domain, raw.department)) {
                row.valid = false;
                row.error = `Department "${raw.department}" is not configured for domain "${raw.domain}".`;
                results.push(row);
                continue;
            }

            let resolvedUsername = raw.requestedUsername;

            if (resolvedUsername) {
                if (!(await isAvailable(resolvedUsername))) {
                    row.valid = false;
                    row.error = `Username "${resolvedUsername}" is already taken.`;
                    results.push(row);
                    continue;
                }
            } else {
                let found: string | null = null;
                for (const candidate of candidateUsernames(raw.givenName, raw.middleName, raw.surname)) {
                    if (await isAvailable(candidate)) {
                        found = candidate;
                        break;
                    }
                }

                if (!found) {
                    row.valid = false;
                    row.error = 'Could not generate an available username automatically — set one explicitly.';
                    results.push(row);
                    continue;
                }

                resolvedUsername = found;
            }

            claimed.add(resolvedUsername.toLowerCase());
            row.username = resolvedUsername;
            row.userPrincipalName = `${resolvedUsername}@${raw.domain}`;
            results.push(row);
        }

        return results;
    });
}
