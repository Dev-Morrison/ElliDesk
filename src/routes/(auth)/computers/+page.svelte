<script lang="ts">
    import type { ADComputer } from '$lib/types';
    import { fileTimeToDate, extractErrorMessage } from '$lib/index';
    import { invalidateAll } from '$app/navigation';
    import { page } from '$app/state';
    import { Monitor, MonitorCheck, MonitorX, MonitorOff, X } from 'lucide-svelte';
    import { showNotice } from '$lib/stores/notice.svelte';

    let { data } = $props();

    const canManageComputers = $derived(
        (data.permissions.capabilities as string[]).includes('computers.manage')
    );

    // Pre-filled when arriving from global search (/computers?search=NAME).
    let search = $state(page.url.searchParams.get('search') ?? '');
    let statusFilter = $state<'all' | 'enabled' | 'disabled'>('all');
    let osFilter = $state('all');
    let ouFilter = $state('all');
    let inactivityFilter = $state<'all' | '30' | '90' | '180' | 'never'>('all');

    let loading = $state(false);
    let busyCn = $state<string | null>(null);

    function daysSinceLastLogon(computer: ADComputer): number | null {
        const date = fileTimeToDate(computer.lastLogon);
        if (!date) return null;
        return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    }

    let osOptions = $derived.by(() => {
        const set = new Set(
            data.computers
                .map((c: ADComputer) => c.operatingSystem)
                .filter((os: string | undefined): os is string => !!os && os.trim() !== '')
        );
        return Array.from(set).sort();
    });

    let ouOptions = $derived.by(() => {
        const set = new Set(data.computers.map((c: ADComputer) => c.ou));
        return Array.from(set).sort();
    });

    let computers = $derived.by(() => {
        const s = search.toLowerCase();

        return data.computers.filter((c: ADComputer) => {
            const matchesSearch =
                s === '' ||
                c.cn?.toLowerCase().includes(s) ||
                c.dnsHostName?.toLowerCase().includes(s) ||
                c.operatingSystem?.toLowerCase().includes(s);

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'enabled' && c.enabled) ||
                (statusFilter === 'disabled' && !c.enabled);

            const matchesOS = osFilter === 'all' || c.operatingSystem === osFilter;

            const matchesOU = ouFilter === 'all' || c.ou === ouFilter;

            const days = daysSinceLastLogon(c);
            const matchesInactivity =
                inactivityFilter === 'all' ||
                (inactivityFilter === 'never' && days === null) ||
                (inactivityFilter === '30' && days !== null && days >= 30) ||
                (inactivityFilter === '90' && days !== null && days >= 90) ||
                (inactivityFilter === '180' && days !== null && days >= 180);

            return matchesSearch && matchesStatus && matchesOS && matchesOU && matchesInactivity;
        });
    });

    let hasActiveFilters = $derived(
        search !== '' ||
        statusFilter !== 'all' ||
        osFilter !== 'all' ||
        ouFilter !== 'all' ||
        inactivityFilter !== 'all'
    );

    function clearFilters() {
        search = '';
        statusFilter = 'all';
        osFilter = 'all';
        ouFilter = 'all';
        inactivityFilter = 'all';
    }

    let stats = $derived.by(() => {
        const total = data.computers.length;
        const enabled = data.computers.filter((c: ADComputer) => c.enabled).length;
        const disabled = total - enabled;
        const stale = data.computers.filter((c: ADComputer) => {
            const days = daysSinceLastLogon(c);
            return days !== null && days >= 90;
        }).length;

        return { total, enabled, disabled, stale };
    });

    async function refresh() {
        loading = true;
        try {
            await invalidateAll();
        } finally {
            loading = false;
        }
    }

    async function toggleEnabled(computer: ADComputer) {
        busyCn = computer.cn;

        try {
            const res = await fetch(`/api/computers/${computer.cn}/${computer.enabled ? 'disable' : 'enable'}`, {
                method: 'POST'
            });

            if (!res.ok) {
                showNotice(await extractErrorMessage(res, 'Failed to update computer.'));
                return;
            }

            await invalidateAll();
        } finally {
            busyCn = null;
        }
    }

    function formatDate(value: string | null | undefined) {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toLocaleString();
    }

    function formatLastLogon(computer: ADComputer) {
        const date = fileTimeToDate(computer.lastLogon);
        return date ? date.toLocaleString() : 'Never';
    }

    // --- Detail modal --------------------------------------------------------
    let selectedComputer = $state<ADComputer | null>(null);
</script>

<svelte:head>
    <title>Computers — ElliDesk</title>
</svelte:head>

<div class="space-y-6 max-w-7xl mx-auto p-6 lg:p-10">

    <section class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <Monitor size={28} />
                Computers
            </h1>
            <p class="text-base-content/70 mt-1">
                Computer objects across the domain — status, OS, and last activity.
            </p>
        </div>

        <button class="btn btn-primary" onclick={refresh} disabled={loading}>
            {#if loading}
                <span class="loading loading-spinner loading-sm"></span>
                Refreshing...
            {:else}
                ↻ Refresh
            {/if}
        </button>
    </section>

    <!-- STAT CARDS -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-primary/10 text-primary">
                    <Monitor size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{stats.total}</div>
                    <div class="text-xs text-base-content/60">Total Computers</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-success/10 text-success">
                    <MonitorCheck size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{stats.enabled}</div>
                    <div class="text-xs text-base-content/60">Enabled</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class="p-3 rounded-lg bg-neutral/10 text-neutral">
                    <MonitorX size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{stats.disabled}</div>
                    <div class="text-xs text-base-content/60">Disabled</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-4 py-4">
                <div class={`p-3 rounded-lg ${stats.stale > 0 ? 'bg-warning/10 text-warning' : 'bg-base-content/10 text-base-content/60'}`}>
                    <MonitorOff size={22} />
                </div>
                <div>
                    <div class="text-2xl font-bold">{stats.stale}</div>
                    <div class="text-xs text-base-content/60">Inactive 90+ days</div>
                </div>
            </div>
        </div>
    </section>

    <!-- TOOLBAR -->
    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">
            <div class="flex flex-col lg:flex-row flex-wrap gap-3">

                <input
                    bind:value={search}
                    class="input input-bordered flex-1 min-w-[200px]"
                    placeholder="Search name, hostname, or OS..."
                />

                <select bind:value={statusFilter} class="select select-bordered w-full lg:w-40">
                    <option value="all">All Statuses</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                </select>

                <select bind:value={osFilter} class="select select-bordered w-full lg:w-56">
                    <option value="all">All Operating Systems</option>
                    {#each osOptions as os}
                        <option value={os}>{os}</option>
                    {/each}
                </select>

                <select bind:value={ouFilter} class="select select-bordered w-full lg:w-56">
                    <option value="all">All OUs</option>
                    {#each ouOptions as ou}
                        <option value={ou}>{ou}</option>
                    {/each}
                </select>

                <select bind:value={inactivityFilter} class="select select-bordered w-full lg:w-48">
                    <option value="all">Any Activity</option>
                    <option value="30">Inactive 30+ days</option>
                    <option value="90">Inactive 90+ days</option>
                    <option value="180">Inactive 180+ days</option>
                    <option value="never">Never Logged On</option>
                </select>

                {#if hasActiveFilters}
                    <button type="button" class="btn btn-ghost" onclick={clearFilters}>
                        Clear filters
                    </button>
                {/if}
            </div>

            <p class="text-sm text-base-content/60">
                Showing {computers.length} of {data.computers.length} computers
            </p>
        </div>
    </div>

    <!-- TABLE -->
    <div class="card bg-base-100 shadow">
        <div class="overflow-x-auto">
            <table class="table table-zebra">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>DNS Hostname</th>
                        <th>Operating System</th>
                        <th>OU</th>
                        <th>Last Logon</th>
                        <th>Status</th>
                        <th class="w-40">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each computers as computer (computer.dn)}
                        <tr class="hover cursor-pointer" onclick={() => (selectedComputer = computer)}>
                            <td class="font-medium">{computer.cn}</td>
                            <td class="text-sm text-base-content/70">{computer.dnsHostName || '—'}</td>
                            <td class="text-sm">
                                {computer.operatingSystem || '—'}
                                {#if computer.operatingSystemVersion}
                                    <span class="text-base-content/50">({computer.operatingSystemVersion})</span>
                                {/if}
                            </td>
                            <td class="text-sm text-base-content/70 max-w-55 truncate">{computer.ou}</td>
                            <td class="text-sm">
                                {#if daysSinceLastLogon(computer) !== null && (daysSinceLastLogon(computer) ?? 0) >= 90}
                                    <span class="text-warning">{formatLastLogon(computer)}</span>
                                {:else}
                                    {formatLastLogon(computer)}
                                {/if}
                            </td>
                            <td>
                                {#if computer.enabled}
                                    <span class="badge badge-success badge-sm">Enabled</span>
                                {:else}
                                    <span class="badge badge-error badge-sm">Disabled</span>
                                {/if}
                            </td>
                            <td onclick={(e) => e.stopPropagation()}>
                                {#if canManageComputers}
                                    <button
                                        type="button"
                                        class="btn btn-xs {computer.enabled ? 'btn-outline btn-error' : 'btn-outline btn-success'}"
                                        disabled={busyCn === computer.cn}
                                        onclick={() => toggleEnabled(computer)}
                                    >
                                        {#if busyCn === computer.cn}
                                            <span class="loading loading-spinner loading-xs"></span>
                                        {:else if computer.enabled}
                                            Disable
                                        {:else}
                                            Enable
                                        {/if}
                                    </button>
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="7" class="text-center text-base-content/50 py-10">
                                No computers match the current filters.
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

</div>

<!-- DETAIL MODAL -->
{#if selectedComputer}
    <div class="modal modal-open">
        <div class="modal-box max-w-xl">
            <div class="flex items-start justify-between">
                <h3 class="font-bold text-lg flex items-center gap-2">
                    <Monitor size={18} />
                    {selectedComputer.cn}
                </h3>
                <button type="button" class="btn btn-ghost btn-sm btn-circle" onclick={() => (selectedComputer = null)}>
                    <X size={16} />
                </button>
            </div>

            <dl class="grid grid-cols-3 gap-x-4 gap-y-2 mt-4 text-sm">
                <dt class="text-base-content/50">Status</dt>
                <dd class="col-span-2">
                    {#if selectedComputer.enabled}
                        <span class="badge badge-success badge-sm">Enabled</span>
                    {:else}
                        <span class="badge badge-error badge-sm">Disabled</span>
                    {/if}
                </dd>

                <dt class="text-base-content/50">DNS Hostname</dt>
                <dd class="col-span-2">{selectedComputer.dnsHostName || '—'}</dd>

                <dt class="text-base-content/50">Operating System</dt>
                <dd class="col-span-2">
                    {selectedComputer.operatingSystem || '—'}
                    {#if selectedComputer.operatingSystemVersion}
                        ({selectedComputer.operatingSystemVersion})
                    {/if}
                </dd>

                <dt class="text-base-content/50">Organizational Unit</dt>
                <dd class="col-span-2">{selectedComputer.ou}</dd>

                <dt class="text-base-content/50">Last Logon</dt>
                <dd class="col-span-2">{formatLastLogon(selectedComputer)}</dd>

                <dt class="text-base-content/50">Created</dt>
                <dd class="col-span-2">{formatDate(selectedComputer.whenCreated) ?? '—'}</dd>

                <dt class="text-base-content/50">Last Changed</dt>
                <dd class="col-span-2">{formatDate(selectedComputer.whenChanged) ?? '—'}</dd>

                {#if selectedComputer.description}
                    <dt class="text-base-content/50">Description</dt>
                    <dd class="col-span-2">{selectedComputer.description}</dd>
                {/if}

                <dt class="text-base-content/50">Service Principal Names</dt>
                <dd class="col-span-2">{selectedComputer.servicePrincipalNameCount}</dd>

                <dt class="text-base-content/50">Distinguished Name</dt>
                <dd class="col-span-2 font-mono text-xs break-all">{selectedComputer.dn}</dd>
            </dl>

            <div class="modal-action">
                {#if canManageComputers}
                    <button
                        type="button"
                        class="btn {selectedComputer.enabled ? 'btn-error' : 'btn-success'}"
                        disabled={busyCn === selectedComputer.cn}
                        onclick={() => toggleEnabled(selectedComputer!)}
                    >
                        {selectedComputer.enabled ? 'Disable' : 'Enable'}
                    </button>
                {/if}
                <button class="btn" type="button" onclick={() => (selectedComputer = null)}>Close</button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => (selectedComputer = null)}></div>
    </div>
{/if}
