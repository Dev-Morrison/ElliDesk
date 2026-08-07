import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAssignments, deleteAssignment, requireCapability } from '$lib/server/permissions';
import { writeAuditLog } from '$lib/server/audit';
import type { SessionUser } from '$lib/types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
    requireCapability(locals, 'admin.manage');

    const actor = (locals as { user?: SessionUser })?.user?.username ?? 'unknown';
    const assignmentId = Number(params.id);

    if (!Number.isFinite(assignmentId)) {
        throw error(400, 'Invalid assignment id.');
    }

    const assignments = await listAssignments();
    const existing = assignments.find((a) => a.id === assignmentId);
    if (!existing) {
        throw error(404, 'Assignment not found.');
    }

    try {
        await deleteAssignment(assignmentId);

        await writeAuditLog({
            actor,
            action: 'role-assignment-deleted',
            targetDn: existing.principalDn,
            targetSam: existing.principalName,
            success: true,
            details: { role: existing.roleName }
        });

        return json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        await writeAuditLog({
            actor,
            action: 'role-assignment-deleted',
            targetDn: existing.principalDn,
            targetSam: existing.principalName,
            success: false,
            error: message
        });

        console.error('Failed to delete role assignment:', err);
        throw error(500, 'Failed to delete role assignment.');
    }
};
