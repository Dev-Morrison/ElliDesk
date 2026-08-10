<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import {
        Search,
        RefreshCw,
        Plus,
        MoreVertical,
        Users,
        Shield,
        Mail,
        Eye,
        UserCog,
        Pencil,
        Trash2,
        ChevronLeft,
        ChevronRight,
        FolderTree
    } from 'lucide-svelte';
    import { extractErrorMessage } from '$lib/index';
    import { showNotice } from '$lib/stores/notice.svelte';

    // Expected shape from +page.server.ts:
    // {
    //   groups: ADGroupListItem[],
    //   totalGroups: number,
    //   securityGroups: number,
    //   distributionGroups: number
    // }
    //
    // interface ADGroupListItem {
    //   cn: string;
    //   sAMAccountName: string;
    //   description?: string;
    //   category: "Security" | "Distribution";
    //   scope: "Global" | "Universal" | "Domain Local";
    //   ou: string;
    //   distinguishedName: string;
    //   memberCount: number;
    //   managedBy?: string;
    // }

    let { data } = $props();

    const canManageGroups = $derived(
        (data.permissions.capabilities as string[]).includes('groups.manage')
    );

    let search = $state('');
    let filterCategory = $state('all');
    let filterOU = $state('all');

    let currentPage = $state(1);
    let pageSize = $state(25);

    let refreshing = $state(false);
    let openMenu = $state<string | null>(null);

    let deleteTarget = $state<{ cn: string; sAMAccountName: string } | null>(null);
    let deleting = $state(false);

    const ouOptions = $derived.by(() => {
        const set = new Set(data.groups.map((g) => g.ou));
        return Array.from(set).sort();
    });

    const filtered = $derived.by(() => {
        const s = search.trim().toLowerCase();

        return data.groups.filter((group) => {
            const matchesSearch =
                s === '' ||
                group.cn.toLowerCase().includes(s) ||
                group.sAMAccountName.toLowerCase().includes(s) ||
                group.description?.toLowerCase().includes(s) ||
                group.managedBy?.toLowerCase().includes(s);

            const matchesCategory =
                filterCategory === 'all' || group.category === filterCategory;

            const matchesOU = filterOU === 'all' || group.ou === filterOU;

            return matchesSearch && matchesCategory && matchesOU;
        });
    });

    const totalPages = $derived.by(() =>
        Math.max(1, Math.ceil(filtered.length / pageSize))
    );

    const paginated = $derived.by(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    });

    const rangeStart = $derived.by(() =>
        filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
    );

    const rangeEnd = $derived.by(() =>
        Math.min(currentPage * pageSize, filtered.length)
    );

    const totalMembers = $derived.by(() =>
        data.groups.reduce((sum, g) => sum + (g.memberCount ?? 0), 0)
    );

    // Reset to page 1 whenever the filtered set changes underneath the current page
    $effect(() => {
        filtered;
        currentPage = 1;
    });

    function goToPage(page: number) {
        currentPage = Math.min(Math.max(1, page), totalPages);
    }

    async function refresh() {
        refreshing = true;
        try {
            await invalidateAll();
        } finally {
            refreshing = false;
        }
    }

    function toggleMenu(sAMAccountName: string) {
        openMenu = openMenu === sAMAccountName ? null : sAMAccountName;
    }

    function closeMenu() {
        openMenu = null;
    }

    function requestDelete(group: { cn: string; sAMAccountName: string }) {
        deleteTarget = group;
        closeMenu();
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        deleting = true;

        try {
            const res = await fetch(`/api/groups/${deleteTarget.sAMAccountName}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                showNotice(await extractErrorMessage(res, 'Failed to delete group.'));
                return;
            }

            await invalidateAll();
        } finally {
            deleting = false;
            deleteTarget = null;
        }
    }

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
</script>

<svelte:head>
    <title>Groups — ElliDesk</title>
</svelte:head>

<svelte:window onclick={closeMenu} />

<div class="space-y-6 p-10">

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div>
            <h1 class="text-3xl font-bold">Groups</h1>
            <p class="text-base-content/70">
                Manage security and distribution groups across the directory
            </p>
        </div>

        {#if canManageGroups}
            <a href="/groups/create" class="btn btn-primary">
                <Plus size={18} />
                Create Group
            </a>
        {/if}

    </div>

    <!-- STAT CARDS -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-primary/10 text-primary">
                    <Users size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{data.totalGroups}</div>
                    <div class="text-xs text-base-content/60">Total Groups</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-success/10 text-success">
                    <Shield size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{data.securityGroups}</div>
                    <div class="text-xs text-base-content/60">Security Groups</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-warning/10 text-warning">
                    <Mail size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{data.distributionGroups}</div>
                    <div class="text-xs text-base-content/60">Distribution Groups</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-secondary/10 text-secondary">
                    <FolderTree size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{totalMembers}</div>
                    <div class="text-xs text-base-content/60">Total Memberships</div>
                </div>
            </div>
        </div>

    </div>

    <!-- TOOLBAR -->
    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">

            <div class="flex flex-col lg:flex-row gap-3">

                <label class="input input-bordered flex items-center gap-2 flex-1">
                    <Search size={18} class="opacity-50" />
                    <input
                        type="text"
                        bind:value={search}
                        placeholder="Search groups by name, description, or manager..."
                        class="grow"
                    >
                </label>

                <select bind:value={filterCategory} class="select select-bordered w-full lg:w-48">
                    <option value="all">All Types</option>
                    <option value="Security">Security</option>
                    <option value="Distribution">Distribution</option>
                </select>

                <select bind:value={filterOU} class="select select-bordered w-full lg:w-56">
                    <option value="all">All OUs</option>
                    {#each ouOptions as ou}
                        <option value={ou}>{ou}</option>
                    {/each}
                </select>

                <button
                    class="btn btn-ghost"
                    onclick={refresh}
                    disabled={refreshing}
                >
                    <RefreshCw size={18} class={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>

            </div>

        </div>
    </div>

    <!-- TABLE -->
    <div class="card bg-base-100 shadow">
        <div class="card-body p-0">

            <div class="">

                <table class="table">

                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Scope</th>
                            <th>Members</th>
                            <th>OU</th>
                            <th>Managed By</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody>

                        {#if paginated.length === 0}
                            <tr>
                                <td colspan="7" class="text-center py-12 text-base-content/60">
                                    No groups match your current filters.
                                </td>
                            </tr>
                        {/if}

                        {#each paginated as group (group.sAMAccountName)}
                            <tr class="hover">

                                <td>
                                    <a
                                        href={`/groups/${group.sAMAccountName}`}
                                        class="font-semibold link link-hover"
                                    >
                                        {group.cn}
                                    </a>
                                    {#if group.description}
                                        <div class="text-xs text-base-content/60">
                                            {group.description}
                                        </div>
                                    {/if}
                                </td>

                                <td>
                                    <span class={`badge ${categoryBadgeClass(group.category)}`}>
                                        {group.category}
                                    </span>
                                </td>

                                <td>
                                    <span class={`w-32 badge badge-outline ${scopeBadgeClass(group.scope)}`}>
                                        {group.scope}
                                    </span>
                                </td>

                                <td>
                                    <div class="flex items-center gap-1.5">
                                        <Users size={14} class="opacity-50" />
                                        {group.memberCount}
                                    </div>
                                </td>

                                <td class="text-sm">{group.ou}</td>

                                <td class="text-sm">{group.managedBy ?? '—'}</td>

                                <td class="text-right">

                                    <div class="dropdown dropdown-end" class:dropdown-open={openMenu === group.sAMAccountName}>

                                        <button
                                            class="btn btn-ghost btn-sm btn-square"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                toggleMenu(group.sAMAccountName);
                                            }}
                                        >
                                            <MoreVertical size={18} />
                                        </button>

                                        {#if openMenu === group.sAMAccountName}
                                            <ul
                                                class="dropdown-content menu bg-base-100 rounded-box shadow z-10 w-52 p-2"
                                                onclick={(e) => e.stopPropagation()}
                                            >
                                                <li>
                                                    <a href={`/groups/${group.sAMAccountName}`}>
                                                        <Eye size={16} />
                                                        View Group
                                                    </a>
                                                </li>
                                                {#if canManageGroups}
                                                    <li>
                                                        <a href={`/groups/${group.sAMAccountName}/edit`}>
                                                            <UserCog size={16} />
                                                            Manage Members
                                                        </a>
                                                    </li>
                                                    <li>
                                                        <a href={`/groups/${group.sAMAccountName}/members`}>
                                                            <Pencil size={16} />
                                                            Edit
                                                        </a>
                                                    </li>
                                                    <li>
                                                        <button
                                                            class="text-error"
                                                            onclick={() => requestDelete(group)}
                                                        >
                                                            <Trash2 size={16} />
                                                            Delete
                                                        </button>
                                                    </li>
                                                {/if}
                                            </ul>
                                        {/if}

                                    </div>

                                </td>

                            </tr>
                        {/each}

                    </tbody>

                </table>

            </div>

            <!-- PAGINATION -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-base-200">

                <div class="text-sm text-base-content/60">
                    Showing {rangeStart}-{rangeEnd} of {filtered.length} groups
                </div>

                <div class="flex items-center gap-2">

                    <select bind:value={pageSize} class="select select-bordered select-sm">
                        <option value={10}>10 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                    </select>

                    <div class="join">
                        <button
                            class="join-item btn btn-sm"
                            disabled={currentPage === 1}
                            onclick={() => goToPage(currentPage - 1)}
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <button class="join-item btn btn-sm btn-disabled">
                            Page {currentPage} of {totalPages}
                        </button>

                        <button
                            class="join-item btn btn-sm"
                            disabled={currentPage === totalPages}
                            onclick={() => goToPage(currentPage + 1)}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                </div>

            </div>

        </div>
    </div>

</div>

<!-- DELETE CONFIRMATION MODAL -->
{#if deleteTarget}
    <div class="modal modal-open">
        <div class="modal-box">

            <h3 class="font-bold text-lg">Delete Group</h3>

            <p class="py-4">
                Are you sure you want to delete
                <span class="font-semibold">{deleteTarget.cn}</span>?
                This action cannot be undone and will remove the group from the directory.
            </p>

            <div class="modal-action">
                <button class="btn" onclick={() => (deleteTarget = null)} disabled={deleting}>
                    Cancel
                </button>
                <button class="btn btn-error" onclick={confirmDelete} disabled={deleting}>
                    {#if deleting}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Delete Group
                </button>
            </div>

        </div>

        <div
            class="modal-backdrop"
            onclick={() => !deleting && (deleteTarget = null)}
        ></div>
    </div>
{/if}