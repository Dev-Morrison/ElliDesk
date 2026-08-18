<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import {
        HeartPulse,
        Database,
        Network,
        RefreshCw,
        CheckCircle2,
        XCircle,
        ScrollText,
        Activity,
        Timer
    } from 'lucide-svelte';

    let { data } = $props();

    let refreshing = $state(false);

    async function refresh() {
        refreshing = true;
        try {
            await invalidateAll();
        } finally {
            refreshing = false;
        }
    }

    function formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        parts.push(`${minutes}m`);

        return parts.join(' ');
    }

    function formatDateTime(iso: string | null): string {
        if (!iso) return 'Never';
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
</script>

<svelte:head>
    <title>System Health — ElliDesk</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto">

    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <HeartPulse size={28} />
                System Health
            </h1>
            <p class="text-base-content/70 mt-1">
                Live status of the services ElliDesk depends on.
            </p>
        </div>
        <button class="btn btn-ghost" onclick={refresh} disabled={refreshing}>
            <RefreshCw size={18} class={refreshing ? 'animate-spin' : ''} />
            Refresh
        </button>
    </div>

    <!-- CONNECTIVITY -->
    <div class="grid sm:grid-cols-2 gap-4">

        <div class="card bg-base-100 shadow">
            <div class="card-body gap-2">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="p-2 rounded-lg {data.health.database.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}">
                            <Database size={18} />
                        </div>
                        <span class="font-semibold">Database</span>
                    </div>
                    {#if data.health.database.ok}
                        <span class="badge badge-success gap-1"><CheckCircle2 size={12} />Online</span>
                    {:else}
                        <span class="badge badge-error gap-1"><XCircle size={12} />Down</span>
                    {/if}
                </div>
                <p class="text-xs text-base-content/60">
                    Responded in {data.health.database.latencyMs}ms
                </p>
                {#if !data.health.database.ok && data.health.database.message}
                    <p class="text-xs text-error break-all">{data.health.database.message}</p>
                {/if}
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body gap-2">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="p-2 rounded-lg {data.health.ldap.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}">
                            <Network size={18} />
                        </div>
                        <span class="font-semibold">Active Directory</span>
                    </div>
                    {#if data.health.ldap.ok}
                        <span class="badge badge-success gap-1"><CheckCircle2 size={12} />Online</span>
                    {:else}
                        <span class="badge badge-error gap-1"><XCircle size={12} />Down</span>
                    {/if}
                </div>
                <p class="text-xs text-base-content/60">
                    Responded in {data.health.ldap.latencyMs}ms
                </p>
                {#if !data.health.ldap.ok && data.health.ldap.message}
                    <p class="text-xs text-error break-all">{data.health.ldap.message}</p>
                {/if}
            </div>
        </div>

    </div>

    <!-- AT A GLANCE -->
    <div class="grid sm:grid-cols-3 gap-4">

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-3 py-4">
                <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <ScrollText size={18} />
                </div>
                <div>
                    <div class="text-sm font-semibold">{formatDateTime(data.health.lastEventLogImport)}</div>
                    <div class="text-xs text-base-content/60">Last event log import</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-3 py-4">
                <div class="p-2.5 rounded-lg bg-secondary/10 text-secondary">
                    <Activity size={18} />
                </div>
                <div>
                    <div class="text-sm font-semibold">
                        {data.health.activeSessionCount ?? '—'}
                    </div>
                    <div class="text-xs text-base-content/60">Active sessions</div>
                </div>
            </div>
        </div>

        <div class="card bg-base-100 shadow">
            <div class="card-body flex-row items-center gap-3 py-4">
                <div class="p-2.5 rounded-lg bg-accent/10 text-accent">
                    <Timer size={18} />
                </div>
                <div>
                    <div class="text-sm font-semibold">{formatUptime(data.health.uptimeSeconds)}</div>
                    <div class="text-xs text-base-content/60">App uptime</div>
                </div>
            </div>
        </div>

    </div>

    <!-- TABLE SIZES -->
    <div class="card bg-base-100 shadow">
        <div class="card-body">
            <h2 class="font-semibold mb-1">Database Tables</h2>
            <p class="text-xs text-base-content/60 mb-3">
                Worth checking here after any bulk import — this is what filled the disk last time.
            </p>

            {#if data.health.tables}
                <div class="overflow-x-auto">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Table</th>
                                <th>Rows</th>
                                <th>Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each data.health.tables as t (t.name)}
                                <tr>
                                    <td class="font-mono text-sm">{t.name}</td>
                                    <td class="text-sm">{t.rows.toLocaleString()}</td>
                                    <td class="text-sm {t.sizeMb > 1000 ? 'text-warning font-semibold' : ''}">
                                        {t.sizeMb >= 1024 ? `${(t.sizeMb / 1024).toFixed(1)} GB` : `${t.sizeMb} MB`}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {:else}
                <p class="text-sm text-base-content/50 py-4">Table sizes unavailable — the database check above is failing.</p>
            {/if}
        </div>
    </div>

</div>
