<script lang="ts">
    import {
        Search,
        X,
        ArrowRight,
        ArrowLeft,
        ShieldAlert,
        CheckCircle2,
        XCircle,
        Download,
        RotateCcw,
        UserMinus,
        LogOut,
        FolderInput
    } from 'lucide-svelte';
    import type { OffboardingTarget, OffboardResult } from '$lib/types';

    interface UserSummary {
        dn: string;
        sAMAccountName: string;
        displayName: string;
        department?: string;
        ou: string;
    }

    // --- Wizard state --------------------------------------------------
    let currentStep = $state(1);

    // Step 1: select users
    let userSearch = $state('');
    let searchingUsers = $state(false);
    let availableUsers = $state<UserSummary[]>([]);
    let selectedUsers = $state<UserSummary[]>([]);

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

    // Step 2: options
    let removeGroups = $state(true);
    let disable = $state(true);
    let moveToRetention = $state(true);

    const optionsValid = $derived(removeGroups || disable || moveToRetention);

    // Step 3: preview
    let previewing = $state(false);
    let previewError = $state('');
    let previewTargets = $state<OffboardingTarget[]>([]);
    let excludedTargets = $state<OffboardingTarget[]>([]);
    let previewSelected = $state<Set<string>>(new Set());
    let expandedGroups = $state<Set<string>>(new Set());

    const includedCount = $derived(previewSelected.size);

    async function loadPreview() {
        previewing = true;
        previewError = '';

        try {
            const res = await fetch('/api/maintenance/offboarding/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dns: selectedUsers.map((u) => u.dn) })
            });

            if (!res.ok) {
                throw new Error('Failed to generate preview. Please try again.');
            }

            const result = await res.json();

            previewTargets = result.targets;
            excludedTargets = result.excluded ?? [];
            previewSelected = new Set(previewTargets.map((t: OffboardingTarget) => t.dn));

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
        previewSelected =
            previewSelected.size === previewTargets.length
                ? new Set()
                : new Set(previewTargets.map((t) => t.dn));
    }

    function toggleGroupsExpanded(dn: string) {
        const next = new Set(expandedGroups);
        if (next.has(dn)) next.delete(dn);
        else next.add(dn);
        expandedGroups = next;
    }

    // Step 4: apply / results
    let showApplyConfirm = $state(false);
    let applying = $state(false);
    let applyResults = $state<OffboardResult[] | null>(null);

    async function applyOffboarding() {
        applying = true;

        try {
            const targets = previewTargets
                .filter((t) => previewSelected.has(t.dn))
                .map((t) => t.dn);

            const res = await fetch('/api/maintenance/offboarding/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets, removeGroups, disable, moveToRetention })
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

        const header = 'sAMAccountName,displayName,success,groupsRemoved,disabled,moved,error\n';
        const rows = applyResults
            .map(
                (r) =>
                    `${r.sAMAccountName},"${r.displayName}",${r.success},${r.removedGroups.length},${r.disabled},${r.moved},"${r.error ?? ''}"`
            )
            .join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `offboarding-${Date.now()}.csv`;
        a.click();

        URL.revokeObjectURL(url);
    }

    function goBack() {
        if (currentStep > 1) currentStep -= 1;
    }

    function startOver() {
        currentStep = 1;
        selectedUsers = [];
        userSearch = '';
        removeGroups = true;
        disable = true;
        moveToRetention = true;
        previewTargets = [];
        excludedTargets = [];
        previewSelected = new Set();
        applyResults = null;
    }

    const successCount = $derived(applyResults?.filter((r) => r.success).length ?? 0);
    const failureCount = $derived(applyResults?.filter((r) => !r.success).length ?? 0);
</script>

<svelte:head>
    <title>Offboarding — ElliDesk</title>
</svelte:head>

<div class="space-y-6 flex flex-col justify-center m-auto max-w-5xl">

    <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <LogOut size={28} />
            Offboard Users
        </h1>
        <p class="text-base-content/70">
            Remove group membership, disable the account, and relocate it to the retention OU — with a full preview before anything is written.
        </p>
    </div>

    <!-- STEPPER -->
    <ul class="steps w-full">
        <li class="step" class:step-primary={currentStep >= 1}>Select Users</li>
        <li class="step" class:step-primary={currentStep >= 2}>Actions</li>
        <li class="step" class:step-primary={currentStep >= 3}>Preview</li>
        <li class="step" class:step-primary={currentStep >= 4}>Apply</li>
    </ul>

    <!-- STEP 1: SELECT USERS -->
    {#if currentStep === 1}
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-4">

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
                            <span class="text-sm font-semibold">Selected for Offboarding</span>
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

                <div class="card-actions justify-end pt-2">
                    <button
                        class="btn btn-primary"
                        disabled={selectedUsers.length === 0}
                        onclick={() => (currentStep = 2)}
                    >
                        Next
                        <ArrowRight size={16} />
                    </button>
                </div>

            </div>
        </div>
    {/if}

    <!-- STEP 2: ACTIONS -->
    {#if currentStep === 2}
        <div class="card bg-base-100 shadow">
            <div class="card-body gap-4">

                <label class="flex items-start gap-3 p-3 border border-base-200 rounded-lg cursor-pointer hover:bg-base-200/50">
                    <input type="checkbox" class="checkbox mt-0.5" bind:checked={removeGroups}>
                    <span>
                        <span class="font-medium flex items-center gap-2">
                            <UserMinus size={16} />
                            Remove from all groups
                        </span>
                        <span class="block text-sm text-base-content/60">
                            Strips every security and distribution group membership the account currently has.
                        </span>
                    </span>
                </label>

                <label class="flex items-start gap-3 p-3 border border-base-200 rounded-lg cursor-pointer hover:bg-base-200/50">
                    <input type="checkbox" class="checkbox mt-0.5" bind:checked={disable}>
                    <span>
                        <span class="font-medium flex items-center gap-2">
                            <ShieldAlert size={16} />
                            Disable the account
                        </span>
                        <span class="block text-sm text-base-content/60">
                            Prevents the account from being used to log in anywhere.
                        </span>
                    </span>
                </label>

                <label class="flex items-start gap-3 p-3 border border-base-200 rounded-lg cursor-pointer hover:bg-base-200/50">
                    <input type="checkbox" class="checkbox mt-0.5" bind:checked={moveToRetention}>
                    <span>
                        <span class="font-medium flex items-center gap-2">
                            <FolderInput size={16} />
                            Move to FE_RETENTION
                        </span>
                        <span class="block text-sm text-base-content/60">
                            Relocates the account object to the retention OU. It's kept, not deleted.
                        </span>
                    </span>
                </label>

                {#if !optionsValid}
                    <div class="alert alert-warning text-sm">
                        <ShieldAlert size={16} />
                        Select at least one action to continue.
                    </div>
                {/if}

                <div class="card-actions justify-between pt-2">
                    <button class="btn btn-ghost" onclick={goBack}>
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    <button
                        class="btn btn-primary"
                        disabled={!optionsValid || previewing}
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
                        excluded automatically because {excludedTargets.length === 1 ? 'it belongs' : 'they belong'} to a protected group
                        (Domain Admins, Enterprise Admins, Schema Admins, or Administrators).
                    </span>
                </div>
            {/if}

            <div class="card bg-base-100 shadow">
                <div class="card-body p-0">

                    <div class="flex items-center justify-between p-4 border-b border-base-200">
                        <div>
                            <h2 class="font-semibold">
                                {includedCount} of {previewTargets.length} users selected for offboarding
                            </h2>
                            <p class="text-sm text-base-content/60">
                                {removeGroups ? 'Remove groups' : ''}
                                {removeGroups && disable ? ' · ' : ''}{disable ? 'Disable' : ''}
                                {(removeGroups || disable) && moveToRetention ? ' · ' : ''}{moveToRetention ? 'Move to FE_RETENTION' : ''}
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
                                    <th>Current OU</th>
                                    <th>Groups</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each previewTargets as target (target.dn)}
                                    <tr class="hover align-top">
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
                                        <td class="text-sm">
                                            {target.currentOU}
                                            {#if target.alreadyInRetention}
                                                <span class="badge badge-ghost badge-sm block w-fit mt-1">Already in retention</span>
                                            {/if}
                                        </td>
                                        <td class="text-sm">
                                            {#if target.groups.length === 0}
                                                <span class="text-base-content/50">No groups</span>
                                            {:else}
                                                <button
                                                    type="button"
                                                    class="link link-hover text-sm"
                                                    onclick={() => toggleGroupsExpanded(target.dn)}
                                                >
                                                    {target.groups.length} group{target.groups.length === 1 ? '' : 's'}
                                                </button>
                                                {#if expandedGroups.has(target.dn)}
                                                    <ul class="mt-1 text-xs text-base-content/60 list-disc list-inside">
                                                        {#each target.groups as g}
                                                            <li>{g.name}</li>
                                                        {/each}
                                                    </ul>
                                                {/if}
                                            {/if}
                                        </td>
                                        <td class="text-sm">
                                            {#if target.enabled}
                                                <span class="badge badge-success badge-sm">Enabled</span>
                                            {:else}
                                                <span class="badge badge-neutral badge-sm">Already Disabled</span>
                                            {/if}
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
                    class="btn btn-error"
                    disabled={includedCount === 0}
                    onclick={() => (showApplyConfirm = true)}
                >
                    Offboard {includedCount} User{includedCount === 1 ? '' : 's'}
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
                            <div class="text-xs text-base-content/60">Offboarded Successfully</div>
                        </div>
                    </div>
                </div>
                <div class="card bg-base-100 shadow">
                    <div class="card-body flex-row items-center gap-4 py-4">
                        <XCircle size={22} class="text-error" />
                        <div>
                            <div class="text-2xl font-bold">{failureCount}</div>
                            <div class="text-xs text-base-content/60">Needs Follow-up</div>
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
                                    <th>Groups Removed</th>
                                    <th>Disabled</th>
                                    <th>Moved</th>
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
                                        <td class="text-sm">{result.removedGroups.length}</td>
                                        <td class="text-sm">{result.disabled ? 'Yes' : '—'}</td>
                                        <td class="text-sm">{result.moved ? 'Yes' : '—'}</td>
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
                    Offboard More Users
                </button>
            </div>

        </div>
    {/if}

</div>

<!-- APPLY CONFIRMATION MODAL -->
{#if showApplyConfirm}
    <div class="modal modal-open">
        <div class="modal-box">

            <h3 class="font-bold text-lg">Confirm Offboarding</h3>

            <p class="py-4">
                You're about to offboard <span class="font-semibold">{includedCount}</span> user{includedCount === 1 ? '' : 's'}:
                {#if removeGroups}<span class="badge badge-outline mr-1">Remove groups</span>{/if}
                {#if disable}<span class="badge badge-outline mr-1">Disable</span>{/if}
                {#if moveToRetention}<span class="badge badge-outline mr-1">Move to FE_RETENTION</span>{/if}
                <br><br>
                This will be written directly to Active Directory and logged to the audit trail.
            </p>

            <div class="modal-action">
                <button class="btn" onclick={() => (showApplyConfirm = false)} disabled={applying}>
                    Cancel
                </button>
                <button type="button" class="btn btn-error" onclick={applyOffboarding} disabled={applying}>
                    {#if applying}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Confirm &amp; Offboard
                </button>
            </div>

        </div>

        <div class="modal-backdrop" onclick={() => !applying && (showApplyConfirm = false)}></div>
    </div>
{/if}
