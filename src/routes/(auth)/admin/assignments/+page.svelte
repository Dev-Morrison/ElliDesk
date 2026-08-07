<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { Users, Plus, Trash2, Search, X, Globe, Check } from 'lucide-svelte';

    let { data } = $props();

    interface PrincipalResult {
        dn: string;
        name: string;
        sAMAccountName: string;
    }

    let showModal = $state(false);
    let principalType = $state<'group' | 'user'>('group');
    let principalSearch = $state('');
    let searching = $state(false);
    let searchResults = $state<PrincipalResult[]>([]);
    let selectedPrincipal = $state<PrincipalResult | null>(null);
    let roleId = $state<number | null>(null);
    let scopeAllDomains = $state(true);
    let selectedDomains = $state<Set<string>>(new Set());
    let saving = $state(false);
    let formError = $state('');

    let deleteTarget = $state<(typeof data.assignments)[number] | null>(null);
    let deleting = $state(false);

    let searchTimeout: ReturnType<typeof setTimeout>;

    $effect(() => {
        const query = principalSearch;
        const type = principalType;
        clearTimeout(searchTimeout);

        if (query.trim().length < 2) {
            searchResults = [];
            return;
        }

        searchTimeout = setTimeout(async () => {
            searching = true;
            try {
                const res = await fetch(
                    `/api/admin/search-principal?q=${encodeURIComponent(query)}&type=${type}`
                );
                searchResults = res.ok ? await res.json() : [];
            } finally {
                searching = false;
            }
        }, 300);
    });

    function openCreate() {
        principalType = 'group';
        principalSearch = '';
        searchResults = [];
        selectedPrincipal = null;
        roleId = data.roles[0]?.id ?? null;
        scopeAllDomains = true;
        selectedDomains = new Set();
        formError = '';
        showModal = true;
    }

    function pickPrincipal(p: PrincipalResult) {
        selectedPrincipal = p;
        principalSearch = '';
        searchResults = [];
    }

    function toggleDomain(key: string) {
        const next = new Set(selectedDomains);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        selectedDomains = next;
    }

    async function save() {
        if (!selectedPrincipal) {
            formError = 'Search for and select a group or user first.';
            return;
        }
        if (!roleId) {
            formError = 'Select a role.';
            return;
        }
        if (!scopeAllDomains && selectedDomains.size === 0) {
            formError = 'Select at least one domain, or grant access to all domains.';
            return;
        }

        saving = true;
        formError = '';

        try {
            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    principalDn: selectedPrincipal.dn,
                    principalName: selectedPrincipal.name,
                    principalType,
                    roleId,
                    scopeAllDomains,
                    domainKeys: Array.from(selectedDomains)
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.message ?? 'Failed to create assignment.');
            }

            showModal = false;
            await invalidateAll();
        } catch (err) {
            formError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            saving = false;
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        deleting = true;
        try {
            await fetch(`/api/admin/assignments/${deleteTarget.id}`, { method: 'DELETE' });
            await invalidateAll();
        } finally {
            deleting = false;
            deleteTarget = null;
        }
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
    }
</script>

<div class="space-y-6 max-w-5xl mx-auto">

    <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <Users size={28} />
                Role Assignments
            </h1>
            <p class="text-base-content/70 mt-1">
                Grant a <a href="/admin/roles" class="link">role</a> to an AD group or user, scoped to all domains
                or a specific subset.
            </p>
        </div>
        <button class="btn btn-primary" onclick={openCreate} disabled={data.roles.length === 0}>
            <Plus size={16} />
            New Assignment
        </button>
    </div>

    {#if data.roles.length === 0}
        <div class="alert alert-warning text-sm">
            <span>Create a <a href="/admin/roles" class="link">role</a> first — there's nothing to assign yet.</span>
        </div>
    {/if}

    <div class="card bg-base-100 shadow">
        <div class="overflow-x-auto">
            <table class="table">
                <thead>
                    <tr>
                        <th>Principal</th>
                        <th>Type</th>
                        <th>Role</th>
                        <th>Scope</th>
                        <th>Granted</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.assignments as a (a.id)}
                        <tr>
                            <td class="font-medium">{a.principalName}</td>
                            <td>
                                <span class="badge badge-ghost badge-sm capitalize">{a.principalType}</span>
                            </td>
                            <td class="text-sm">{a.roleName}</td>
                            <td class="text-sm">
                                {#if a.scopeAllDomains}
                                    <span class="badge badge-info badge-sm">All Domains</span>
                                {:else}
                                    <div class="flex flex-wrap gap-1">
                                        {#each a.domainKeys as key}
                                            <span class="badge badge-ghost badge-sm">{key}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </td>
                            <td class="text-sm text-base-content/60">
                                {formatDate(a.createdAt)} by {a.createdBy}
                            </td>
                            <td class="text-right">
                                <button
                                    class="btn btn-ghost btn-xs text-error"
                                    onclick={() => (deleteTarget = a)}
                                    aria-label="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="6" class="text-center text-base-content/50 py-10">
                                No role assignments yet.
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

</div>

<!-- CREATE MODAL -->
{#if showModal}
    <div class="modal modal-open">
        <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg text-center">New Role Assignment</h3>

            <div class="tabs tabs-box w-full mt-3">
                <button
                    type="button"
                    class="tab w-1/2"
                    class:tab-active={principalType === 'group'}
                    onclick={() => {
                        principalType = 'group';
                        selectedPrincipal = null;
                        searchResults = [];
                    }}
                >
                    AD Group
                </button>
                <button
                    type="button"
                    class="tab w-1/2"
                    class:tab-active={principalType === 'user'}
                    onclick={() => {
                        principalType = 'user';
                        selectedPrincipal = null;
                        searchResults = [];
                    }}
                >
                    Individual User
                </button>
            </div>

            <div class="mt-3">
                {#if selectedPrincipal}
                    <div class="flex items-center justify-between p-3 border border-base-200 rounded-lg">
                        <div class="min-w-0">
                            <div class="font-medium truncate">{selectedPrincipal.name}</div>
                            <div class="text-xs text-base-content/50 truncate">{selectedPrincipal.dn}</div>
                        </div>
                        <button
                            type="button"
                            class="btn btn-ghost btn-sm btn-square shrink-0"
                            onclick={() => (selectedPrincipal = null)}
                        >
                            <X size={14} />
                        </button>
                    </div>
                {:else}
                    <label class="input input-bordered w-full flex items-center gap-2">
                        <Search size={16} class="opacity-50" />
                        <input
                            type="text"
                            bind:value={principalSearch}
                            placeholder={principalType === 'group' ? 'Search AD groups...' : 'Search AD users...'}
                            class="grow"
                        />
                    </label>

                    {#if searching}
                        <div class="p-3 text-center text-sm text-base-content/60">Searching...</div>
                    {:else if searchResults.length > 0}
                        <ul class="menu border border-base-200 rounded-lg mt-1 max-h-48 overflow-y-auto flex-nowrap">
                            {#each searchResults as p}
                                <li>
                                    <button type="button" onclick={() => pickPrincipal(p)}>
                                        {p.name}
                                        <span class="text-xs opacity-60">({p.sAMAccountName})</span>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                {/if}
            </div>

            <label class="form-control w-full flex justify-between mt-4">
                <div class="label"><span class="label-text">Role</span></div>
                <select bind:value={roleId} class="select select-bordered">
                    {#each data.roles as role}
                        <option value={role.id}>{role.name}</option>
                    {/each}
                </select>
            </label>

            <div class="mt-4">
                <div class="label"><span class="label-text">Domain scope</span></div>

                <div class="join w-full">
                    <button
                        type="button"
                        class="join-item btn btn-sm flex-1 {scopeAllDomains ? 'btn-primary' : 'btn-outline'}"
                        onclick={() => (scopeAllDomains = true)}
                    >
                        <Globe size={14} />
                        All Domains
                    </button>
                    <button
                        type="button"
                        class="join-item btn btn-sm flex-1 {!scopeAllDomains ? 'btn-primary' : 'btn-outline'}"
                        onclick={() => (scopeAllDomains = false)}
                    >
                        Specific Domains
                    </button>
                </div>

                {#if !scopeAllDomains}
                    <div class="flex flex-wrap gap-1.5 mt-3">
                        {#each data.domainOptions as opt}
                            {@const active = selectedDomains.has(opt.key)}
                            <button
                                type="button"
                                class="btn btn-sm rounded-full gap-1 {active ? 'btn-primary' : 'btn-outline'}"
                                onclick={() => toggleDomain(opt.key)}
                                aria-pressed={active}
                            >
                                {#if active}
                                    <Check size={13} />
                                {/if}
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if formError}
                <div class="alert alert-error mt-3 text-sm">{formError}</div>
            {/if}

            <div class="modal-action">
                <button class="btn" onclick={() => (showModal = false)} disabled={saving}>Cancel</button>
                <button class="btn btn-primary" onclick={save} disabled={saving}>
                    {#if saving}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Create Assignment
                </button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => !saving && (showModal = false)}></div>
    </div>
{/if}

<!-- DELETE CONFIRM MODAL -->
{#if deleteTarget}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="font-bold text-lg">Remove Assignment</h3>
            <p class="py-4">
                Remove <span class="font-semibold">{deleteTarget.roleName}</span> from
                <span class="font-semibold">{deleteTarget.principalName}</span>? They'll lose any access that came
                only from this assignment immediately.
            </p>
            <div class="modal-action">
                <button class="btn" onclick={() => (deleteTarget = null)} disabled={deleting}>Cancel</button>
                <button class="btn btn-error" onclick={confirmDelete} disabled={deleting}>
                    {#if deleting}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Remove
                </button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => !deleting && (deleteTarget = null)}></div>
    </div>
{/if}
