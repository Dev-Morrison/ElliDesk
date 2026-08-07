<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
  import NoticeModal from '$lib/components/NoticeModal.svelte';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
</script>

<section class="flex flex-col h-full">
    <Navbar username={data.user.username} capabilities={data.permissions.capabilities} />
    <main class="flex-1">
        <div class="p-10 mx-auto">{@render children()}</div>
    </main>
</section>

<NoticeModal />