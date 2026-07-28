export interface SessionUser {
    username: string;
    email: string;
    name: string;
    dn: string;
    createdAt: number;
}

export interface LdapAddUserParams {
    displayName: string;
    givenName: string;
    surname: string;
    samAccountName: string;
    userPrincipalName: string;
    password: string;
    targetOU: string;
    proxyAddresses: string[];
    department: string;
    baseDN: string;
    groupDNs: string[]; // Optional array of group DNs to add the user to
}


export interface ADUser {
    dn: string;
    cn: string;
    displayName: string;
    sAMAccountName: string;
    mail?: string;
    department?: string;

    enabled: boolean;
    locked: boolean;

    lastLogon?: string;
}

export interface OuNode {
    dn: string;
    name: string;
    directUsers: number;
    totalUsers: number;
    children: OuNode[];
}

export interface ADComputer {
    dn: string;
    cn: string;
    sAMAccountName: string;
    dnsHostName?: string;
    operatingSystem?: string;
    operatingSystemVersion?: string;
    description?: string;
    ou: string;

    enabled: boolean;

    lastLogon?: string;
    whenCreated?: string;
    whenChanged?: string;
    servicePrincipalNameCount: number;
}

export interface OffboardingTarget {
    dn: string;
    sAMAccountName: string;
    displayName: string;
    currentOU: string;
    enabled: boolean;
    groups: { dn: string; name: string }[];
    alreadyInRetention: boolean;
}

export interface OffboardResult {
    dn: string;
    sAMAccountName: string;
    displayName: string;
    success: boolean;
    error?: string;
    removedGroups: string[];
    failedGroups: { name: string; error: string }[];
    disabled: boolean;
    moved: boolean;
}

export interface InactiveDeviceRow {
    dn: string;
    cn: string;
    dnsHostName: string;
    operatingSystem: string;
    ou: string;
    lastLogon: string | null;
    daysSinceLogon: number | null;
}

export interface StaleUserRow {
    dn: string;
    sAMAccountName: string;
    displayName: string;
    department: string;
    ou: string;
    lastLogon: string | null;
    daysSinceLogon: number | null;
}

export interface NonExpiringPasswordRow {
    dn: string;
    sAMAccountName: string;
    displayName: string;
    department: string;
    ou: string;
    enabled: boolean;
    passwordLastSet: string | null;
}

export interface DefaultPasswordPolicy {
    minLength: number | null;
    historyLength: number | null;
    maxAgeDays: number | null; // null = passwords never expire
    minAgeDays: number | null;
    complexityEnabled: boolean;
    reversibleEncryption: boolean;
    lockoutThreshold: number | null; // 0 = lockout disabled
    lockoutDurationMinutes: number | null;
    lockoutObservationMinutes: number | null;
}

export interface FineGrainedPolicy {
    name: string;
    precedence: number | null;
    minLength: number | null;
    historyLength: number | null;
    maxAgeDays: number | null;
    minAgeDays: number | null;
    complexityEnabled: boolean;
    reversibleEncryption: boolean;
    lockoutThreshold: number | null;
    lockoutDurationMinutes: number | null;
    lockoutObservationMinutes: number | null;
    appliesTo: string[];
}