<script lang="ts">
  let { totalUsers, activeUsers, lockedAccounts } = $props();
  
</script>

<div class="stats shadow">
  <div class="stat">
    <div class="stat-figure text-primary">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users-icon lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>
    </div>
    <div class="stat-title">Total Users</div>
    <div class="stat-value text-primary">{totalUsers}</div>
    <div class="stat-desc">Includes service accounts</div>
  </div>

  <div class="stat">
    <div class="stat-figure text-secondary">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-lock-icon lucide-user-lock"><path d="M19 16v-2a2 2 0 0 0-4 0v2"/><path d="M9.5 15H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><rect x="13" y="16" width="8" height="5" rx=".899"/></svg>
    </div>
    <div class="stat-title">Locked Users</div>
    <div class="stat-value text-secondary">{lockedAccounts}</div>
    <div class="stat-desc">{totalUsers ? ((lockedAccounts / totalUsers) * 100).toFixed(2) : '0.00'}% of all users</div>
  </div>

  <div class="stat">
    <div class="stat-figure text-secondary">
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity-icon lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
    </div>
    <div class="stat-title">Active Users</div>
    <div class="stat-value text-secondary">{activeUsers}</div>
    <div class="stat-desc">Users who have logged on within the last week</div>
  </div>
</div>