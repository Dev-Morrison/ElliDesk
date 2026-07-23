<script lang="ts">
    import type { PageProps } from './$types';
    import { FolderKanban, AlertTriangle } from 'lucide-svelte';
    import OuTreeNode from '$lib/components/OuTreeNode.svelte';
    import type { ADUser, OuNode } from '$lib/types';

    let { data }: PageProps = $props();

    let treeFilter = $state('');
    let selectedOu = $state<OuNode | null>(null);
    let includeSubOUs = $state(false);
    let members = $state<ADUser[]>([]);
    let loadingMembers = $state(false);
    let membersError = $state('');

    function filterTree(nodes: OuNode[], query: string): OuNode[] {
        if (!query) return nodes;
        const q = query.toLowerCase();

        function walk(node: OuNode): OuNode | null {
            const children = node.children
                .map(walk)
                .filter((n): n is OuNode => n !== null);

            if (node.name.toLowerCase().includes(q) || children.length > 0) {
                return { ...node, children };
            }
            return null;
        }

        return nodes.map(walk).filter((n): n is OuNode => n !== null);
    }

    let filteredRoots = $derived(filterTree(data.tree, treeFilter));

    async function selectOu(node: OuNode) {
        selectedOu = node;
        await loadMembers();
    }

    async function loadMembers() {
        if (!selectedOu) return;

        loadingMembers = true;
        membersError = '';

        try {
            const params = new URLSearchParams({
                dn: selectedOu.dn,
                includeSubOUs: String(includeSubOUs)
            });

            const res = await fetch(`/api/ous/members?${params}`);

            if (!res.ok) {
                throw new Error(await res.text());
            }

            members = (await res.json()) as ADUser[];
        } catch (err) {
            membersError = err instanceof Error ? err.message : 'Failed to load members.';
            members = [];
        } finally {
            loadingMembers = false;
        }
    }
</script>

<div class="space-y-6 max-w-7xl mx-auto p-6 lg:p-10">

    <section>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <FolderKanban size={28} />
            Organizational Units
        </h1>
        <p class="text-base-content/70 mt-1">
            Browse the OU structure of the directory and view the users placed in each unit.
        </p>
    </section>

    {#if data.error}
        <div class="alert alert-error">
            <AlertTriangle size={18} />
            <span>{data.error}</span>
        </div>
    {:else if data.tree.length === 0}
        <div class="alert">
            <span>No organizational units were found under the configured base DN.</span>
        </div>
    {:else}
        <div class="grid lg:grid-cols-[320px_1fr] gap-6 items-start">

            <!-- TREE -->
            <div class="card bg-base-100 shadow">
                <div class="card-body p-3">
                    <input
                        bind:value={treeFilter}
                        placeholder="Filter OUs..."
                        class="input input-bordered input-sm w-full mb-2"
                    />

                    <div class="overflow-y-auto max-h-[65vh] space-y-0.5">
                        {#each filteredRoots as root (root.dn)}
                            <OuTreeNode
                                node={root}
                                selectedDn={selectedOu?.dn ?? null}
                                forceExpand={treeFilter.length > 0}
                                onselect={selectOu}
                            />
                        {:else}
                            <p class="text-sm text-base-content/50 px-2 py-4">No OUs match "{treeFilter}".</p>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- MEMBERS -->
            <div class="card bg-base-100 shadow">
                <div class="card-body">
                    {#if !selectedOu}
                        <div class="flex flex-col items-center justify-center py-16 text-base-content/50">
                            <FolderKanban size={40} />
                            <p class="mt-2">Select an organizational unit to view its members.</p>
                        </div>
                    {:else}
                        <div class="flex items-center justify-between flex-wrap gap-3">
                            <div class="min-w-0">
                                <h2 class="text-lg font-semibold truncate">{selectedOu.name}</h2>
                                <p class="text-xs text-base-content/50 font-mono truncate">{selectedOu.dn}</p>
                            </div>

                            <label class="label cursor-pointer gap-2 shrink-0">
                                <span class="label-text text-sm">Include sub-OUs</span>
                                <input
                                    type="checkbox"
                                    class="toggle toggle-sm"
                                    bind:checked={includeSubOUs}
                                    onchange={loadMembers}
                                />
                            </label>
                        </div>

                        {#if membersError}
                            <div class="alert alert-error mt-3 text-sm">{membersError}</div>
                        {:else if loadingMembers}
                            <div class="flex justify-center py-10">
                                <span class="loading loading-spinner"></span>
                            </div>
                        {:else if members.length === 0}
                            <p class="text-base-content/60 py-8 text-center">
                                No users found directly in this OU{includeSubOUs ? '' : ' — try including sub-OUs'}.
                            </p>
                        {:else}
                            <div class="overflow-x-auto mt-3">
                                <table class="table table-zebra table-sm">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Username</th>
                                            <th>Email</th>
                                            <th>Status</th>
                                            <th>Locked</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each members as user (user.sAMAccountName)}
                                            <tr>
                                                <td>{user.displayName}</td>
                                                <td>{user.sAMAccountName}</td>
                                                <td>{user.mail}</td>
                                                <td>
                                                    {#if user.enabled}
                                                        <span class="badge badge-success badge-sm">Enabled</span>
                                                    {:else}
                                                        <span class="badge badge-error badge-sm">Disabled</span>
                                                    {/if}
                                                </td>
                                                <td>
                                                    {#if user.locked}
                                                        <span class="badge badge-warning badge-sm">Locked</span>
                                                    {:else}
                                                        <span class="text-base-content/30">—</span>
                                                    {/if}
                                                </td>
                                                <td class="text-right">
                                                    <a href={`/users/${user.sAMAccountName}`} class="btn btn-ghost btn-xs">
                                                        View
                                                    </a>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>

        </div>
    {/if}

</div>
