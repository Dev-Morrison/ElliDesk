<script lang="ts">
    import { Upload, ScrollText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-svelte';

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
