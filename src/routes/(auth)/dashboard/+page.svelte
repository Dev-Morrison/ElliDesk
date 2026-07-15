<script lang="ts">
  import type { PageProps } from "./$types";
  import Navbar from "$lib/components/Navbar.svelte";
  import { goto } from "$app/navigation";
  let { data }: PageProps = $props();
</script>

<div>
  <Navbar username={data.user.username} />
  <section class="p-10 pb-0">
    <p class="text-base-content">Dashboard</p>
    <h1 class="text-2xl font-bold">Welcome, {data.user.name}!</h1>
  </section>
  <div class="flex p-10 space-x-5">
    <div class="card w-96 bg-base-100 card-sm">
      <div class="card-body bg-base-300 rounded">
        <h2 class="card-title">Create New Active Directory User</h2>
        <p>
          This is where you can create a new Active Directory user. Click the
          button below to get started.
        </p>
        <div class="justify-end card-actions">
          <button
            class="btn btn-primary"
            onclick={() => {
              goto("/add-user");
            }}>Add New User</button
          >
        </div>
      </div>
    </div>
    <div class="card w-96 bg-base-100 card-sm">
      <div class="card-body bg-base-300 rounded">
        <h2 class="card-title">View All Active Directory User</h2>
        <p>
          View a complete list of all Active Directory users. Click the button
          below to view all users.
        </p>
        <div class="justify-end card-actions">
          <button
            class="btn btn-primary"
            onclick={() => {
              goto("/all-users");
            }}>View All Users</button
          >
        </div>
      </div>
    </div>
  </div>
</div>
