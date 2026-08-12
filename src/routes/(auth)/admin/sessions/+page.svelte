<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { Activity, RefreshCw, ShieldCheck, KeyRound } from 'lucide-svelte';

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

    function formatDateTime(iso: string) {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function formatRelative(iso: string): string {
        const diffMs = new Date(iso).getTime() - Date.now();
        const diffMin = Math.round(diffMs / 60000);

        if (diffMin <= 0) return 'expiring now';
        if (diffMin < 60) return `in ${diffMin}m`;

        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
    }
</script>

<svelte:head>
    <title>Active Sessions — ElliDesk</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto">

    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <Activity size={28} />
                Active Sessions
            </h1>
            <p class="text-base-content/70 mt-1">
                Accounts with a currently valid session.
            </p>
        </div>
        <button class="btn btn-ghost" onclick={refresh} disabled={refreshing}>
            <RefreshCw size={18} class={refreshing ? 'animate-spin' : ''} />
            Refresh
        </button>
    </div>

    <div class="alert text-sm">
        <span>
            Sessions here are signed cookies, not something the server tracks live — this list is
            approximated from sign-in/sign-out activity. An account counts as active until it either
            logs out or its session reaches 8 hours old, whichever comes first. Closing a browser
            without logging out will still show as active until it expires.
        </span>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="overflow-x-auto">
            <table class="table">
                <thead>
                    <tr>
                        <th>Account</th>
                        <th>Source</th>
                        <th>Signed in</th>
                        <th>Expires</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.sessions as session (session.actor + session.loginAt)}
                        <tr>
                            <td class="font-medium">{session.actor}</td>
                            <td>
                                {#if session.authSource === 'local'}
                                    <span class="badge badge-warning badge-sm gap-1">
                                        <KeyRound size={12} />
                                        Local Admin
                                    </span>
                                {:else}
                                    <span class="badge badge-ghost badge-sm gap-1">
                                        <ShieldCheck size={12} />
                                        AD
                                    </span>
                                {/if}
                            </td>
                            <td class="text-sm text-base-content/70">{formatDateTime(session.loginAt)}</td>
                            <td class="text-sm text-base-content/70">
                                {formatDateTime(session.expiresAt)}
                                <span class="text-base-content/40">({formatRelative(session.expiresAt)})</span>
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="4" class="text-center text-base-content/50 py-10">
                                No active sessions.
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

</div>
