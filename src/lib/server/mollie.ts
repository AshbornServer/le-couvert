/**
 * Mollie Connect.
 *
 * L'argent va directement sur le compte du club : les paiements sont créés
 * avec le jeton OAuth du club. La commission de la plateforme est prélevée au
 * passage par `applicationFee`. Aucune donnée de carte ne transite ici.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { clubs, evenements, journal, reservations } from './db/schema';
import { config } from './config';
import { maintenant } from '$lib/dates';
import type { Dossier } from './reservation';

const API = 'https://api.mollie.com';
const AUTORISATION = 'https://my.mollie.com/oauth2/authorize';

const PORTEE = [
	'organizations.read',
	'profiles.read',
	'payments.read',
	'payments.write',
	'refunds.read',
	'refunds.write',
	'onboarding.read'
].join(' ');

type Club = typeof clubs.$inferSelect;

export const mollieConfigure = () =>
	Boolean(config.mollie.clientId && config.mollie.clientSecret);

/** Montant Mollie : « 16.20 ». */
const montant = (centimes: number) => ({
	currency: 'EUR',
	value: (centimes / 100).toFixed(2)
});

/* ------------------------------------------------------------ connexion */

/**
 * Le paramètre `state` transporte l'identifiant du club jusqu'au retour de
 * Mollie. Il est signé pour que personne ne puisse relier un autre club.
 */
export function signerEtat(club_id: number): string {
	const charge = `${club_id}.${maintenant()}`;
	const signature = createHmac('sha256', config.mollie.clientSecret)
		.update(charge)
		.digest('base64url');
	return `${charge}.${signature}`;
}

export function verifierEtat(etat: string): number | null {
	const morceaux = etat.split('.');
	if (morceaux.length !== 3) return null;
	const [club_id, instant, signature] = morceaux;

	const attendue = createHmac('sha256', config.mollie.clientSecret)
		.update(`${club_id}.${instant}`)
		.digest('base64url');

	const a = Buffer.from(signature);
	const b = Buffer.from(attendue);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

	// Un aller-retour OAuth dure quelques minutes, pas une heure.
	if (maintenant() - Number(instant) > 3600) return null;

	const id = Number(club_id);
	return Number.isFinite(id) ? id : null;
}

export function urlAutorisation(etat: string, redirection: string): string {
	const p = new URLSearchParams({
		client_id: config.mollie.clientId,
		redirect_uri: redirection,
		state: etat,
		scope: PORTEE,
		response_type: 'code',
		approval_prompt: 'auto'
	});
	return `${AUTORISATION}?${p}`;
}

async function jetons(corps: Record<string, string>) {
	const reponse = await fetch(`${API}/oauth2/tokens`, {
		method: 'POST',
		headers: {
			authorization:
				'Basic ' +
				Buffer.from(`${config.mollie.clientId}:${config.mollie.clientSecret}`).toString('base64'),
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams(corps)
	});
	if (!reponse.ok) throw new Error(`Mollie OAuth ${reponse.status} : ${await reponse.text()}`);
	return (await reponse.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	};
}

/** Échange le code reçu après l'accord du club et enregistre ses jetons. */
export async function relierClub(club_id: number, code: string, redirection: string): Promise<void> {
	const reponse = await jetons({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirection
	});

	db.update(clubs)
		.set({
			mollie_jeton_acces: reponse.access_token,
			mollie_jeton_rafraichissement: reponse.refresh_token ?? null,
			mollie_expire_le: maintenant() + reponse.expires_in - 60,
			mollie_statut: 'relie'
		})
		.where(eq(clubs.id, club_id))
		.run();

	// Identifiants de l'organisation et du profil : nécessaires pour encaisser.
	try {
		const organisation = await appel<{ id: string }>(club_id, 'GET', '/v2/organizations/me');
		const profils = await appel<{ _embedded?: { profiles: { id: string; status: string }[] } }>(
			club_id,
			'GET',
			'/v2/profiles?limit=5'
		);
		const profil =
			profils._embedded?.profiles.find((p) => p.status === 'verified') ??
			profils._embedded?.profiles[0];

		db.update(clubs)
			.set({ mollie_org_id: organisation.id, mollie_profil_id: profil?.id ?? null })
			.where(eq(clubs.id, club_id))
			.run();
	} catch (erreur) {
		console.error('[mollie] organisation ou profil illisible :', erreur);
	}

	db.insert(journal)
		.values({ club_id, action: 'mollie_relie', detail: 'compte Mollie relié' })
		.run();
}

/** Le jeton d'accès du club, rafraîchi s'il est périmé. */
async function jetonDuClub(club_id: number): Promise<string> {
	const club = db.select().from(clubs).where(eq(clubs.id, club_id)).get();
	if (!club?.mollie_jeton_acces) throw new Error('Le compte Mollie de ce club n’est pas relié.');

	if (club.mollie_expire_le && club.mollie_expire_le > maintenant()) {
		return club.mollie_jeton_acces;
	}
	if (!club.mollie_jeton_rafraichissement) return club.mollie_jeton_acces;

	const reponse = await jetons({
		grant_type: 'refresh_token',
		refresh_token: club.mollie_jeton_rafraichissement
	});

	db.update(clubs)
		.set({
			mollie_jeton_acces: reponse.access_token,
			mollie_jeton_rafraichissement: reponse.refresh_token ?? club.mollie_jeton_rafraichissement,
			mollie_expire_le: maintenant() + reponse.expires_in - 60
		})
		.where(eq(clubs.id, club_id))
		.run();

	return reponse.access_token;
}

async function appel<T>(
	club_id: number,
	methode: 'GET' | 'POST',
	chemin: string,
	corps?: unknown
): Promise<T> {
	const jeton = await jetonDuClub(club_id);
	const reponse = await fetch(`${API}${chemin}`, {
		method: methode,
		headers: {
			authorization: `Bearer ${jeton}`,
			...(corps ? { 'content-type': 'application/json' } : {})
		},
		body: corps ? JSON.stringify(corps) : undefined
	});

	const texte = await reponse.text();
	if (!reponse.ok) throw new Error(`Mollie ${methode} ${chemin} → ${reponse.status} : ${texte}`);
	return texte ? (JSON.parse(texte) as T) : ({} as T);
}

/* ------------------------------------------------------------- paiements */

type Paiement = {
	id: string;
	status: string;
	_links?: { checkout?: { href: string } };
};

export type ResultatPaiement = { ok: true; url: string } | { ok: false; erreur: string };

/** Crée le paiement chez Mollie et rend l'adresse de la page de paiement. */
export async function creerPaiement(dossier: Dossier, origine: string): Promise<ResultatPaiement> {
	const { reservation, evenement } = dossier;

	if (!mollieConfigure()) {
		return { ok: false, erreur: 'Le paiement en ligne n’est pas encore configuré sur la plateforme.' };
	}

	// Les jetons et l'identifiant de profil sont lus ici : ils ne sortent jamais du serveur.
	const club = db.select().from(clubs).where(eq(clubs.id, evenement.club_id)).get();
	if (!club?.mollie_jeton_acces) {
		return { ok: false, erreur: 'Le compte Mollie de ce club n’est pas encore relié.' };
	}

	/**
	 * La commission est celle qui a été FIGÉE à la réservation quand c'est le
	 * participant qui la paie : sinon un changement de tarif entre la
	 * réservation et le paiement ferait perdre la différence au club.
	 */
	const due =
		club.frais_payes_par === 'participant'
			? reservation.frais_centimes
			: reservation.couverts * club.commission_centimes;

	// La commission ne peut pas dépasser le montant payé, et Mollie refuse 0.
	const commission = Math.min(due, Math.max(0, reservation.total_centimes - 1));

	const corps: Record<string, unknown> = {
		amount: montant(reservation.total_centimes),
		description: `${evenement.titre} — ${reservation.prenom} ${reservation.nom}`,
		redirectUrl: `${origine}/r/${reservation.token_gestion}?retour=1`,
		webhookUrl: `${origine}/api/mollie/webhook`,
		metadata: { reservation_id: reservation.id, club_id: club.id },
		locale: 'fr_BE'
	};
	if (club.mollie_profil_id) corps.profileId = club.mollie_profil_id;
	if (commission >= 1) {
		corps.applicationFee = {
			amount: montant(commission),
			description: `Frais de réservation (${reservation.couverts} couvert${reservation.couverts > 1 ? 's' : ''})`
		};
	}

	try {
		/**
		 * Si un paiement a déjà été créé pour cette réservation et qu'il est
		 * encore ouvert, on renvoie la même page. Sinon un second identifiant
		 * écraserait le premier et le webhook du premier ne retrouverait plus
		 * la réservation.
		 */
		if (reservation.mollie_paiement_id) {
			try {
				const existant = await appel<Paiement>(
					club.id,
					'GET',
					`/v2/payments/${reservation.mollie_paiement_id}`
				);
				if (existant.status === 'open' && existant._links?.checkout?.href) {
					return { ok: true, url: existant._links.checkout.href };
				}
				if (existant.status === 'paid') {
					await synchroniserPaiement(existant.id);
					return { ok: false, erreur: 'Ce paiement est déjà arrivé.' };
				}
			} catch (erreur) {
				console.error('[mollie] paiement précédent illisible :', erreur);
			}
		}

		const paiement = await appel<Paiement>(club.id, 'POST', '/v2/payments', corps);
		db.update(reservations)
			.set({ mollie_paiement_id: paiement.id })
			.where(eq(reservations.id, reservation.id))
			.run();

		const url = paiement._links?.checkout?.href;
		if (!url) return { ok: false, erreur: 'Mollie n’a pas renvoyé de page de paiement.' };
		return { ok: true, url };
	} catch (erreur) {
		console.error('[mollie] création de paiement impossible :', erreur);
		return {
			ok: false,
			erreur: 'Le paiement en ligne est momentanément indisponible. Réessayez ou choisissez un autre moyen de paiement.'
		};
	}
}

/**
 * Relit l'état d'un paiement chez Mollie et met la réservation à jour.
 * C'est l'unique endroit qui décide qu'une réservation est payée.
 */
export async function synchroniserPaiement(paiement_id: string): Promise<void> {
	const reservation = db
		.select()
		.from(reservations)
		.where(eq(reservations.mollie_paiement_id, paiement_id))
		.get();
	if (!reservation) return;

	const evenement = db.select().from(evenements).where(eq(evenements.id, reservation.evenement_id)).get();
	if (!evenement) return;

	const paiement = await appel<Paiement>(evenement.club_id, 'GET', `/v2/payments/${paiement_id}`);

	if (paiement.status === 'paid') {
		/**
		 * Uniquement depuis une réservation qui attend ou qui a expiré. Un
		 * webhook rejoué ne doit pas faire revivre une réservation annulée ni
		 * réécrire la date de paiement d'une réservation déjà payée.
		 */
		if (reservation.statut_paiement === 'en_attente' || reservation.statut_paiement === 'expire') {
			db.update(reservations)
				.set({ statut_paiement: 'paye', paye_le: maintenant(), bloque_jusqu_a: null })
				.where(eq(reservations.id, reservation.id))
				.run();
		} else if (reservation.statut_paiement === 'annule' || reservation.statut_paiement === 'rembourse') {
			console.error(
				`[mollie] paiement ${paiement_id} reçu pour la réservation ${reservation.id}, déjà ${reservation.statut_paiement} — à rembourser à la main`
			);
			db.insert(journal)
				.values({
					club_id: evenement.club_id,
					action: 'paiement_apres_annulation',
					detail: `réservation ${reservation.id}, paiement ${paiement_id} — remboursement à faire`
				})
				.run();
		}
		return;
	}

	if (['canceled', 'expired', 'failed'].includes(paiement.status)) {
		// On ne touche pas à une réservation déjà payée ou déjà annulée à la main.
		if (reservation.statut_paiement === 'en_attente') {
			db.update(reservations)
				.set({ statut_paiement: 'expire', bloque_jusqu_a: null })
				.where(eq(reservations.id, reservation.id))
				.run();
		}
	}
}

/* --------------------------------------------------------- remboursement */

export type ResultatRemboursement = { ok: boolean; erreur?: string };

/** Rembourse un paiement en ligne. Sans Mollie, l'annulation reste valable. */
export async function rembourser(dossier: Dossier): Promise<ResultatRemboursement> {
	const { reservation, club } = dossier;

	if (!reservation.mollie_paiement_id || reservation.mode_paiement !== 'en_ligne') {
		return { ok: false, erreur: 'Rien à rembourser : ce paiement n’est pas passé par Mollie.' };
	}
	if (!mollieConfigure() || !club.mollie_relie) {
		return { ok: false, erreur: 'Mollie n’est pas relié : le remboursement doit être fait à la main.' };
	}

	try {
		await appel(club.id, 'POST', `/v2/payments/${reservation.mollie_paiement_id}/refunds`, {
			amount: montant(reservation.total_centimes),
			description: `Annulation réservation ${reservation.id}`
		});

		db.update(reservations)
			.set({ statut_paiement: 'rembourse' })
			.where(eq(reservations.id, reservation.id))
			.run();

		db.insert(journal)
			.values({
				club_id: club.id,
				action: 'remboursement',
				detail: `réservation ${reservation.id} — ${(reservation.total_centimes / 100).toFixed(2)} €`
			})
			.run();

		return { ok: true };
	} catch (erreur) {
		console.error('[mollie] remboursement impossible :', erreur);
		return { ok: false, erreur: 'Le remboursement a échoué. À faire depuis le tableau de bord Mollie.' };
	}
}

/** L'état d'avancement du dossier Mollie du club (onboarding). */
export async function statutOnboarding(club: Club): Promise<string | null> {
	if (!club.mollie_jeton_acces) return null;
	try {
		const onboarding = await appel<{ status: string; canReceivePayments: boolean }>(
			club.id,
			'GET',
			'/v2/onboarding/me'
		);
		return onboarding.canReceivePayments ? 'peut_encaisser' : onboarding.status;
	} catch {
		return null;
	}
}
