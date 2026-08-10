<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
    import {
        FolderTree,
        Users,
        Search,
        X,
        ArrowRight,
        ArrowLeft,
        ShieldAlert,
        CheckCircle2,
        XCircle,
        Download,
        RotateCcw
    } from 'lucide-svelte';

    // Expected `data` from +page.server.ts:
    // { ous: string[] }   -- friendly OU paths for the scope dropdown, e.g. "Company > Sales"

    let { data } = $props();

    interface UserSummary {
        dn: string;
        sAMAccountName: string;
        displayName: string;
        department?: string;
        ou: string;
    }

    interface PreviewTarget {
        dn: string;
        sAMAccountName: string;
        displayName: string;
        ou: string;
        currentValue: string;
        newValue: string;
    }

    interface ApplyResult {
        dn: string;
        displayName: string;
        sAMAccountName: string;
        success: boolean;
        error?: string;
    }

    type AttributeType = 'text' | 'person';

    interface AttributeOption {
        value: string;
        label: string;
        type: AttributeType;
        placeholder?: string;
    }

    const ATTRIBUTE_OPTIONS: AttributeOption[] = [
        { value: 'department', label: 'Department', type: 'text', placeholder: 'e.g. Finance' },
        { value: 'title', label: 'Job Title', type: 'text', placeholder: 'e.g. Systems Administrator' },
        { value: 'company', label: 'Company', type: 'text', placeholder: 'e.g. Acme Corp' },
        { value: 'physicalDeliveryOfficeName', label: 'Office', type: 'text', placeholder: 'e.g. Kingston HQ' },
        { value: 'description', label: 'Description', type: 'text', placeholder: 'e.g. Senior ICT Officer' },
        { value: 'manager', label: 'Manager', type: 'person' }
    ];

    // --- Wizard state --------------------------------------------------
    let currentStep = $state(1);

    // Step 1: scope
    let scopeMode = $state<'ou' | 'manual'>('ou');
    let selectedOU = $state('');
    let includeSubOUs = $state(true);

    let userSearch = $state('');
    let searchingUsers = $state(false);
    let availableUsers = $state<UserSummary[]>([]);
    let selectedUsers = $state<UserSummary[]>([]);

    // Step 2: attribute + value
    let attribute = $state('department');
    let value = $state('');

    let managerSearch = $state('');
    let searchingManagers = $state(false);
    let managerResults = $state<UserSummary[]>([]);
    let selectedManager = $state<UserSummary | null>(null);

    // Step 3: preview
    let previewing = $state(false);
    let previewError = $state('');
    let previewTargets = $state<PreviewTarget[]>([]);
    let excludedTargets = $state<PreviewTarget[]>([]);
    let previewSelected = $state<Set<string>>(new Set());

    // Step 4: apply / results
    let showApplyConfirm = $state(false);
    let applying = $state(false);
    let applyResults = $state<ApplyResult[] | null>(null);

    const selectedAttribute = $derived.by(() =>
        ATTRIBUTE_OPTIONS.find((a) => a.value === attribute)
    );

    const scopeValid = $derived.by(() =>
        scopeMode === 'ou' ? selectedOU !== '' : selectedUsers.length > 0
    );

    const attributeValid = $derived.by(() =>
        selectedAttribute?.type === 'person' ? selectedManager !== null : value.trim() !== ''
    );

    const includedCount = $derived.by(() => previewSelected.size);

    // --- User search (manual scope) ------------------------------------
    let userSearchTimeout: ReturnType<typeof setTimeout>;

    $effect(() => {
        const query = userSearch;
        clearTimeout(userSearchTimeout);

        if (query.trim().length < 2) {
            availableUsers = [];
            return;
        }

        userSearchTimeout = setTimeout(async () => {
            searchingUsers = true;
            try {
                const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=15`);
                availableUsers = res.ok ? await res.json() : [];
            } finally {
                searchingUsers = false;
            }
        }, 300);
    });

    function addUser(user: UserSummary) {
        if (!selectedUsers.find((u) => u.dn === user.dn)) {
            selectedUsers.push(user);
        }
    }

    function removeUser(dn: string) {
        selectedUsers = selectedUsers.filter((u) => u.dn !== dn);
    }

    // --- Manager search (person attribute) ------------------------------
    let managerSearchTimeout: ReturnType<typeof setTimeout>;

    $effect(() => {
        const query = managerSearch;
        clearTimeout(managerSearchTimeout);

        if (query.trim().length < 2) {
            managerResults = [];
            return;
        }

        managerSearchTimeout = setTimeout(async () => {
            searchingManagers = true;
            try {
                const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
                managerResults = res.ok ? await res.json() : [];
            } finally {
                searchingManagers = false;
            }
        }, 300);
    });

    function pickManager(user: UserSummary) {
        selectedManager = user;
        managerSearch = '';
        managerResults = [];
    }

    // --- Navigation ------------------------------------------------------
    function goBack() {
        if (currentStep > 1) currentStep -= 1;
    }

    async function loadPreview() {
        previewing = true;
        previewError = '';

        try {
            const body = {
                scope:
                    scopeMode === 'ou'
                        ? { mode: 'ou', ou: selectedOU, includeSubOUs }
                        : { mode: 'manual', dns: selectedUsers.map((u) => u.dn) },
                attribute,
                value: selectedAttribute?.type === 'person' ? selectedManager?.dn ?? '' : value
            };

            const res = await fetch('/api/bulk-update/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                throw new Error('Failed to generate preview. Please try again.');
            }

            const result = await res.json();

            previewTargets = result.targets;
            excludedTargets = result.excluded ?? [];
            previewSelected = new Set(previewTargets.map((t) => t.dn));

            currentStep = 3;
        } catch (err) {
            previewError = err instanceof Error ? err.message : 'Something went wrong.';
        } finally {
            previewing = false;
        }
    }

    function toggleTarget(dn: string) {
        const next = new Set(previewSelected);
        if (next.has(dn)) {
            next.delete(dn);
        } else {
            next.add(dn);
        }
        previewSelected = next;
    }

    function toggleAll() {
        if (previewSelected.size === previewTargets.length) {
            previewSelected = new Set();
        } else {
            previewSelected = new Set(previewTargets.map((t) => t.dn));
        }
    }

    async function applyChanges() {
        applying = true;

        try {
            const targets = previewTargets
                .filter((t) => previewSelected.has(t.dn))
                .map((t) => t.dn);

            const res = await fetch('/api/bulk-update/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targets,
                    attribute,
                    value: selectedAttribute?.type === 'person' ? selectedManager?.dn ?? '' : value
                })
            });

            applyResults = await res.json();
            currentStep = 4;
        } finally {
            applying = false;
            showApplyConfirm = false;
        }
    }

    function exportResultsCSV() {
        if (!applyResults) return;

        const header = 'sAMAccountName,displayName,success,error\n';
        const rows = applyResults
            .map(
                (r) =>
                    `${r.sAMAccountName},"${r.displayName}",${r.success},"${r.error ?? ''}"`
            )
            .join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `bulk-update-${attribute}-${Date.now()}.csv`;
        a.click();

        URL.revokeObjectURL(url);
    }

    function startOver() {
        currentStep = 1;
        scopeMode = 'ou';
        selectedOU = '';
        includeSubOUs = true;
        selectedUsers = [];
        userSearch = '';
        attribute = 'department';
        value = '';
        selectedManager = null;
        previewTargets = [];
        excludedTargets = [];
        previewSelected = new Set();
        applyResults = null;
    }

    const successCount = $derived.by(
        () => applyResults?.filter((r) => r.success).length ?? 0
    );
    const failureCount = $derived.by(
        () => applyResults?.filter((r) => !r.success).length ?? 0
    );
</script>

<svelte:head>
    <title>Bulk Update — ElliDesk</title>
</svelte:head>

<div class="space-y-6 flex flex-col justify-center m-auto max-w-5xl">

    <div>
        <h1 class="text-3xl font-bold">Bulk Update</h1>
        <p class="text-base-content/70">
            Update an attribute across a group of users in one pass, with a full preview before anything is written.
        </p>
    </div>

    <!-- STEPPER -->
    <ul class="steps w-full">
        <li class="step" class:step-primary={currentStep >= 1}>Scope</li>
        <li class="step" class:step-primary={currentStep >= 2}>Attribute &amp; Value</li>
        <li class="step" class:step-primary={currentStep >= 3}>Preview</li>
        <li class="step" class:step-primary={currentStep >= 4}>Apply</li>
    </ul>

    <!-- STEP 1: SCOPE -->
    {#if currentStep === 1}
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-4">

                <div class="tabs tabs-boxed w-fit">
                    <button
                        class="tab"
                        class:tab-active={scopeMode === 'ou'}
                        onclick={() => (scopeMode = 'ou')}
                    >
                        <FolderTree size={16} class="mr-2" />
                        By Organizational Unit
                    </button>
                    <button
                        class="tab"
                        class:tab-active={scopeMode === 'manual'}
                        onclick={() => (scopeMode = 'manual')}
                    >
                        <Users size={16} class="mr-2" />
                        Select Users Manually
                    </button>
                </div>

                {#if scopeMode === 'ou'}
                    <div class="space-y-3 flex flex-col">
                        <label class="form-control w-full flex flex-col">
                            <div class="label">
                                <span class="label-text">Organizational Unit</span>
                            </div>
                            <select bind:value={selectedOU} class="select select-bordered">
                                <option value="" disabled>Choose an OU...</option>
                                {#each data.ous as ou}
                                    <option value={ou}>{ou}</option>
                                {/each}
                            </select>
                        </label>

                        <label class="label cursor-pointer w-fit">
                            <input type="checkbox" class="checkbox" bind:checked={includeSubOUs}>
                            <span class="label-text">Include users in sub-OUs</span>
                        </label>
                    </div>
                {:else}
                    <div class="grid md:grid-cols-2 gap-4">

                        <div class="space-y-2">
                            <label class="input input-bordered flex items-center gap-2">
                                <Search size={16} class="opacity-50" />
                                <input
                                    type="text"
                                    bind:value={userSearch}
                                    placeholder="Search by name or username..."
                                    class="grow"
                                >
                            </label>

                            <div class="border border-base-200 rounded-lg max-h-72 overflow-auto">
                                {#if searchingUsers}
                                    <div class="p-4 text-center text-sm text-base-content/60">
                                        Searching...
                                    </div>
                                {:else if availableUsers.length === 0}
                                    <div class="p-4 text-center text-sm text-base-content/60">
                                        {userSearch.trim().length < 2
                                            ? 'Type at least 2 characters to search.'
                                            : 'No matching users.'}
                                    </div>
                                {:else}
                                    <ul class="menu">
                                        {#each availableUsers as user}
                                            <li>
                                                <button onclick={() => addUser(user)} class="justify-between">
                                                    <span>
                                                        {user.displayName}
                                                        <span class="text-xs opacity-60">({user.sAMAccountName})</span>
                                                    </span>
                                                    <ArrowRight size={14} />
                                                </button>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-sm font-semibold">Selected Users</span>
                                <span class="badge badge-primary">{selectedUsers.length}</span>
                            </div>

                            <div class="border border-base-200 rounded-lg max-h-72 overflow-auto">
                                {#if selectedUsers.length === 0}
                                    <div class="p-4 text-center text-sm text-base-content/60">
                                        No users selected yet.
                                    </div>
                                {:else}
                                    <ul class="menu">
                                        {#each selectedUsers as user (user.dn)}
                                            <li>
                                                <button onclick={() => removeUser(user.dn)} class="justify-between">
                                                    <span>
                                                        {user.displayName}
                                                        <span class="text-xs opacity-60">({user.sAMAccountName})</span>
                                                    </span>
                                                    <X size={14} />
                                                </button>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        </div>

                    </div>
                {/if}

                <div class="card-actions justify-end pt-2">
                    <button
                        class="btn btn-primary"
                        disabled={!scopeValid}
                        onclick={() => (currentStep = 2)}
                    >
                        Next
                        <ArrowRight size={16} />
                    </button>
                </div>

            </div>
        </div>
    {/if}

    <!-- STEP 2: ATTRIBUTE + VALUE -->
    {#if currentStep === 2}
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-4">

                <label class="form-control w-full max-w-md">
                    <div class="label">
                        <span class="label-text">Attribute to update</span>
                    </div>
                    <select bind:value={attribute} class="select select-bordered">
                        {#each ATTRIBUTE_OPTIONS as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </label>

                {#if selectedAttribute?.type === 'text'}
                    <label class="form-control w-full max-w-md">
                        <div class="label">
                            <span class="label-text">New value</span>
                        </div>
                        <input
                            type="text"
                            bind:value={value}
                            placeholder={selectedAttribute.placeholder}
                            class="input input-bordered"
                        >
                    </label>
                {:else if selectedAttribute?.type === 'person'}
                    <div class="w-full max-w-md space-y-2">
                        <div class="label">
                            <span class="label-text">New manager</span>
                        </div>

                        {#if selectedManager}
                            <div class="flex items-center justify-between p-3 border border-base-200 rounded-lg">
                                <span>
                                    {selectedManager.displayName}
                                    <span class="text-xs opacity-60">({selectedManager.sAMAccountName})</span>
                                </span>
                                <button class="btn btn-ghost btn-sm btn-square" onclick={() => (selectedManager = null)}>
                                    <X size={14} />
                                </button>
                            </div>
                        {:else}
                            <label class="input input-bordered flex items-center gap-2">
                                <Search size={16} class="opacity-50" />
                                <input
                                    type="text"
                                    bind:value={managerSearch}
                                    placeholder="Search for a person..."
                                    class="grow"
                                >
                            </label>

                            {#if searchingManagers}
                                <div class="p-3 text-center text-sm text-base-content/60">Searching...</div>
                            {:else if managerResults.length > 0}
                                <ul class="menu border border-base-200 rounded-lg">
                                    {#each managerResults as user}
                                        <li>
                                            <button onclick={() => pickManager(user)}>
                                                {user.displayName}
                                                <span class="text-xs opacity-60">({user.sAMAccountName})</span>
                                            </button>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        {/if}
                    </div>
                {/if}

                <div class="card-actions justify-between pt-2">
                    <button class="btn btn-ghost" onclick={goBack}>
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    <button
                        class="btn btn-primary"
                        disabled={!attributeValid || previewing}
                        onclick={loadPreview}
                    >
                        {#if previewing}
                            <span class="loading loading-spinner loading-sm"></span>
                        {/if}
                        Load Preview
                        <ArrowRight size={16} />
                    </button>
                </div>

                {#if previewError}
                    <div class="alert alert-error">
                        <XCircle size={18} />
                        {previewError}
                    </div>
                {/if}

            </div>
        </div>
    {/if}

    <!-- STEP 3: PREVIEW -->
    {#if currentStep === 3}
        <div class="space-y-4">

            {#if excludedTargets.length > 0}
                <div class="alert alert-warning">
                    <ShieldAlert size={18} />
                    <span>
                        {excludedTargets.length} account{excludedTargets.length === 1 ? '' : 's'}
                        excluded automatically because they belong to a protected group
                        (Domain Admins, Enterprise Admins, Schema Admins, or Administrators).
                    </span>
                </div>
            {/if}

            <div class="card bg-base-100 shadow">
                <div class="card-body p-0">

                    <div class="flex items-center justify-between p-4 border-b border-base-200">
                        <div>
                            <h2 class="font-semibold">
                                Setting <span class="badge badge-outline">{selectedAttribute?.label}</span>
                                to
                                <span class="font-mono text-sm">
                                    "{selectedAttribute?.type === 'person' ? selectedManager?.displayName : value}"
                                </span>
                            </h2>
                            <p class="text-sm text-base-content/60">
                                {includedCount} of {previewTargets.length} users selected
                            </p>
                        </div>

                        <button class="btn btn-ghost btn-sm" onclick={toggleAll}>
                            {previewSelected.size === previewTargets.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div class="overflow-x-auto max-h-[500px]">
                        <table class="table table-pin-rows">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>User</th>
                                    <th>OU</th>
                                    <th>Current Value</th>
                                    <th>New Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each previewTargets as target (target.dn)}
                                    <tr class="hover">
                                        <td>
                                            <input
                                                type="checkbox"
                                                class="checkbox checkbox-sm"
                                                checked={previewSelected.has(target.dn)}
                                                onchange={() => toggleTarget(target.dn)}
                                            >
                                        </td>
                                        <td>
                                            <div class="font-medium">{target.displayName}</div>
                                            <div class="text-xs opacity-60">{target.sAMAccountName}</div>
                                        </td>
                                        <td class="text-sm">{target.ou}</td>
                                        <td class="text-sm text-base-content/60">
                                            {target.currentValue || '—'}
                                        </td>
                                        <td class="text-sm font-medium text-success">
                                            {target.newValue}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>

            <div class="flex justify-between">
                <button class="btn btn-ghost" onclick={() => (currentStep = 2)}>
                    <ArrowLeft size={16} />
                    Back
                </button>

                <button
                    class="btn btn-primary"
                    disabled={includedCount === 0}
                    onclick={() => (showApplyConfirm = true)}
                >
                    Apply to {includedCount} User{includedCount === 1 ? '' : 's'}
                </button>
            </div>

        </div>
    {/if}

    <!-- STEP 4: RESULTS -->
    {#if currentStep === 4 && applyResults}
        <div class="space-y-4">

            <div class="grid grid-cols-2 gap-4">
                <div class="card bg-base-100 shadow">
                    <div class="card-body flex-row items-center gap-4 py-4">
                        <CheckCircle2 size={22} class="text-success" />
                        <div>
                            <div class="text-2xl font-bold">{successCount}</div>
                            <div class="text-xs text-base-content/60">Updated Successfully</div>
                        </div>
                    </div>
                </div>
                <div class="card bg-base-100 shadow">
                    <div class="card-body flex-row items-center gap-4 py-4">
                        <XCircle size={22} class="text-error" />
                        <div>
                            <div class="text-2xl font-bold">{failureCount}</div>
                            <div class="text-xs text-base-content/60">Failed</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body p-0">
                    <div class="overflow-x-auto max-h-[500px]">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Status</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each applyResults as result (result.dn)}
                                    <tr>
                                        <td>
                                            <div class="font-medium">{result.displayName}</div>
                                            <div class="text-xs opacity-60">{result.sAMAccountName}</div>
                                        </td>
                                        <td>
                                            {#if result.success}
                                                <span class="badge badge-success gap-1">
                                                    <CheckCircle2 size={12} />
                                                    Success
                                                </span>
                                            {:else}
                                                <span class="badge badge-error gap-1">
                                                    <XCircle size={12} />
                                                    Failed
                                                </span>
                                            {/if}
                                        </td>
                                        <td class="text-sm text-base-content/60">
                                            {result.error ?? '—'}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="flex justify-between">
                <button class="btn btn-ghost" onclick={exportResultsCSV}>
                    <Download size={16} />
                    Export Results CSV
                </button>

                <button class="btn btn-primary" onclick={startOver}>
                    <RotateCcw size={16} />
                    Start New Bulk Update
                </button>
            </div>

        </div>
    {/if}

</div>

<!-- APPLY CONFIRMATION MODAL -->
{#if showApplyConfirm}
    <div class="modal modal-open">
        <div class="modal-box">

            <h3 class="font-bold text-lg">Confirm Bulk Update</h3>

            <p class="py-4">
                You're about to set <span class="font-semibold">{selectedAttribute?.label}</span>
                to
                <span class="font-mono">
                    "{selectedAttribute?.type === 'person' ? selectedManager?.displayName : value}"
                </span>
                on <span class="font-semibold">{includedCount}</span> user{includedCount === 1 ? '' : 's'}.
                This will be written directly to Active Directory and logged to the audit trail.
            </p>

            <div class="modal-action">
                <button class="btn" onclick={() => (showApplyConfirm = false)} disabled={applying}>
                    Cancel
                </button>
                <button type="button" class="btn btn-primary" onclick={applyChanges} disabled={applying}>
                    {#if applying}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Confirm &amp; Apply
                </button>
            </div>

        </div>

        <div class="modal-backdrop" onclick={() => !applying && (showApplyConfirm = false)}></div>
    </div>
{/if}