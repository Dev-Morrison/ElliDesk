<script lang="ts">
    import { getNoticeState, closeNotice } from '$lib/stores/notice.svelte';
    import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-svelte';

    const notice = getNoticeState();

    const iconBg = $derived(
        notice.variant === 'success'
            ? 'bg-success/20'
            : notice.variant === 'warning'
                ? 'bg-warning/20'
                : notice.variant === 'info'
                    ? 'bg-info/20'
                    : 'bg-error/20'
    );

    const iconColor = $derived(
        notice.variant === 'success'
            ? 'text-success'
            : notice.variant === 'warning'
                ? 'text-warning'
                : notice.variant === 'info'
                    ? 'text-info'
                    : 'text-error'
    );
</script>

{#if notice.open}
    <div class="modal modal-open">
        <div class="modal-box max-w-sm text-center">
            <div class="flex flex-col items-center">
                <div class={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${iconBg}`}>
                    {#if notice.variant === 'success'}
                        <CheckCircle2 size={32} class={iconColor} />
                    {:else if notice.variant === 'warning'}
                        <AlertTriangle size={32} class={iconColor} />
                    {:else if notice.variant === 'info'}
                        <Info size={32} class={iconColor} />
                    {:else}
                        <XCircle size={32} class={iconColor} />
                    {/if}
                </div>

                <h3 class="font-bold text-lg">{notice.title}</h3>
                <p class="py-2 text-sm text-base-content/70">{notice.message}</p>
            </div>

            <div class="modal-action justify-center">
                <button class="btn btn-primary px-10" onclick={closeNotice}>OK</button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={closeNotice}></div>
    </div>
{/if}
