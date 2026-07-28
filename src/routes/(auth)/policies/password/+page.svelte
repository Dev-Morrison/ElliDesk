<script lang="ts">
    import { ShieldCheck, AlertTriangle, KeyRound, History, Clock, Lock, CheckCircle2, XCircle } from 'lucide-svelte';

    let { data } = $props();

    function formatDays(days: number | null, whenNull = 'Never expires') {
        if (days === null) return whenNull;
        const rounded = Math.round(days * 10) / 10;
        return `${rounded} day${rounded === 1 ? '' : 's'}`;
    }

    function formatMinutes(minutes: number | null, whenNull = 'Not set') {
        if (minutes === null) return whenNull;
        if (minutes >= 60) {
            const hours = Math.round((minutes / 60) * 10) / 10;
            return `${hours} hour${hours === 1 ? '' : 's'}`;
        }
        const rounded = Math.round(minutes);
        return `${rounded} minute${rounded === 1 ? '' : 's'}`;
    }
</script>

<div class="space-y-6 max-w-5xl mx-auto">

    <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck size={28} />
            Password Policy
        </h1>
        <p class="text-base-content/70 mt-1">
            Read-only. Domain and fine-grained password policy settings, as configured in Active Directory.
        </p>
    </div>

    {#if data.error && !data.defaultPolicy}
        <div class="alert alert-error">
            <AlertTriangle size={18} />
            {data.error}
        </div>
    {:else if data.defaultPolicy}
        {#if data.error}
            <div class="alert alert-warning text-sm">
                <AlertTriangle size={16} />
                {data.error}
            </div>
        {/if}

        <!-- DEFAULT DOMAIN POLICY -->
        <section class="card bg-base-100 shadow">
            <div class="card-body">
                <h2 class="font-semibold text-lg">Default Domain Policy</h2>
                <p class="text-sm text-base-content/60 mb-2">
                    Applies to every account unless a fine-grained policy below takes precedence over it.
                </p>

                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-primary/10 text-primary">
                            <KeyRound size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">{data.defaultPolicy.minLength ?? '—'} characters</div>
                            <div class="text-xs text-base-content/60">Minimum Length</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-info/10 text-info">
                            <History size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">{data.defaultPolicy.historyLength ?? '—'} passwords</div>
                            <div class="text-xs text-base-content/60">Password History</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-secondary/10 text-secondary">
                            <Clock size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">{formatDays(data.defaultPolicy.maxAgeDays)}</div>
                            <div class="text-xs text-base-content/60">Maximum Age</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-secondary/10 text-secondary">
                            <Clock size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">{formatDays(data.defaultPolicy.minAgeDays, 'No minimum')}</div>
                            <div class="text-xs text-base-content/60">Minimum Age</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class={`p-2 rounded-lg ${data.defaultPolicy.complexityEnabled ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                            {#if data.defaultPolicy.complexityEnabled}
                                <CheckCircle2 size={18} />
                            {:else}
                                <XCircle size={18} />
                            {/if}
                        </div>
                        <div>
                            <div class="text-lg font-bold">{data.defaultPolicy.complexityEnabled ? 'Enabled' : 'Disabled'}</div>
                            <div class="text-xs text-base-content/60">Complexity Requirements</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class={`p-2 rounded-lg ${data.defaultPolicy.reversibleEncryption ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                            {#if data.defaultPolicy.reversibleEncryption}
                                <AlertTriangle size={18} />
                            {:else}
                                <CheckCircle2 size={18} />
                            {/if}
                        </div>
                        <div>
                            <div class="text-lg font-bold">{data.defaultPolicy.reversibleEncryption ? 'Enabled' : 'Disabled'}</div>
                            <div class="text-xs text-base-content/60">Reversible Encryption</div>
                        </div>
                    </div>

                </div>

                <div class="divider text-sm text-base-content/50">Account Lockout</div>

                <div class="grid sm:grid-cols-3 gap-4">
                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-warning/10 text-warning">
                            <Lock size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">
                                {data.defaultPolicy.lockoutThreshold === 0 || data.defaultPolicy.lockoutThreshold === null
                                    ? 'Disabled'
                                    : `${data.defaultPolicy.lockoutThreshold} attempts`}
                            </div>
                            <div class="text-xs text-base-content/60">Lockout Threshold</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-warning/10 text-warning">
                            <Lock size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">{formatMinutes(data.defaultPolicy.lockoutDurationMinutes)}</div>
                            <div class="text-xs text-base-content/60">Lockout Duration</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-3 border border-base-200 rounded-lg">
                        <div class="p-2 rounded-lg bg-warning/10 text-warning">
                            <Lock size={18} />
                        </div>
                        <div>
                            <div class="text-lg font-bold">{formatMinutes(data.defaultPolicy.lockoutObservationMinutes)}</div>
                            <div class="text-xs text-base-content/60">Reset Counter After</div>
                        </div>
                    </div>
                </div>

            </div>
        </section>

        <!-- FINE-GRAINED PASSWORD POLICIES -->
        <section class="space-y-3">
            <h2 class="font-semibold text-lg">Fine-Grained Password Policies</h2>

            {#if data.fineGrainedPolicies.length === 0}
                <div class="alert text-sm">
                    <span>No fine-grained password policies (PSOs) are configured on this domain — every account follows the default policy above.</span>
                </div>
            {:else}
                <div class="grid md:grid-cols-2 gap-4">
                    {#each data.fineGrainedPolicies as pso}
                        <div class="card bg-base-100 shadow">
                            <div class="card-body">
                                <div class="flex items-center justify-between">
                                    <h3 class="font-semibold">{pso.name}</h3>
                                    {#if pso.precedence !== null}
                                        <span class="badge badge-outline badge-sm">Precedence {pso.precedence}</span>
                                    {/if}
                                </div>

                                <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                                    <dt class="text-base-content/50">Min Length</dt>
                                    <dd>{pso.minLength ?? '—'} characters</dd>

                                    <dt class="text-base-content/50">History</dt>
                                    <dd>{pso.historyLength ?? '—'} passwords</dd>

                                    <dt class="text-base-content/50">Max Age</dt>
                                    <dd>{formatDays(pso.maxAgeDays)}</dd>

                                    <dt class="text-base-content/50">Min Age</dt>
                                    <dd>{formatDays(pso.minAgeDays, 'No minimum')}</dd>

                                    <dt class="text-base-content/50">Complexity</dt>
                                    <dd>{pso.complexityEnabled ? 'Enabled' : 'Disabled'}</dd>

                                    <dt class="text-base-content/50">Reversible Encryption</dt>
                                    <dd class={pso.reversibleEncryption ? 'text-error' : ''}>
                                        {pso.reversibleEncryption ? 'Enabled' : 'Disabled'}
                                    </dd>

                                    <dt class="text-base-content/50">Lockout Threshold</dt>
                                    <dd>{pso.lockoutThreshold === 0 || pso.lockoutThreshold === null ? 'Disabled' : `${pso.lockoutThreshold} attempts`}</dd>

                                    <dt class="text-base-content/50">Lockout Duration</dt>
                                    <dd>{formatMinutes(pso.lockoutDurationMinutes)}</dd>
                                </dl>

                                {#if pso.appliesTo.length > 0}
                                    <div class="mt-2">
                                        <div class="text-xs text-base-content/50 mb-1">Applies to</div>
                                        <div class="flex flex-wrap gap-1">
                                            {#each pso.appliesTo as target}
                                                <span class="badge badge-ghost badge-sm">{target}</span>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>
    {/if}

</div>
