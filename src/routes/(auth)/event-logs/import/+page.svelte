<script lang="ts">
    import { Upload, ScrollText, CheckCircle2, XCircle, AlertTriangle, Trash2, Search } from 'lucide-svelte';
    import { extractErrorMessage } from '$lib/index';
    import { showNotice } from '$lib/stores/notice.svelte';

    const LOG_TYPES = ['Application', 'Security', 'Setup', 'System'] as const;

    let logName = $state<(typeof LOG_TYPES)[number]>('Security');
    let files = $state<FileList | null>(null);
    let uploading = $state(false);

    interface FileProgress {
        name: string;
        inserted: number;
        skipped: number;
        status: 'pending' | 'importing' | 'done' | 'error';
        error?: string;
    }

    let fileProgress = $state<FileProgress[]>([]);

    const totalInserted = $derived(fileProgress.reduce((sum, f) => sum + f.inserted, 0));
    const totalSkipped = $derived(fileProgress.reduce((sum, f) => sum + f.skipped, 0));
    const allDone = $derived(
        fileProgress.length > 0 && fileProgress.every((f) => f.status === 'done' || f.status === 'error')
    );

    async function importOneFile(file: File, progress: FileProgress) {
        progress.status = 'importing';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('logName', logName);

        try {
            const res = await fetch('/api/event-logs/import', { method: 'POST', body: formData });

            if (!res.ok || !res.body) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? `Import failed (${res.status})`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event = JSON.parse(line);

                    if (event.type === 'progress' || event.type === 'done') {
                        progress.inserted = event.inserted;
                        progress.skipped = event.skipped;
                    } else if (event.type === 'error') {
                        progress.status = 'error';
                        progress.error = event.message;
                    }
                }
            }

            if (progress.status !== 'error') {
                progress.status = 'done';
            }
        } catch (err) {
            progress.status = 'error';
            progress.error = err instanceof Error ? err.message : 'Something went wrong.';
        }
    }

    async function startImport() {
        if (!files || files.length === 0) return;

        uploading = true;
        fileProgress = Array.from(files).map((f) => ({
            name: f.name,
            inserted: 0,
            skipped: 0,
            status: 'pending'
        }));

        // Sequential, not parallel — each import already streams batched
        // writes to the DB; running several at once would just contend for
        // the same connection pool and DC-export-derived files for no benefit.
        for (let i = 0; i < files.length; i++) {
            await importOneFile(files[i], fileProgress[i]);
        }

        uploading = false;
    }

    function reset() {
        files = null;
        fileProgress = [];
    }

    // --- Cleanup ------------------------------------------------------------
    let cleanupLogName = $state<'' | (typeof LOG_TYPES)[number]>('');
    let cleanupDays = $state(180);

    interface CleanupPreview {
        matching: number;
        oldestMatch: string | null;
        newestMatch: string | null;
    }

    let previewing = $state(false);
    let previewResult = $state<CleanupPreview | null>(null);
    let previewParamsKey = $state('');

    let showDeleteConfirm = $state(false);
    let deleting = $state(false);
    let deletedCount = $state(0);
    let deleteDone = $state(false);
    let deleteError = $state('');

    function currentCleanupParamsKey() {
        return `${cleanupLogName}|${cleanupDays}`;
    }

    // A preview only reflects the filters it was run with — if either
    // changes afterward, the count on screen no longer matches what Delete
    // would actually remove, so re-previewing is required before it unlocks.
    const previewStale = $derived(
        previewResult !== null && previewParamsKey !== currentCleanupParamsKey()
    );

    async function runPreview() {
        previewing = true;

        try {
            const res = await fetch('/api/event-logs/cleanup/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    olderThanDays: cleanupDays,
                    logName: cleanupLogName || undefined
                })
            });

            if (!res.ok) {
                throw new Error(await extractErrorMessage(res, 'Failed to preview cleanup.'));
            }

            previewResult = await res.json();
            previewParamsKey = currentCleanupParamsKey();
            deleteDone = false;
            deleteError = '';
        } catch (err) {
            showNotice(err instanceof Error ? err.message : 'Failed to preview cleanup.');
        } finally {
            previewing = false;
        }
    }

    async function confirmCleanup() {
        showDeleteConfirm = false;
        deleting = true;
        deletedCount = 0;
        deleteDone = false;
        deleteError = '';

        try {
            const res = await fetch('/api/event-logs/cleanup/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    olderThanDays: cleanupDays,
                    logName: cleanupLogName || undefined
                })
            });

            if (!res.ok || !res.body) {
                throw new Error(await extractErrorMessage(res, `Cleanup failed (${res.status})`));
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event = JSON.parse(line);

                    if (event.type === 'progress' || event.type === 'done') {
                        deletedCount = event.deleted;
                    } else if (event.type === 'error') {
                        deleteError = event.message;
                    }
                }
            }

            deleteDone = true;
            previewResult = null;
        } catch (err) {
            deleteError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            deleting = false;
        }
    }

    function formatCleanupDate(iso: string | null) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
    }
</script>

<svelte:head>
    <title>Import Event Logs — ElliDesk</title>
</svelte:head>

<div class="space-y-6 max-w-3xl mx-auto">

    <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <ScrollText size={28} />
            Import Event Logs
        </h1>
        <p class="text-base-content/70 mt-1">
            Import CSV exports of Windows Event Logs (Application, Security, Setup, System) for browsing.
        </p>
    </div>

    <div class="alert alert-info text-sm">
        <span>
            Export .evtx files to CSV first using
            <code class="font-bold">\\falcon\ADMaintenance\scripts\Export-EventLogsToCsv.ps1</code> on the DC at , then upload the resulting CSV(s) here.
            Re-uploading a file you've already imported is safe — matching events are updated in place, not
            duplicated.
        </span>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">

            <label class="form-control w-full max-w-xs">
                <div class="label"><span class="label-text">Log type</span></div>
                <select bind:value={logName} class="select select-bordered" disabled={uploading}>
                    {#each LOG_TYPES as type}
                        <option value={type}>{type}</option>
                    {/each}
                </select>
            </label>

            <label class="form-control w-full">
                <div class="label"><span class="label-text">CSV file(s)</span></div>
                <input
                    type="file"
                    accept=".csv"
                    multiple
                    bind:files
                    disabled={uploading}
                    class="file-input file-input-bordered w-full"
                />
                <div class="label">
                    <span class="label-text-alt">
                        All selected files must be the same log type — upload separately per type otherwise.
                    </span>
                </div>
            </label>

            <div class="card-actions justify-end">
                <button
                    class="btn btn-primary"
                    disabled={!files || files.length === 0 || uploading}
                    onclick={startImport}
                >
                    {#if uploading}
                        <span class="loading loading-spinner loading-sm"></span>
                        Importing...
                    {:else}
                        <Upload size={16} />
                        Import
                    {/if}
                </button>
            </div>

        </div>
    </div>

    <!-- CLEANUP -->
    <div class="divider">Cleanup</div>

    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">

            <div>
                <h2 class="font-semibold flex items-center gap-2">
                    <Trash2 size={18} />
                    Cleanup Old Entries
                </h2>
                <p class="text-sm text-base-content/60 mt-1">
                    Permanently delete imported entries older than a chosen number of days. Preview first —
                    deleting cannot be undone.
                </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
                <label class="form-control w-full sm:w-48">
                    <div class="label"><span class="label-text">Log type</span></div>
                    <select
                        bind:value={cleanupLogName}
                        class="select select-bordered"
                        disabled={deleting}
                    >
                        <option value="">All Log Types</option>
                        {#each LOG_TYPES as type}
                            <option value={type}>{type}</option>
                        {/each}
                    </select>
                </label>

                <label class="form-control w-full sm:w-40">
                    <div class="label"><span class="label-text">Older than (days)</span></div>
                    <input
                        type="number"
                        min="1"
                        bind:value={cleanupDays}
                        class="input input-bordered"
                        disabled={deleting}
                    />
                </label>

                <div class="form-control flex-1 sm:items-end">
                    <div class="label sm:hidden"><span class="label-text">&nbsp;</span></div>
                    <button
                        type="button"
                        class="btn btn-outline w-full sm:w-auto"
                        onclick={runPreview}
                        disabled={previewing || deleting || cleanupDays < 1}
                    >
                        {#if previewing}
                            <span class="loading loading-spinner loading-sm"></span>
                        {:else}
                            <Search size={16} />
                        {/if}
                        Preview
                    </button>
                </div>
            </div>

            {#if previewResult}
                {#if previewResult.matching === 0}
                    <div class="alert text-sm">
                        <span>No entries match these filters — nothing to delete.</span>
                    </div>
                {:else}
                    <div class="alert alert-warning text-sm">
                        <AlertTriangle size={18} />
                        <span>
                            <strong>{previewResult.matching.toLocaleString()}</strong>
                            {previewResult.matching === 1 ? 'entry matches' : 'entries match'}, from
                            {formatCleanupDate(previewResult.oldestMatch)} to
                            {formatCleanupDate(previewResult.newestMatch)}. This cannot be undone.
                        </span>
                    </div>
                {/if}

                {#if previewStale}
                    <p class="text-xs text-warning">Filters changed — preview again before deleting.</p>
                {/if}

                <div class="card-actions justify-end">
                    <button
                        type="button"
                        class="btn btn-error"
                        disabled={deleting || previewStale || previewResult.matching === 0}
                        onclick={() => (showDeleteConfirm = true)}
                    >
                        {#if deleting}
                            <span class="loading loading-spinner loading-sm"></span>
                            Deleting...
                        {:else}
                            <Trash2 size={16} />
                            Delete {previewResult.matching.toLocaleString()} Entries
                        {/if}
                    </button>
                </div>
            {/if}

            {#if deleting || deleteDone}
                <div class="p-3 border border-base-200 rounded-lg text-sm flex items-center justify-between">
                    <span class="flex items-center gap-2">
                        {#if deleting}
                            <span class="loading loading-spinner loading-xs"></span>
                            Deleting...
                        {:else if deleteError}
                            <XCircle size={16} class="text-error" />
                            Cleanup failed
                        {:else}
                            <CheckCircle2 size={16} class="text-success" />
                            Cleanup complete
                        {/if}
                    </span>
                    <span class="text-base-content/60">{deletedCount.toLocaleString()} deleted</span>
                </div>
            {/if}

            {#if deleteError}
                <div class="alert alert-error text-sm">
                    <AlertTriangle size={16} />
                    <span>{deleteError}</span>
                </div>
            {/if}

        </div>
    </div>

    {#if fileProgress.length > 0}
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-3">

                <div class="flex items-center justify-between">
                    <h2 class="font-semibold">Progress</h2>
                    {#if allDone}
                        <span class="text-sm text-base-content/60">
                            {totalInserted} imported, {totalSkipped} skipped total
                        </span>
                    {/if}
                </div>

                <ul class="space-y-2">
                    {#each fileProgress as f}
                        <li class="flex items-center justify-between p-3 border border-base-200 rounded-lg text-sm">
                            <div class="flex items-center gap-2 min-w-0">
                                {#if f.status === 'pending'}
                                    <span class="loading loading-spinner loading-xs opacity-40"></span>
                                {:else if f.status === 'importing'}
                                    <span class="loading loading-spinner loading-xs"></span>
                                {:else if f.status === 'done'}
                                    <CheckCircle2 size={16} class="text-success shrink-0" />
                                {:else}
                                    <XCircle size={16} class="text-error shrink-0" />
                                {/if}
                                <span class="truncate font-mono">{f.name}</span>
                            </div>

                            <div class="text-right shrink-0 pl-3">
                                {#if f.status === 'error'}
                                    <span class="text-error">{f.error}</span>
                                {:else if f.status !== 'pending'}
                                    <span class="text-base-content/60">
                                        {f.inserted} imported{f.skipped > 0 ? `, ${f.skipped} skipped` : ''}
                                    </span>
                                {/if}
                            </div>
                        </li>
                    {/each}
                </ul>

                {#if totalSkipped > 0 && allDone}
                    <div class="alert alert-warning text-sm">
                        <AlertTriangle size={16} />
                        <span>
                            {totalSkipped} row{totalSkipped === 1 ? '' : 's'} skipped — usually rows with an
                            unparseable timestamp or missing record/event ID. Worth spot-checking the source
                            CSV if this number seems high.
                        </span>
                    </div>
                {/if}

                {#if allDone}
                    <div class="flex justify-between pt-2">
                        <button class="btn btn-ghost btn-sm" onclick={reset}>Import More</button>
                        <a href="/event-logs" class="btn btn-primary btn-sm">Browse Imported Logs</a>
                    </div>
                {/if}

            </div>
        </div>
    {/if}

</div>

<!-- DELETE CONFIRM MODAL -->
{#if showDeleteConfirm && previewResult}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="font-bold text-lg">Delete Event Log Entries</h3>
            <p class="py-4">
                Permanently delete <span class="font-semibold">{previewResult.matching.toLocaleString()}</span>
                {cleanupLogName ? cleanupLogName : ''} entries older than {cleanupDays} days
                (before {formatCleanupDate(previewResult.oldestMatch)} through
                {formatCleanupDate(previewResult.newestMatch)})? This cannot be undone.
            </p>
            <div class="modal-action">
                <button class="btn" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
                <button class="btn btn-error" onclick={confirmCleanup}>
                    <Trash2 size={16} />
                    Delete
                </button>
            </div>
        </div>

        <div class="modal-backdrop" onclick={() => (showDeleteConfirm = false)}></div>
    </div>
{/if}
