import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { config } from './config';

export const DOSSIER = config.dossierTeleversements;
const TAILLE_MAX = 4 * 1024 * 1024; // 4 Mo

/**
 * Pas de SVG : un SVG peut contenir un script, et il serait servi depuis
 * l'origine de l'application. Les affiches de club sont des photos.
 */
const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export type ResultatTeleversement =
	| { ok: true; chemin: string }
	| { ok: false; erreur: string };

/**
 * Enregistre une image envoyée par un formulaire et rend son chemin public.
 * Rend `{ ok: true, chemin: '' }` quand aucun fichier n'a été choisi.
 */
export async function enregistrerImage(fichier: unknown): Promise<ResultatTeleversement> {
	if (!(fichier instanceof File) || fichier.size === 0) return { ok: true, chemin: '' };

	const extension = EXTENSIONS[fichier.type];
	if (!extension) {
		return { ok: false, erreur: 'Format d’image non accepté : JPG, PNG, WEBP ou GIF.' };
	}
	if (fichier.size > TAILLE_MAX) {
		return { ok: false, erreur: 'Image trop lourde : 4 Mo au maximum.' };
	}

	mkdirSync(DOSSIER, { recursive: true });
	const nom = `${randomBytes(12).toString('hex')}.${extension}`;
	writeFileSync(join(DOSSIER, nom), Buffer.from(await fichier.arrayBuffer()));
	return { ok: true, chemin: `/televersements/${nom}` };
}

/** Supprime un fichier téléversé à partir de son chemin public. */
export function supprimerImage(chemin: string | null | undefined): void {
	if (!chemin?.startsWith('/televersements/')) return;
	const fichier = join(DOSSIER, basename(chemin));
	if (existsSync(fichier)) unlinkSync(fichier);
}
