import type { RequestHandler } from './$types';
import { synchroniserPaiement } from '$lib/server/mollie';

/**
 * Webhook Mollie. Le corps ne contient qu'un identifiant : l'état réel est
 * toujours relu chez Mollie, jamais déduit de la requête reçue.
 */
export const POST: RequestHandler = async ({ request }) => {
	let id = '';
	try {
		const corps = await request.formData();
		id = String(corps.get('id') ?? '');
	} catch {
		return new Response('corps illisible', { status: 400 });
	}

	if (!id.startsWith('tr_')) return new Response('identifiant inattendu', { status: 400 });

	try {
		await synchroniserPaiement(id);
	} catch (erreur) {
		console.error('[mollie] webhook', id, erreur);
		// 500 : Mollie réessaiera.
		return new Response('réessayez', { status: 500 });
	}

	return new Response('ok');
};
