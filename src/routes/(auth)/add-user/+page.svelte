<script lang="ts">
    import Navbar from '$lib/components/Navbar.svelte';
    import type { PageProps } from './$types';
    import { enhance } from '$app/forms';
    import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-svelte';

    let { data, form }: PageProps = $props();

    let givenName = $state('');
    let middleName = $state('');
    let surname = $state('');
    let username = $state('');
    // Auto-select when there's only one domain in scope — no reason to make
    // a restricted admin click a dropdown with a single option.
    let domain = $state(data.allowedDomains.length === 1 ? data.allowedDomains[0] : '');
    let department = $state('');

    // Derived email based on username + domain
    let email = $derived(username === '' || domain === '' ? '' : `${username}@${domain}`);

    let resultModal: HTMLDialogElement;
    let modalTitle = $state('');
    let modalMessage = $state('');
    let modalSuccess = $state(false);

    type UsernameStatus = 'available' | 'taken' | 'empty' | 'error' | null;
    let usernameStatus = $state<UsernameStatus>(null);

    let checking = $state(false);
    let generating = $state(false);
    let creating = $state(false);

    // One entry per domain — add a new domain here and the form picks it up
    // everywhere (dropdown + department options) with no other changes.
    const DEPARTMENTS_BY_DOMAIN: Record<string, string[]> = {
        'bsj.org.jm': [
            'ICT', 'FINANCE','PROCUREMENT', 'HR', 'QEMS', 'OFMB',
            'OFMB_FACILITIES_ADMINISTRATION', 'OFMB_PROPERTY_AND_PROJECTS',
            'CCSB', 'CUSTOMER_SERVICE', 'STANDARDS', 'TRAINING',
            'LEGAL_OFFICE', 'INTERNAL_AUDIT', 'EXECUTIVE_OFFICE',
            'EXECUTIVE_DIRECTOR', 'BDO', 'CORPORATE_OFFICE', 'SPECIAL_PROJECTS',
            'CHEMISTRY', 'MICROBIOLOGY', 'PACKAGING', 'MECHANICAL',
            'ELECTRICAL', 'METALLURGY', 'CIVIL'
        ],
        'hsra.org.jm': ['HSRA_Staff'],
        'ncbj.org.jm': ['NCBJ_Staff'],
        'ncra.org.jm': ['MAIN_OFFICE', 'REGIONAL_OFFICE']
    };

    const departmentOptions = $derived.by(() => DEPARTMENTS_BY_DOMAIN[domain] ?? []);

    // Reset department whenever the domain changes so a stale selection
    // from a previous domain can never be submitted.
    $effect(() => {
        domain;
        department = '';
    });

    function enhanceForm() {
        return async ({ result }: { result: any }) => {
            creating = false;

            if (result.type === 'success') {
                modalSuccess = true;
                modalTitle = 'User Created Successfully';
                modalMessage = result.data?.message ?? 'The user has been created successfully.';
                resultModal.showModal();
            }

            if (result.type === 'failure') {
                modalSuccess = false;
                modalTitle = 'Unable to Create User';
                modalMessage = result.data?.message ?? 'An unexpected error occurred.';
                resultModal.showModal();
            }
        };
    }

    async function isUsernameAvailable(candidate: string): Promise<boolean> {
        const res = await fetch('/api/check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: candidate })
        });

        if (!res.ok) throw new Error('Unable to check username availability');

        const result = await res.json();
        return Boolean(result.available);
    }

    async function checkUsername() {
        if (!username) {
            usernameStatus = 'empty';
            return;
        }

        checking = true;
        usernameStatus = null;

        try {
            usernameStatus = (await isUsernameAvailable(username)) ? 'available' : 'taken';
        } catch (err) {
            console.error(err);
            usernameStatus = 'error';
        } finally {
            checking = false;
        }
    }

    // Generates a username following the same fallback order described in
    // the help text below, and checks each candidate against AD until it
    // finds one that's free (or runs out of options).
    async function generateUsername() {
        if (!givenName || !surname) return;

        generating = true;
        usernameStatus = null;

        const candidates = [
            (givenName[0] + surname).toLowerCase(),
            middleName ? (givenName[0] + middleName[0] + surname).toLowerCase() : null,
            `${givenName}.${surname}`.toLowerCase()
        ].filter((c): c is string => Boolean(c));

        try {
            for (const candidate of candidates) {
                if (await isUsernameAvailable(candidate)) {
                    username = candidate;
                    usernameStatus = 'available';
                    return;
                }
            }

            // Everything we tried is taken — leave the last candidate in the
            // field so the admin can see it and adjust manually.
            username = candidates[candidates.length - 1];
            usernameStatus = 'taken';
        } catch (err) {
            console.error(err);
            usernameStatus = 'error';
        } finally {
            generating = false;
        }
    }

    function resetForm() {
        givenName = '';
        middleName = '';
        surname = '';
        username = '';
        domain = data.allowedDomains.length === 1 ? data.allowedDomains[0] : '';
        department = '';
        usernameStatus = null;
        resultModal.close();
    }
</script>

<svelte:head>
    <title>Add User — ElliDesk</title>
</svelte:head>

<div class="max-w-5xl mx-auto p-6 lg:p-10 space-y-6">

    <div class="text-center space-y-2">
        <h1 class="text-3xl font-bold">Add New User</h1>
        <p class="text-base-content/70 max-w-2xl mx-auto">
            Create a new user by entering the relevant details below. Generate a username from
            the name fields and check its availability before submitting.
        </p>
        <p class="text-xs text-base-content/50 max-w-xl mx-auto">
            Username format: first initial + surname (e.g. John Doe → jdoe). If taken, first +
            middle initial + surname (John Mark Doe → jmdoe). If that's also taken,
            firstname.lastname (john.doe).
        </p>
    </div>

    <div class="card bg-base-100 shadow">
        <div class="card-body">

            <form
                method="POST"
                class="grid grid-cols-1 md:grid-cols-2 gap-6"
                action="/add-user"
                use:enhance={enhanceForm}
                onsubmit={() => (creating = true)}
            >

                <!-- Domain -->
                <div class="form-control col-span-2">
                    <label class="label" for="domain">
                        <span class="label-text font-semibold">Domain</span>
                    </label>
                    <select
                        id="domain"
                        name="domain"
                        bind:value={domain}
                        class="select select-bordered w-full"
                        required
                    >
                        <option value="" disabled selected>Select Domain</option>
                        {#each data.allowedDomains as d}
                            <option value={d}>{d}</option>
                        {/each}
                    </select>
                </div>

                <!-- Given Name -->
                <div class="form-control">
                    <label class="label" for="givenName">
                        <span class="label-text font-semibold">Given Name</span>
                    </label>
                    <input
                        id="givenName"
                        type="text"
                        name="givenName"
                        bind:value={givenName}
                        required
                        class="input input-bordered w-full"
                        placeholder="John"
                    >
                </div>

                <!-- Surname -->
                <div class="form-control">
                    <label class="label" for="surname">
                        <span class="label-text font-semibold">Surname</span>
                    </label>
                    <input
                        id="surname"
                        type="text"
                        name="surname"
                        bind:value={surname}
                        required
                        class="input input-bordered w-full"
                        placeholder="Doe"
                    >
                </div>

                <!-- Middle Name (optional, enables the jmdoe fallback) -->
                <div class="form-control col-span-2">
                    <label class="label" for="middleName">
                        <span class="label-text font-semibold">Middle Name</span>
                        <span class="label-text-alt">Optional</span>
                    </label>
                    <input
                        id="middleName"
                        type="text"
                        bind:value={middleName}
                        class="input input-bordered w-full"
                        placeholder="Mark — enables the jmdoe-style fallback if jdoe is taken"
                    >
                </div>

                <!-- Username -->
                <div class="form-control">
                    <label class="label" for="username">
                        <span class="label-text font-semibold">Username</span>
                    </label>
                    <input
                        id="username"
                        type="text"
                        class="input input-bordered w-full"
                        bind:value={username}
                        name="username"
                        placeholder="jdoe / jmdoe / john.doe"
                        required
                    >
                </div>

                <div class="form-control flex pt-6 justify-between gap-2">
                    <button
                        type="button"
                        class="btn btn-secondary flex-1"
                        onclick={generateUsername}
                        disabled={!givenName || !surname || generating}
                    >
                        {generating ? 'Generating...' : 'Generate'}
                    </button>
                    <button
                        type="button"
                        class="btn btn-primary flex-1"
                        onclick={checkUsername}
                        disabled={checking}
                    >
                        {checking ? 'Checking...' : 'Check'}
                    </button>
                </div>

                {#if usernameStatus}
                    <div class="col-span-2 -mt-2">
                        {#if usernameStatus === 'available'}
                            <div class="flex items-center gap-2 text-success text-sm font-medium">
                                <CheckCircle2 size={16} />
                                Username is available
                            </div>
                        {:else if usernameStatus === 'taken'}
                            <div class="flex items-center gap-2 text-error text-sm font-medium">
                                <XCircle size={16} />
                                Username is already taken
                            </div>
                        {:else if usernameStatus === 'empty'}
                            <div class="flex items-center gap-2 text-warning text-sm font-medium">
                                <AlertTriangle size={16} />
                                Enter a username to check
                            </div>
                        {:else}
                            <div class="flex items-center gap-2 text-warning text-sm font-medium">
                                <AlertTriangle size={16} />
                                Couldn't check availability — please try again
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Primary Email (UPN) -->
                <div class="form-control">
                    <label class="label" for="upn">
                        <span class="label-text font-semibold">Primary Email (UPN)</span>
                    </label>
                    <input
                        id="upn"
                        type="email"
                        value={email}
                        name="userPrincipalName"
                        required
                        class="input input-bordered w-full"
                        placeholder="example@bsj.org.jm"
                    >
                </div>

                <!-- Department -->
                <div class="form-control">
                    <label class="label" for="department">
                        <span class="label-text font-semibold">Department</span>
                    </label>
                    <select
                        id="department"
                        name="department"
                        bind:value={department}
                        class="select select-bordered w-full"
                        required
                        disabled={domain === ''}
                    >
                        <option value="" disabled selected>
                            {domain === '' ? 'Select a domain first' : 'Select Department'}
                        </option>
                        {#each departmentOptions as option}
                            <option>{option}</option>
                        {/each}
                    </select>
                </div>

                <!-- Submit -->
                <div class="form-control md:col-span-2 pt-4">
                    <button type="submit" class="btn btn-primary w-full" disabled={creating}>
                        {creating ? 'Creating...' : 'Create User'}
                    </button>
                </div>

            </form>

        </div>
    </div>

</div>

<dialog bind:this={resultModal} class="modal">
    <div class="modal-box max-w-md">

        <div class="flex flex-col items-center text-center">

            <div
                class={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
                    modalSuccess ? 'bg-success/20' : 'bg-error/20'
                }`}
            >
                {#if modalSuccess}
                    <CheckCircle2 size={40} class="text-success" />
                {:else}
                    <XCircle size={40} class="text-error" />
                {/if}
            </div>

            <h2 class="text-2xl font-bold">{modalTitle}</h2>
            <p class="py-5">{modalMessage}</p>

        </div>

        <div class="modal-action justify-center">
            {#if modalSuccess}
                <a href="/all-users" class="btn px-10">View Users</a>
                <button class="btn btn-success px-10" onclick={resetForm}>
                    Add Another
                </button>
            {:else}
                <button class="btn btn-error px-10" onclick={() => resultModal.close()}>
                    Try Again
                </button>
            {/if}
        </div>

    </div>
</dialog>