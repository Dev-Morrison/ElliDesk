<script lang="ts">
    import type { PageProps } from './$types';
    import Navbar from '$lib/components/Navbar.svelte';
    import {
        UserPlus,
        Users,
        UserCheck,
        UserX,
        Lock,
        Shield,
        Mail,
        Wand2,
        Monitor,
        FolderKanban,
        ShieldCheck,
        FileClock,
        AlertTriangle,
        ArrowRight
    } from 'lucide-svelte';

    let { data }: PageProps = $props();

    // --- Quick Actions ----------------------------------------------------
    // Add a new module here as the app grows — everything below renders
    // from this list, no template changes needed.
    type LinkStatus = 'active' | 'soon';

    interface QuickLink {
        title: string;
        description: string;
        href: string;
        icon: typeof UserPlus;
        accent: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning';
        status: LinkStatus;
    }

    const QUICK_LINKS: QuickLink[] = [
        {
            title: 'Add New User',
            description: 'Create a new Active Directory account with the right group and OU placement.',
            href: '/add-user',
            icon: UserPlus,
            accent: 'primary',
            status: 'active'
        },
        {
            title: 'All Users',
            description: 'Search, view, and manage every account in the directory.',
            href: '/all-users',
            icon: Users,
            accent: 'info',
            status: 'active'
        },
        {
            title: 'Groups',
            description: 'Browse security and distribution groups, and manage membership.',
            href: '/groups',
            icon: Shield,
            accent: 'secondary',
            status: 'active'
        },
        {
            title: 'Bulk Update',
            description: 'Apply an attribute change across many users at once, with a full preview.',
            href: '/maintenance/bulk-update',
            icon: Wand2,
            accent: 'accent',
            status: 'active'
        },
        {
            title: 'Computers',
            description: 'View computer objects and their status across the domain.',
            href: '/computers',
            icon: Monitor,
            accent: 'info',
            status: 'active'
        },
        {
            title: 'Organizational Units',
            description: 'Browse and manage the OU structure of the directory.',
            href: '/ous',
            icon: FolderKanban,
            accent: 'secondary',
            status: 'active'
        },
        {
            title: 'Password Policy',
            description: 'Review domain and fine-grained password policy settings.',
            href: '/policies/password',
            icon: ShieldCheck,
            accent: 'warning',
            status: 'soon'
        },
        {
            title: 'Audit Logs',
            description: 'See a history of changes made through this console.',
            href: '/audit-logs',
            icon: FileClock,
            accent: 'primary',
            status: 'active'
        }
    ];

    function accentClasses(accent: QuickLink['accent']) {
        return {
            primary: 'bg-primary/10 text-primary',
            secondary: 'bg-secondary/10 text-secondary',
            accent: 'bg-accent/10 text-accent',
            info: 'bg-info/10 text-info',
            success: 'bg-success/10 text-success',
            warning: 'bg-warning/10 text-warning'
        }[accent];
    }

    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
</script>


<div class="space-y-8 max-w-6xl mx-auto p-6 lg:p-10">

    <!-- HEADER -->
    <section class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
            <p class="text-sm text-base-content/60">{today}</p>
            <h1 class="text-3xl font-bold">Welcome back, {data.user.name}</h1>
            <p class="text-base-content/70 mt-1">
                Here's what's happening across the directory today.
            </p>
        </div>
    </section>

    <!-- ATTENTION BANNER -->
    {#if data.stats && data.stats.lockedUsers > 0}
        <a href="/all-users" class="alert alert-warning shadow-sm hover:brightness-95 transition">
            <AlertTriangle size={20} />
            <span>
                <span class="font-semibold">{data.stats.lockedUsers}</span>
                account{data.stats.lockedUsers === 1 ? ' is' : 's are'} currently locked out — review in All Users.
            </span>
            <ArrowRight size={16} class="ml-auto" />
        </a>
    {/if}

    <!-- STAT CARDS -->
    {#if data.stats}
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <div class="card bg-base-100 shadow">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class="p-3 rounded-lg bg-primary/10 text-primary">
                        <Users size={22} />
                    </div>
                    <div>
                        <div class="text-2xl font-bold">{data.stats.totalUsers}</div>
                        <div class="text-xs text-base-content/60">Total Users</div>
                    </div>
                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class="p-3 rounded-lg bg-success/10 text-success">
                        <UserCheck size={22} />
                    </div>
                    <div>
                        <div class="text-2xl font-bold">{data.stats.enabledUsers}</div>
                        <div class="text-xs text-base-content/60">Enabled</div>
                    </div>
                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class="p-3 rounded-lg bg-neutral/10 text-neutral">
                        <UserX size={22} />
                    </div>
                    <div>
                        <div class="text-2xl font-bold">{data.stats.disabledUsers}</div>
                        <div class="text-xs text-base-content/60">Disabled</div>
                    </div>
                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class={`p-3 rounded-lg ${data.stats.lockedUsers > 0 ? 'bg-warning/10 text-warning' : 'bg-base-content/10 text-base-content/60'}`}>
                        <Lock size={22} />
                    </div>
                    <div>
                        <div class="text-2xl font-bold">{data.stats.lockedUsers}</div>
                        <div class="text-xs text-base-content/60">Locked</div>
                    </div>
                </div>
            </div>

        </section>

        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <div class="card bg-base-100 shadow lg:col-span-2">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class="p-3 rounded-lg bg-secondary/10 text-secondary">
                        <Shield size={22} />
                    </div>
                    <div>
                        <div class="text-2xl font-bold">{data.stats.totalGroups}</div>
                        <div class="text-xs text-base-content/60">Total Groups</div>
                    </div>
                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class="p-3 rounded-lg bg-success/10 text-success">
                        <Shield size={20} />
                    </div>
                    <div>
                        <div class="text-xl font-bold">{data.stats.securityGroups}</div>
                        <div class="text-xs text-base-content/60">Security</div>
                    </div>
                </div>
            </div>

            <div class="card bg-base-100 shadow">
                <div class="card-body flex-row items-center gap-4 py-4">
                    <div class="p-3 rounded-lg bg-warning/10 text-warning">
                        <Mail size={20} />
                    </div>
                    <div>
                        <div class="text-xl font-bold">{data.stats.distributionGroups}</div>
                        <div class="text-xs text-base-content/60">Distribution</div>
                    </div>
                </div>
            </div>

        </section>
    {:else}
        <div class="alert alert-error">
            <AlertTriangle size={18} />
            <span>Directory stats are temporarily unavailable. The rest of the console is still usable.</span>
        </div>
    {/if}

    <!-- QUICK ACTIONS -->
    <section class="space-y-3">
        <h2 class="text-lg font-semibold">Quick Actions</h2>

        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each QUICK_LINKS as link}
                {#if link.status === 'active'}
                    <a
                        href={link.href}
                        class="card bg-base-100 shadow hover:shadow-md transition-shadow"
                    >
                        <div class="card-body gap-2">
                            <div class={`w-fit p-2.5 rounded-lg ${accentClasses(link.accent)}`}>
                                <link.icon size={20} />
                            </div>
                            <h3 class="font-semibold">{link.title}</h3>
                            <p class="text-sm text-base-content/60">{link.description}</p>
                            <div class="flex items-center gap-1 text-sm font-medium text-primary pt-1">
                                Open
                                <ArrowRight size={14} />
                            </div>
                        </div>
                    </a>
                {:else}
                    <div class="card bg-base-100 shadow opacity-60 cursor-not-allowed">
                        <div class="card-body gap-2">
                            <div class={`w-fit p-2.5 rounded-lg ${accentClasses(link.accent)}`}>
                                <link.icon size={20} />
                            </div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-semibold">{link.title}</h3>
                                <span class="badge badge-ghost badge-sm">Coming Soon</span>
                            </div>
                            <p class="text-sm text-base-content/60">{link.description}</p>
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    </section>

</div>