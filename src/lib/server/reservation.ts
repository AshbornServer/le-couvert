/** Création, annulation et courriers d'une réservation. */
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import {
	clubs,
	evenements,
	lignes_menu,
	options,
	reservation_lignes,
	reservation_options,
	reservations,
	services,
	tickets
} from './db/schema';
import { envoyerMail, gabaritHtml } from './mail';
import { DUREE_BLOCAGE, dejaVendu, libererBlocagesExpires, placesEvenement, placesServices } from './places';
import { communicationStructuree } from '$lib/communication';
import { euros } from '$lib/argent';
import { dateLongue, heureBelge, maintenant } from '$lib/dates';
import { fichierIcs } from '$lib/ics';
import { lienMaps } from '$lib/lieu';

export type Demande = {
	evenement_id: number;
	service_id: number | null;
	prenom: string;
	nom: string;
	email: string | null;
	telephone: string | null;
	/** identifiant de ligne de menu → quantité */
	quantites: Record<number, number>;
	/** identifiant d'option → réponse */
	reponses: Record<number, string>;
	mode_paiement: 'en_ligne' | 'sur_place' | 'virement' | 'liquide';
	source: 'en_ligne' | 'manuelle';
	/** Réservation prise au guichet et déjà encaissée. */
	deja_payee?: boolean;
	note_interne?: string | null;
};

export type Resultat =
	| { ok: true; id: number; token: string }
	| { ok: false; erreur: string };

/* --------------------------------------------------------------- création */

export function creerReservation(demande: Demande): Resultat {
	libererBlocagesExpires();

	const evenement = db.select().from(evenements).where(eq(evenements.id, demande.evenement_id)).get();
	if (!evenement) return { ok: false, erreur: 'Cet événement n’existe plus.' };

	const club = db.select().from(clubs).where(eq(clubs.id, evenement.club_id)).get();
	if (!club) return { ok: false, erreur: 'Ce club n’existe plus.' };

	/* ------------------------------------------------------- vérifications */

	if (demande.source === 'en_ligne') {
		if (evenement.statut !== 'publie') {
			return { ok: false, erreur: 'Les réservations ne sont pas ouvertes.' };
		}
		if (evenement.date_limite && new Date(evenement.date_limite) < new Date()) {
			return { ok: false, erreur: 'La date limite est dépassée : il n’est plus possible de réserver.' };
		}
	}

	if (!demande.prenom.trim() || !demande.nom.trim()) {
		return { ok: false, erreur: 'Merci d’indiquer votre prénom et votre nom.' };
	}
	if (demande.source === 'en_ligne' && !demande.email?.includes('@')) {
		return { ok: false, erreur: 'Merci d’indiquer une adresse e-mail valable : le ticket y sera envoyé.' };
	}

	const modesAutorises = {
		en_ligne: evenement.paiement_en_ligne,
		sur_place: evenement.paiement_sur_place,
		virement: evenement.paiement_virement,
		liquide: demande.source === 'manuelle'
	};
	if (demande.source === 'en_ligne' && !modesAutorises[demande.mode_paiement]) {
		return { ok: false, erreur: 'Ce moyen de paiement n’est pas proposé pour cet événement.' };
	}

	/* ------------------------------------------------- le panier et le total */

	const menu = db.select().from(lignes_menu).where(eq(lignes_menu.evenement_id, evenement.id)).all();
	const panier: { ligne: (typeof menu)[number]; quantite: number }[] = [];

	for (const ligne of menu) {
		const quantite = Math.floor(Number(demande.quantites[ligne.id] ?? 0));
		if (!Number.isFinite(quantite) || quantite <= 0) continue;
		if (quantite > 99) return { ok: false, erreur: 'Maximum 99 par ligne. Appelez le club pour un groupe plus grand.' };

		if (ligne.stock_max !== null) {
			const restant = ligne.stock_max - dejaVendu(ligne.id);
			if (quantite > restant) {
				return {
					ok: false,
					erreur:
						restant <= 0
							? `« ${ligne.nom} » est épuisé.`
							: `Il ne reste que ${restant} × « ${ligne.nom} ».`
				};
			}
		}
		panier.push({ ligne, quantite });
	}

	if (panier.length === 0) {
		return { ok: false, erreur: 'Votre commande est vide : choisissez au moins un article.' };
	}

	const couverts = panier
		.filter((p) => p.ligne.compte_comme_couvert)
		.reduce((t, p) => t + p.quantite, 0);
	const sousTotal = panier.reduce((t, p) => t + p.quantite * p.ligne.prix_centimes, 0);

	/* ------------------------------------------------------------- capacité */

	const places = placesEvenement(evenement.id, evenement.capacite);
	if (places.restant !== null && couverts > places.restant) {
		return {
			ok: false,
			erreur:
				places.restant <= 0
					? 'C’est complet : il n’y a plus de place.'
					: `Il ne reste que ${places.restant} ${places.restant === 1 ? 'place' : 'places'}.`
		};
	}

	/* -------------------------------------------------------------- service */

	const listeServices = db.select().from(services).where(eq(services.evenement_id, evenement.id)).all();
	let service_id: number | null = null;

	if (listeServices.length > 0) {
		const choisi = listeServices.find((s) => s.id === demande.service_id);
		if (!choisi) return { ok: false, erreur: 'Merci de choisir votre service.' };

		const restants = placesServices(evenement.id);
		const restant = restants.get(choisi.id);
		if (restant !== null && restant !== undefined && couverts > restant) {
			return {
				ok: false,
				erreur:
					restant <= 0
						? `Le service « ${choisi.libelle} » est complet. Choisissez l’autre service.`
						: `Il ne reste que ${restant} places pour « ${choisi.libelle} ».`
			};
		}
		service_id = choisi.id;
	}

	/* -------------------------------------------------------------- options */

	const listeOptions = db.select().from(options).where(eq(options.evenement_id, evenement.id)).all();
	for (const option of listeOptions) {
		if (option.obligatoire && !String(demande.reponses[option.id] ?? '').trim()) {
			return { ok: false, erreur: `Merci de répondre à « ${option.libelle} ».` };
		}
	}

	/* ---------------------------------------------------- frais et montants */

	const frais =
		demande.mode_paiement === 'en_ligne' && club.frais_payes_par === 'participant'
			? couverts * club.commission_centimes
			: 0;
	const total = sousTotal + frais;

	const paye = demande.deja_payee === true;
	const token = randomBytes(24).toString('base64url');

	/* -------------------------------------------------------- enregistrement */

	const id = db.transaction((tx) => {
		const cree = tx
			.insert(reservations)
			.values({
				evenement_id: evenement.id,
				service_id,
				nom: demande.nom.trim(),
				prenom: demande.prenom.trim(),
				email: demande.email?.trim().toLowerCase() || null,
				telephone: demande.telephone?.trim() || null,
				couverts,
				total_centimes: total,
				frais_centimes: frais,
				statut_paiement: paye ? 'paye' : 'en_attente',
				mode_paiement: demande.mode_paiement,
				paye_le: paye ? maintenant() : null,
				token_gestion: token,
				source: demande.source,
				note_interne: demande.note_interne ?? null,
				bloque_jusqu_a:
					demande.mode_paiement === 'en_ligne' && !paye ? maintenant() + DUREE_BLOCAGE : null
			})
			.returning({ id: reservations.id })
			.get();

		for (const p of panier) {
			tx.insert(reservation_lignes)
				.values({
					reservation_id: cree.id,
					ligne_menu_id: p.ligne.id,
					quantite: p.quantite,
					prix_centimes: p.ligne.prix_centimes,
					nom: p.ligne.nom
				})
				.run();
		}

		for (const option of listeOptions) {
			const valeur = String(demande.reponses[option.id] ?? '').trim();
			if (!valeur) continue;
			tx.insert(reservation_options)
				.values({
					reservation_id: cree.id,
					option_id: option.id,
					libelle: option.libelle,
					valeur
				})
				.run();
		}

		if (demande.mode_paiement === 'virement') {
			tx.update(reservations)
				.set({ communication_structuree: communicationStructuree(evenement.id, cree.id) })
				.where(eq(reservations.id, cree.id))
				.run();
		}

		tx.insert(tickets)
			.values({ reservation_id: cree.id, code_qr: randomBytes(16).toString('base64url') })
			.run();

		return cree.id;
	});

	return { ok: true, id, token };
}

/* -------------------------------------------------------------- lecture */

export function lireParToken(token: string) {
	const reservation = db
		.select()
		.from(reservations)
		.where(eq(reservations.token_gestion, token))
		.get();
	if (!reservation) return null;

	const evenement = db.select().from(evenements).where(eq(evenements.id, reservation.evenement_id)).get();
	if (!evenement) return null;

	/**
	 * Uniquement ce qui peut s'afficher : ce dossier part dans le HTML de pages
	 * publiques. La ligne `clubs` entière contient les jetons Mollie du club.
	 */
	const club = db
		.select({
			id: clubs.id,
			slug: clubs.slug,
			nom: clubs.nom,
			logo: clubs.logo,
			couleur: clubs.couleur,
			commission_centimes: clubs.commission_centimes,
			frais_payes_par: clubs.frais_payes_par,
			mollie_relie: sql<number>`(${clubs.mollie_jeton_acces} is not null)`
		})
		.from(clubs)
		.where(eq(clubs.id, evenement.club_id))
		.get();
	if (!club) return null;

	return {
		reservation,
		evenement,
		club,
		service: reservation.service_id
			? (db.select().from(services).where(eq(services.id, reservation.service_id)).get() ?? null)
			: null,
		lignes: db
			.select()
			.from(reservation_lignes)
			.where(eq(reservation_lignes.reservation_id, reservation.id))
			.all(),
		reponses: db
			.select()
			.from(reservation_options)
			.where(eq(reservation_options.reservation_id, reservation.id))
			.all(),
		ticket: db.select().from(tickets).where(eq(tickets.reservation_id, reservation.id)).get() ?? null
	};
}

export type Dossier = NonNullable<ReturnType<typeof lireParToken>>;

/** La réservation peut-elle encore être annulée par le participant ? */
export function annulableParLeParticipant(dossier: Dossier): boolean {
	if (dossier.reservation.statut_paiement === 'annule') return false;
	if (dossier.reservation.statut_paiement === 'rembourse') return false;
	if (dossier.ticket?.scanne_le) return false;
	if (!dossier.evenement.date_limite) return true;
	return new Date(dossier.evenement.date_limite) > new Date();
}

/* --------------------------------------------------------- les courriers */

function detailHtml(dossier: Dossier): string {
	const { reservation, lignes, service, evenement } = dossier;
	const maps = lienMaps(evenement.lieu_nom, evenement.lieu_adresse);

	const articles = lignes
		.map(
			(l) =>
				`<tr><td style="padding:6px 0">${l.quantite} × ${l.nom}</td><td style="padding:6px 0;text-align:right">${euros(l.quantite * l.prix_centimes)}</td></tr>`
		)
		.join('');

	return `
<p style="font-size:17px">Bonjour ${reservation.prenom},</p>
<p style="font-size:17px">Votre réservation est enregistrée. Voici le détail :</p>
<table style="width:100%;border-collapse:collapse;font-size:17px">
	${articles}
	${reservation.frais_centimes > 0 ? `<tr><td style="padding:6px 0;color:#666">Frais de réservation</td><td style="padding:6px 0;text-align:right;color:#666">${euros(reservation.frais_centimes)}</td></tr>` : ''}
	<tr><td style="padding:10px 0;border-top:2px solid #141b2d"><strong>Total</strong></td><td style="padding:10px 0;border-top:2px solid #141b2d;text-align:right"><strong>${euros(reservation.total_centimes)}</strong></td></tr>
</table>
<p style="font-size:17px;margin-top:20px">
	<strong>${evenement.titre}</strong><br />
	${dateLongue(evenement.date)}${evenement.heure_debut ? ` — dès ${heureBelge(evenement.heure_debut)}` : ''}<br />
	${service ? `Service : ${service.libelle}${service.heure ? ` (${heureBelge(service.heure)})` : ''}<br />` : ''}
	${evenement.lieu_nom ? `${evenement.lieu_nom}<br />` : ''}
	${evenement.lieu_adresse ?? ''}
	${maps ? `<br /><a href="${maps}">Voir sur Google Maps</a>` : ''}
</p>`;
}

function paiementHtml(dossier: Dossier): string {
	const { reservation, evenement } = dossier;

	if (reservation.statut_paiement === 'paye') {
		return `<p style="font-size:17px;background:#e7f4ec;border:2px solid #14733f;border-radius:10px;padding:14px">
			<strong>C’est payé, il n’y a plus rien à faire.</strong></p>`;
	}
	if (reservation.mode_paiement === 'sur_place') {
		return `<p style="font-size:17px;background:#fdf3e2;border:2px solid #8a5300;border-radius:10px;padding:14px">
			<strong>À payer sur place</strong> : ${euros(reservation.total_centimes)}. Prévoyez de quoi payer le soir même.</p>`;
	}
	if (reservation.mode_paiement === 'virement') {
		return `<div style="font-size:17px;background:#fdf3e2;border:2px solid #8a5300;border-radius:10px;padding:14px">
			<strong>À payer par virement</strong><br />
			Montant : <strong>${euros(reservation.total_centimes)}</strong><br />
			${evenement.iban ? `Compte : <strong>${evenement.iban}</strong><br />` : ''}
			Communication : <strong>${reservation.communication_structuree ?? ''}</strong><br />
			<span style="font-size:15px">Recopiez bien la communication : c’est elle qui permet de retrouver votre paiement.</span>
		</div>`;
	}
	return '';
}

/** E-mail de confirmation, avec le ticket QR et le fichier d'agenda. */
export async function envoyerConfirmation(dossier: Dossier, origine: string): Promise<void> {
	const { reservation, evenement, club, ticket } = dossier;
	if (!reservation.email) return;

	const lienGestion = `${origine}/r/${reservation.token_gestion}`;
	const lienTicket = `${lienGestion}/ticket`;

	const qr = ticket
		? await QRCode.toBuffer(ticket.code_qr, { type: 'png', width: 600, margin: 2 })
		: null;

	const ics = evenement.date
		? fichierIcs({
				uid: `reservation-${reservation.id}@soupers`,
				titre: evenement.titre,
				description: `Réservation ${reservation.prenom} ${reservation.nom} — ${reservation.couverts} couvert(s)`,
				lieu: [evenement.lieu_nom, evenement.lieu_adresse].filter(Boolean).join(', '),
				date: evenement.date,
				heure: dossier.service?.heure ?? evenement.heure_debut
			})
		: null;

	const corps = `
${detailHtml(dossier)}
${paiementHtml(dossier)}
<p style="font-size:17px;margin-top:20px"><strong>Votre ticket d’entrée</strong><br />
Le QR code est en pièce jointe. Présentez-le à l’entrée, sur votre téléphone ou imprimé.</p>
<p style="margin:20px 0">
	<a href="${lienTicket}" style="display:inline-block;background:${evenement.couleur || club.couleur};color:#fff;font-size:18px;font-weight:600;padding:14px 22px;border-radius:10px;text-decoration:none">Voir et imprimer mon ticket</a>
</p>
<p style="font-size:15px;color:#666">
	Pour revoir ou annuler votre réservation : <a href="${lienGestion}">${lienGestion}</a><br />
	Gardez ce lien, il ne demande aucun mot de passe.
</p>
${evenement.texte_confirmation ? `<p style="font-size:17px;margin-top:16px">${evenement.texte_confirmation}</p>` : ''}`;

	const texte = [
		`Bonjour ${reservation.prenom},`,
		'',
		'Votre réservation est enregistrée.',
		'',
		...dossier.lignes.map((l) => `  ${l.quantite} × ${l.nom} — ${euros(l.quantite * l.prix_centimes)}`),
		`  Total : ${euros(reservation.total_centimes)}`,
		'',
		`${evenement.titre} — ${dateLongue(evenement.date)}${evenement.heure_debut ? ` dès ${heureBelge(evenement.heure_debut)}` : ''}`,
		dossier.service ? `Service : ${dossier.service.libelle}` : '',
		[evenement.lieu_nom, evenement.lieu_adresse].filter(Boolean).join(', '),
		'',
		reservation.mode_paiement === 'virement'
			? `À payer par virement : ${euros(reservation.total_centimes)} sur ${evenement.iban ?? ''} avec la communication ${reservation.communication_structuree ?? ''}`
			: reservation.mode_paiement === 'sur_place'
				? `À payer sur place : ${euros(reservation.total_centimes)}`
				: '',
		'',
		`Votre ticket : ${lienTicket}`,
		`Voir ou annuler : ${lienGestion}`
	]
		.filter((l) => l !== '')
		.join('\n');

	await envoyerMail({
		a: reservation.email,
		sujet: `Votre réservation — ${evenement.titre}`,
		texte,
		html: gabaritHtml(evenement.titre, corps, evenement.couleur || club.couleur),
		pieces: [
			...(qr ? [{ nom: 'ticket.png', contenu: qr.toString('base64'), type: 'image/png' }] : []),
			...(ics
				? [
						{
							nom: 'evenement.ics',
							contenu: Buffer.from(ics, 'utf8').toString('base64'),
							type: 'text/calendar'
						}
					]
				: [])
		]
	});
}

/* ------------------------------------------------------------ annulation */

export type ResultatAnnulation = { ok: true; rembourse: boolean } | { ok: false; erreur: string };

/**
 * Annule une réservation. Le remboursement Mollie est demandé par
 * l'appelant (voir `$lib/server/mollie`), pour garder ce module sans réseau.
 */
export function annuler(reservation_id: number, parQui: 'participant' | 'organisateur'): ResultatAnnulation {
	const reservation = db.select().from(reservations).where(eq(reservations.id, reservation_id)).get();
	if (!reservation) return { ok: false, erreur: 'Réservation introuvable.' };

	if (reservation.statut_paiement === 'annule' || reservation.statut_paiement === 'rembourse') {
		return { ok: false, erreur: 'Cette réservation est déjà annulée.' };
	}

	const ticket = db.select().from(tickets).where(eq(tickets.reservation_id, reservation.id)).get();
	if (ticket?.scanne_le && parQui === 'participant') {
		return { ok: false, erreur: 'Ce ticket a déjà été scanné à l’entrée : contactez le club.' };
	}

	const aRembourser = reservation.statut_paiement === 'paye' && reservation.mode_paiement === 'en_ligne';
	db.update(reservations)
		.set({ statut_paiement: 'annule' })
		.where(eq(reservations.id, reservation.id))
		.run();

	return { ok: true, rembourse: aRembourser };
}

/** Prévient le participant que sa réservation est annulée. */
export async function envoyerAnnulation(dossier: Dossier, rembourse: boolean): Promise<void> {
	const { reservation, evenement, club } = dossier;
	if (!reservation.email) return;

	const corps = `
<p style="font-size:17px">Bonjour ${reservation.prenom},</p>
<p style="font-size:17px">Votre réservation pour <strong>${evenement.titre}</strong> du ${dateLongue(evenement.date)} est annulée.</p>
${
	rembourse
		? `<p style="font-size:17px">Le remboursement de ${euros(reservation.total_centimes)} a été demandé. Comptez quelques jours ouvrables pour le voir sur votre compte.</p>`
		: `<p style="font-size:17px">Il n’y a rien à payer.</p>`
}
<p style="font-size:15px;color:#666">Votre ticket n’est plus valable.</p>`;

	await envoyerMail({
		a: reservation.email,
		sujet: `Réservation annulée — ${evenement.titre}`,
		texte: `Bonjour ${reservation.prenom},\n\nVotre réservation pour ${evenement.titre} du ${dateLongue(evenement.date)} est annulée.\n${rembourse ? `Le remboursement de ${euros(reservation.total_centimes)} a été demandé.` : 'Il n’y a rien à payer.'}\n\nVotre ticket n’est plus valable.`,
		html: gabaritHtml('Réservation annulée', corps, evenement.couleur || club.couleur)
	});
}
