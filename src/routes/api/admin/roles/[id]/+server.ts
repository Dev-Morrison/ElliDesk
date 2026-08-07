import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getRole,
    updateRole,
    deleteRole,
    requireCapability,
    isCapability,
    type Capability
} from '$lib/server/permissions';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

interface UpdateRoleBody {
    name: string;
    description?: string;
    capabilities: string[];
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    requireCapability(locals, 'admin.manage');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';
    const roleId = Number(params.id);

    if (!Number.isFinite(roleId)) {
        throw error(400, 'Invalid role id.');
    }

    const existing = await getRole(roleId);
    if (!existing) {
        throw error(404, 'Role not found.');
    }

    const body = (await request.json()) as UpdateRoleBody;
    const name = body.name?.trim() ?? '';
    if (!name) {
        throw error(400, 'Role name is required.');
    }

    const capabilities = (body.capabilities ?? []).filter(isCapability) as Capability[];

    try {
        await updateRole(roleId, name, body.description?.trim() || null, capabilities);

        await writeAuditLog({
            actor,
            action: 'role-updated',
            targetSam: name,
            success: true,
            details: { capabilities }
        });

        return json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'role-updated',
            targetSam: name,
            success: false,
            error: message
        });

        if (message.includes('Duplicate entry')) {
            throw error(409, `A role named "${name}" already exists.`);
        }

        console.error('Failed to update role:', err);
        throw error(500, 'Failed to update role.');
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    requireCapability(locals, 'admin.manage');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';
    const roleId = Number(params.id);

    if (!Number.isFinite(roleId)) {
        throw error(400, 'Invalid role id.');
    }

    const existing = await getRole(roleId);
    if (!existing) {
        throw error(404, 'Role not found.');
    }

    try {
        await deleteRole(roleId);

        await writeAuditLog({
            actor,
            action: 'role-deleted',
            targetSam: existing.name,
            success: true,
            details: { assignmentsRemoved: existing.assignmentCount }
        });

        return json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'role-deleted',
            targetSam: existing.name,
            success: false,
            error: message
        });

        console.error('Failed to delete role:', err);
        throw error(500, 'Failed to delete role.');
    }
};
