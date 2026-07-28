<script lang="ts">
    import { FileBarChart, Download, Monitor, UserX, KeyRound, AlertTriangle } from 'lucide-svelte';
    import type { InactiveDeviceRow, StaleUserRow, NonExpiringPasswordRow } from '$lib/types';

    type ReportKey = 'inactive-devices' | 'stale-users' | 'non-expiring-passwords';

    let activeTab = $state<ReportKey>('inactive-devices');
    let days = $state(90);

    let loading = $state(false);
    let loadError = $state('');

    let inactiveDevices = $state<InactiveDeviceRow[] | null>(null);
    let staleUsers = $state<StaleUserRow[] | null>(null);
    let nonExpiring = $state<NonExpiringPasswordRow[] | null>(null);

    async function loadReport(tab: ReportKey, force = false) {
        if (!force) {
            if (tab === 'inactive-devices' && inactiveDevices !== null) return;
            if (tab === 'stale-users' && staleUsers !== null) return;
            if (tab === 'non-expiring-passwords' && nonExpiring !== null) return;
        }

        loading = true;
        loadError = '';

        try {
            if (tab === 'inactive-devices') {
                const res = await fetch(`/api/maintenance/reports/inactive-devices?days=${days}`);
                if (!res.ok) throw new Error('Failed to load report.');
                inactiveDevices = await res.json();
            } else if (tab === 'stale-users') {
                const res = await fetch(`/api/maintenance/reports/stale-users?days=${days}`);
                if (!res.ok) throw new Error('Failed to load report.');
                staleUsers = await res.json();
            } else {
                const res = await fetch('/api/maintenance/reports/non-expiring-passwords');
                if (!res.ok) throw new Error('Failed to load report.');
                nonExpiring = await res.json();
            }
        } catch (err) {
            loadError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            loading = false;
        }
    }

    function selectTab(tab: ReportKey) {
        activeTab = tab;
        loadReport(tab);
    }

    function refreshCurrent() {
        loadReport(activeTab, true);
    }

    // Initial load for the default tab.
    loadReport('inactive-devices');

    function exportCSV<T extends object>(rows: T[] | null, filename: string) {
        if (!rows || rows.length === 0) return;

        const headers = Object.keys(rows[0]) as (keyof T)[];
        const csvRows = rows.map((r) =>
            headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
        );

        const blob = new Blob([headers.join(',') + '\n' + csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    function formatDate(iso: string | null) {
        return iso ? new Date(iso).toLocaleString() : 'Never';
    }
</script>

<div class="space-y-6 max-w-6xl mx-auto">

    <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <FileBarChart size={28} />
            Reports
        </h1>
        <p class="text-base-content/70">
            Directory hygiene at a glance — inactive devices, stale accounts, and password policy exceptions.
        </p>
    </div>

    <div class="tabs tabs-boxed w-fit">
        <button class="tab" class:tab-active={activeTab === 'inactive-devices'} onclick={() => selectTab('inactive-devices')}>
            <Monitor size={16} class="mr-2" />
            Inactive Devices
        </button>
        <button class="tab" class:tab-active={activeTab === 'stale-users'} onclick={() => selectTab('stale-users')}>
            <UserX size={16} class="mr-2" />
            Stale Accounts
        </button>
        <button class="tab" class:tab-active={activeTab === 'non-expiring-passwords'} onclick={() => selectTab('non-expiring-passwords')}>
            <KeyRound size={16} class="mr-2" />
            Non-Expiring Passwords
        </button>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="card-body">

            <div class="flex items-center justify-between flex-wrap gap-3">
                <div>
                    {#if activeTab === 'inactive-devices'}
                        <h2 class="font-semibold">Enabled computers with no logon activity</h2>
                        <p class="text-sm text-base-content/60">Candidates for investigation or decommissioning.</p>
                    {:else if activeTab === 'stale-users'}
                        <h2 class="font-semibold">Enabled user accounts with no logon activity</h2>
                        <p class="text-sm text-base-content/60">Candidates for offboarding — check with the department first.</p>
                    {:else}
                        <h2 class="font-semibold">Accounts with "Password never expires" set</h2>
                        <p class="text-sm text-base-content/60">A common finding in security reviews — worth periodic reassessment.</p>
                    {/if}
                </div>

                <div class="flex items-center gap-2">
                    {#if activeTab !== 'non-expiring-passwords'}
                        <select
                            bind:value={days}
                            onchange={() => loadReport(activeTab, true)}
                            class="select select-bordered select-sm"
                        >
                            <option value={30}>30+ days inactive</option>
                            <option value={60}>60+ days inactive</option>
                            <option value={90}>90+ days inactive</option>
                            <option value={180}>180+ days inactive</option>
                        </select>
                    {/if}

                    <button class="btn btn-ghost btn-sm" onclick={refreshCurrent} disabled={loading}>
                        {#if loading}
                            <span class="loading loading-spinner loading-xs"></span>
                        {:else}
                            ↻ Refresh
                        {/if}
                    </button>

                    <button
                        class="btn btn-ghost btn-sm"
                        onclick={() => {
                            if (activeTab === 'inactive-devices') exportCSV(inactiveDevices, `inactive-devices-${Date.now()}.csv`);
                            else if (activeTab === 'stale-users') exportCSV(staleUsers, `stale-users-${Date.now()}.csv`);
                            else exportCSV(nonExpiring, `non-expiring-passwords-${Date.now()}.csv`);
                        }}
                    >
                        <Download size={14} />
                        Export CSV
                    </button>
                </div>
            </div>

            {#if loadError}
                <div class="alert alert-error mt-4">
                    <AlertTriangle size={18} />
                    {loadError}
                </div>
            {:else if loading}
                <div class="flex justify-center py-12">
                    <span class="loading loading-spinner"></span>
                </div>
            {:else if activeTab === 'inactive-devices'}
                <div class="overflow-x-auto mt-4">
                    <table class="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>DNS Hostname</th>
                                <th>Operating System</th>
                                <th>OU</th>
                                <th>Last Logon</th>
                                <th>Days Inactive</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each inactiveDevices ?? [] as row (row.dn)}
                                <tr>
                                    <td class="font-medium">{row.cn}</td>
                                    <td class="text-sm text-base-content/70">{row.dnsHostName || '—'}</td>
                                    <td class="text-sm">{row.operatingSystem || '—'}</td>
                                    <td class="text-sm text-base-content/70">{row.ou}</td>
                                    <td class="text-sm">{formatDate(row.lastLogon)}</td>
                                    <td class="text-sm">
                                        {#if row.daysSinceLogon === null}
                                            <span class="badge badge-warning badge-sm">Never</span>
                                        {:else}
                                            <span class="text-warning">{row.daysSinceLogon}</span>
                                        {/if}
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="6" class="text-center text-base-content/50 py-8">No inactive devices found at this threshold.</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {:else if activeTab === 'stale-users'}
                <div class="overflow-x-auto mt-4">
                    <table class="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Department</th>
                                <th>OU</th>
                                <th>Last Logon</th>
                                <th>Days Inactive</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each staleUsers ?? [] as row (row.dn)}
                                <tr>
                                    <td class="font-medium">{row.displayName}</td>
                                    <td class="text-sm text-base-content/70">{row.sAMAccountName}</td>
                                    <td class="text-sm">{row.department || '—'}</td>
                                    <td class="text-sm text-base-content/70">{row.ou}</td>
                                    <td class="text-sm">{formatDate(row.lastLogon)}</td>
                                    <td class="text-sm">
                                        {#if row.daysSinceLogon === null}
                                            <span class="badge badge-warning badge-sm">Never</span>
                                        {:else}
                                            <span class="text-warning">{row.daysSinceLogon}</span>
                                        {/if}
                                    </td>
                                    <td>
                                        <a href={`/users/${row.sAMAccountName}`} class="btn btn-ghost btn-xs">View</a>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="7" class="text-center text-base-content/50 py-8">No stale accounts found at this threshold.</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {:else}
                <div class="overflow-x-auto mt-4">
                    <table class="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Department</th>
                                <th>OU</th>
                                <th>Password Last Set</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each nonExpiring ?? [] as row (row.dn)}
                                <tr>
                                    <td class="font-medium">{row.displayName}</td>
                                    <td class="text-sm text-base-content/70">{row.sAMAccountName}</td>
                                    <td class="text-sm">{row.department || '—'}</td>
                                    <td class="text-sm text-base-content/70">{row.ou}</td>
                                    <td class="text-sm">{formatDate(row.passwordLastSet)}</td>
                                    <td>
                                        {#if row.enabled}
                                            <span class="badge badge-success badge-sm">Enabled</span>
                                        {:else}
                                            <span class="badge badge-neutral badge-sm">Disabled</span>
                                        {/if}
                                    </td>
                                    <td>
                                        <a href={`/users/${row.sAMAccountName}`} class="btn btn-ghost btn-xs">View</a>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="7" class="text-center text-base-content/50 py-8">No accounts with non-expiring passwords found.</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}

        </div>
    </div>

</div>
