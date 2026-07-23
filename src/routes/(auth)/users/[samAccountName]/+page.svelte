<script lang="ts">
  import { fileTimeToDate } from "$lib";
  import Navbar from "$lib/components/Navbar.svelte";
  import { KeyRound, Copy, Check, RefreshCw, ArrowLeft } from "lucide-svelte";

  let { data } = $props();

  let user = data.selectedUser;

  let activeTab = $state("general");

  async function action(name: string) {
    await fetch(`/api/users/${user.sAMAccountName}/${name}`, {
      method: "POST",
    });

    location.reload();
  }

  // --- Reset Password ----------------------------------------------------
  let showResetModal = $state(false);
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

  function openResetModal() {
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
      await navigator.clipboard.writeText(resetPassword);
      copied = true;
    } catch {
      copied = false;
    }
  }

  async function submitReset() {
    resetting = true;
    resetError = "";

    try {
      const res = await fetch(`/api/users/${user.sAMAccountName}/reset-password`, {
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
</script>

<div class="space-y-5">
  <a href="/all-users" class="btn btn-ghost btn-sm gap-1 -ml-3">
    <ArrowLeft size={16} />
    Back to Users
  </a>

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
        <button class="btn btn-success" type="button" onclick={() => action("enable")}>
          Enable
        </button>
      {:else}
        <button class="btn btn-error" type="button" onclick={() => action("disable")}>
          Disable
        </button>
      {/if}

      <button class="btn btn-warning" type="button" onclick={() => action("unlock")}>
        Unlock
      </button>

      <button class="btn btn-primary" type="button" onclick={openResetModal}>
        <KeyRound size={16} />
        Reset Password
      </button>
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

<!-- RESET PASSWORD MODAL -->
{#if showResetModal}
  <div class="modal modal-open">
    <div class="modal-box max-w-md">

      <h3 class="font-bold text-lg">Reset Password</h3>

      {#if !resetDone}
        <p class="py-2 text-sm text-base-content/70">
          Set a new password for <span class="font-semibold">{user.displayName}</span>.
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