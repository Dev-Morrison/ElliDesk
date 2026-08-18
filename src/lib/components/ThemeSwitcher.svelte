<script lang="ts">
    import { Palette } from 'lucide-svelte';
    import { THEMES, getThemeState, setTheme } from '$lib/stores/theme.svelte';

    const theme = getThemeState();
</script>

<div class="dropdown dropdown-end">
    <div tabindex="0" role="button" class="btn btn-ghost btn-square" aria-label="Change theme">
        <Palette size={20} />
    </div>

    <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 rounded-box z-20 mt-3 w-56 p-2 shadow-lg max-h-128 overflow-y-auto flex-nowrap"
    >
        <li class="menu-title">Theme</li>
        {#each THEMES as t (t)}
            <li>
                <button
                    type="button"
                    class="gap-3 px-2 {theme.current === t ? 'bg-base-content/10' : ''}"
                    onclick={() => setTheme(t)}
                >
                    <!-- Scoped to this theme via data-theme, so the swatch
                         colors come from daisyUI's real palette for `t`
                         regardless of the page's actual active theme, rather
                         than hardcoded color values that could drift out of
                         sync with the theme itself. -->
                    <div data-theme={t} class="grid shrink-0 grid-cols-2 gap-0.5 rounded-md p-1 shadow-sm bg-base-100">
                        <div class="size-1 rounded-full bg-base-content"></div>
                        <div class="size-1 rounded-full bg-primary"></div>
                        <div class="size-1 rounded-full bg-secondary"></div>
                        <div class="size-1 rounded-full bg-accent"></div>
                    </div>

                    <div class="w-32 truncate capitalize">{t}</div>
                </button>
            </li>
        {/each}
    </ul>
</div>
