<script lang="ts">
    import type { PageProps } from './$types';
    import Navbar from '$lib/components/Navbar.svelte';
  import { goto } from '$app/navigation';
    let { data }: PageProps = $props();
</script>

<div>
    <Navbar username={data.user.username} />
    <section class="p-5">
        <p class="text-gray-300">Dashboard</p>
        <h1 class="text-2xl font-bold">Welcome, {data.user.name}!</h1>
        <div class="card w-96 bg-base-100 card-sm shadow-sm">
        <div class="card-body bg-base-300 rounded mt-5">
            <h2 class="card-title">Create New Active Directory User</h2>
            <p>
                This is where you can create a new Active Directory user. Fill out the form below to add a new user to your directory.
            </p>
            <div class="justify-end card-actions">
            <button class="btn btn-primary" on:click={()=>{goto("/add-user")}}>Add New User</button>
            </div>
        </div>
        </div>
    </section>
    
</div>