// Generates a LOCAL_ADMIN_PASSWORD_HASH value for .env — run with:
//   node scripts/hash-password.mjs
// Prompts twice (and checks they match) rather than taking the password as
// a CLI argument — PowerShell/bash/cmd all treat characters like $, !, `,
// and " specially inside quoted arguments, which can silently hash a
// different password than the one you think you typed. The password itself
// is never stored; only the resulting salt:hash string is.
import { scryptSync, randomBytes } from 'node:crypto';
import { promptPassword } from './_prompt.mjs';

const password = await promptPassword('New local admin password: ');
const confirm = await promptPassword('Confirm password: ');

if (password !== confirm) {
    console.error('\nPasswords did not match — nothing generated. Try again.');
    process.exit(1);
}

if (password.length < 8) {
    console.error('\nPassword must be at least 8 characters.');
    process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');

console.log('\nAdd this to your .env as LOCAL_ADMIN_PASSWORD_HASH (paste it exactly, no quotes):\n');
console.log(`${salt}:${hash}`);
