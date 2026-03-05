<script lang="ts">
  export let username: string;
  
</script>

<div class="navbar bg-base-100 shadow-sm">
  <div class="flex-1">
    <a class="btn btn-ghost text-xl" href="/dashboard">ElliDesk AD Manager</a>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1">
      <li>
        <details>
          <summary class="font-bold">BOS\{username}</summary>
          <ul class="bg-base-300 rounded-t-none p-2 w-full">
            <li><a>Settings</a></li>
            <li><a href="/logout">Logout</a></li>
          </ul>
        </details>
      </li>
    </ul>
  </div>
</div>