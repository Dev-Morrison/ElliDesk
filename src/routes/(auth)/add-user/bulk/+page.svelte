<script lang="ts">
    import { UsersRound, Upload, Download, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-svelte';
    import { extractErrorMessage, downloadCsv } from '$lib/index';
    import { showNotice } from '$lib/stores/notice.svelte';

    let { data } = $props();

    interface BulkUserRow {
        rowNumber: number;
        givenName: string;
        surname: string;
        middleName: string;
        domain: string;
        department: string;
        requestedUsername: string;
        username: string;
        userPrincipalName: string;
        valid: boolean;
        error?: string;
    }

    let files = $state<FileList | null>(null);
    let previewing = $state(false);
    let previewRows = $state<BulkUserRow[] | null>(null);

    let showConfirm = $state(false);
    let applying = $state(false);
    let rowResults = $state<Map<number, { success: boolean; error?: string }>>(new Map());
    let createdCount = $state(0);
    let failedCount = $state(0);
    let applyDone = $state(false);

    const validRows = $derived(previewRows?.filter((r) => r.valid) ?? []);
    const invalidRows = $derived(previewRows?.filter((r) => !r.valid) ?? []);

    function downloadTemplate() {
        downloadCsv(
            'elidesk-bulk-users-template.csv',
            ['GivenName', 'Surname', 'MiddleName', 'Username', 'Domain', 'Department'],
            [['John', 'Doe', '', '', data.allowedDomains[0] ?? '', '']]
        );
    }

    async function runPreview() {
        if (!files || files.length === 0) return;

        previewing = true;
        previewRows = null;
        applyDone = false;
        rowResults = new Map();

        try {
            const formData = new FormData();
            formData.append('file', files[0]);

            const res = await fetch('/api/add-user/bulk/preview', { method: 'POST', body: formData });

            if (!res.ok) {
                throw new Error(await extractErrorMessage(res, 'Failed to validate the file.'));
            }

            previewRows = await res.json();
        } catch (err) {
            showNotice(err instanceof Error ? err.message : 'Failed to validate the file.');
        } finally {
            previewing = false;
        }
    }

    async function confirmCreate() {
        showConfirm = false;
        applying = true;
        rowResults = new Map();
        createdCount = 0;
        failedCount = 0;

        try {
            const res = await fetch('/api/add-user/bulk/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: validRows })
            });

            if (!res.ok || !res.body) {
                throw new Error(await extractErrorMessage(res, 'Bulk creation failed.'));
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

                    if (event.type === 'row') {
                        const next = new Map(rowResults);
                        next.set(event.rowNumber, { success: event.success, error: event.error });
                        rowResults = next;
                    } else if (event.type === 'progress') {
                        createdCount = event.created;
                        failedCount = event.failed;
                    }
                }
            }

            applyDone = true;
        } catch (err) {
            showNotice(err instanceof Error ? err.message : 'Bulk creation failed.');
        } finally {
            applying = false;
        }
    }

    function exportResults() {
        if (!previewRows) return;

        downloadCsv(
            'elidesk-bulk-users-results.csv',
            ['Row', 'GivenName', 'Surname', 'Username', 'Domain', 'Department', 'Status', 'Detail'],
            previewRows.map((r) => {
                const result = rowResults.get(r.rowNumber);
                const status = !r.valid ? 'Skipped' : result ? (result.success ? 'Created' : 'Failed') : 'Not attempted';
                const detail = !r.valid ? r.error : result?.error;
                return [r.rowNumber, r.givenName, r.surname, r.username, r.domain, r.department, status, detail ?? ''];
            })
        );
    }

    function reset() {
        files = null;
        previewRows = null;
        rowResults = new Map();
        applyDone = false;
        createdCount = 0;
        failedCount = 0;
    }
</script>

<svelte:head>
    <title>Bulk Add Users — ElliDesk</title>
</svelte:head>

<div class="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">

    <a href="/add-user" class="btn btn-ghost btn-sm w-fit -ml-2">
        <ArrowLeft size={16} />
        Back to Add User
    </a>

    <div class="text-center space-y-2">
        <h1 class="text-3xl font-bold flex items-center justify-center gap-2">
            <UsersRound size={28} />
            Bulk Add Users
        </h1>
        <p class="text-base-content/70 max-w-2xl mx-auto">
            Create many accounts at once from a CSV file. Leave Username blank to auto-generate it the
            same way the single Add User page does.
        </p>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="card-body gap-4">

            <div class="alert alert-info text-sm">
                <span>
                    Columns: <code class="font-bold">GivenName, Surname, MiddleName, Username, Domain, Department</code>.
                    MiddleName and Username are optional — everything else is required.
                    {#if data.allowedDomains.length > 0}
                        Domain must be one of: <code class="font-bold">{data.allowedDomains.join(', ')}</code>.
                    {/if}
                </span>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
                <input
                    type="file"
                    accept=".csv"
                    bind:files
                    disabled={previewing || applying}
                    class="file-input file-input-bordered flex-1"
                />
                <button type="button" class="btn btn-outline" onclick={downloadTemplate}>
                    <Download size={16} />
                    Download Template
                </button>
                <button
                    type="button"
                    class="btn btn-primary"
                    disabled={!files || files.length === 0 || previewing || applying}
                    onclick={runPreview}
                >
                    {#if previewing}
                        <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                        <Upload size={16} />
                    {/if}
                    Preview
                </button>
            </div>

        </div>
    </div>

    {#if previewRows}
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-4">

                <div class="flex items-center justify-between flex-wrap gap-3">
                    <h2 class="font-semibold">
                        Preview — {validRows.length} ready, {invalidRows.length} with errors
                    </h2>

                    {#if !applyDone}
                        <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            disabled={validRows.length === 0 || applying}
                            onclick={() => (showConfirm = true)}
                        >
                            {#if applying}
                                <span class="loading loading-spinner loading-xs"></span>
                                Creating...
                            {:else}
                                Create {validRows.length} Users
                            {/if}
                        </button>
                    {:else}
                        <div class="flex gap-2">
                            <button type="button" class="btn btn-ghost btn-sm" onclick={exportResults}>
                                <Download size={14} />
                                Export Results
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm" onclick={reset}>
                                Start Over
                            </button>
                        </div>
                    {/if}
                </div>

                {#if applyDone}
                    <div class="alert {failedCount > 0 ? 'alert-warning' : 'alert-success'} text-sm">
                        <span>{createdCount} created, {failedCount} failed.</span>
                    </div>
                {/if}

                <div class="overflow-x-auto">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Row</th>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Domain</th>
                                <th>Department</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each previewRows as row (row.rowNumber)}
                                {@const result = rowResults.get(row.rowNumber)}
                                <tr>
                                    <td class="text-sm text-base-content/50">{row.rowNumber}</td>
                                    <td class="text-sm">{row.givenName} {row.surname}</td>
                                    <td class="text-sm font-mono">{row.username || '—'}</td>
                                    <td class="text-sm">{row.domain}</td>
                                    <td class="text-sm">{row.department}</td>
                                    <td class="text-sm">
                                        {#if result}
                                            {#if result.success}
                                                <span class="badge badge-success badge-sm gap-1">
                                                    <CheckCircle2 size={12} />
                                                    Created
                                                </span>
                                            {:else}
                                                <span class="badge badge-error badge-sm gap-1" title={result.error}>
                                                    <XCircle size={12} />
                                                    Failed
                                                </span>
                                            {/if}
                                        {:else if row.valid}
                                            <span class="badge badge-ghost badge-sm">Ready</span>
                                        {:else}
                                            <span class="badge badge-warning badge-sm gap-1" title={row.error}>
                                                <AlertTriangle size={12} />
                                                {row.error}
                                            </span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    {/if}

</div>

<!-- CONFIRM MODAL -->
{#if showConfirm}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="font-bold text-lg">Create {validRows.length} Users</h3>
            <p class="py-4">
                This will create {validRows.length} new Active Directory account{validRows.length === 1 ? '' : 's'},
                each disabled and without a password until you reset one — same as creating a user one at a
                time. {invalidRows.length > 0 ? `${invalidRows.length} row(s) with errors will be skipped.` : ''}
            </p>
            <div class="modal-action">
                <button class="btn" onclick={() => (showConfirm = false)}>Cancel</button>
                <button class="btn btn-primary" onclick={confirmCreate}>Create Users</button>
            </div>
        </div>
        <div class="modal-backdrop" onclick={() => (showConfirm = false)}></div>
    </div>
{/if}
