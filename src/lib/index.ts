// navigator.clipboard only exists in secure contexts (HTTPS, or localhost) —
// on a plain-HTTP internal deployment it's undefined, so this falls back to
// the older execCommand approach, which has no such restriction.
export async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('execCommand(copy) was rejected');
        }
    } finally {
        document.body.removeChild(textarea);
    }
}

// Endpoints fail in a few different shapes (JSON `{message}` from SvelteKit's
// error(), JSON `{error}` from hand-rolled handlers, or plain text) — this
// normalizes all of them into one string for display, without assuming any
// particular shape ahead of time.
export async function extractErrorMessage(
    res: Response,
    fallback = 'Something went wrong.'
): Promise<string> {
    try {
        const body = await res.clone().json();
        if (body && typeof body === 'object') {
            if (typeof body.message === 'string' && body.message) return body.message;
            if (typeof body.error === 'string' && body.error) return body.error;
        }
    } catch {
        // Not JSON — fall through to plain text.
    }

    try {
        const text = await res.text();
        if (text) return text;
    } catch {
        // ignore
    }

    return fallback;
}

export function fileTimeToDate(fileTime?: string | number) :Date | null {
    if (!fileTime) return null;

    const value = BigInt(fileTime);

    if (value === 0n) return null;

    // Windows FILETIME starts Jan 1, 1601
    const unixTime = Number((value - 116444736000000000n) / 10000000n);

    return new Date(unixTime * 1000);
}