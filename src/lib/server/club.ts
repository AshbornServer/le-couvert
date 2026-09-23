/**
 * Ouverture d'un espace de club.
 *
 * Un seul chemin de code, utilisé par la demande publique (automatique) et
 * par la création à la main du super-admin. Le club est ouvert tout de suite :
 * personne n'attend qu'on clique. La surveillance se fait après coup, depuis
 * `/admin`, où un club peut être suspendu.
 */
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from './db';
import { clubs, demandes_club, journal, utilisateurs } from './db/schema';
import { envoyerInvitation, normaliserEmail } from './auth';
import { mollieConfigure, signerEtat, urlAutorisation } from './mollie';
import { config } from './config';
import { slugValide, versSlug } from '$lib/slug';
import { maintenant } from '$lib/dates';

export type Demande = {
	club: string;
	ville?: string | null;
	contact: string;
	email: string;
	telephone?: string | null;
	evenement?: string | null;
};

export type Resultat =
	| { ok: true; club_id: number; slug: string }
	| { ok: false; erreur: string; deja_inscrit?: boolean };

/** Un slug libre : « fc-exemple », puis « fc-exemple-2 »… */
function slugLibre(nom: string): string {
	const racine = versSlug(nom);
	const base = slugValide(racine) ? racine : 'club';
	for (let n = 1; n < 500; n++) {
		const essai = n === 1 ? base : `${base}-${n}`;
		if (!slugValide(essai)) continue;
		const pris = db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, essai)).get();
		if (!pris) return essai;
	}
	return `club-${Date.now()}`;
}

/**
 * Garde-fou : au plus 3 ouvertures automatiques par heure et par adresse IP.
 * Assez large pour un club qui se trompe, assez serré pour éviter le remplissage
 * automatique de la base.
 */
const OUVERTURES_MAX = 3;
const ouvertures = new Map<string, number[]>();

export function tropDOuvertures(ip: string): boolean {
	const limite = Date.now() - 60 * 60 * 1000;
	const recentes = (ouvertures.get(ip) ?? []).filter((t) => t > limite);
	if (recentes.length >= OUVERTURES_MAX) {
		ouvertures.set(ip, recentes);
		return true;
	}
	recentes.push(Date.now());
	ouvertures.set(ip, recentes);
	return false;
}

/** Vide la table des tentatives : appelée par le ménage horaire. */
export function menageOuvertures(): void {
	const limite = Date.now() - 60 * 60 * 1000;
	for (const [ip, dates] of ouvertures) {
		const recentes = dates.filter((d) => d > limite);
		if (recentes.length === 0) ouvertures.delete(ip);
		else ouvertures.set(ip, recentes);
	}
}

/**
 * Ouvre l'espace, crée l'organisateur, lui envoie son accès.
 * `source` distingue une demande venue du site d'une création par le super-admin.
 */
export async function ouvrirClub(
	demande: Demande,
	origine: string,
	source: 'site' | 'superadmin',
	utilisateur_id: number | null = null
): Promise<Resultat> {
	const nom = demande.club.trim();
	const email = normaliserEmail(demande.email);
	const contact = demande.contact.trim();

	if (!nom) return { ok: false, erreur: 'Il manque le nom du club.' };
	if (!contact) return { ok: false, erreur: 'Il manque votre nom.' };
	if (!email.includes('@')) return { ok: false, erreur: 'Adresse e-mail invalide.' };

	/* Une adresse déjà organisatrice ailleurs : on ne l'arrache pas à son club. */
	const existant = db.select().from(utilisateurs).where(eq(utilisateurs.email, email)).get();
	if (existant && existant.role === 'organisateur' && existant.club_id) {
		const sien = db
			.select({ nom: clubs.nom, slug: clubs.slug })
			.from(clubs)
			.where(eq(clubs.id, existant.club_id))
			.get();
		return {
			ok: false,
			deja_inscrit: true,
			erreur: `Cette adresse est déjà l’organisatrice de « ${sien?.nom ?? 'un club'} ». Connectez-vous avec elle plutôt que de créer un second espace.`
		};
	}

	const slug = slugLibre(nom);

	const cree = db
		.insert(clubs)
		.values({ nom, slug, email_contact: email })
		.returning({ id: clubs.id })
		.get();

	/* L'invitation porte aussi le lien Mollie : le club règle tout d'un coup. */
	const lienMollie =
		mollieConfigure() && config.mollie.redirection
			? urlAutorisation(signerEtat(cree.id), config.mollie.redirection)
			: null;

	try {
		if (existant) {
			db.update(utilisateurs)
				.set({ club_id: cree.id, role: 'organisateur' })
				.where(eq(utilisateurs.id, existant.id))
				.run();
		} else {
			db.insert(utilisateurs).values({ email, role: 'organisateur', club_id: cree.id }).run();
		}
		await envoyerInvitation(email, nom, origine, lienMollie);
	} catch (erreur) {
		db.delete(clubs).where(eq(clubs.id, cree.id)).run();
		console.error('[club] ouverture annulée :', erreur);
		return {
			ok: false,
			erreur: 'L’envoi de votre accès a échoué. Réessayez dans un instant.'
		};
	}

	db.insert(demandes_club)
		.values({
			club: nom,
			ville: demande.ville?.trim() || null,
			contact,
			email,
			telephone: demande.telephone?.trim() || null,
			evenement: demande.evenement?.trim() || null,
			statut: 'traitee',
			club_cree_id: cree.id
		})
		.run();

	db.insert(journal)
		.values({
			club_id: cree.id,
			utilisateur_id,
			action: source === 'site' ? 'club_ouvert_automatiquement' : 'club_cree',
			detail: `${nom} (/${slug}) — ${contact}, ${email}`
		})
		.run();

	console.log(`[club] ${nom} ouvert (/${slug}) — accès envoyé à ${email}`);
	return { ok: true, club_id: cree.id, slug };
}

/** Les clubs ouverts depuis le site ces sept derniers jours. */
export function ouverturesRecentes() {
	const depuis = maintenant() - 7 * 24 * 60 * 60;
	return db
		.select({
			club_id: demandes_club.club_cree_id,
			contact: demandes_club.contact,
			email: demandes_club.email,
			ville: demandes_club.ville,
			evenement: demandes_club.evenement,
			cree_le: demandes_club.cree_le
		})
		.from(demandes_club)
		.where(and(gt(demandes_club.cree_le, depuis), sql`${demandes_club.club_cree_id} is not null`))
		.orderBy(sql`${demandes_club.cree_le} desc`)
		.all();
}
