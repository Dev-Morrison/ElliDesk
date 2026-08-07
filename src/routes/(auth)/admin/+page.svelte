<script lang="ts">
    import { ShieldCheck, Users, KeyRound, ArrowRight } from 'lucide-svelte';
</script>

<div class="space-y-6 max-w-4xl mx-auto">

    <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck size={28} />
            Administration
        </h1>
        <p class="text-base-content/70 mt-1">
            Manage who can use this console, and what they're allowed to do.
        </p>
    </div>

    <div class="grid sm:grid-cols-2 gap-4">
        <a href="/admin/roles" class="card bg-base-100 shadow hover:shadow-md transition-shadow">
            <div class="card-body gap-2">
                <div class="w-fit p-2.5 rounded-lg bg-primary/10 text-primary">
                    <KeyRound size={20} />
                </div>
                <h3 class="font-semibold">Roles</h3>
                <p class="text-sm text-base-content/60">
                    Named sets of capabilities — what a role can view or manage across the console.
                </p>
                <div class="flex items-center gap-1 text-sm font-medium text-primary pt-1">
                    Open
                    <ArrowRight size={14} />
                </div>
            </div>
        </a>

        <a href="/admin/assignments" class="card bg-base-100 shadow hover:shadow-md transition-shadow">
            <div class="card-body gap-2">
                <div class="w-fit p-2.5 rounded-lg bg-secondary/10 text-secondary">
                    <Users size={20} />
                </div>
                <h3 class="font-semibold">Role Assignments</h3>
                <p class="text-sm text-base-content/60">
                    Grant a role to an AD group or user, scoped to all domains or a specific subset.
                </p>
                <div class="flex items-center gap-1 text-sm font-medium text-primary pt-1">
                    Open
                    <ArrowRight size={14} />
                </div>
            </div>
        </a>
    </div>

</div>
