// App-wide replacement for the browser's native alert() — a single reactive
// notice that any component can trigger via showNotice() and that renders
// through NoticeModal.svelte (mounted once in the (auth) layout), so error/
// success messages look like part of the app instead of a native dialog.

export type NoticeVariant = 'error' | 'success' | 'warning' | 'info';

interface NoticeState {
    open: boolean;
    title: string;
    message: string;
    variant: NoticeVariant;
}

const state = $state<NoticeState>({
    open: false,
    title: '',
    message: '',
    variant: 'error'
});

const DEFAULT_TITLES: Record<NoticeVariant, string> = {
    error: 'Something went wrong',
    success: 'Success',
    warning: 'Warning',
    info: 'Notice'
};

export function getNoticeState(): NoticeState {
    return state;
}

export function showNotice(
    message: string,
    options: { title?: string; variant?: NoticeVariant } = {}
): void {
    const variant = options.variant ?? 'error';
    state.variant = variant;
    state.title = options.title ?? DEFAULT_TITLES[variant];
    state.message = message;
    state.open = true;
}

export function closeNotice(): void {
    state.open = false;
}
