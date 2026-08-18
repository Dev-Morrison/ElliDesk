<script lang="ts">
    import { goto } from '$app/navigation';
    import { Search, Users, Shield, Monitor } from 'lucide-svelte';
    import type { SearchResultItem } from '$lib/types';

    let dialogEl: HTMLDialogElement;
    let query = $state('');
    let results = $state<SearchResultItem[]>([]);
    let searching = $state(false);
    let searchedAtLeastOnce = $state(false);
    let inputEl: HTMLInputElement | undefined = $state();

    let debounceTimer: ReturnType<typeof setTimeout>;

    const TYPE_META = {
        user: { icon: Users, label: 'Users' },
        group: { icon: Shield, label: 'Groups' },
        computer: { icon: Monitor, label: 'Computers' }
    } as const;

    const grouped = $derived.by(() => {
        const byType: Record<string, SearchResultItem[]> = {};
        for (const r of results) {
            (byType[r.type] ??= []).push(r);
        }
        return byType;
    });

    function openSearch() {
        query = '';
        results = [];
        searchedAtLeastOnce = false;
        dialogEl.showModal();
        // The dialog needs to be open before the input can take focus.
        requestAnimationFrame(() => inputEl?.focus());
    }

    function closeSearch() {
        dialogEl.close();
    }

    function onKeydown(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openSearch();
        }
    }

    function onQueryInput() {
        clearTimeout(debounceTimer);

        if (query.trim().length < 2) {
            results = [];
            searching = false;
            return;
        }

        searching = true;
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
                results = res.ok ? await res.json() : [];
            } catch {
                results = [];
            } finally {
                searching = false;
                searchedAtLeastOnce = true;
            }
        }, 250);
    }

    function goToResult(href: string) {
        closeSearch();
        goto(href);
    }
</script>

<svelte:window onkeydown={onKeydown} />

<button type="button" class="btn btn-ghost btn-square" onclick={openSearch} aria-label="Search">
    <Search size={20} />
</button>

<dialog bind:this={dialogEl} class="modal">
    <div class="modal-box max-w-lg p-0 overflow-hidden">
        <label class="flex items-center gap-2 px-4 py-3 border-b border-base-200">
            <Search size={18} class="text-base-content/50 shrink-0" />
            <input
                bind:this={inputEl}
                bind:value={query}
                oninput={onQueryInput}
                type="text"
                placeholder="Search users, groups, computers..."
                class="grow bg-transparent outline-none text-sm"
            />
            {#if searching}
                <span class="loading loading-spinner loading-sm text-base-content/40 shrink-0"></span>
            {/if}
            <kbd class="kbd kbd-sm hidden sm:inline-flex shrink-0">Esc</kbd>
        </label>

        <div class="max-h-96 overflow-y-auto">
            {#if query.trim().length < 2}
                <p class="text-sm text-base-content/50 text-center py-10">
                    Type at least 2 characters to search.
                </p>
            {:else if searching && results.length === 0}
                <p class="text-sm text-base-content/50 text-center py-10">Searching...</p>
            {:else if searchedAtLeastOnce && results.length === 0}
                <p class="text-sm text-base-content/50 text-center py-10">No matches for "{query}".</p>
            {:else}
                {#each Object.entries(grouped) as [type, items] (type)}
                    {@const meta = TYPE_META[type as keyof typeof TYPE_META]}
                    <div class="px-2 pt-2">
                        <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide px-2 pb-1">
                            {meta.label}
                        </div>
                        <ul class="menu menu-sm p-0">
                            {#each items as item}
                                <li>
                                    <button type="button" onclick={() => goToResult(item.href)} class="gap-3">
                                        <meta.icon size={15} class="text-base-content/50 shrink-0" />
                                        <span class="min-w-0 flex-1 text-left">
                                            <span class="block truncate font-medium">{item.title}</span>
                                            {#if item.subtitle}
                                                <span class="block truncate text-xs text-base-content/50">{item.subtitle}</span>
                                            {/if}
                                        </span>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
                <div class="h-2"></div>
            {/if}
        </div>
    </div>

    <div class="modal-backdrop" onclick={closeSearch}></div>
</dialog>
