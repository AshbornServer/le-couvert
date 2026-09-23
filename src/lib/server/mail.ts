/**
 * Envoi d'e-mails transactionnels.
 * FOURNISSEUR_MAIL = "console" (développement), "brevo" ou "resend".
 */

type Courriel = {
	a: string;
	sujet: string;
	texte: string;
	html?: string;
	pieces?: { nom: string; contenu: string; type: string }[]; // contenu en base64
};

import { config } from './config';

const fournisseur = () => config.fournisseurMail;
const cle = () => config.cleMail;
const expediteur = () => config.mailExpediteur;
const nomExpediteur = () => config.mailNomExpediteur;

export async function envoyerMail(c: Courriel): Promise<void> {
	const f = fournisseur();

	if (f === 'console' || !cle()) {
		console.log('\n========== E-MAIL (mode console) ==========');
		console.log('À      :', c.a);
		console.log('Sujet  :', c.sujet);
		console.log('-------------------------------------------');
		console.log(c.texte);
		if (c.pieces?.length) console.log('Pièces :', c.pieces.map((p) => p.nom).join(', '));
		console.log('===========================================\n');
		return;
	}

	try {
		if (f === 'brevo') await viaBrevo(c);
		else if (f === 'resend') await viaResend(c);
		else throw new Error(`FOURNISSEUR_MAIL inconnu : ${f}`);
	} catch (erreur) {
		console.error('[mail] échec de l’envoi à', c.a, erreur);
		throw erreur;
	}
}

async function viaBrevo(c: Courriel) {
	const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: { 'api-key': cle(), 'content-type': 'application/json' },
		body: JSON.stringify({
			sender: { email: expediteur(), name: nomExpediteur() },
			to: [{ email: c.a }],
			subject: c.sujet,
			textContent: c.texte,
			htmlContent: c.html ?? undefined,
			attachment: c.pieces?.map((p) => ({ name: p.nom, content: p.contenu }))
		})
	});
	if (!reponse.ok) throw new Error(`Brevo ${reponse.status} ${await reponse.text()}`);
}

async function viaResend(c: Courriel) {
	const reponse = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { authorization: `Bearer ${cle()}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			from: `${nomExpediteur()} <${expediteur()}>`,
			to: [c.a],
			subject: c.sujet,
			text: c.texte,
			html: c.html ?? undefined,
			attachments: c.pieces?.map((p) => ({ filename: p.nom, content: p.contenu }))
		})
	});
	if (!reponse.ok) throw new Error(`Resend ${reponse.status} ${await reponse.text()}`);
}

/** Gabarit sobre, lisible sur téléphone et à l'impression. */
export function gabaritHtml(titre: string, corps: string, couleur = '#0b6b3a'): string {
	return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2ed;font:17px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#141b2d">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#fff;border-radius:12px;padding:24px;border-top:6px solid ${couleur}">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${titre}</h1>
${corps}
</div>
<p style="color:#666;font-size:14px;text-align:center;margin-top:16px">Message automatique — merci de ne pas y répondre.</p>
</div></body></html>`;
}
