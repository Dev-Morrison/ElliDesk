<script lang="ts">
    import type { PageProps } from './$types';
    let { data }: PageProps = $props();
	let givenName = $state('');
	let surname = $state('');
	let username = $state('');
    let department = '';
    // Derived email store based on username
    let email = $derived(username == "" ? "" : username + '@bsj.org.jm');

    let usernameStatus = $state<string | null>(null);
    let checking = $state(false);
    let generating = $state(false);
    let formProcessing = $state(false);

  async function checkUsername() {
    if (!username) return;
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

<div class="p-12 flex flex-col items-center">
    <h1 class="text-2xl font-bold my-10">Add New User</h1>
    <p class="mb-10 text-center max-w-2xl">
        Create a new user by entering their first and last name. A username will be automatically generated in the format of the first initial followed by the last name (e.g., John Doe would become jdoe).
    </p>
    <form method="POST" class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">

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
                    />
                </div>
                <div class="form-control flex pt-6 justify-between">
                    <button
                    type="button"
                    class="btn btn-secondary w-1/2 mr-2"
                    on:click={()=>{
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
                    on:click={checkUsername}
                    disabled={checking}
                    >
                    {checking ? "Checking..." : "Check"}
                    </button>
                </div>

                {#if usernameStatus}
                    <div class="col-span-2 text-sm font-medium mt-1">{usernameStatus}</div>
                {/if}

					<label class="label">
						<span class="label-text-alt">
							You may manually edit the generated username. <br> try john.doe if the standard format is already taken.
						</span>
					</label>

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

				<!-- Proxy Email -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">
							Proxy Email
						</span>
					</label>
					<input
						type="email"
						name="proxyEmail"
						required
						class="input input-bordered w-full"
						placeholder="john.doe@yourdomain.local"
					/>
				</div>

				<!-- Department -->
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
                    <option>OFMB-FACILITIES ADMINISTRATION</option>
                    <option>OFMB-PROPERTY & PROJECTS</option>
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

				<!-- Spacer (Balances Grid on Desktop) -->
				<div class="hidden md:block"></div>

				<!-- Submit Button (Full Width) -->
				<div class="form-control md:col-span-2 pt-4">
					<button type="submit" class="btn btn-primary w-full">
						Create User
					</button>
				</div>
			</form>
</div>