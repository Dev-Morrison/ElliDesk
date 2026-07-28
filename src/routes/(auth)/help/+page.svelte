<script lang="ts">
    import {
        BookOpen,
        Rocket,
        LayoutDashboard,
        Users,
        UserPlus,
        Shield,
        FolderKanban,
        Monitor,
        Wrench,
        LogOut,
        Wand2,
        FileBarChart,
        ShieldCheck,
        FileClock,
        AlertTriangle,
        Mail
    } from 'lucide-svelte';

    const sections = [
        { id: 'getting-started', label: 'Getting Started', icon: Rocket },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'all-users', label: 'Managing Users', icon: Users },
        { id: 'add-user', label: 'Adding a New User', icon: UserPlus },
        { id: 'groups', label: 'Groups', icon: Shield },
        { id: 'ous', label: 'Organizational Units', icon: FolderKanban },
        { id: 'computers', label: 'Computers', icon: Monitor },
        { id: 'maintenance', label: 'Maintenance Hub', icon: Wrench },
        { id: 'offboarding', label: 'Offboarding', icon: LogOut, sub: true },
        { id: 'bulk-update', label: 'Bulk Update', icon: Wand2, sub: true },
        { id: 'reports', label: 'Reports', icon: FileBarChart, sub: true },
        { id: 'password-policy', label: 'Password Policy', icon: ShieldCheck },
        { id: 'audit-logs', label: 'Audit Logs', icon: FileClock },
        { id: 'known-issues', label: 'Known Issues', icon: AlertTriangle },
        { id: 'getting-help', label: 'Getting Help', icon: Mail }
    ];
</script>

<svelte:head>
    <title>ElliDesk — User Guide</title>
</svelte:head>

<div class="max-w-7xl mx-auto grid lg:grid-cols-[240px_1fr] gap-8 pb-24">

    <!-- TABLE OF CONTENTS -->
    <nav class="hidden lg:block sticky top-6 self-start space-y-0.5 text-sm max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
        <div class="font-semibold text-base-content/50 uppercase text-xs tracking-wide px-3 pb-2">
            On this page
        </div>
        {#each sections as s}
            <a
                href={`#${s.id}`}
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-base-200 text-base-content/80 {s.sub ? 'ml-3 text-xs' : ''}"
            >
                <s.icon size={s.sub ? 13 : 15} />
                {s.label}
            </a>
        {/each}
    </nav>

    <!-- CONTENT -->
    <article class="prose prose-sm sm:prose-base max-w-none">

        <header class="not-prose mb-8">
            <h1 class="text-3xl font-bold flex items-center gap-2">
                <BookOpen size={30} />
                ElliDesk User Guide
            </h1>
            <p class="text-base-content/70 mt-2">
                A walkthrough of every tool in ElliDesk — the internal console for managing Active Directory
                at BSJ. Bookmark this page; it lives at <code>/help</code> inside the app.
            </p>
        </header>

        <div class="not-prose alert alert-warning mb-8">
            <AlertTriangle size={20} />
            <span>
                <strong>Known issue:</strong> Password Reset currently fails with a connection error. This is
                expected until the LDAPS certificate is finished — see <a href="#known-issues">Known Issues</a>
                below. Everything else in the app is fully working.
            </span>
        </div>

        <!-- GETTING STARTED -->
        <section id="getting-started">
            <h2>Getting Started</h2>
            <p>
                ElliDesk is a web console for day-to-day Active Directory administration — user accounts,
                groups, computers, and directory cleanup — without needing the Active Directory Users and
                Computers (ADUC) snap-in or ADSI Edit.
            </p>
            <h3>Signing in</h3>
            <p>
                Go to the app and sign in with your normal <strong>BOS domain username and password</strong>
                (the same one you use to log into your Windows machine). There's no separate account to
                create.
            </p>
            <p>
                Access is currently limited to accounts under the ICT/MIS organizational unit. If you sign in
                with correct credentials but see "not authorized," it means your account isn't in scope yet —
                contact whoever administers ElliDesk to be added.
            </p>
            <p>
                Sessions last <strong>8 hours</strong>, after which you'll need to sign in again.
            </p>
        </section>

        <!-- DASHBOARD -->
        <section id="dashboard">
            <h2>Dashboard</h2>
            <p>
                The landing page after login. It shows at a glance:
            </p>
            <ul>
                <li>Total, enabled, disabled, and locked user counts</li>
                <li>Total groups, split into security vs. distribution</li>
                <li>A warning banner if any accounts are currently locked out, linking straight to them</li>
                <li>A grid of every tool in the app ("Quick Actions") as the fastest way to get around</li>
            </ul>
            <p>
                You can also navigate using the menu bar at the top of every page, which links directly to
                Users, Groups, OUs, Computers, Maintenance, and Audit Logs.
            </p>
        </section>

        <!-- ALL USERS -->
        <section id="all-users">
            <h2>Managing Users</h2>
            <p>
                <strong>Users → All Users</strong> lists every account in the directory. Use the search box
                and the three filter dropdowns (Status, Locked, Department) together to narrow the list — for
                example, "Locked Only" + a specific department finds exactly who needs unlocking in that team.
            </p>
            <h3>Actions on a user</h3>
            <p>
                Click <strong>Actions</strong> on any row for a menu with:
            </p>
            <ul>
                <li><strong>View</strong> — opens the full user detail page (see below)</li>
                <li><strong>Enable / Disable</strong> — toggles whether the account can log in anywhere</li>
                <li><strong>Unlock</strong> — only shown when the account is currently locked out</li>
                <li><strong>Reset Password</strong> — opens a dialog (see next section)</li>
            </ul>
            <h3>Resetting a password</h3>
            <p>
                The Reset Password dialog generates a strong random password for you automatically (with a
                Regenerate button if you want a different one). Two checkboxes, both on by default:
            </p>
            <ul>
                <li><strong>User must change password at next logon</strong> — forces them to set their own on first login</li>
                <li><strong>Unlock account</strong> — clears any existing lockout at the same time</li>
            </ul>
            <p>
                After a successful reset, the password is shown once with a copy button — AD doesn't let the
                app retrieve it again after that, so copy it before closing the dialog.
            </p>
            <div class="not-prose alert alert-warning">
                <AlertTriangle size={18} />
                <span>
                    This action currently errors out — see <a href="#known-issues">Known Issues</a>. It will
                    start working as soon as the LDAPS certificate is in place; nothing else needs to change on
                    your end.
                </span>
            </div>
            <h3>User detail page</h3>
            <p>
                Clicking a user's name (or "View") opens their full record: General, Account, Organization,
                and a raw Attribute Editor tab that shows every AD attribute on the object — useful for
                troubleshooting. The same Enable/Disable, Unlock, and Reset Password actions are available here
                too, plus a "Back to Users" link at the top.
            </p>
        </section>

        <!-- ADD USER -->
        <section id="add-user">
            <h2>Adding a New User</h2>
            <p>
                <strong>Add New User</strong> (from the Dashboard) creates a new AD account. Fill in name,
                username, UPN (email-style login), and pick a department — the department determines which OU
                the account is placed in and which groups it's added to automatically, based on the
                organization's configured department list.
            </p>
            <div class="not-prose alert alert-info">
                <span>
                    New accounts are created <strong>disabled and without a password</strong> on purpose. Use
                    Reset Password afterward to set an initial password — that's also what enables the account
                    for use. Because Reset Password is temporarily unavailable (see
                    <a href="#known-issues">Known Issues</a>), newly created accounts can't be activated until
                    that's resolved either.
                </span>
            </div>
        </section>

        <!-- GROUPS -->
        <section id="groups">
            <h2>Groups</h2>
            <p>
                <strong>Groups</strong> lists every security and distribution group, with search and filters
                by type and OU. Click a group to see its members, or use the row menu to edit its description,
                email, or manager, view members, or delete it entirely.
            </p>
            <p>
                From a group's member list you can add or remove members directly — search for a user, add
                them, or remove existing members with one click. Changes take effect immediately in AD.
            </p>
        </section>

        <!-- OUS -->
        <section id="ous">
            <h2>Organizational Units</h2>
            <p>
                <strong>OUs</strong> shows the full organizational unit tree on the left — click any folder to
                expand it, and click its name to load the users inside it on the right. A user-count badge on
                each OU includes everyone in its sub-OUs, so you can see where people actually are at a glance.
                Toggle <strong>Include sub-OUs</strong> to see everyone underneath a branch, not just users
                directly in that one folder. Use the filter box at the top of the tree to jump straight to an
                OU by name.
            </p>
        </section>

        <!-- COMPUTERS -->
        <section id="computers">
            <h2>Computers</h2>
            <p>
                <strong>Computers</strong> lists every computer object in the domain with its OS, OU, last
                logon, and enabled/disabled status. Filter by status, operating system, OU, or inactivity
                (e.g. "Inactive 90+ days") to find machines worth investigating. Click a row for full details,
                including service principal name count and creation date, and enable or disable the computer
                account directly from either the table or the detail view.
            </p>
        </section>

        <!-- MAINTENANCE -->
        <section id="maintenance">
            <h2>Maintenance Hub</h2>
            <p>
                <strong>Maintenance</strong> is home to the three cleanup and bulk-action tools: Offboarding,
                Bulk Update, and Reports. Each one runs a full <em>preview</em> before writing anything to AD,
                so you always see exactly what's about to happen first.
            </p>

            <h3 id="offboarding">Offboarding</h3>
            <p>
                The tool for retiring an account when someone leaves. It's a four-step wizard:
            </p>
            <ol>
                <li><strong>Select Users</strong> — search and add one or more people to offboard</li>
                <li>
                    <strong>Actions</strong> — choose any combination of: remove from all groups, disable the
                    account, and/or move it into the <code>FE_RETENTION</code> OU. All three are on by default
                </li>
                <li>
                    <strong>Preview</strong> — shows each person's current OU, every group they'll be removed
                    from, and whether they're already disabled, before anything happens. You can deselect
                    individual people here if needed
                </li>
                <li><strong>Apply</strong> — runs it, then shows a per-person result you can export to CSV</li>
            </ol>
            <div class="not-prose alert alert-info">
                <span>
                    Accounts belonging to protected groups (Domain Admins, Enterprise Admins, Schema Admins,
                    Administrators) are automatically excluded from offboarding as a safety measure — they
                    won't appear as selectable in the preview.
                </span>
            </div>
            <p>
                Accounts are <strong>moved and disabled, never deleted</strong> — everything in
                <code>FE_RETENTION</code> is fully recoverable by an administrator later if needed.
            </p>

            <h3 id="bulk-update">Bulk Update</h3>
            <p>
                Change one attribute (Department, Job Title, Company, Office, Description, or Manager) across
                many users in one pass. Scope your target group either by OU (with an option to include
                sub-OUs) or by manually searching and selecting specific people, then set the new value and
                load a preview before applying. Accounts in protected groups are excluded here too. Results are
                exportable to CSV.
            </p>

            <h3 id="reports">Reports</h3>
            <p>
                Three directory-hygiene reports, each with a CSV export button:
            </p>
            <ul>
                <li>
                    <strong>Inactive Devices</strong> — enabled computers with no logon activity in the last
                    30/60/90/180 days (your choice)
                </li>
                <li>
                    <strong>Stale Accounts</strong> — enabled user accounts with no logon activity over the
                    same thresholds — good candidates to check before offboarding
                </li>
                <li>
                    <strong>Non-Expiring Passwords</strong> — every account with "password never expires" set,
                    a standard item to review periodically
                </li>
            </ul>
        </section>

        <!-- PASSWORD POLICY -->
        <section id="password-policy">
            <h2>Password Policy</h2>
            <p>
                A <strong>read-only</strong> view of the domain's default password policy (minimum length,
                history, age, complexity, and lockout settings) plus any Fine-Grained Password Policies (PSOs)
                configured on the domain, including what each one applies to. This page doesn't let you change
                anything — policy changes are made through Group Policy, as usual.
            </p>
        </section>

        <!-- AUDIT LOGS -->
        <section id="audit-logs">
            <h2>Audit Logs</h2>
            <p>
                Every change made through ElliDesk is recorded here automatically — logins, password resets,
                account enable/disable/unlock, offboarding, bulk updates, and all group and computer changes.
                Filter by action type, success/failure, a date range, or free-text search (matches actor,
                username, or DN). Click any row for full details, including exactly what changed.
            </p>
            <p>
                This is the first place to check if you need to know who did what, or when — for example,
                confirming when an account was disabled and by whom.
            </p>
        </section>

        <!-- KNOWN ISSUES -->
        <section id="known-issues">
            <h2>Known Issues</h2>
            <div class="not-prose alert alert-warning">
                <AlertTriangle size={20} />
                <div>
                    <p class="font-semibold mb-1">Password Reset is temporarily unavailable</p>
                    <p class="text-sm">
                        Active Directory refuses to accept a new password over a connection that isn't
                        encrypted, so ElliDesk connects using StartTLS specifically for that one action. Our
                        domain controller doesn't yet have the self-signed certificate installed for LDAPS/StartTLS,
                        so right now Reset Password will fail with a connection error every time it's used —
                        this includes activating brand-new accounts created via Add New User, since activation
                        is done through the same Reset Password flow.
                    </p>
                    <p class="text-sm mt-2">
                        This is being worked on and doesn't affect anything else in the app — search, viewing,
                        enable/disable, unlock, groups, OUs, computers, offboarding, bulk update, reports, and
                        audit logs are all fully working today. Once the certificate is installed, password
                        resets will start working immediately with no changes needed on your end.
                    </p>
                </div>
            </div>
        </section>

        <!-- GETTING HELP -->
        <section id="getting-help">
            <h2>Getting Help</h2>
            <p>
                If something looks wrong, isn't reflecting a change you expect, or you're not sure whether an
                action is safe to take (especially Offboarding or Bulk Update), check the Audit Logs page
                first — it usually explains what actually happened. Otherwise, reach out to whoever administers
                ElliDesk in ICT.
            </p>
        </section>

    </article>

</div>
