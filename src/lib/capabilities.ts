// Client-safe capability catalog — extracted from lib/server/permissions.ts
// so admin UI pages (which run in the browser) can render capability
// checkboxes without importing server-only modules (DB pool, etc.).
// lib/server/permissions.ts re-exports these for server-side code.

export const CAPABILITIES = [
    'users.view',
    'users.manage', // create, enable/disable/unlock/reset-password, edit attributes
    'groups.view',
    'groups.manage',
    'computers.view',
    'computers.manage',
    'ous.view',
    'maintenance.offboard',
    'maintenance.bulk-update',
    'maintenance.reports',
    'audit-logs.view',
    'event-logs.view',
    'event-logs.import',
    'password-policy.view',
    'admin.manage'
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: string): value is Capability {
    return (CAPABILITIES as readonly string[]).includes(value);
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
    'users.view': 'View Users',
    'users.manage': 'Manage Users',
    'groups.view': 'View Groups',
    'groups.manage': 'Manage Groups',
    'computers.view': 'View Computers',
    'computers.manage': 'Manage Computers',
    'ous.view': 'View Organizational Units',
    'maintenance.offboard': 'Offboarding',
    'maintenance.bulk-update': 'Bulk Update',
    'maintenance.reports': 'Maintenance Reports',
    'audit-logs.view': 'View Audit Logs',
    'event-logs.view': 'View Event Logs',
    'event-logs.import': 'Import Event Logs',
    'password-policy.view': 'View Password Policy',
    'admin.manage': 'Administration'
};

// Short forms for use inside a grouped picker (e.g. a "Users" card showing
// "View" / "Manage" chips) where the group heading already supplies the
// resource name and repeating it in every chip would be redundant.
export const CAPABILITY_SHORT_LABELS: Record<Capability, string> = {
    'users.view': 'View',
    'users.manage': 'Manage',
    'groups.view': 'View',
    'groups.manage': 'Manage',
    'computers.view': 'View',
    'computers.manage': 'Manage',
    'ous.view': 'View',
    'maintenance.offboard': 'Offboarding',
    'maintenance.bulk-update': 'Bulk Update',
    'maintenance.reports': 'Reports',
    'audit-logs.view': 'View',
    'event-logs.view': 'View',
    'event-logs.import': 'Import',
    'password-policy.view': 'View',
    'admin.manage': 'Manage'
};

export interface CapabilityGroup {
    label: string;
    capabilities: Capability[];
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
    { label: 'Users', capabilities: ['users.view', 'users.manage'] },
    { label: 'Groups', capabilities: ['groups.view', 'groups.manage'] },
    { label: 'Computers', capabilities: ['computers.view', 'computers.manage'] },
    { label: 'Organizational Units', capabilities: ['ous.view'] },
    {
        label: 'Maintenance',
        capabilities: ['maintenance.offboard', 'maintenance.bulk-update', 'maintenance.reports']
    },
    { label: 'Audit Logs', capabilities: ['audit-logs.view'] },
    { label: 'Event Logs', capabilities: ['event-logs.view', 'event-logs.import'] },
    { label: 'Password Policy', capabilities: ['password-policy.view'] },
    { label: 'Administration', capabilities: ['admin.manage'] }
];
