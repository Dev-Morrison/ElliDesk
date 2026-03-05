<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
    import type { PageProps } from './$types';
    let { data, form }: PageProps = $props();
	let givenName = $state('');
	let surname = $state('');
	let username = $state('');
    let domain = $state('');
    let department = $state('');
    // Derived email store based on username
    let email = $derived(username == "" ? "" : username + '@' + domain);

    let usernameStatus = $state<string | null>(null);
    let checking = $state(false);
    let generating = $state(false);
    let creating = $state(false);

    function enhanceForm() {
    return async ({ result }: { result: any }) => {
        if (result.type === 'success') {
            creating = false;
        }

        if (result.type === 'failure') {
            creating = false;
        }
    };
}

    

  async function checkUsername() {
    if (!username){
        usernameStatus = "⚠️ Please enter a username to check";
        return
    };
    checking = true;
    usernameStatus = null;

    try {
      const res = await fetch('/api/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();

      if (data.available) {
        usernameStatus = "✅ Username is available";
      } else {
        usernameStatus = "❌ Username is already taken";
      }
    } catch (err) {
      console.error(err);
      usernameStatus = "⚠️ Error checking username";
    } finally {
      checking = false;
    }
  }
</script>

<svelte:head>
    <title>Add User</title>
</svelte:head>
<Navbar username={data.user.username} />
<div class="p-12 flex flex-col items-center">
    <h1 class="text-2xl font-bold my-10">Add New User</h1>
    <p class="text-center max-w-2xl">
        Create a new user by entering the relevant details below. You can generate a username based on the given name and surname, and check its availability before submitting the form.
    </p>
    <p class="text-xs mt-5 mb-10 max-w-xl">Note: Username can be first initial followed by the last name (e.g., John Doe would become jdoe) or first initial + middle initial followed by the last name (e.g., John Mark Doe would become jmdoe). If that is also taken, use firstname.lastname (e.g., john.doe)</p>
    <form method="POST" class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl" action="/add-user" onsubmit={()=>{creating = true}}>

                <!-- Domain -->
				<div class="form-control col-span-2">
                <label class="label">
                    <span class="label-text font-semibold">Domain</span>
                </label>
                <select
                    name="domain"
                    bind:value={domain}
                    class="select select-bordered w-full"
                    required
                >
                    <option value="" disabled selected>Select Domain</option>
                    <option>bsj.org.jm</option>
                    <option>ncra.org.jm</option>
                    <option>ncbj.org.jm</option>
                    <option>hsra.org.jm</option>
                </select>
                </div>

				<!-- Given Name -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">Given Name</span>
					</label>
					<input
						type="text"
						name="givenName"
						bind:value={givenName}
						required
						class="input input-bordered w-full"
						placeholder="John"
					/>
				</div>

				<!-- Surname -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">Surname</span>
					</label>
					<input
						type="text"
						name="surname"
						bind:value={surname}
						required
						class="input input-bordered w-full"
						placeholder="Doe"
					/>
				</div>

				<!-- Username Section (Full Width on Desktop) -->
				  <div class="form-control">
                    <label class="label"><span class="label-text">Username</span></label>
                    <input
                    type="text"
                    class="input input-bordered w-full"
                    bind:value={username}
                    name="username"
                    placeholder="jdoe/jmdoe/john.doe'"
                    required
                    />
                </div>
                <div class="form-control flex pt-6 justify-between">
                    <button
                    type="button"
                    class="btn btn-secondary w-1/2 mr-2"
                    onclick={()=>{
                        if(givenName && surname) {
                            username = (givenName[0] + surname).toLowerCase(); 
                        }
                    }}
                    disabled={!givenName || !surname || generating}
                    >
                    {generating ? "Generating..." : "Generate"}
                    </button>
                    <button
                    type="button"
                    class="btn btn-primary w-1/2"
                    onclick={checkUsername}
                    disabled={checking}
                    >
                    {checking ? "Checking..." : "Check"}
                    </button>
                </div>

                {#if usernameStatus}
                    <div class="col-span-2 text-sm font-medium mt-1">{usernameStatus}</div>
                {/if}


				<!-- Primary Email -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">
							Primary Email (UPN)
						</span>
					</label>
					<input
						type="email"
                        value={email}
						name="userPrincipalName"
						required
						class="input input-bordered w-full"
						placeholder="jdoe@bsj.org.jm"
					/>
				</div>

				

				<!-- Department -->
                 {#if domain === 'hsra.org.jm'}
                    <div class="form-control">
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-semibold">Department</span>
                            </label>
                    <select
                        name="department"
                        bind:value={department}
                        class="select select-bordered w-full"
                        required
                        >
                        <option value="" disabled selected>Select Department</option>
                        <option>HSRA_Staff</option>
                    </select>
                    </div>
                </div>
                 {:else if domain === 'ncbj.org.jm'}
                    <div class="form-control">
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-semibold">Department</span>
                            </label>
                    <select
                        name="department"
                        bind:value={department}
                        class="select select-bordered w-full"
                        required
                        >
                        <option value="" disabled selected>Select Department</option>
                        <option>NCBJ_Staff</option>
                    </select>
                </div>
                </div>
                 {:else if domain === 'ncra.org.jm'}
                    <div class="form-control">
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-semibold">Department</span>
                            </label>
                    <select
                        name="department"
                        bind:value={department}
                        class="select select-bordered w-full"
                        required
                        >
                        <option value="" disabled selected>Select Department</option>
                        <option>MAIN_OFFICE</option>
                        <option>REGIONAL_OFFICE</option>
                    </select>
                </div>
                </div>
                 {:else}

                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-semibold">Department</span>
                        </label>
                    <select
                    name="department"
                    bind:value={department}
                    class="select select-bordered w-full"
                    required
                    >
                        <option value="" disabled selected>Select Department</option>
                        <option>ICT</option>
                        <option>Finance</option>
                        <option>HR</option>
                        <option>QEMS</option>
                        <option>OFMB</option>
                        <option>OFMB_FACILITIES_ADMINISTRATION</option>
                        <option>OFMB_PROPERTY_AND_PROJECTS</option>
                        <option>CCSB</option>
                        <option>CUSTOMER_SERVICE</option>
                        <option>STANDARDS</option>
                        <option>TRAINING</option>
                        <option>LEGAL_OFFICE</option>
                        <option>INTERNAL_AUDIT</option>
                        <option>EXECUTIVE_OFFICE</option>
                        <option>EXECUTIVE_DIRECTOR</option>
                        <option>BDO</option>
                        <option>CORPORATE_OFFICE</option>
                        <option>SPECIAL_PROJECTS</option>
                        <option>CHEMISTRY</option>
                        <option>MICROBIOLOGY</option>
                        <option>PACKAGING</option>
                        <option>MECHANICAL</option>
                        <option>ELECTRICAL</option>
                        <option>METALLURGY</option>
                        <option>CIVIL</option>
                    </select>
                    </div>	
                
                {/if}
				<!-- Spacer (Balances Grid on Desktop) -->
				<div class="hidden md:block"></div>

                {#if form?.success}
                <!-- {()=>{creating = false;}} -->
                <div class="alert alert-success shadow-lg col-span-full">
                <span>{form.message}</span>
                </div>
                {/if}

                {#if form?.success === false}
                <div class="alert alert-error shadow-lg col-span-full">
                <span>{form.message}</span>
                </div>
                {/if}

				<!-- Submit Button (Full Width) -->
				<div class="form-control md:col-span-2 pt-4">
					<button type="submit" class="btn btn-primary w-full" disabled={creating}>
						{creating ? "Creating..." : "Create User"}
					</button>
				</div>
			</form>
            
</div>