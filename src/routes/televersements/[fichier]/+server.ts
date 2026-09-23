import { error } from '@sveltejs/kit';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import type { RequestHandler } from './$types';
import { DOSSIER } from '$lib/server/televersement';

const TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif'
};

/**
 * Sert une image téléversée. Les fichiers font 4 Mo au maximum (voir
 * `televersement.ts`) : on les lit d'un coup plutôt que par flux, ce qui évite
 * les mauvaises surprises quand le navigateur coupe la connexion.
 */
export const GET: RequestHandler = ({ params, request }) => {
	const nom = basename(params.fichier);
	const type = TYPES[extname(nom).toLowerCase()];
	if (!type) error(404);

	const chemin = join(DOSSIER, nom);
	if (!existsSync(chemin)) error(404);

	const infos = statSync(chemin);
	const etiquette = `"${infos.size.toString(16)}-${Math.floor(infos.mtimeMs).toString(16)}"`;
	if (request.headers.get('if-none-match') === etiquette) {
		return new Response(null, { status: 304, headers: { etag: etiquette } });
	}

	return new Response(new Uint8Array(readFileSync(chemin)), {
		headers: {
			'content-type': type,
			etag: etiquette,
			'cache-control': 'public, max-age=31536000, immutable',
			// Par précaution, même sans SVG accepté.
			'content-security-policy': "default-src 'none'; sandbox",
			'x-content-type-options': 'nosniff'
		}
	});
};
