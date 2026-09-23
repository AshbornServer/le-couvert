import type { Utilisateur } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			utilisateur: Utilisateur | null;
		}
		interface PageData {
			utilisateur?: Utilisateur | null;
		}
	}
}

export {};
