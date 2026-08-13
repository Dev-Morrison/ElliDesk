<script lang="ts">
    import { Palette, Check } from 'lucide-svelte';
    import { THEMES, getThemeState, setTheme } from '$lib/stores/theme.svelte';

    const theme = getThemeState();
</script>

<div class="dropdown dropdown-end">
    <div tabindex="0" role="button" class="btn btn-ghost btn-square" aria-label="Change theme">
        <Palette size={20} />
    </div>

    <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 rounded-box z-20 mt-3 w-56 p-2 shadow-lg max-h-96 overflow-y-auto"
    >
        {#each THEMES as t (t)}
            <li>
                <button
                    type="button"
                    class="flex items-center gap-3"
                    class:menu-active={theme.current === t}
                    onclick={() => setTheme(t)}
                >
                    <!-- Scoped to this theme via data-theme, so the swatch
                         colors come from daisyUI's real palette for `t`
                         regardless of the page's actual active theme. -->
                    <span data-theme={t} class="grid grid-cols-2 gap-0.5 rounded-md overflow-hidden w-5 h-5 shrink-0 border border-base-content/10">
                        <span class="bg-primary"></span>
                        <span class="bg-secondary"></span>
                        <span class="bg-accent"></span>
                        <span class="bg-neutral"></span>
                    </span>

                    <span class="capitalize flex-1 text-left">{t}</span>

                    {#if theme.current === t}
                        <Check size={14} />
                    {/if}
                </button>
            </li>
        {/each}
    </ul>
</div>
