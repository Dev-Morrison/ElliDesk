// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/types';
import type { EffectivePermissions } from '$lib/server/permissions';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: SessionUser | null;
			permissions: EffectivePermissions;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
