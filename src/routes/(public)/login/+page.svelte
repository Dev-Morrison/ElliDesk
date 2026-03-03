<script lang="ts">
    import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    let formProcessing = $state(false);
    let errorText = $state('');

</script>

<svelte:head>
	<title>Login</title>
</svelte:head>
<section
	class="bg-gray-300 h-fit min-h-screen flex items-center justify-center w-full"
>
	<div
		class="w-full min-w-fit max-w-xl h-fit flex items-center flex-col space-y-5 my-32 mx-5 pt-10 pb-5 rounded-xl"
	>
		<h1 class="text-center text-3xl font-bold text-gray-800 mb-5">Log in to ElliDesk</h1>

		<p class="text-center font-semibold text-gray-800">
			Enter Your LDAP Account Credentials
		</p>
		<form
			class="flex flex-col space-y-7 px-5 mt-10 w-full"
			method="post" action="/login"
            use:enhance={({})=>{
                errorText = '';
                formProcessing = true;
                return ({result})=>{
                    formProcessing = false;
                    if(result.type === 'failure') {
                        if(result.status === 401 && result.data?.error) {
                            errorText = result.data.error as string;
                        } else {
                            errorText = "An unexpected error occurred. Please try again.";
                        }
                    }else if(result.type === 'success') {
                        goto('/dashboard')
                    }
                }
            }}
        >
			<input type="text" name="username" placeholder="Username" class="rounded-md input input-neutral w-full" />
            <input type="password" name="password" placeholder="Password" class="rounded-md input input-neutral w-full" />

			<div class="flex justify-between items-center">
				<p class="text-red-600 text-sm ml-0.5">{errorText}</p>
                <button class="btn btn-soft btn-primary rounded-md">
                {#if formProcessing }
                    <span class="loading loading-spinner"></span>
                {/if}
                    Log In
                </button>
			</div>
		</form>
	</div>
</section>