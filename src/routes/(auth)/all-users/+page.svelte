<script lang="ts">
    import type { ADUser } from '$lib/types';
    import { fileTimeToDate } from '$lib/index';
    import Navbar from '$lib/components/Navbar.svelte';
    import { invalidateAll } from '$app/navigation';
  import StatBoard from '$lib/components/StatBoard.svelte';
    let { data } = $props();

    let search = $state("");

    let loading = $state(false);

    let users = $derived.by(() => {

        return data.users.filter((u: ADUser) => {

            const s = search.toLowerCase();

            return (
                u.cn?.toLocaleLowerCase().includes(s) ||
                u.sAMAccountName?.toLocaleLowerCase().includes(s)
            );

        });

    });

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
    <StatBoard totalUsers={users.length} activeUsers={activeUsersWithLogonsWithinTheLastWeek} lockedAccounts={lockedAccounts} />
</div>



<div class="space-y-5 overflow-visible">

    <div class="flex justify-between">

        <input
            bind:value={search}
            class="input input-bordered w-96"
            placeholder="Search users..."
        />

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
                                        <button onclick={() => action(user,"reset-password")}>
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