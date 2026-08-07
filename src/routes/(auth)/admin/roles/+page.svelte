<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import {
        KeyRound,
        Plus,
        Pencil,
        Trash2,
        Users,
        Shield,
        Monitor,
        FolderKanban,
        Wrench,
        ScrollText,
        FileClock,
        Lock,
        Settings,
        Check
    } from 'lucide-svelte';
    import { CAPABILITY_GROUPS, CAPABILITY_LABELS, CAPABILITY_SHORT_LABELS, type Capability } from '$lib/capabilities';

    let { data } = $props();

    // Matches the icon used for each area's nav link (Navbar.svelte), so the
    // picker reads as "the same areas you see in the sidebar."
    const GROUP_ICONS: Record<string, typeof KeyRound> = {
        Users: Users,
        Groups: Shield,
        Computers: Monitor,
        'Organizational Units': FolderKanban,
        Maintenance: Wrench,
        'Audit Logs': FileClock,
        'Event Logs': ScrollText,
        'Password Policy': Lock,
        Administration: Settings
    };

    interface RoleSummary {
        id: number;
        name: string;
        description: string | null;
        capabilities: Capability[];
        assignmentCount: number;
    }

    let showModal = $state(false);
    let editingId = $state<number | null>(null);
    let formName = $state('');
    let formDescription = $state('');
    let formCapabilities = $state<Set<Capability>>(new Set());
    let saving = $state(false);
    let formError = $state('');

    let deleteTarget = $state<RoleSummary | null>(null);
    let deleting = $state(false);

    function openCreate() {
        editingId = null;
        formName = '';
        formDescription = '';
        formCapabilities = new Set();
        formError = '';
        showModal = true;
    }

    function openEdit(role: RoleSummary) {
        editingId = role.id;
        formName = role.name;
        formDescription = role.description ?? '';
        formCapabilities = new Set(role.capabilities);
        formError = '';
        showModal = true;
    }

    function toggleCapability(cap: Capability) {
        const next = new Set(formCapabilities);
        if (next.has(cap)) next.delete(cap);
        else next.add(cap);
        formCapabilities = next;
    }

    async function save() {
        if (!formName.trim()) {
            formError = 'Role name is required.';
            return;
        }

        saving = true;
        formError = '';

        try {
            const body = {
                name: formName.trim(),
                description: formDescription.trim() || undefined,
                capabilities: Array.from(formCapabilities)
            };

            const res = await fetch(editingId ? `/api/admin/roles/${editingId}` : '/api/admin/roles', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.message ?? 'Failed to save role.');
            }

            showModal = false;
            await invalidateAll();
        } catch (err) {
            formError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            saving = false;
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        deleting = true;
        try {
            await fetch(`/api/admin/roles/${deleteTarget.id}`, { method: 'DELETE' });
            await invalidateAll();
        } finally {
            deleting = false;
            deleteTarget = null;
        }
    }
</script>

<div class="space-y-6 max-w-5xl mx-auto">

    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <KeyRound size={28} />
                Roles
            </h1>
            <p class="text-base-content/70 mt-1">
                Named sets of capabilities, assignable to AD groups or users on the
                <a href="/admin/assignments" class="link">Assignments</a> page.
            </p>
        </div>
        <button class="btn btn-primary" onclick={openCreate}>
            <Plus size={16} />
            New Role
        </button>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="overflow-x-auto">
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Capabilities</th>
                        <th>Assignments</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.roles as role (role.id)}
                        <tr>
                            <td class="font-medium align-top">{role.name}</td>
                            <td class="text-sm text-base-content/60 align-top">{role.description || '—'}</td>
                            <td class="text-sm align-top">
                                {#if role.capabilities.length === 0}
                                    <span class="text-base-content/40">None</span>
                                {:else}
                                    <div class="flex flex-wrap gap-1 max-w-md">
                                        {#each role.capabilities as cap}
                                            <span class="badge badge-ghost badge-sm">{CAPABILITY_LABELS[cap]}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </td>
                            <td class="text-sm align-top">{role.assignmentCount}</td>
                            <td class="text-right align-top whitespace-nowrap">
                                <button class="btn btn-ghost btn-xs" onclick={() => openEdit(role)} aria-label="Edit">
                                    <Pencil size={14} />
                                </button>
                                <button
                                    class="btn btn-ghost btn-xs text-error"
                                    onclick={() => (deleteTarget = role)}
                                    aria-label="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="5" class="text-center text-base-content/50 py-10">
                                No roles yet. Create one to get started.
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

</div>

<!-- CREATE/EDIT MODAL -->
{#if showModal}
    <div class="modal modal-open">
        <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg text-center mb-2">{editingId ? 'Edit Role' : 'New Role'}</h3>
            <div class="flex flex-col gap-2">
                <label class="form-control w-full flex justify-between">
                    <div class="label"><span class="label-text">Name</span></div>
                    <input type="text" bind:value={formName} class="input input-bordered" placeholder="e.g. NCRA Admin" />
                </label>

                <label class="form-control w-full flex justify-between">
                    <div class="label"><span class="label-text">Description</span></div>
                    <input
                        type="text"
                        bind:value={formDescription}
                        class="input input-bordered"
                        placeholder="What this role is for"
                    />
                </label>

                <div class="label mb-2 self-center"><span class="label">Capabilities</span></div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {#each CAPABILITY_GROUPS as group}
                    {@const GroupIcon = GROUP_ICONS[group.label] ?? KeyRound}
                    <div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
                        <div class="flex items-center gap-2 mb-2 text-base-content/80">
                            <GroupIcon size={15} />
                            <span class="text-xs font-semibold uppercase tracking-wide">{group.label}</span>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            {#each group.capabilities as cap}
                                {@const active = formCapabilities.has(cap)}
                                <button
                                    type="button"
                                    class="btn btn-xs rounded-full gap-1 {active ? 'btn-primary' : 'btn-outline'}"
                                    onclick={() => toggleCapability(cap)}
                                    aria-pressed={active}
                                >
                                    {#if active}
                                        <Check size={12} />
                                    {/if}
                                    {CAPABILITY_SHORT_LABELS[cap]}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            {#if formError}
                <div class="alert alert-error mt-3 text-sm">{formError}</div>
            {/if}

            <div class="modal-action">
                <button class="btn" onclick={() => (showModal = false)} disabled={saving}>Cancel</button>
                <button class="btn btn-primary" onclick={save} disabled={saving}>
                    {#if saving}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    {editingId ? 'Save Changes' : 'Create Role'}
                </button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => !saving && (showModal = false)}></div>
    </div>
{/if}

<!-- DELETE CONFIRM MODAL -->
{#if deleteTarget}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="font-bold text-lg">Delete Role</h3>
            <p class="py-4">
                Delete <span class="font-semibold">{deleteTarget.name}</span>?
                {#if deleteTarget.assignmentCount > 0}
                    This will also remove {deleteTarget.assignmentCount}
                    assignment{deleteTarget.assignmentCount === 1 ? '' : 's'} using it — anyone whose only access
                    came through this role will lose access immediately.
                {/if}
            </p>
            <div class="modal-action">
                <button class="btn" onclick={() => (deleteTarget = null)} disabled={deleting}>Cancel</button>
                <button class="btn btn-error" onclick={confirmDelete} disabled={deleting}>
                    {#if deleting}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Delete
                </button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => !deleting && (deleteTarget = null)}></div>
    </div>
{/if}
