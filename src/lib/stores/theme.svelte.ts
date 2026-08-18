// Theme switching backed by a Svelte 5 rune store — persists to
// localStorage and applies data-theme to <html>. The initial value on the
// very first paint is set synchronously by an inline script in app.html
// (before any app code runs, to avoid a flash of the wrong theme); this
// store just picks up whatever that script already applied and gives the
// UI a reactive way to change it afterward.

// Every daisyUI v5 built-in theme, in daisyUI's own canonical order (the
// order they're declared in when you register all of them) - kept in sync
// with the `themes:` list in src/routes/layout.css and the no-FOUC script
// in app.html, which both need the exact same set.
export const THEMES = [
    'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro',
    'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
    'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn', 'business', 'acid', 'lemonade',
    'night', 'coffee', 'winter', 'dim', 'nord', 'sunset', 'caramellatte', 'abyss', 'silk'
] as const;
export type ThemeName = (typeof THEMES)[number];

const DEFAULT_THEME: ThemeName = 'silk';
const STORAGE_KEY = 'theme';

function isThemeName(value: string | null): value is ThemeName {
    return value !== null && (THEMES as readonly string[]).includes(value);
}

function readCurrentTheme(): ThemeName {
    if (typeof document === 'undefined') return DEFAULT_THEME;
    const attr = document.documentElement.getAttribute('data-theme');
    return isThemeName(attr) ? attr : DEFAULT_THEME;
}

const state = $state({ current: readCurrentTheme() });

export function getThemeState(): { readonly current: ThemeName } {
    return state;
}

export function setTheme(theme: ThemeName): void {
    state.current = theme;

    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
    }

    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Private browsing / storage disabled - theme still applies for
        // this page load via the attribute above, just won't persist.
    }
}
