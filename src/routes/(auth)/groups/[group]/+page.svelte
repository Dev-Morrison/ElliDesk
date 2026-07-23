<script lang="ts">
    import { goto } from '$app/navigation';
    import {
        Users,
        Mail,
        FolderTree,
        UserCog,
        Pencil,
        Trash2,
        ArrowLeft,
        Calendar,
        Clock
    } from 'lucide-svelte';

    // Expected `data` from +page.server.ts: { group: ADGroupDetail }
    let { data } = $props();

    let deleting = $state(false);
    let showDeleteConfirm = $state(false);

    function categoryBadgeClass(category: string) {
        return category === 'Security' ? 'badge-success' : 'badge-warning';
    }

    function scopeBadgeClass(scope: string) {
        switch (scope) {
            case 'Global':
                return 'badge-info';
            case 'Universal':
                return 'badge-secondary';
            default:
                return 'badge-neutral';
        }
    }

    function formatDate(value: string | null) {
        if (!value) return '—';
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toLocaleString();
    }

    async function confirmDelete() {
        deleting = true;

        try {
            const res = await fetch(`/api/groups/${data.group.sAMAccountName}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                throw new Error('Failed to delete group.');
            }

            await goto('/groups');
        } catch (err) {
            console.error(err);
            deleting = false;
            showDeleteConfirm = false;
        }
    }
</script>

<div class="space-y-6">

    <a href="/groups" class="btn btn-ghost btn-sm w-fit">
        <ArrowLeft size={16} />
        Back to Groups
    </a>

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        <div class="flex items-start gap-4">
            <div class="p-3 rounded-lg bg-primary/10 text-primary">
                <Users size={28} />
            </div>
            <div>
                <h1 class="text-3xl font-bold">{data.group.cn}</h1>
                <p class="text-base-content/70">{data.group.sAMAccountName}</p>
                <div class="flex gap-2 mt-2">
                    <span class={`badge ${categoryBadgeClass(data.group.category)}`}>
                        {data.group.category}
                    </span>
                    <span class={`badge badge-outline ${scopeBadgeClass(data.group.scope)}`}>
                        {data.group.scope}
                    </span>
                </div>
            </div>
        </div>

        <div class="flex gap-2">
            <a href={`/groups/${data.group.sAMAccountName}/members`} class="btn btn-primary">
                <UserCog size={16} />
                Manage Members
            </a>
            <a href={`/groups/${data.group.sAMAccountName}/edit`} class="btn btn-ghost">
                <Pencil size={16} />
                Edit
            </a>
            <button class="btn btn-ghost text-error" onclick={() => (showDeleteConfirm = true)} type="button">
                <Trash2 size={16} />
                Delete
            </button>
        </div>

    </div>

    <div class="grid lg:grid-cols-3 gap-6">

        <!-- GROUP INFORMATION -->
        <div class="lg:col-span-2 card bg-base-100 shadow">
            <div class="card-body gap-4">

                <h2 class="card-title">Group Information</h2>

                <div class="grid sm:grid-cols-2 gap-4">

                    <div>
                        <div class="text-xs text-base-content/60">Description</div>
                        <div class="font-medium">{data.group.description || '—'}</div>
                    </div>

                    <div>
                        <div class="text-xs text-base-content/60">Email</div>
                        <div class="font-medium flex items-center gap-1.5">
                            {#if data.group.mail}
                                <Mail size={14} class="opacity-50" />
                            {/if}
                            {data.group.mail || '—'}
                        </div>
                    </div>

                    <div>
                        <div class="text-xs text-base-content/60">Organizational Unit</div>
                        <div class="font-medium flex items-center gap-1.5">
                            <FolderTree size={14} class="opacity-50" />
                            {data.group.ou}
                        </div>
                    </div>

                    <div>
                        <div class="text-xs text-base-content/60">Managed By</div>
                        <div class="font-medium">
                            {data.group.managedBy?.displayName ?? '—'}
                        </div>
                    </div>

                    <div class="sm:col-span-2">
                        <div class="text-xs text-base-content/60">Distinguished Name</div>
                        <div class="font-mono text-xs break-all text-base-content/80">
                            {data.group.distinguishedName}
                        </div>
                    </div>

                </div>

            </div>
        </div>

        <!-- SUMMARY -->
        <div class="space-y-6">

            <div class="card bg-base-100 shadow">
                <div class="card-body gap-3">

                    <h2 class="card-title text-base">Membership</h2>

                    <div class="flex items-center gap-3">
                        <div class="p-3 rounded-lg bg-primary/10 text-primary">
                            <Users size={20} />
                        </div>
                        <div>
                            <div class="text-2xl font-bold">{data.group.memberCount}</div>
                            <div class="text-xs text-base-content/60">Members</div>
                        </div>
                    </div>

                    <a href={`/groups/${data.group.sAMAccountName}/members`} class="btn btn-outline btn-sm w-full">
                        View &amp; Manage Members
                    </a>

                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body gap-3">

                    <h2 class="card-title text-base">Timestamps</h2>

                    <div class="flex items-center gap-2 text-sm">
                        <Calendar size={14} class="opacity-50" />
                        <span class="text-base-content/60">Created:</span>
                        {formatDate(data.group.whenCreated)}
                    </div>

                    <div class="flex items-center gap-2 text-sm">
                        <Clock size={14} class="opacity-50" />
                        <span class="text-base-content/60">Last Changed:</span>
                        {formatDate(data.group.whenChanged)}
                    </div>

                </div>
            </div>

        </div>

    </div>

</div>

<!-- DELETE CONFIRMATION MODAL -->
{#if showDeleteConfirm}
    <div class="modal modal-open">
        <div class="modal-box">

            <h3 class="font-bold text-lg">Delete Group</h3>

            <p class="py-4">
                Are you sure you want to delete
                <span class="font-semibold">{data.group.cn}</span>?
                This action cannot be undone and will remove the group from the directory.
            </p>

            <div class="modal-action">
                <button
                    class="btn"
                    type="button"
                    onclick={() => (showDeleteConfirm = false)}
                    disabled={deleting}
                >
                    Cancel
                </button>
                <button class="btn btn-error" type="button" onclick={confirmDelete} disabled={deleting}>
                    {#if deleting}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Delete Group
                </button>
            </div>

        </div>

        <div class="modal-backdrop" onclick={() => !deleting && (showDeleteConfirm = false)}></div>
    </div>
{/if}