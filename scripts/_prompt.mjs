import readline from 'node:readline';

// Best-effort masked prompt (no dependency) — works in most real terminals
// via readline's undocumented _writeToOutput hook. Falls back to visible
// input if that hook isn't usable (non-TTY, piped input, etc.), which is an
// acceptable tradeoff for a local admin-only dev script.
export function promptPassword(label = 'Password: ') {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        let masking = false;

        if (process.stdin.isTTY) {
            // @ts-ignore - private API, best-effort only
            rl._writeToOutput = (str) => {
                rl.output.write(masking && str !== '\r\n' && str !== '\n' ? '*' : str);
            };
        }

        rl.question(label, (answer) => {
            rl.close();
            process.stdout.write('\n');
            resolve(answer);
        });

        masking = true;
    });
}
