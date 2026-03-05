export interface SessionUser {
    username: string;
    email: string;
    name: string;
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