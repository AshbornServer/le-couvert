import { error } from '@sveltejs/kit';
import QRCode from 'qrcode';
import type { RequestHandler } from './$types';
import { clubDeLaSession, lireEvenement } from '$lib/server/evenement';
import { origine } from '$lib/server/config';
import { versSlug } from '$lib/slug';

/** Le QR code de la page publique, en PNG, à coller sur les affiches. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const club = clubDeLaSession(locals);
	const evenement = lireEvenement(club.id, Number(params.id));
	if (evenement.statut === 'brouillon') error(400, 'Publiez l’événement avant de télécharger le QR code.');

	const lien = `${origine(url)}/${club.slug}/${evenement.slug}`;
	const png = await QRCode.toBuffer(lien, {
		type: 'png',
		width: 1000,
		margin: 2,
		errorCorrectionLevel: 'M',
		color: { dark: '#000000', light: '#ffffff' }
	});

	const nom = `qr-${versSlug(evenement.titre) || evenement.slug}.png`;
	return new Response(new Uint8Array(png), {
		headers: {
			'content-type': 'image/png',
			'content-disposition': `attachment; filename="${nom}"`,
			'cache-control': 'no-store'
		}
	});
};
