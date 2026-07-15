<script lang="ts">
  import { fileTimeToDate } from "$lib";
  import Navbar from "$lib/components/Navbar.svelte";

  let { data } = $props();

  let user = data.selectedUser;

  let activeTab = $state("general");

  async function action(name: string) {
    await fetch(`/api/users/${user.sAMAccountName}/${name}`, {
      method: "POST",
    });

    location.reload();
  }
</script>

<Navbar username={data.user.username} />

<section class="p-10">
  <!-- <span>
    <h1 class="text-4xl font-bold">User Details</h1>
    <p class="text-base-content">View and manage Active Directory user details</p>
  </span> -->
<div class="space-y-5">
  <div class="flex justify-between">
    <div>
      <h1 class="text-2xl font-bold">
        {user.displayName}
      </h1>

      <p class="text-gray-500">
        {user.sAMAccountName}
      </p>
    </div>

    <div class="flex gap-2">
      {#if user.userAccountControl & 2}
        <button class="btn btn-success" onclick={() => action("enable")}>
          Enable
        </button>
      {:else}
        <button class="btn btn-error" onclick={() => action("disable")}>
          Disable
        </button>
      {/if}

      <button class="btn btn-warning" onclick={() => action("unlock")}>
        Unlock
      </button>

      <button class="btn btn-primary" disabled> Reset Password  </button>
    </div>
  </div>

  <div role="tablist" class="tabs tabs-lift">
    <button
      class:tab-active={activeTab === "general"}
      class="tab"
      role="tab"
      onclick={() => (activeTab = "general")}
    >
      General
    </button>

    <button
      class:tab-active={activeTab === "account"}
      class="tab"
      role="tab"
      onclick={() => (activeTab = "account")}
    >
      Account
    </button>

    <button
      class:tab-active={activeTab === "organization"}
      class="tab"
      role="tab"
      onclick={() => (activeTab = "organization")}
    >
      Organization
    </button>

    <button
      class:tab-active={activeTab === "attributes"}
      class="tab"
      role="tab"
      onclick={() => (activeTab = "attributes")}
    >
      Attribute Editor
    </button>
  </div>

  {#if activeTab === "general"}
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label"> Display Name </label>

        <input class="input input-bordered w-full" value={user.displayName} />
      </div>

      <div>
        <label class="label"> Email </label>

        <input class="input input-bordered w-full" value={user.userPrincipalName ?? ""} />
      </div>

      <!-- <div>
        <label class="label"> Telephone </label>

        <input
          class="input input-bordered w-full"
          value={user.telephoneNumber ?? ""}
        />
      </div> -->
    </div>
  {/if}

  {#if activeTab === "organization"}
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label"> Department </label>

        <input class="input input-bordered w-full" value={user.department ?? ""} />
      </div>

      <div>
        <label class="label"> Title </label>

        <input class="input input-bordered w-full" value={user.title ?? ""} />
      </div>
    </div>
  {/if}

  {#if activeTab === "account"}
    <div class="space-y-3">
      <div>
        <b>Username:</b>
        {user.sAMAccountName}
      </div>

      <div>
        <b>User Principal Name:</b>
        {user.userPrincipalName}
      </div>

      <div>
        <b>Password Last Set:</b>
        {fileTimeToDate(user.pwdLastSet)?.toLocaleString() ?? "Never"}
      </div>

      <div>
        <b>Last Logon:</b>
        {fileTimeToDate(user.lastLogonTimestamp)?.toLocaleString() ?? "Never"}
      </div>
    </div>
  {/if}

  {#if activeTab === "attributes"}
    <div class="overflow-auto max-h-[600px]">
      <table class="table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Value</th>
          </tr>
        </thead>

        <tbody>
          {#each Object.entries(user) as [key, value]}
            <tr>
              <td>
                {key}
              </td>

              <td class="max-w-xl break-all">
                {Array.isArray(value) ? value.join(", ") : value}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
</section>