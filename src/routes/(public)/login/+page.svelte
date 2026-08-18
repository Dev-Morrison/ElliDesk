<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import type { PageProps } from './$types';
    import { ShieldCheck, Lock, FileClock, User, Eye, EyeOff, ArrowRight, ExternalLink } from 'lucide-svelte';

    let { data }: PageProps = $props();
    let formProcessing = $state(false);
    let errorText = $state('');
    let showPassword = $state(false);
</script>

<svelte:head>
    <title>Login — ElliDesk</title>
</svelte:head>

<section class="min-h-screen w-full flex bg-slate-50">

    <!-- LEFT: BRAND PANEL -->
    <div class="hidden lg:flex relative w-1/2 flex-col justify-between overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-14">

        <!-- decorative glow -->
        <div class="absolute -top-32 -left-24 w-96 h-96 bg-indigo-500/25 rounded-full blur-3xl"></div>
        <div class="absolute bottom-0 right-0 w-md h-112 bg-blue-500/15 rounded-full blur-3xl"></div>

        <!-- decorative network graphic -->
        <svg
            class="absolute inset-0 w-full h-full opacity-[0.15]"
            viewBox="0 0 400 800"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
        >
            <g stroke="white" stroke-width="1">
                <line x1="200" y1="110" x2="110" y2="230" />
                <line x1="200" y1="110" x2="290" y2="230" />
                <line x1="110" y1="230" x2="60" y2="350" />
                <line x1="110" y1="230" x2="165" y2="350" />
                <line x1="290" y1="230" x2="245" y2="350" />
                <line x1="290" y1="230" x2="345" y2="350" />
                <line x1="165" y1="350" x2="130" y2="480" />
                <line x1="245" y1="350" x2="280" y2="480" />
                <line x1="130" y1="480" x2="200" y2="600" />
                <line x1="280" y1="480" x2="200" y2="600" />
                <line x1="200" y1="600" x2="150" y2="710" />
                <line x1="200" y1="600" x2="260" y2="710" />
            </g>
            <g fill="white">
                <circle cx="200" cy="110" r="5" />
                <circle cx="110" cy="230" r="4" />
                <circle cx="290" cy="230" r="4" />
                <circle cx="60" cy="350" r="3" />
                <circle cx="165" cy="350" r="4" />
                <circle cx="245" cy="350" r="4" />
                <circle cx="345" cy="350" r="3" />
                <circle cx="130" cy="480" r="3.5" />
                <circle cx="280" cy="480" r="3.5" />
                <circle cx="200" cy="600" r="5" />
                <circle cx="150" cy="710" r="3" />
                <circle cx="260" cy="710" r="3" />
            </g>
        </svg>

        <!-- TOP: logo -->
        <div class="relative z-10 flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
                <ShieldCheck class="w-6 h-6 text-white" />
            </div>
            <div>
                <div class="font-semibold tracking-tight text-lg leading-none">ElliDesk</div>
                <div class="text-xs text-white/50 mt-1">Active Directory Management Console</div>
            </div>
        </div>

        <!-- MIDDLE: headline -->
        <div class="relative z-10 max-w-md">
            <h2 class="text-4xl font-bold leading-tight tracking-tight mb-4">
                One console for every domain.
            </h2>
            <p class="text-white/60 text-base leading-relaxed">
                Manage users, groups, and computers across BSJ, NCRA, NCBJ, and HSRA — without touching ADUC
                or ADSI Edit.
            </p>
        </div>

        <!-- BOTTOM: feature strip -->
        <div class="relative z-10 grid grid-cols-2 gap-6">
            <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Lock size={16} />
                </div>
                <div>
                    <div class="text-sm font-medium">Role-Based Access</div>
                    <div class="text-xs text-white/50 mt-0.5">Granular, per-domain permissions</div>
                </div>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <FileClock size={16} />
                </div>
                <div>
                    <div class="text-sm font-medium">Full Audit Trail</div>
                    <div class="text-xs text-white/50 mt-0.5">Every change is logged</div>
                </div>
            </div>
        </div>
    </div>

    <!-- RIGHT: SIGN-IN CARD -->
    <div class="w-full lg:w-1/2 flex items-center justify-center px-4 py-12">
        <div class="w-full max-w-sm">

            <!-- Mobile-only brand mark (left panel is hidden below lg) -->
            <div class="flex lg:hidden flex-col items-center mb-8">
                <div class="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4 shadow-sm">
                    <ShieldCheck class="w-6 h-6 text-white" />
                </div>
                <h1 class="text-xl font-semibold text-slate-900 tracking-tight">ElliDesk</h1>
                <p class="text-sm text-slate-500 mt-1">Active Directory Console</p>
            </div>

            <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                <h2 class="text-2xl font-bold text-slate-900 mb-1">Sign In</h2>
                <p class="text-sm text-slate-500 mb-6">Enter your BOS domain credentials to continue.</p>

                <form
                    class="space-y-4"
                    method="post"
                    action="/login"
                    use:enhance={() => {
                        errorText = '';
                        formProcessing = true;
                        return ({ result }) => {
                            formProcessing = false;
                            if (result.type === 'failure') {
                                // Every fail() the login action returns (401,
                                // 403, 429, 500) includes a real message —
                                // status-specific handling here was silently
                                // dropping all but 401's.
                                errorText =
                                    (result.data?.error as string | undefined) ??
                                    'An unexpected error occurred. Please try again.';
                            } else if (result.type === 'success') {
                                goto('/dashboard');
                            }
                        };
                    }}
                >
                    <div>
                        <label for="username" class="block text-sm font-medium text-slate-700 mb-1.5">
                            Username
                        </label>
                        <div class="relative">
                            <User size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="username"
                                type="text"
                                name="username"
                                autocomplete="username"
                                required
                                placeholder="Use LDAP username (e.g., jdoe)"
                                class="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5">
                            Password
                        </label>
                        <div class="relative">
                            <Lock size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                autocomplete="current-password"
                                required
                                placeholder="••••••••"
                                class="w-full rounded-lg border border-slate-300 pl-9 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
                            />
                            <button
                                type="button"
                                onclick={() => (showPassword = !showPassword)}
                                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {#if showPassword}
                                    <EyeOff size={16} />
                                {:else}
                                    <Eye size={16} />
                                {/if}
                            </button>
                        </div>
                    </div>

                    {#if errorText}
                        <div class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                            {errorText}
                        </div>
                    {/if}

                    <button
                        type="submit"
                        disabled={formProcessing}
                        class="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition"
                    >
                        {#if formProcessing}
                            <span class="loading loading-spinner loading-xs"></span>
                        {:else}
                            Sign In
                            <ArrowRight size={15} />
                        {/if}
                    </button>
                </form>

                <div class="flex items-center justify-center gap-3 text-xs text-slate-400 mt-6 pt-6 border-t border-slate-100">
                    <span class="inline-flex items-center gap-1">
                        <Lock size={11} />
                        Encrypted Session
                    </span>
                    <span class="text-slate-300">·</span>
                    <span class="inline-flex items-center gap-1">
                        <FileClock size={11} />
                        Fully Audited
                    </span>
                </div>
            </div>

            <!-- FOOTNOTE -->
            <p class="text-center text-xs text-slate-400 mt-6">
                Built within the BSJ ICT Division ·
                <a
                    href="https://github.com/Dev-Morrison/ElliDesk"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-0.5 underline decoration-slate-300 hover:text-slate-600 hover:decoration-slate-400 transition"
                >
                    GitHub
                    <ExternalLink size={11} />
                </a>
            </p>

        </div>
    </div>

</section>
