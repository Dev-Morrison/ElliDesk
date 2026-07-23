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