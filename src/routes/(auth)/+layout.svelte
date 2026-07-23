<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
</script>

<section class="flex flex-col h-full">
    <Navbar username={data.user.username} />
    <main class="flex-1">
        <div class="p-10 mx-auto">{@render children()}</div>
    </main>
</section>