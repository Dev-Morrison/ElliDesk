import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAssignments, createAssignment, getRole, requireCapability } from '$lib/server/permissions';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

export const GET: RequestHandler = async ({ locals }) => {
    requireCapability(locals, 'admin.manage');
    return json(await listAssignments());
};

interface CreateAssignmentBody {
    principalDn: string;
    principalName: string;
    principalType: 'group' | 'user';
    roleId: number;
    scopeAllDomains: boolean;
    domainKeys: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'admin.manage');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';
    const body = (await request.json()) as CreateAssignmentBody;

    if (!body.principalDn || !body.principalName) {
        throw error(400, 'A group or user must be selected.');
    }
    if (!body.roleId) {
        throw error(400, 'A role must be selected.');
    }
    if (!body.scopeAllDomains && (!body.domainKeys || body.domainKeys.length === 0)) {
        throw error(400, 'Select at least one domain, or grant access to all domains.');
    }

    const role = await getRole(body.roleId);
    if (!role) {
        throw error(400, 'Selected role no longer exists.');
    }

    try {
        const id = await createAssignment({
            principalDn: body.principalDn,
            principalName: body.principalName,
            principalType: body.principalType === 'user' ? 'user' : 'group',
            roleId: body.roleId,
            scopeAllDomains: body.scopeAllDomains,
            domainKeys: body.scopeAllDomains ? [] : body.domainKeys,
            createdBy: actor
        });

        await writeAuditLog({
            actor,
            action: 'role-assignment-created',
            targetDn: body.principalDn,
            targetSam: body.principalName,
            success: true,
            details: {
                role: role.name,
                scopeAllDomains: body.scopeAllDomains,
                domainKeys: body.scopeAllDomains ? [] : body.domainKeys
            }
        });

        return json({ id, success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'role-assignment-created',
            targetDn: body.principalDn,
            targetSam: body.principalName,
            success: false,
            error: message
        });

        console.error('Failed to create role assignment:', err);
        throw error(500, 'Failed to create role assignment.');
    }
};
