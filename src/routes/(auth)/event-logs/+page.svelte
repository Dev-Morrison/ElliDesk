<script lang="ts">
    import type { PageProps } from './$types';
    import { goto } from '$app/navigation';
    import { ScrollText, AlertTriangle, Upload, X } from 'lucide-svelte';

    let { data }: PageProps = $props();

    let logName = $state(data.filters.logName);
    let level = $state(data.filters.level);
    let machineName = $state(data.filters.machineName);
    let eventId = $state(data.filters.eventId);
    let search = $state(data.filters.search);
    let from = $state(data.filters.from);
    let to = $state(data.filters.to);

    let searchDebounce: ReturnType<typeof setTimeout> | undefined;

    const LOG_TYPES = ['Application', 'Security', 'Setup', 'System'];

    const LEVEL_BADGE: Record<string, string> = {
        Critical: 'badge-error',
        Error: 'badge-error',
        Warning: 'badge-warning',
        Information: 'badge-ghost',
        Verbose: 'badge-ghost'
    };

    function levelBadge(l: string) {
        return LEVEL_BADGE[l] ?? 'badge-ghost';
    }

    function buildParams(pageOverride?: number) {
        const params = new URLSearchParams();
        if (logName) params.set('logName', logName);
        if (level) params.set('level', level);
        if (machineName) params.set('machineName', machineName);
        if (eventId) params.set('eventId', eventId);
        if (search) params.set('search', search);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (pageOverride && pageOverride > 1) params.set('page', String(pageOverride));
        return params;
    }

    function applyFilters() {
        const params = buildParams();
        goto(`/event-logs${params.toString() ? `?${params}` : ''}`, { keepFocus: true });
    }

    function onSearchInput() {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(applyFilters, 350);
    }

    function clearFilters() {
        logName = '';
        level = '';
        machineName = '';
        eventId = '';
        search = '';
        from = '';
        to = '';
        goto('/event-logs');
    }

    let hasActiveFilters = $derived(
        Boolean(logName || level || machineName || eventId || search || from || to)
    );

    function goToPage(p: number) {
        goto(`/event-logs?${buildParams(p)}`);
    }

    let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

    function formatTime(iso: string) {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
    }

    let selectedRow = $state<(typeof data.rows)[number] | null>(null);
</script>

<div class="space-y-6 max-w-7xl mx-auto pb-10">

    <section class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <ScrollText size={28} />
                Event Logs
            </h1>
            <p class="text-base-content/70 mt-1">
                Imported Windows Event Log entries from the domain controller.
            </p>
        </div>

        <a href="/event-logs/import" class="btn btn-primary btn-sm">
            <Upload size={16} />
            Import
        </a>
    </section>

    {#if data.error}
        <div class="alert alert-error">
            <AlertTriangle size={18} />
            <span>{data.error}</span>
        </div>
    {:else if data.total === 0 && !hasActiveFilters}
        <div class="alert">
            <span>
                No event logs imported yet. <a href="/event-logs/import" class="link">Import a CSV export</a>
                to get started.
            </span>
        </div>
    {/if}

    <!-- TOOLBAR -->
    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">
            <div class="flex flex-col lg:flex-row flex-wrap gap-3">

                <input
                    type="text"
                    bind:value={search}
                    oninput={onSearchInput}
                    placeholder="Search message (word-prefix, e.g. 'KB504')..."
                    class="input input-bordered flex-1 min-w-55"
                />

                <select bind:value={logName} onchange={applyFilters} class="select select-bordered w-full lg:w-40">
                    <option value="">All Log Types</option>
                    {#each LOG_TYPES as t}
                        <option value={t}>{t}</option>
                    {/each}
                </select>

                <select bind:value={level} onchange={applyFilters} class="select select-bordered w-full lg:w-40">
                    <option value="">All Levels</option>
                    {#each data.facets.levels as l}
                        <option value={l}>{l}</option>
                    {/each}
                </select>

                <select bind:value={machineName} onchange={applyFilters} class="select select-bordered w-full lg:w-40">
                    <option value="">All Machines</option>
                    {#each data.facets.machines as m}
                        <option value={m}>{m}</option>
                    {/each}
                </select>

                <input
                    type="number"
                    bind:value={eventId}
                    onchange={applyFilters}
                    placeholder="Event ID"
                    class="input input-bordered w-full lg:w-32"
                />

                <input type="date" bind:value={from} onchange={applyFilters} class="input input-bordered w-full lg:w-40" title="From date" />
                <input type="date" bind:value={to} onchange={applyFilters} class="input input-bordered w-full lg:w-40" title="To date" />

                {#if hasActiveFilters}
                    <button type="button" class="btn btn-ghost" onclick={clearFilters}>Clear</button>
                {/if}
            </div>

            <p class="text-sm text-base-content/60">
                {data.total.toLocaleString()} {data.total === 1 ? 'entry' : 'entries'}
                {#if hasActiveFilters}matching your filters{/if}
            </p>
        </div>
    </div>

    <!-- TABLE -->
    <div class="card bg-base-100 shadow">
        <div class="overflow-x-auto">
            <table class="table table-zebra table-sm">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Log</th>
                        <th>Level</th>
                        <th>Event ID</th>
                        <th>Provider</th>
                        <th>Machine</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.rows as row (row.id)}
                        <tr class="cursor-pointer hover" onclick={() => (selectedRow = row)}>
                            <td class="whitespace-nowrap text-sm">{formatTime(row.timeCreated)}</td>
                            <td class="text-sm">{row.logName}</td>
                            <td><span class="badge badge-sm {levelBadge(row.level)}">{row.level}</span></td>
                            <td class="text-sm font-mono">{row.eventId}</td>
                            <td class="text-sm text-base-content/70 max-w-45 truncate">{row.providerName}</td>
                            <td class="text-sm text-base-content/70">{row.machineName}</td>
                            <td class="text-sm max-w-90 truncate">{row.message ?? '—'}</td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="7" class="text-center text-base-content/50 py-10">
                                No event log entries found.
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        {#if totalPages > 1}
            <div class="flex items-center justify-between p-4 border-t border-base-200">
                <span class="text-sm text-base-content/60">Page {data.page} of {totalPages}</span>
                <div class="join">
                    <button class="btn btn-sm join-item" disabled={data.page <= 1} onclick={() => goToPage(data.page - 1)}>
                        Previous
                    </button>
                    <button class="btn btn-sm join-item" disabled={data.page >= totalPages} onclick={() => goToPage(data.page + 1)}>
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
                    <span class="badge {levelBadge(selectedRow.level)}">{selectedRow.level}</span>
                    Event {selectedRow.eventId}
                </h3>
                <button type="button" class="btn btn-ghost btn-sm btn-circle" onclick={() => (selectedRow = null)}>
                    <X size={16} />
                </button>
            </div>

            <dl class="grid grid-cols-3 gap-x-4 gap-y-2 mt-4 text-sm">
                <dt class="text-base-content/50">Time</dt>
                <dd class="col-span-2">{formatTime(selectedRow.timeCreated)}</dd>

                <dt class="text-base-content/50">Log</dt>
                <dd class="col-span-2">{selectedRow.logName}</dd>

                <dt class="text-base-content/50">Provider</dt>
                <dd class="col-span-2">{selectedRow.providerName}</dd>

                <dt class="text-base-content/50">Machine</dt>
                <dd class="col-span-2">{selectedRow.machineName}</dd>

                {#if selectedRow.userId}
                    <dt class="text-base-content/50">User SID</dt>
                    <dd class="col-span-2 font-mono text-xs">{selectedRow.userId}</dd>
                {/if}

                <dt class="text-base-content/50">Record ID</dt>
                <dd class="col-span-2 font-mono text-xs">{selectedRow.recordId}</dd>

                {#if selectedRow.sourceFile}
                    <dt class="text-base-content/50">Source File</dt>
                    <dd class="col-span-2 font-mono text-xs">{selectedRow.sourceFile}</dd>
                {/if}

                <dt class="text-base-content/50">Message</dt>
                <dd class="col-span-2 whitespace-pre-wrap">{selectedRow.message ?? '—'}</dd>
            </dl>

            <div class="modal-action">
                <button class="btn" type="button" onclick={() => (selectedRow = null)}>Close</button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => (selectedRow = null)}></div>
    </div>
{/if}
