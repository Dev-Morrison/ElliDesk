// Diagnoses "Invalid username or password" for the local break-glass admin
// without ever sending your password anywhere — everything here runs
// locally against your own .env file. Run with:
//   node scripts/check-local-admin.mjs
import { readFileSync, existsSync } from 'node:fs';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { promptPassword } from './_prompt.mjs';

const ENV_PATH = new URL('../.env', import.meta.url);

function parseEnvFile(text) {
    const result = {};
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

if (!existsSync(ENV_PATH)) {
    console.error(`No .env found at ${ENV_PATH.pathname}`);
    process.exit(1);
}

const env = parseEnvFile(readFileSync(ENV_PATH, 'utf8'));
const username = env.LOCAL_ADMIN_USERNAME;
const storedHash = env.LOCAL_ADMIN_PASSWORD_HASH;

console.log('--- .env check ---');
console.log('LOCAL_ADMIN_USERNAME:', username ? JSON.stringify(username) : '(not set)');

if (!storedHash) {
    console.log('LOCAL_ADMIN_PASSWORD_HASH: (not set)');
    console.log('\nBoth vars must be set for the local admin login to work at all.');
    process.exit(1);
}

const parts = storedHash.split(':');
const looksValid = parts.length === 2 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1]);
console.log('LOCAL_ADMIN_PASSWORD_HASH: set, length', storedHash.length, looksValid ? '(format looks valid)' : '(format looks WRONG — expected salt:hash, both hex)');

if (!username) {
    console.log('\nSet LOCAL_ADMIN_USERNAME and re-run.');
    process.exit(1);
}

if (!looksValid) {
    console.log('\nThe hash value in .env is malformed — regenerate it with `node scripts/hash-password.mjs`');
    console.log('and make sure you pasted the WHOLE line with no extra quotes, spaces, or line breaks.');
    process.exit(1);
}

console.log('\n--- Password check (nothing is sent anywhere, this only runs locally) ---');
const candidateUsername = await promptPassword('Username to test (blank = use LOCAL_ADMIN_USERNAME): ');
const testUsername = candidateUsername || username;
const password = await promptPassword('Password to test: ');

const usernameMatches = testUsername.toLowerCase() === username.toLowerCase();
console.log(`Username match: ${usernameMatches ? 'YES' : 'NO — "' + testUsername + '" != "' + username + '"'}`);

const [salt, hashHex] = storedHash.split(':');
const expected = Buffer.from(hashHex, 'hex');
const actual = scryptSync(password, salt, 64);
const passwordMatches = expected.length === actual.length && timingSafeEqual(expected, actual);

console.log(`Password match: ${passwordMatches ? 'YES' : 'NO'}`);

if (usernameMatches && passwordMatches) {
    console.log('\nThese credentials WOULD work against the app as configured.');
    console.log('If the login page still rejects them, the running app process has a stale');
    console.log('.env (env vars are only read at process startup) — fully stop and restart it.');
} else {
    console.log('\nThese credentials would NOT work. Regenerate with `node scripts/hash-password.mjs`');
    console.log('and paste the new value into .env, or re-check what you typed above.');
}
