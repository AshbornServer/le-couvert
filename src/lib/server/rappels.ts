/**
 * Rappels automatiques.
 *
 * - 2 jours avant : un e-mail à chaque participant.
 * - le matin même : un récapitulatif aux organisateurs du club.
 * - le lendemain : l'événement passe en « terminé ».
 *
 * Tout est lancé une fois par jour depuis `hooks.server.ts`, et rejouable à la
 * main depuis l'espace super-admin. Les envois sont marqués en base, donc
 * relancer la tâche n'envoie jamais deux fois le même message.
 */
import { and, eq, isNull, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { clubs, evenements, reservations, utilisateurs } from './db/schema';
import { envoyerMail, gabaritHtml } from './mail';
import { chiffres, recapCuisine } from './bord';
import { config } from './config';
import { euros } from '$lib/argent';
import { dateLongue, heureBelge, jourLocal, maintenant } from '$lib/dates';
import { lienMaps } from '$lib/lieu';

/**
 * 'AAAA-MM-JJ' local, pas UTC : `evenements.date` est un jour civil belge, et
 * `toISOString()` faisait partir les rappels un jour trop tôt après 22 h.
 */
const jour = jourLocal;

export type Bilan = { rappels: number; recaps: number; termines: number };

export async function lancerRappels(): Promise<Bilan> {
	const bilan: Bilan = { rappels: 0, recaps: 0, termines: 0 };
	const origine = config.origine || 'http://localhost:5000';

	bilan.rappels = await rappelsParticipants(jour(2), origine);
	bilan.recaps = await recapOrganisateurs(jour(0));
	bilan.termines = cloturerEvenementsPasses();

	if (bilan.rappels || bilan.recaps || bilan.termines) {
		console.log(
			`[rappels] ${bilan.rappels} rappel(s), ${bilan.recaps} récap(s), ${bilan.termines} événement(s) clôturé(s)`
		);
	}
	return bilan;
}

/* ------------------------------------------------- 2 jours avant : le public */

async function rappelsParticipants(date: string, origine: string): Promise<number> {
	const aVenir = db
		.select()
		.from(evenements)
		.where(and(eq(evenements.date, date), eq(evenements.statut, 'publie')))
		.all();

	let envoyes = 0;

	for (const evenement of aVenir) {
		const club = db.select().from(clubs).where(eq(clubs.id, evenement.club_id)).get();
		if (!club) continue;

		const aPrevenir = db
			.select()
			.from(reservations)
			.where(
				and(
					eq(reservations.evenement_id, evenement.id),
					isNull(reservations.rappel_envoye_le),
					inArray(reservations.statut_paiement, ['paye', 'en_attente']),
					sql`${reservations.email} is not null`
				)
			)
			.all();

		const maps = lienMaps(evenement.lieu_nom, evenement.lieu_adresse);

		for (const r of aPrevenir) {
			const lien = `${origine}/r/${r.token_gestion}`;
			const encadre = (contenu: string) =>
				`<p style="font-size:17px;background:#fdf3e2;border:2px solid #8a5300;border-radius:10px;padding:14px">${contenu}</p>`;

			/* Le message dépend du moyen de paiement réellement choisi. */
			let reste = '';
			if (r.statut_paiement === 'en_attente') {
				if (r.mode_paiement === 'virement') {
					reste = encadre(
						`Il reste <strong>${euros(r.total_centimes)}</strong> à virer, communication <strong>${r.communication_structuree ?? ''}</strong>.`
					);
				} else if (r.mode_paiement === 'en_ligne') {
					reste = encadre(
						`Votre paiement de <strong>${euros(r.total_centimes)}</strong> n'est pas terminé. <a href="${lien}/payer">Payer maintenant</a>`
					);
				} else {
					reste = encadre(
						`Pensez à prévoir <strong>${euros(r.total_centimes)}</strong> : le paiement se fait sur place.`
					);
				}
			}

			const corps = `
<p style="font-size:17px">Bonjour ${r.prenom},</p>
<p style="font-size:17px">C’est <strong>après-demain</strong> !</p>
<p style="font-size:17px">
	<strong>${evenement.titre}</strong><br />
	${dateLongue(evenement.date)}${evenement.heure_debut ? ` — dès ${heureBelge(evenement.heure_debut)}` : ''}<br />
	${evenement.lieu_nom ? `${evenement.lieu_nom}<br />` : ''}${evenement.lieu_adresse ?? ''}
	${maps ? `<br /><a href="${maps}">Voir sur Google Maps</a>` : ''}
</p>
<p style="font-size:17px">Vous avez réservé ${r.couverts} ${r.couverts === 1 ? 'couvert' : 'couverts'}.</p>
${reste}
<p style="margin:20px 0">
	<a href="${lien}/ticket" style="display:inline-block;background:${evenement.couleur || club.couleur};color:#fff;font-size:18px;font-weight:600;padding:14px 22px;border-radius:10px;text-decoration:none">Voir mon ticket</a>
</p>
<p style="font-size:15px;color:#666">Un empêchement ? Vous pouvez annuler ici : <a href="${lien}">${lien}</a></p>`;

			try {
				await envoyerMail({
					a: r.email!,
					sujet: `Après-demain : ${evenement.titre}`,
					texte: `Bonjour ${r.prenom},\n\nC'est après-demain : ${evenement.titre}, ${dateLongue(evenement.date)}${evenement.heure_debut ? ` dès ${heureBelge(evenement.heure_debut)}` : ''}.\n${[evenement.lieu_nom, evenement.lieu_adresse].filter(Boolean).join(', ')}\n\nVous avez réservé ${r.couverts} couvert(s).\n${r.statut_paiement === 'en_attente' ? `Reste à payer : ${euros(r.total_centimes)}${r.mode_paiement === 'en_ligne' ? ` — ${lien}/payer` : ''}\n` : ''}\nVotre ticket : ${lien}/ticket\nAnnuler : ${lien}`,
					html: gabaritHtml(evenement.titre, corps, evenement.couleur || club.couleur)
				});

				db.update(reservations)
					.set({ rappel_envoye_le: maintenant() })
					.where(eq(reservations.id, r.id))
					.run();
				envoyes++;
			} catch (erreur) {
				console.error('[rappels] échec pour', r.email, erreur);
			}
		}
	}

	return envoyes;
}

/* ------------------------------------------- le matin même : les organisateurs */

async function recapOrganisateurs(date: string): Promise<number> {
	const duJour = db
		.select()
		.from(evenements)
		.where(
			and(eq(evenements.date, date), eq(evenements.statut, 'publie'), isNull(evenements.recap_envoye_le))
		)
		.all();

	let envoyes = 0;

	for (const evenement of duJour) {
		const club = db.select().from(clubs).where(eq(clubs.id, evenement.club_id)).get();
		if (!club) continue;

		const organisateurs = db
			.select({ email: utilisateurs.email })
			.from(utilisateurs)
			.where(and(eq(utilisateurs.club_id, club.id), eq(utilisateurs.role, 'organisateur')))
			.all();
		if (organisateurs.length === 0) continue;

		const total = chiffres(evenement.id);
		const cuisine = recapCuisine(evenement.id);

		const tableau = `
<table style="width:100%;border-collapse:collapse;font-size:17px">
	<tr>
		<th style="text-align:left;padding:6px 0;border-bottom:2px solid #141b2d">Plat</th>
		${cuisine.services.map((s) => `<th style="text-align:right;padding:6px 0;border-bottom:2px solid #141b2d">${s.libelle}</th>`).join('')}
		<th style="text-align:right;padding:6px 0;border-bottom:2px solid #141b2d">Total</th>
	</tr>
	${cuisine.lignes
		.map(
			(l) => `<tr>
			<td style="padding:6px 0;border-bottom:1px solid #ded9cf">${l.nom}</td>
			${cuisine.services.map((s) => `<td style="padding:6px 0;text-align:right;border-bottom:1px solid #ded9cf">${l.par_service[s.id] ?? 0}</td>`).join('')}
			<td style="padding:6px 0;text-align:right;border-bottom:1px solid #ded9cf"><strong>${l.total}</strong></td>
		</tr>`
		)
		.join('')}
	<tr>
		<td style="padding:10px 0"><strong>Couverts</strong></td>
		${cuisine.services.map((s) => `<td style="padding:10px 0;text-align:right"><strong>${s.couverts}</strong></td>`).join('')}
		<td style="padding:10px 0;text-align:right"><strong>${cuisine.couverts_total}</strong></td>
	</tr>
</table>`;

		const corps = `
<p style="font-size:17px">Bonjour,</p>
<p style="font-size:17px">C’est aujourd’hui : <strong>${evenement.titre}</strong>${evenement.heure_debut ? `, dès ${heureBelge(evenement.heure_debut)}` : ''}.</p>
<p style="font-size:19px">
	<strong>${total.couverts} couverts</strong> · ${total.reservations} réservations<br />
	${euros(total.encaisse_centimes)} sur le compte du club · ${total.a_payer} réservations à encaisser (${euros(total.attendu_centimes)})
</p>
${tableau}
<p style="font-size:15px;color:#666;margin-top:20px">
	Pensez à imprimer le récap cuisine et la liste d’entrée depuis le tableau de bord,
	et à ouvrir le scanner sur un téléphone à l’accueil.
</p>`;

		const texte = [
			`C'est aujourd'hui : ${evenement.titre}.`,
			'',
			`${total.couverts} couverts, ${total.reservations} réservations.`,
			`${euros(total.encaisse_centimes)} sur le compte du club, ${total.a_payer} à encaisser (${euros(total.attendu_centimes)}).`,
			'',
			...cuisine.lignes.map((l) => `  ${l.total} × ${l.nom}`),
			'',
			...cuisine.services.map((s) => `  ${s.libelle} : ${s.couverts} couverts`)
		].join('\n');

		for (const o of organisateurs) {
			try {
				await envoyerMail({
					a: o.email,
					sujet: `Aujourd’hui : ${evenement.titre} — ${total.couverts} couverts`,
					texte,
					html: gabaritHtml(`Aujourd’hui : ${evenement.titre}`, corps, evenement.couleur || club.couleur)
				});
				envoyes++;
			} catch (erreur) {
				console.error('[rappels] récap impossible pour', o.email, erreur);
			}
		}

		db.update(evenements)
			.set({ recap_envoye_le: maintenant() })
			.where(eq(evenements.id, evenement.id))
			.run();
	}

	return envoyes;
}

/* -------------------------------------------------- le lendemain : clôture */

function cloturerEvenementsPasses(): number {
	return db
		.update(evenements)
		.set({ statut: 'termine' })
		.where(and(eq(evenements.statut, 'publie'), sql`${evenements.date} < ${jour(0)}`))
		.run().changes;
}
