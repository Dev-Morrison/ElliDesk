<script lang="ts">
    import { Wrench, LogOut, Wand2, FileBarChart, ArrowRight } from 'lucide-svelte';

    interface MaintenanceTool {
        title: string;
        description: string;
        href: string;
        icon: typeof Wrench;
        accent: 'primary' | 'secondary' | 'accent' | 'info' | 'warning' | 'error';
    }

    const TOOLS: MaintenanceTool[] = [
        {
            title: 'Offboard Users',
            description: 'Remove group membership, disable the account, and relocate it to FE_RETENTION — with a full preview first.',
            href: '/maintenance/offboarding',
            icon: LogOut,
            accent: 'error'
        },
        {
            title: 'Bulk Update',
            description: 'Apply an attribute change across many users at once, with a full preview before anything is written.',
            href: '/maintenance/bulk-update',
            icon: Wand2,
            accent: 'accent'
        },
        {
            title: 'Reports',
            description: 'Inactive devices, stale accounts, and password policy exceptions — directory hygiene at a glance.',
            href: '/maintenance/reports',
            icon: FileBarChart,
            accent: 'info'
        }
    ];

    function accentClasses(accent: MaintenanceTool['accent']) {
        return {
            primary: 'bg-primary/10 text-primary',
            secondary: 'bg-secondary/10 text-secondary',
            accent: 'bg-accent/10 text-accent',
            info: 'bg-info/10 text-info',
            warning: 'bg-warning/10 text-warning',
            error: 'bg-error/10 text-error'
        }[accent];
    }
</script>

<div class="space-y-6 max-w-6xl mx-auto">

    <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
            <Wrench size={28} />
            Maintenance
        </h1>
        <p class="text-base-content/70 mt-1">
            Tools to clean up, organize, and monitor the directory.
        </p>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each TOOLS as tool}
            <a href={tool.href} class="card bg-base-100 shadow hover:shadow-md transition-shadow">
                <div class="card-body gap-2">
                    <div class={`w-fit p-2.5 rounded-lg ${accentClasses(tool.accent)}`}>
                        <tool.icon size={20} />
                    </div>
                    <h3 class="font-semibold">{tool.title}</h3>
                    <p class="text-sm text-base-content/60">{tool.description}</p>
                    <div class="flex items-center gap-1 text-sm font-medium text-primary pt-1">
                        Open
                        <ArrowRight size={14} />
                    </div>
                </div>
            </a>
        {/each}
    </div>

</div>
