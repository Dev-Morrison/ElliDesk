<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { Search, X, ArrowLeft, UserMinus, UserPlus } from 'lucide-svelte';

    // Expected `data` from +page.server.ts:
    // {
    //   group: { cn: string; sAMAccountName: string },
    //   members: { dn, displayName, sAMAccountName, department, enabled }[]
    // }
    let { data } = $props();

    const pageTitle = $derived(`Manage Members: ${data.group.cn} — ElliDesk`);

    interface UserSummary {
        dn: string;
        displayName: string;
        sAMAccountName: string;
        department?: string;
        enabled?: boolean;
    }

    let memberSearch = $state('');
    let selectedToRemove = $state<Set<string>>(new Set());
    let removing = $state(false);

    let addSearch = $state('');
    let searchingUsers = $state(false);
    let searchResults = $state<UserSummary[]>([]);
    let pendingToAdd = $state<UserSummary[]>([]);
    let adding = $state(false);

    let actionError = $state('');

    const memberDNs = $derived.by(() => new Set(data.members.map((m) => m.dn)));

    const filteredMembers = $derived.by(() => {
        const s = memberSearch.trim().toLowerCase();
        if (!s) return data.members;

        return data.members.filter(
            (m) =>
                m.displayName.toLowerCase().includes(s) ||
                m.sAMAccountName.toLowerCase().includes(s) ||
                m.department?.toLowerCase().includes(s)
        );
    });

    function toggleRemove(dn: string) {
        const next = new Set(selectedToRemove);
        if (next.has(dn)) {
            next.delete(dn);
        } else {
            next.add(dn);
        }
        selectedToRemove = next;
    }

    async function removeSelected() {
        if (selectedToRemove.size === 0) return;

        removing = true;
        actionError = '';

        try {
            const res = await fetch(`/api/groups/${data.group.sAMAccountName}/members/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ members: Array.from(selectedToRemove) })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? 'Failed to remove selected members.');
            }

            selectedToRemove = new Set();
            await invalidateAll();
        } catch (err) {
            actionError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            removing = false;
        }
    }

    // --- Add people: debounced server-side search, same pattern as the
    // bulk-update page, so we never load the whole directory client-side.
    let addSearchTimeout: ReturnType<typeof setTimeout>;

    $effect(() => {
        const query = addSearch;
        clearTimeout(addSearchTimeout);

        if (query.trim().length < 2) {
            searchResults = [];
            return;
        }

        addSearchTimeout = setTimeout(async () => {
            searchingUsers = true;
            try {
                const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=15`);
                const results: UserSummary[] = res.ok ? await res.json() : [];

                // Exclude users who are already members or already staged to add
                const pendingDNs = new Set(pendingToAdd.map((u) => u.dn));
                searchResults = results.filter(
                    (u) => !memberDNs.has(u.dn) && !pendingDNs.has(u.dn)
                );
            } finally {
                searchingUsers = false;
            }
        }, 300);
    });

    function stageUser(user: UserSummary) {
        if (!pendingToAdd.find((u) => u.dn === user.dn)) {
            pendingToAdd.push(user);
        }
        searchResults = searchResults.filter((u) => u.dn !== user.dn);
    }

    function unstageUser(dn: string) {
        pendingToAdd = pendingToAdd.filter((u) => u.dn !== dn);
    }

    async function addStaged() {
        if (pendingToAdd.length === 0) return;

        adding = true;
        actionError = '';

        try {
            const res = await fetch(`/api/groups/${data.group.sAMAccountName}/members/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ members: pendingToAdd.map((u) => u.dn) })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? 'Failed to add selected people.');
            }

            pendingToAdd = [];
            await invalidateAll();
        } catch (err) {
            actionError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            adding = false;
        }
    }
</script>

<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

<div class="space-y-6">

    <a href={`/groups/${data.group.sAMAccountName}`} class="btn btn-ghost btn-sm w-fit">
        <ArrowLeft size={16} />
        Back to {data.group.cn}
    </a>

    <div>
        <h1 class="text-3xl font-bold">Manage Members</h1>
        <p class="text-base-content/70">
            {data.group.cn}
            <span class="opacity-60">({data.group.sAMAccountName})</span>
        </p>
    </div>

    {#if actionError}
        <div class="alert alert-error">{actionError}</div>
    {/if}

    <div class="grid lg:grid-cols-2 gap-6">

        <!-- CURRENT MEMBERS -->
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-3">

                <div class="flex items-center justify-between">
                    <h2 class="card-title text-base">Current Members</h2>
                    <span class="badge badge-primary">{data.members.length}</span>
                </div>

                <label class="input input-bordered flex items-center gap-2">
                    <Search size={16} class="opacity-50" />
                    <input
                        type="text"
                        bind:value={memberSearch}
                        placeholder="Search current members..."
                        class="grow"
                    >
                </label>

                <div class="border border-base-200 rounded-lg max-h-96 overflow-auto">
                    {#if filteredMembers.length === 0}
                        <div class="p-4 text-center text-sm text-base-content/60">
                            No members match your search.
                        </div>
                    {:else}
                        <ul class="menu">
                            {#each filteredMembers as member (member.dn)}
                                <li>
                                    <label class="justify-between cursor-pointer">
                                        <span class="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                class="checkbox checkbox-sm"
                                                checked={selectedToRemove.has(member.dn)}
                                                onchange={() => toggleRemove(member.dn)}
                                            >
                                            <span>
                                                {member.displayName}
                                                <span class="text-xs opacity-60">({member.sAMAccountName})</span>
                                                {#if !member.enabled}
                                                    <span class="badge badge-ghost badge-xs ml-1">Disabled</span>
                                                {/if}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <button
                    class="btn btn-error"
                    type="button"
                    disabled={selectedToRemove.size === 0 || removing}
                    onclick={removeSelected}
                >
                    {#if removing}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    <UserMinus size={16} />
                    Remove Selected ({selectedToRemove.size})
                </button>

            </div>
        </div>

        <!-- ADD PEOPLE -->
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-3">

                <div class="flex items-center justify-between">
                    <h2 class="card-title text-base">Add People</h2>
                    <span class="badge badge-secondary">{pendingToAdd.length} staged</span>
                </div>

                <label class="input input-bordered flex items-center gap-2">
                    <Search size={16} class="opacity-50" />
                    <input
                        type="text"
                        bind:value={addSearch}
                        placeholder="Search the directory..."
                        class="grow"
                    >
                </label>

                <div class="border border-base-200 rounded-lg max-h-40 overflow-auto">
                    {#if searchingUsers}
                        <div class="p-3 text-center text-sm text-base-content/60">Searching...</div>
                    {:else if searchResults.length === 0}
                        <div class="p-3 text-center text-sm text-base-content/60">
                            {addSearch.trim().length < 2
                                ? 'Type at least 2 characters to search.'
                                : 'No matching people.'}
                        </div>
                    {:else}
                        <ul class="menu">
                            {#each searchResults as user (user.dn)}
                                <li>
                                    <button type="button" onclick={() => stageUser(user)} class="justify-between">
                                        <span>
                                            {user.displayName}
                                            <span class="text-xs opacity-60">({user.sAMAccountName})</span>
                                        </span>
                                        <UserPlus size={14} />
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <div class="text-sm font-semibold pt-1">Staged to Add</div>

                <div class="border border-base-200 rounded-lg max-h-40 overflow-auto">
                    {#if pendingToAdd.length === 0}
                        <div class="p-3 text-center text-sm text-base-content/60">
                            No one staged yet — search above and select people to add.
                        </div>
                    {:else}
                        <ul class="menu">
                            {#each pendingToAdd as user (user.dn)}
                                <li>
                                    <button type="button" onclick={() => unstageUser(user.dn)} class="justify-between">
                                        <span>
                                            {user.displayName}
                                            <span class="text-xs opacity-60">({user.sAMAccountName})</span>
                                        </span>
                                        <X size={14} />
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <button
                    class="btn btn-primary"
                    type="button"
                    disabled={pendingToAdd.length === 0 || adding}
                    onclick={addStaged}
                >
                    {#if adding}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    <UserPlus size={16} />
                    Add {pendingToAdd.length} to Group
                </button>

            </div>
        </div>

    </div>

</div>