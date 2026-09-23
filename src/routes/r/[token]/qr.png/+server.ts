import { error } from '@sveltejs/kit';
import QRCode from 'qrcode';
import type { RequestHandler } from './$types';
import { lireParToken } from '$lib/server/reservation';

/** Le QR code du ticket, en PNG. */
export const GET: RequestHandler = async ({ params }) => {
	const dossier = lireParToken(params.token);
	if (!dossier?.ticket) error(404);

	const png = await QRCode.toBuffer(dossier.ticket.code_qr, {
		type: 'png',
		width: 600,
		margin: 2,
		errorCorrectionLevel: 'M'
	});

	return new Response(new Uint8Array(png), {
		headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600' }
	});
};
