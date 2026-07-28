<script lang="ts">
  import { page } from '$app/state';
  import { LayoutDashboard, Users, Shield, FolderKanban, Monitor, Wrench, FileClock, Menu, HelpCircle } from 'lucide-svelte';

  let { username }: { username: string } = $props();

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/all-users', label: 'Users', icon: Users },
    { href: '/groups', label: 'Groups', icon: Shield },
    { href: '/ous', label: 'OUs', icon: FolderKanban },
    { href: '/computers', label: 'Computers', icon: Monitor },
    { href: '/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/audit-logs', label: 'Audit Logs', icon: FileClock }
  ];

  function isActive(href: string) {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<div class="navbar bg-base-100 shadow-sm">
  <div class="flex-1 flex items-center gap-1">
    <a class="btn btn-ghost text-xl" href="/dashboard">ElliDesk</a>

    <ul class="menu menu-horizontal px-1 gap-1 hidden lg:flex">
      {#each links as link}
        <li>
          <a href={link.href} class:menu-active={isActive(link.href)}>
            <link.icon size={16} />
            {link.label}
          </a>
        </li>
      {/each}
    </ul>

    <div class="dropdown lg:hidden">
      <div tabindex="0" role="button" class="btn btn-ghost btn-square">
        <Menu size={20} />
      </div>
      <ul class="menu dropdown-content bg-base-100 rounded-box z-10 mt-3 w-56 p-2 shadow">
        {#each links as link}
          <li>
            <a href={link.href} class:menu-active={isActive(link.href)}>
              <link.icon size={16} />
              {link.label}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <div class="flex-none gap-1">
    <a href="/help" class="btn btn-ghost btn-square" class:menu-active={isActive('/help')} aria-label="Help">
      <HelpCircle size={20} />
    </a>

    <ul class="menu menu-horizontal px-1">
      <li>
        <details>
          <summary class="font-bold">BOS\{username}</summary>
          <ul class="bg-base-300 rounded-t-none p-2 w-full">
            <li><a href="/logout">Logout</a></li>
          </ul>
        </details>
      </li>
    </ul>
  </div>
</div>
