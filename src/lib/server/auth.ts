import { randomBytes, createHash } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db } from './db';
import { jetons_connexion, sessions, utilisateurs, clubs } from './db/schema';
import { envoyerMail, gabaritHtml } from './mail';
import { config } from './config';
import { maintenant } from '$lib/dates';

export const COOKIE_SESSION = 'session';
const DUREE_JETON = 30 * 60; // 30 minutes
const DUREE_SESSION = 30 * 24 * 60 * 60; // 30 jours

export type Utilisateur = {
	id: number;
	email: string;
	nom: string | null;
	role: 'superadmin' | 'organisateur';
	club_id: number | null;
};

const hacher = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

export function normaliserEmail(email: string): string {
	return email.trim().toLowerCase();
}

/* ------------------------------------------------- limitation des demandes */

const demandes = new Map<string, number[]>();

/**
 * Au plus 5 demandes de lien par quart d'heure et par clé (e-mail ou IP).
 * L'appelant doit évaluer les DEUX clés, sans court-circuit : sinon une même
 * adresse IP peut tourner indéfiniment en changeant d'e-mail.
 */
export function tropDeDemandes(cle: string): boolean {
	const limite = Date.now() - 15 * 60 * 1000;
	const recentes = (demandes.get(cle) ?? []).filter((t) => t > limite);
	if (recentes.length >= 5) {
		demandes.set(cle, recentes);
		return true;
	}
	recentes.push(Date.now());
	demandes.set(cle, recentes);
	return false;
}

/** Une IP peut couvrir toute une buvette : la limite y est plus large. */
const LIMITE_IP = 20;

export function tropDeDemandesIp(ip: string): boolean {
	const cle = `ip:${ip}`;
	const limite = Date.now() - 15 * 60 * 1000;
	const recentes = (demandes.get(cle) ?? []).filter((t) => t > limite);
	if (recentes.length >= LIMITE_IP) {
		demandes.set(cle, recentes);
		return true;
	}
	recentes.push(Date.now());
	demandes.set(cle, recentes);
	return false;
}

/* --------------------------------------------------------- lien magique */

/**
 * Envoie un lien de connexion si l'adresse est connue.
 * Ne révèle jamais si l'adresse existe (réponse identique dans tous les cas).
 */
export async function envoyerLienMagique(
	emailBrut: string,
	origine: string,
	suite?: string | null
): Promise<void> {
	const email = normaliserEmail(emailBrut);
	let utilisateur = db.select().from(utilisateurs).where(eq(utilisateurs.email, email)).get();

	// Les adresses déclarées dans EMAILS_SUPERADMIN sont créées à la volée.
	if (!utilisateur && config.emailsSuperadmin.includes(email)) {
		db.insert(utilisateurs).values({ email, role: 'superadmin', club_id: null }).run();
		utilisateur = db.select().from(utilisateurs).where(eq(utilisateurs.email, email)).get();
	}
	if (!utilisateur) return;

	const jeton = randomBytes(32).toString('base64url');
	db.insert(jetons_connexion)
		.values({ jeton_hache: hacher(jeton), email, expire_le: maintenant() + DUREE_JETON })
		.run();

	const apres = suite ? `&suite=${encodeURIComponent(suite)}` : '';
	const lien = `${origine}/connexion/verifier?jeton=${jeton}${apres}`;
	const corps = `
<p style="font-size:17px">Bonjour,</p>
<p style="font-size:17px">Voici votre lien de connexion. Il est valable 30 minutes et ne fonctionne qu'une seule fois.</p>
<p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#0b6b3a;color:#fff;font-size:18px;font-weight:600;padding:14px 22px;border-radius:10px;text-decoration:none">Me connecter</a></p>
<p style="font-size:14px;color:#666">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br>${lien}</p>
<p style="font-size:14px;color:#666">Vous n'avez rien demandé ? Ignorez ce message.</p>`;

	await envoyerMail({
		a: email,
		sujet: 'Votre lien de connexion',
		texte: `Bonjour,\n\nVoici votre lien de connexion (valable 30 minutes, une seule fois) :\n\n${lien}\n\nVous n'avez rien demandé ? Ignorez ce message.`,
		html: gabaritHtml('Votre lien de connexion', corps)
	});
}

/**
 * Invitation : le tout premier message qu'un organisateur reçoit. Il n'a rien
 * demandé, donc le message doit dire d'où il vient et pourquoi.
 */
export async function envoyerInvitation(
	emailBrut: string,
	nomClub: string,
	origine: string,
	lienMollie: string | null = null
): Promise<void> {
	const email = normaliserEmail(emailBrut);
	const jeton = randomBytes(32).toString('base64url');
	db.insert(jetons_connexion)
		.values({ jeton_hache: hacher(jeton), email, expire_le: maintenant() + DUREE_JETON })
		.run();

	const lien = `${origine}/connexion/verifier?jeton=${jeton}`;
	const corps = `
<p style="font-size:17px">Bonjour,</p>
<p style="font-size:17px">
	Le site de réservation des soupers de <strong>${nomClub}</strong> est prêt, et vous en êtes
	l’organisateur.
</p>
<p style="font-size:17px">Pas de mot de passe à retenir : ce bouton vous connecte directement.</p>
<p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#0b6b3a;color:#fff;font-size:18px;font-weight:600;padding:14px 22px;border-radius:10px;text-decoration:none">Ouvrir mon espace</a></p>
<p style="font-size:15px;color:#666">
	Ce lien est valable 30 minutes. Passé ce délai, demandez-en un nouveau sur
	<a href="${origine}/connexion">${origine}/connexion</a> avec cette même adresse.
</p>
${
	lienMollie
		? `<p style="font-size:17px;margin-top:24px;padding-top:18px;border-top:1px solid #ded9cf">
	<strong>Pour encaisser en ligne</strong><br />
	Si vous voulez que les gens puissent payer par Bancontact, reliez le compte
	bancaire du club en une fois :
	<a href="${lienMollie}">relier notre compte</a>.<br />
	<span style="font-size:15px;color:#666">Ce n'est pas obligatoire : sans ça, les
	réservations se paient sur place ou par virement.</span>
</p>`
		: ''
}`;

	await envoyerMail({
		a: email,
		sujet: `${nomClub} — votre accès aux réservations`,
		texte: `Bonjour,\n\nLe site de réservation des soupers de ${nomClub} est prêt, et vous en êtes l'organisateur.\n\nPas de mot de passe à retenir, ce lien vous connecte directement (valable 30 minutes) :\n\n${lien}\n\nPassé ce délai, demandez-en un nouveau sur ${origine}/connexion avec cette même adresse.${lienMollie ? `\n\nPour encaisser en ligne (facultatif), reliez le compte du club :\n${lienMollie}` : ''}`,
		html: gabaritHtml(`${nomClub} — vos réservations`, corps)
	});
}

/** Consomme un jeton et ouvre une session. Rend null si le jeton est invalide. */
export function consommerJeton(jeton: string, cookies: Cookies): Utilisateur | null {
	const hache = hacher(jeton);
	const ligne = db.select().from(jetons_connexion).where(eq(jetons_connexion.jeton_hache, hache)).get();
	if (!ligne) return null;

	if (ligne.utilise_le !== null) return null;
	if (ligne.expire_le < maintenant()) return null;

	db.update(jetons_connexion)
		.set({ utilise_le: maintenant() })
		.where(eq(jetons_connexion.id, ligne.id))
		.run();

	const utilisateur = db.select().from(utilisateurs).where(eq(utilisateurs.email, ligne.email)).get();
	if (!utilisateur) return null;

	ouvrirSession(utilisateur.id, cookies);
	db.update(utilisateurs)
		.set({ derniere_connexion_le: maintenant() })
		.where(eq(utilisateurs.id, utilisateur.id))
		.run();

	return {
		id: utilisateur.id,
		email: utilisateur.email,
		nom: utilisateur.nom,
		role: utilisateur.role,
		club_id: utilisateur.club_id
	};
}

export function ouvrirSession(utilisateur_id: number, cookies: Cookies): void {
	const id = randomBytes(32).toString('base64url');
	db.insert(sessions).values({ id, utilisateur_id, expire_le: maintenant() + DUREE_SESSION }).run();
	cookies.set(COOKIE_SESSION, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: config.production,
		maxAge: DUREE_SESSION
	});
}

export function lireSession(cookies: Cookies): Utilisateur | null {
	const id = cookies.get(COOKIE_SESSION);
	if (!id) return null;

	const ligne = db
		.select({
			expire_le: sessions.expire_le,
			id: utilisateurs.id,
			email: utilisateurs.email,
			nom: utilisateurs.nom,
			role: utilisateurs.role,
			club_id: utilisateurs.club_id
		})
		.from(sessions)
		.innerJoin(utilisateurs, eq(utilisateurs.id, sessions.utilisateur_id))
		.where(eq(sessions.id, id))
		.get();

	if (!ligne) return null;
	if (ligne.expire_le < maintenant()) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	const { expire_le, ...utilisateur } = ligne;
	return utilisateur;
}

export function fermerSession(cookies: Cookies): void {
	const id = cookies.get(COOKIE_SESSION);
	if (id) db.delete(sessions).where(eq(sessions.id, id)).run();
	cookies.delete(COOKIE_SESSION, { path: '/' });
}

/** Ménage : jetons expirés et sessions périmées. */
export function menageAuth(): void {
	// La table des demandes ne doit pas grossir indéfiniment.
	const limite = Date.now() - 15 * 60 * 1000;
	for (const [cle, dates] of demandes) {
		const recentes = dates.filter((d) => d > limite);
		if (recentes.length === 0) demandes.delete(cle);
		else demandes.set(cle, recentes);
	}

	const t = maintenant();
	db.delete(sessions).where(lt(sessions.expire_le, t)).run();
	db.delete(jetons_connexion).where(and(lt(jetons_connexion.expire_le, t), isNull(jetons_connexion.utilise_le))).run();
}

/* ----------------------------------------------------------- invitations */

/** Crée (ou retrouve) un organisateur pour un club et lui envoie son lien. */
export async function inviterOrganisateur(
	emailBrut: string,
	club_id: number,
	origine: string
): Promise<{ cree: boolean; email: string }> {
	const email = normaliserEmail(emailBrut);
	const existant = db.select().from(utilisateurs).where(eq(utilisateurs.email, email)).get();

	if (existant && existant.club_id !== club_id && existant.role !== 'superadmin') {
		throw new Error('Cette adresse est déjà rattachée à un autre club.');
	}
	if (!existant) {
		db.insert(utilisateurs).values({ email, role: 'organisateur', club_id }).run();
	}

	const club = db.select({ nom: clubs.nom }).from(clubs).where(eq(clubs.id, club_id)).get();
	await envoyerInvitation(email, club?.nom ?? 'votre club', origine);
	return { cree: !existant, email };
}
