<script lang="ts">
    import type { PageProps } from './$types';
    import { goto } from '$app/navigation';
    import { FileClock, AlertTriangle, X } from 'lucide-svelte';

    let { data }: PageProps = $props();

    let search = $state(data.filters.search);
    let action = $state(data.filters.action);
    let success = $state(data.filters.success);
    let from = $state(data.filters.from);
    let to = $state(data.filters.to);

    let searchDebounce: ReturnType<typeof setTimeout> | undefined;

    const ACTION_LABELS: Record<string, { label: string; badge: string }> = {
        'login': { label: 'Login', badge: 'badge-success' },
        'login-failed': { label: 'Login Failed', badge: 'badge-error' },
        'login-denied': { label: 'Login Denied', badge: 'badge-error' },
        'user-created': { label: 'User Created', badge: 'badge-primary' },
        'user-updated': { label: 'User Updated', badge: 'badge-info' },
        'user-enabled': { label: 'User Enabled', badge: 'badge-success' },
        'user-disabled': { label: 'User Disabled', badge: 'badge-warning' },
        'user-unlocked': { label: 'User Unlocked', badge: 'badge-warning' },
        'password-reset': { label: 'Password Reset', badge: 'badge-secondary' },
        'group-member-added': { label: 'Member Added', badge: 'badge-info' },
        'group-member-removed': { label: 'Member Removed', badge: 'badge-warning' },
        'group-updated': { label: 'Group Updated', badge: 'badge-info' },
        'group-deleted': { label: 'Group Deleted', badge: 'badge-error' },
        'computer-enabled': { label: 'Computer Enabled', badge: 'badge-success' },
        'computer-disabled': { label: 'Computer Disabled', badge: 'badge-warning' }
    };

    function actionMeta(a: string) {
        return ACTION_LABELS[a] ?? { label: a, badge: 'badge-ghost' };
    }

    function applyFilters(resetPage = true) {
        const params = new URLSearchParams();

        if (search) params.set('search', search);
        if (action) params.set('action', action);
        if (success) params.set('success', success);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (!resetPage && data.page > 1) params.set('page', String(data.page));

        goto(`/audit-logs${params.toString() ? `?${params}` : ''}`, {
            keepFocus: true,
            replaceState: false
        });
    }

    function onSearchInput() {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => applyFilters(), 350);
    }

    function clearFilters() {
        search = '';
        action = '';
        success = '';
        from = '';
        to = '';
        goto('/audit-logs');
    }

    let hasActiveFilters = $derived(
        Boolean(search || action || success || from || to)
    );

    function goToPage(p: number) {
        const params = new URLSearchParams();

        if (search) params.set('search', search);
        if (action) params.set('action', action);
        if (success) params.set('success', success);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        params.set('page', String(p));

        goto(`/audit-logs?${params}`);
    }

    let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

    // --- Detail modal -------------------------------------------------------
    let selectedRow = $state<(typeof data.rows)[number] | null>(null);

    function formatTime(iso: string) {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'medium'
        });
    }
</script>

<svelte:head>
    <title>Audit Logs — ElliDesk</title>
</svelte:head>

<div class="space-y-6 max-w-7xl mx-auto p-6 lg:p-10">

    <section>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <FileClock size={28} />
            Audit Logs
        </h1>
        <p class="text-base-content/70 mt-1">
            A history of changes made through this console — who did what, and when.
        </p>
    </section>

    {#if data.error}
        <div class="alert alert-error">
            <AlertTriangle size={18} />
            <span>{data.error}</span>
        </div>
    {/if}

    <!-- TOOLBAR -->
    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">
            <div class="flex flex-col lg:flex-row gap-3">

                <input
                    type="text"
                    bind:value={search}
                    oninput={onSearchInput}
                    placeholder="Search actor, username, or DN..."
                    class="input input-bordered flex-1"
                />

                <select bind:value={action} onchange={() => applyFilters()} class="select select-bordered w-full lg:w-52">
                    <option value="">All Actions</option>
                    {#each data.actions as a}
                        <option value={a}>{actionMeta(a).label}</option>
                    {/each}
                </select>

                <select bind:value={success} onchange={() => applyFilters()} class="select select-bordered w-full lg:w-40">
                    <option value="">All Outcomes</option>
                    <option value="true">Success Only</option>
                    <option value="false">Failures Only</option>
                </select>

                <input
                    type="date"
                    bind:value={from}
                    onchange={() => applyFilters()}
                    class="input input-bordered w-full lg:w-40"
                    title="From date"
                />

                <input
                    type="date"
                    bind:value={to}
                    onchange={() => applyFilters()}
                    class="input input-bordered w-full lg:w-40"
                    title="To date"
                />

                {#if hasActiveFilters}
                    <button type="button" class="btn btn-ghost" onclick={clearFilters}>
                        Clear
                    </button>
                {/if}
            </div>

            <p class="text-sm text-base-content/60">
                {data.total} {data.total === 1 ? 'entry' : 'entries'}
                {#if hasActiveFilters}matching your filters{/if}
            </p>
        </div>
    </div>

    <!-- TABLE -->
    <div class="card bg-base-100 shadow">
        <div class="overflow-x-auto">
            <table class="table table-zebra">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Detail</th>
                        <th>Outcome</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.rows as row (row.id)}
                        <tr class="cursor-pointer hover" onclick={() => (selectedRow = row)}>
                            <td class="whitespace-nowrap text-sm">{formatTime(row.occurredAt)}</td>
                            <td class="font-medium">{row.actor}</td>
                            <td>
                                <span class="badge badge-sm {actionMeta(row.action).badge}">
                                    {actionMeta(row.action).label}
                                </span>
                            </td>
                            <td class="max-w-55 truncate">
                                {row.targetDisplayName || row.targetSam || row.targetDn || '—'}
                            </td>
                            <td class="max-w-70 truncate text-sm text-base-content/70">
                                {#if row.attribute}
                                    <span class="font-mono">{row.attribute}</span>:
                                    {row.oldValue || '(empty)'} → {row.newValue || '(empty)'}
                                {:else if !row.success && row.error}
                                    {row.error}
                                {:else if row.details}
                                    {JSON.stringify(row.details)}
                                {:else}
                                    —
                                {/if}
                            </td>
                            <td>
                                {#if row.success}
                                    <span class="badge badge-success badge-sm">Success</span>
                                {:else}
                                    <span class="badge badge-error badge-sm">Failed</span>
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="6" class="text-center text-base-content/50 py-10">
                                No audit entries found.
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        {#if totalPages > 1}
            <div class="flex items-center justify-between p-4 border-t border-base-200">
                <span class="text-sm text-base-content/60">
                    Page {data.page} of {totalPages}
                </span>
                <div class="join">
                    <button
                        class="btn btn-sm join-item"
                        disabled={data.page <= 1}
                        onclick={() => goToPage(data.page - 1)}
                    >
                        Previous
                    </button>
                    <button
                        class="btn btn-sm join-item"
                        disabled={data.page >= totalPages}
                        onclick={() => goToPage(data.page + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
        {/if}
    </div>

</div>

<!-- DETAIL MODAL -->
{#if selectedRow}
    <div class="modal modal-open">
        <div class="modal-box max-w-2xl">
            <div class="flex items-start justify-between">
                <h3 class="font-bold text-lg flex items-center gap-2">
                    <span class="badge {actionMeta(selectedRow.action).badge}">
                        {actionMeta(selectedRow.action).label}
                    </span>
                </h3>
                <button type="button" class="btn btn-ghost btn-sm btn-circle" onclick={() => (selectedRow = null)}>
                    <X size={16} />
                </button>
            </div>

            <dl class="grid grid-cols-3 gap-x-4 gap-y-2 mt-4 text-sm">
                <dt class="text-base-content/50">Time</dt>
                <dd class="col-span-2">{formatTime(selectedRow.occurredAt)}</dd>

                <dt class="text-base-content/50">Actor</dt>
                <dd class="col-span-2">{selectedRow.actor}</dd>

                <dt class="text-base-content/50">Outcome</dt>
                <dd class="col-span-2">
                    {#if selectedRow.success}
                        <span class="badge badge-success badge-sm">Success</span>
                    {:else}
                        <span class="badge badge-error badge-sm">Failed</span>
                    {/if}
                </dd>

                {#if selectedRow.targetSam}
                    <dt class="text-base-content/50">Target</dt>
                    <dd class="col-span-2">{selectedRow.targetDisplayName || selectedRow.targetSam}</dd>
                {/if}

                {#if selectedRow.targetDn}
                    <dt class="text-base-content/50">Target DN</dt>
                    <dd class="col-span-2 font-mono text-xs break-all">{selectedRow.targetDn}</dd>
                {/if}

                {#if selectedRow.attribute}
                    <dt class="text-base-content/50">Attribute</dt>
                    <dd class="col-span-2 font-mono">{selectedRow.attribute}</dd>

                    <dt class="text-base-content/50">Old Value</dt>
                    <dd class="col-span-2">{selectedRow.oldValue || '(empty)'}</dd>

                    <dt class="text-base-content/50">New Value</dt>
                    <dd class="col-span-2">{selectedRow.newValue || '(empty)'}</dd>
                {/if}

                {#if selectedRow.error}
                    <dt class="text-base-content/50">Error</dt>
                    <dd class="col-span-2 text-error">{selectedRow.error}</dd>
                {/if}

                {#if selectedRow.details}
                    <dt class="text-base-content/50">Details</dt>
                    <dd class="col-span-2">
                        <pre class="bg-base-200 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(selectedRow.details, null, 2)}</pre>
                    </dd>
                {/if}
            </dl>

            <div class="modal-action">
                <button class="btn" type="button" onclick={() => (selectedRow = null)}>Close</button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => (selectedRow = null)}></div>
    </div>
{/if}
