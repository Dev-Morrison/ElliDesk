<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Search, X, Save } from 'lucide-svelte';

    // Expected `data` from +page.server.ts:
    // { group: { cn, sAMAccountName, description, mail, managedBy: { dn, displayName } | null } }
    let { data } = $props();

    const pageTitle = $derived(`Edit Group: ${data.group.cn} — ElliDesk`);

    interface UserSummary {
        dn: string;
        displayName: string;
        sAMAccountName: string;
    }

    let description = $state(data.group.description ?? '');
    let mail = $state(data.group.mail ?? '');
    let managedBy = $state<UserSummary | null>(
        data.group.managedBy
            ? { dn: data.group.managedBy.dn, displayName: data.group.managedBy.displayName, sAMAccountName: '' }
            : null
    );

    let managerSearch = $state('');
    let searchingManagers = $state(false);
    let managerResults = $state<UserSummary[]>([]);

    let saving = $state(false);
    let saveError = $state('');

    let managerSearchTimeout: ReturnType<typeof setTimeout>;

    $effect(() => {
        const query = managerSearch;
        clearTimeout(managerSearchTimeout);

        if (query.trim().length < 2) {
            managerResults = [];
            return;
        }

        managerSearchTimeout = setTimeout(async () => {
            searchingManagers = true;
            try {
                const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
                managerResults = res.ok ? await res.json() : [];
            } finally {
                searchingManagers = false;
            }
        }, 300);
    });

    function pickManager(user: UserSummary) {
        managedBy = user;
        managerSearch = '';
        managerResults = [];
    }

    function clearManager() {
        managedBy = null;
    }

    async function save() {
        saving = true;
        saveError = '';

        try {
            const res = await fetch(`/api/groups/${data.group.sAMAccountName}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    mail,
                    managedBy: managedBy?.dn ?? null
                })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? 'Failed to save changes.');
            }

            await goto(`/groups/${data.group.sAMAccountName}`);
        } catch (err) {
            saveError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            saving = false;
        }
    }
</script>

<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

<div class="space-y-6 max-w-2xl">

    <a href={`/groups/${data.group.sAMAccountName}`} class="btn btn-ghost btn-sm w-fit">
        <ArrowLeft size={16} />
        Back to {data.group.cn}
    </a>

    <div>
        <h1 class="text-3xl font-bold">Edit Group</h1>
        <p class="text-base-content/70">
            {data.group.cn}
            <span class="opacity-60">({data.group.sAMAccountName})</span>
        </p>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Description</span>
                </div>
                <input
                    type="text"
                    bind:value={description}
                    placeholder="e.g. ICT department security group"
                    class="input input-bordered"
                >
            </label>

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Email</span>
                </div>
                <input
                    type="email"
                    bind:value={mail}
                    placeholder="e.g. ict@company.com"
                    class="input input-bordered"
                >
            </label>

            <div class="form-control w-full">
                <div class="label">
                    <span class="label-text">Managed By</span>
                </div>

                {#if managedBy}
                    <div class="flex items-center justify-between p-3 border border-base-200 rounded-lg">
                        <span>
                            {managedBy.displayName}
                        </span>
                        <button class="btn btn-ghost btn-sm btn-square" type="button" onclick={clearManager}>
                            <X size={14} />
                        </button>
                    </div>
                {:else}
                    <label class="input input-bordered flex items-center gap-2">
                        <Search size={16} class="opacity-50" />
                        <input
                            type="text"
                            bind:value={managerSearch}
                            placeholder="Search for a person..."
                            class="grow"
                        >
                    </label>

                    {#if searchingManagers}
                        <div class="p-3 text-center text-sm text-base-content/60">Searching...</div>
                    {:else if managerResults.length > 0}
                        <ul class="menu border border-base-200 rounded-lg mt-2">
                            {#each managerResults as user}
                                <li>
                                    <button type="button" onclick={() => pickManager(user)}>
                                        {user.displayName}
                                        <span class="text-xs opacity-60">({user.sAMAccountName})</span>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                {/if}
            </div>

            {#if saveError}
                <div class="alert alert-error">{saveError}</div>
            {/if}

            <div class="card-actions justify-end pt-2">
                <a href={`/groups/${data.group.sAMAccountName}`} class="btn btn-ghost">
                    Cancel
                </a>
                <button class="btn btn-primary" type="button" onclick={save} disabled={saving}>
                    {#if saving}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    <Save size={16} />
                    Save Changes
                </button>
            </div>

        </div>
    </div>

</div>