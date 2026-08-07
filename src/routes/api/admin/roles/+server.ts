import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    listRoles,
    createRole,
    requireCapability,
    isCapability,
    type Capability
} from '$lib/server/permissions';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

export const GET: RequestHandler = async ({ locals }) => {
    requireCapability(locals, 'admin.manage');
    return json(await listRoles());
};

interface CreateRoleBody {
    name: string;
    description?: string;
    capabilities: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
    requireCapability(locals, 'admin.manage');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';
    const body = (await request.json()) as CreateRoleBody;

    const name = body.name?.trim() ?? '';
    if (!name) {
        throw error(400, 'Role name is required.');
    }

    const capabilities = (body.capabilities ?? []).filter(isCapability) as Capability[];

    try {
        const roleId = await createRole(name, body.description?.trim() || null, capabilities);

        await writeAuditLog({
            actor,
            action: 'role-created',
            targetSam: name,
            success: true,
            details: { capabilities }
        });

        return json({ id: roleId, success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'role-created',
            targetSam: name,
            success: false,
            error: message
        });

        if (message.includes('Duplicate entry')) {
            throw error(409, `A role named "${name}" already exists.`);
        }

        console.error('Failed to create role:', err);
        throw error(500, 'Failed to create role.');
    }
};
