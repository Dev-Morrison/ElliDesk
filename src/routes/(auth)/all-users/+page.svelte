<script lang="ts">
    import type { ADUser } from '$lib/types';
    import { fileTimeToDate, copyToClipboard } from '$lib/index';
    import Navbar from '$lib/components/Navbar.svelte';
    import { invalidateAll } from '$app/navigation';
  import StatBoard from '$lib/components/StatBoard.svelte';
    import { Copy, Check, RefreshCw } from 'lucide-svelte';
    let { data } = $props();

    let search = $state("");
    let statusFilter = $state<"all" | "enabled" | "disabled">("all");
    let lockedFilter = $state<"all" | "locked" | "unlocked">("all");
    let departmentFilter = $state("all");

    let loading = $state(false);

    let departmentOptions = $derived.by(() => {
        const set = new Set(
            data.users
                .map((u: ADUser) => u.department)
                .filter((d: string | undefined): d is string => !!d && d.trim() !== "")
        );
        return Array.from(set).sort();
    });

    let users = $derived.by(() => {

        const s = search.toLowerCase();

        return data.users.filter((u: ADUser) => {

            const matchesSearch =
                s === "" ||
                u.cn?.toLocaleLowerCase().includes(s) ||
                u.sAMAccountName?.toLocaleLowerCase().includes(s);

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "enabled" && u.enabled) ||
                (statusFilter === "disabled" && !u.enabled);

            const matchesLocked =
                lockedFilter === "all" ||
                (lockedFilter === "locked" && u.locked) ||
                (lockedFilter === "unlocked" && !u.locked);

            const matchesDepartment =
                departmentFilter === "all" || u.department === departmentFilter;

            return matchesSearch && matchesStatus && matchesLocked && matchesDepartment;

        });

    });

    let hasActiveFilters = $derived(
        search !== "" ||
        statusFilter !== "all" ||
        lockedFilter !== "all" ||
        departmentFilter !== "all"
    );

    function clearFilters() {
        search = "";
        statusFilter = "all";
        lockedFilter = "all";
        departmentFilter = "all";
    }

    async function refreshUsers() {
        loading = true;

        try {
            await invalidateAll();
        } finally {
            loading = false;
        }
    }

    async function action(
        user: ADUser,
        action: string
    ) {

        const res = await fetch(`/api/users/${user.sAMAccountName}/${action}`, {
            method: "POST"
        });

        if (!res.ok) {
            alert(await res.text());
            return;
        }

        location.reload();

    }

    // --- Reset Password ----------------------------------------------------
    let showResetModal = $state(false);
    let resetTargetUser = $state<ADUser | null>(null);
    let resetPassword = $state("");
    let forceChangeAtLogon = $state(true);
    let unlockOnReset = $state(true);
    let resetting = $state(false);
    let resetError = $state("");
    let resetDone = $state(false);
    let copied = $state(false);

    function generatePassword(length = 14): string {
        const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lower = "abcdefghijkmnpqrstuvwxyz";
        const digits = "23456789";
        const symbols = "!@#$%^&*-_=+";
        const all = upper + lower + digits + symbols;

        const pick = (charset: string) =>
            charset[crypto.getRandomValues(new Uint32Array(1))[0] % charset.length];

        const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
        const rest = Array.from({ length: Math.max(length - required.length, 0) }, () =>
            pick(all)
        );

        const chars = [...required, ...rest];

        for (let i = chars.length - 1; i > 0; i--) {
            const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        return chars.join("");
    }

    function openResetModal(user: ADUser) {
        resetTargetUser = user;
        resetPassword = generatePassword();
        forceChangeAtLogon = true;
        unlockOnReset = true;
        resetError = "";
        resetDone = false;
        copied = false;
        showResetModal = true;
    }

    async function copyPassword() {
        try {
            await copyToClipboard(resetPassword);
            copied = true;
        } catch {
            copied = false;
        }
    }

    async function submitReset() {
        if (!resetTargetUser) return;

        resetting = true;
        resetError = "";

        try {
            const res = await fetch(`/api/users/${resetTargetUser.sAMAccountName}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    newPassword: resetPassword,
                    forceChangeAtLogon,
                    unlockAccount: unlockOnReset,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.message ?? "Failed to reset password.");
            }

            resetDone = true;
        } catch (err) {
            resetError = err instanceof Error ? err.message : "Something went wrong.";
        } finally {
            resetting = false;
        }
    }

    function closeResetModal() {
        showResetModal = false;
        if (resetDone) location.reload();
    }

    let lockedAccounts = $derived.by(() => {
        return data.users.filter((u: ADUser) => u.locked).length;
    });

    let activeUsersWithLogonsWithinTheLastWeek = $derived.by(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        return data.users.filter((u: ADUser) => {
            const lastLogonDate = fileTimeToDate(u.lastLogon);
            return lastLogonDate && lastLogonDate > oneWeekAgo;
        }).length;
    });
</script>
<div class="flex justify-between items-center pb-10 w-full">
    <span>
        <h1 class="text-4xl font-bold">All Users</h1>
        <p class="text-base-content">View all Active Directory users</p>
    </span>
    <!-- <StatBoard totalUsers={users.length} activeUsers={activeUsersWithLogonsWithinTheLastWeek} lockedAccounts={lockedAccounts} /> -->
</div>



<div class="space-y-5 overflow-visible">

    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

        <div class="flex flex-col sm:flex-row flex-wrap gap-3 flex-1">

            <input
                bind:value={search}
                class="input input-bordered w-full sm:w-72"
                placeholder="Search users..."
            />

            <select bind:value={statusFilter} class="select select-bordered w-full sm:w-40">
                <option value="all">All Statuses</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
            </select>

            <select bind:value={lockedFilter} class="select select-bordered w-full sm:w-40">
                <option value="all">All Accounts</option>
                <option value="locked">Locked Only</option>
                <option value="unlocked">Not Locked</option>
            </select>

            <select bind:value={departmentFilter} class="select select-bordered w-full sm:w-52">
                <option value="all">All Departments</option>
                {#each departmentOptions as dept}
                    <option value={dept}>{dept}</option>
                {/each}
            </select>

            {#if hasActiveFilters}
                <button type="button" class="btn btn-ghost" onclick={clearFilters}>
                    Clear filters
                </button>
            {/if}

        </div>

        <!-- <a href="/add-user" class="btn btn-primary">
            Add User
        </a> -->
        <button
            class="btn btn-primary"
            onclick={refreshUsers}
            disabled={loading}
        >
            {#if loading}
                <span class="loading loading-spinner loading-sm"></span>
                Refreshing...
            {:else}
                ↻ Refresh
            {/if}
        </button>

    </div>

    <p class="text-sm text-base-content/60">
        Showing {users.length} of {data.users.length} users
    </p>

    <div class="">

        <table class="table table-zebra">

            <thead>

                <tr>

                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Locked</th>
                    <th class="w-56">Actions</th>

                </tr>

            </thead>

            <tbody>

                {#each users as user}

                    <tr>

                        <td>{user.displayName}</td>

                        <td>{user.sAMAccountName}</td>

                        <td>{user.mail}</td>

                        <td>{user.department}</td>

                        <td>

                            {#if user.enabled}

                                <span class="badge badge-success">
                                    Enabled
                                </span>

                            {:else}

                                <span class="badge badge-error">
                                    Disabled
                                </span>

                            {/if}

                        </td>

                        <td>

                            {#if user.locked}

                                <span class="badge badge-warning">
                                    Locked
                                </span>

                            {:else}

                                <span class="badge badge-neutral">
                                    No
                                </span>

                            {/if}

                        </td>

                        <td>

                            <div class="dropdown dropdown-end">

                                <div tabindex="0" role="button" class="btn btn-sm">
                                    Actions
                                </div>

                                <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box shadow w-56">

                                    <li>
                                        <a href={`/users/${user.sAMAccountName}`}>
                                            View
                                        </a>
                                    </li>

                                    {#if user.enabled}

                                        <li>
                                            <button onclick={() => action(user,"disable")}>
                                                Disable
                                            </button>
                                        </li>

                                    {:else}

                                        <li>
                                            <button onclick={() => action(user,"enable")}>
                                                Enable
                                            </button>
                                        </li>

                                    {/if}

                                    {#if user.locked}

                                        <li>
                                            <button onclick={() => action(user,"unlock")}>
                                                Unlock
                                            </button>
                                        </li>

                                    {/if}

                                    <li>
                                        <button onclick={() => openResetModal(user)}>
                                            Reset Password
                                        </button>
                                    </li>

                                </ul>

                            </div>

                        </td>

                    </tr>

                {/each}

            </tbody>

        </table>

    </div>

</div>

<!-- RESET PASSWORD MODAL -->
{#if showResetModal && resetTargetUser}
  <div class="modal modal-open">
    <div class="modal-box max-w-md">

      <h3 class="font-bold text-lg">Reset Password</h3>

      {#if !resetDone}
        <p class="py-2 text-sm text-base-content/70">
          Set a new password for <span class="font-semibold">{resetTargetUser.displayName}</span>.
        </p>

        <div class="form-control">
          <label class="label"><span class="label-text">New Password</span></label>
          <div class="join w-full">
            <input
              class="input input-bordered join-item w-full font-mono"
              bind:value={resetPassword}
            >
            <button
              type="button"
              class="btn join-item"
              onclick={() => (resetPassword = generatePassword())}
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
          </div>
          {#if resetPassword.length > 0 && resetPassword.length < 8}
            <div class="label">
              <span class="label-text-alt text-error">Must be at least 8 characters</span>
            </div>
          {/if}
        </div>

        <label class="label cursor-pointer justify-start gap-2 mt-3">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={forceChangeAtLogon}>
          <span class="label-text">User must change password at next logon</span>
        </label>

        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={unlockOnReset}>
          <span class="label-text">Unlock account</span>
        </label>

        {#if resetError}
          <div class="alert alert-error mt-3 text-sm">{resetError}</div>
        {/if}

        <div class="modal-action">
          <button
            class="btn"
            type="button"
            onclick={() => (showResetModal = false)}
            disabled={resetting}
          >
            Cancel
          </button>
          <button
            class="btn btn-primary"
            type="button"
            onclick={submitReset}
            disabled={resetting || resetPassword.length < 8}
          >
            {#if resetting}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Reset Password
          </button>
        </div>
      {:else}
        <div class="py-4 space-y-3">
          <div class="alert alert-success text-sm">
            Password reset successfully. Share it securely — it won't be shown again.
          </div>
          <div class="join w-full">
            <input class="input input-bordered join-item w-full font-mono" value={resetPassword} readonly>
            <button type="button" class="btn join-item" onclick={copyPassword}>
              {#if copied}
                <Check size={14} />
                Copied
              {:else}
                <Copy size={14} />
                Copy
              {/if}
            </button>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" type="button" onclick={closeResetModal}>
            Done
          </button>
        </div>
      {/if}

    </div>

    <div
      class="modal-backdrop"
      onclick={() => !resetting && !resetDone && (showResetModal = false)}
    ></div>
  </div>
{/if}