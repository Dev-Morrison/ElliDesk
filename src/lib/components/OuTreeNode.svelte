<script lang="ts">
    import { ChevronRight, ChevronDown, Folder } from 'lucide-svelte';
    import type { OuNode } from '$lib/types';
    import OuTreeNode from './OuTreeNode.svelte';

    let {
        node,
        depth = 0,
        selectedDn = null,
        forceExpand = false,
        onselect
    }: {
        node: OuNode;
        depth?: number;
        selectedDn?: string | null;
        forceExpand?: boolean;
        onselect: (node: OuNode) => void;
    } = $props();

    let manuallyExpanded = $state(depth < 1);
    let expanded = $derived(forceExpand || manuallyExpanded);
</script>

<div>
    <div class="flex items-center gap-1" style="padding-left: {depth * 1}rem">
        {#if node.children.length > 0}
            <button
                type="button"
                class="p-0.5 rounded hover:bg-base-300 shrink-0"
                onclick={() => (manuallyExpanded = !manuallyExpanded)}
                aria-label={expanded ? 'Collapse' : 'Expand'}
            >
                {#if expanded}
                    <ChevronDown size={14} />
                {:else}
                    <ChevronRight size={14} />
                {/if}
            </button>
        {:else}
            <span class="w-5.5 shrink-0"></span>
        {/if}

        <button
            type="button"
            class="flex items-center gap-1.5 flex-1 min-w-0 text-left px-1.5 py-1 rounded hover:bg-base-200 {selectedDn === node.dn ? 'bg-primary/10 text-primary font-medium' : ''}"
            onclick={() => onselect(node)}
        >
            <Folder size={14} class="text-base-content/50 shrink-0" />
            <span class="truncate">{node.name}</span>
            {#if node.totalUsers > 0}
                <span class="badge badge-ghost badge-sm ml-auto">{node.totalUsers}</span>
            {/if}
        </button>
    </div>

    {#if expanded && node.children.length > 0}
        <div>
            {#each node.children as child (child.dn)}
                <OuTreeNode node={child} depth={depth + 1} {selectedDn} {forceExpand} {onselect} />
            {/each}
        </div>
    {/if}
</div>
