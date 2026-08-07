<script lang="ts">
    import { page } from '$app/state';
    import { ShieldAlert, FileQuestion, ServerCrash, ArrowLeft } from 'lucide-svelte';

    const status = $derived(page.status);

    const Icon = $derived(status === 403 ? ShieldAlert : status === 404 ? FileQuestion : ServerCrash);

    const heading = $derived(
        status === 403 ? "You don't have permission" : status === 404 ? 'Not found' : 'Something went wrong'
    );

    // 403s come from requireCapability() with a technical message ("Missing
    // required permission: groups.manage") that's fine in a server log but
    // not something to show an end user — swap it for a plain sentence.
    // 404/500 messages are already written to be user-facing, so keep those.
    const message = $derived(
        status === 403
            ? "Your account doesn't have the permissions needed to view this page. Contact your administrator if you think this is a mistake."
            : (page.error?.message ?? 'Something went wrong.')
    );

    const iconTone = $derived(
        status === 403 ? 'bg-warning/15 text-warning' : status === 404 ? 'bg-info/15 text-info' : 'bg-error/15 text-error'
    );
</script>

<div class="min-h-screen flex items-center justify-center p-6 bg-base-200">
    <div class="card bg-base-100 shadow max-w-md w-full">
        <div class="card-body items-center text-center">
            <div class={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${iconTone}`}>
                <Icon size={32} />
            </div>

            <h1 class="text-xl font-bold">{heading}</h1>
            <p class="text-sm text-base-content/70">{message}</p>

            {#if status === 403}
                <p class="text-xs text-base-content/40 font-mono mt-1">{page.url.pathname}</p>
            {/if}

            <a href="/dashboard" class="btn btn-primary mt-4">
                <ArrowLeft size={16} />
                Back to Dashboard
            </a>
        </div>
    </div>
</div>
