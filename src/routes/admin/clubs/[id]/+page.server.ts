import { error, fail, redirect } from '@sveltejs/kit';
import { eq, and, sql } from 'drizzle-orm';
import { origine } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';
import { db, sqlite } from '$lib/server/db';
import { clubs, evenements, utilisateurs, journal } from '$lib/server/db/schema';
import { inviterOrganisateur } from '$lib/server/auth';
import { exigerSuperadmin } from '$lib/server/evenement';
import { versSlug, slugValide } from '$lib/slug';
import { centimes } from '$lib/argent';
import { enregistrerImage, supprimerImage } from '$lib/server/televersement';
import {
	mollieConfigure,
	signerEtat,
	statutOnboarding,
	urlAutorisation
} from '$lib/server/mollie';
import { config } from '$lib/server/config';

function lireClub(id: number) {
	const club = db.select().from(clubs).where(eq(clubs.id, id)).get();
	if (!club) error(404, 'Club inconnu.');
	return club;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const club = lireClub(Number(params.id));

	const organisateurs = db
		.select({
			id: utilisateurs.id,
			email: utilisateurs.email,
			derniere_connexion_le: utilisateurs.derniere_connexion_le
		})
		.from(utilisateurs)
		.where(and(eq(utilisateurs.club_id, club.id), eq(utilisateurs.role, 'organisateur')))
		.orderBy(utilisateurs.email)
		.all();

	const listeEvenements = db
		.select({
			id: evenements.id,
			slug: evenements.slug,
			titre: evenements.titre,
			date: evenements.date,
			statut: evenements.statut,
			couverts: sql<number>`coalesce((
				select sum(r.couverts) from reservations r
				where r.evenement_id = evenements.id and r.statut_paiement = 'paye'
			), 0)`,
			commissions: sql<number>`coalesce((
				select sum(r.frais_centimes) from reservations r
				where r.evenement_id = evenements.id and r.statut_paiement = 'paye'
			), 0)`
		})
		.from(evenements)
		.where(eq(evenements.club_id, club.id))
		.orderBy(sql`${evenements.date} desc`)
		.all();

	/* Le club, sans ses jetons Mollie : ce bloc part dans le HTML de la page. */
	const { mollie_jeton_acces, mollie_jeton_rafraichissement, ...clubAffichable } = club;

	const aPublie = listeEvenements.some((e) => e.statut !== 'brouillon');

	return {
		club: clubAffichable,
		slugVerrouille: aPublie,
		organisateurs,
		evenements: listeEvenements,
		cree: url.searchParams.has('cree'),
		mollie: url.searchParams.get('mollie'),
		mollieRelie: Boolean(mollie_jeton_acces),
		mollieConfigure: mollieConfigure(),
		mollieOnboarding: await statutOnboarding(club)
	};
};

export const actions: Actions = {
	/* ------------------------------------------------------------ réglages */
	reglages: async ({ request, params, locals }) => {
		exigerSuperadmin(locals);
		const club = lireClub(Number(params.id));
		const d = await request.formData();

		const nom = String(d.get('nom') ?? '').trim();
		const slug = versSlug(String(d.get('slug') ?? ''));
		const couleur = String(d.get('couleur') ?? club.couleur);
		const commissionSaisie = String(d.get('commission') ?? '').trim();
		const commission = centimes(commissionSaisie);
		const frais_payes_par = d.get('frais_payes_par') === 'club' ? 'club' : 'participant';
		const actif = d.get('actif') === 'oui';

		if (!nom) return fail(400, { erreur: 'Le nom du club est obligatoire.' });
		if (commissionSaisie === '' || (commission === 0 && !/^0([.,]0*)?$/.test(commissionSaisie))) {
			return fail(400, {
				erreur: 'Commission illisible. Écrivez un montant en euros, par exemple 0,20.'
			});
		}
		if (!slugValide(slug)) return fail(400, { erreur: 'Adresse du club invalide ou réservée.' });

		const prise = db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, slug)).get();
		if (prise && prise.id !== club.id) {
			return fail(400, { erreur: `L’adresse « /${slug} » est déjà prise.` });
		}

		/* Des affiches et des QR codes portent cette adresse : on ne la change
		   plus dès qu'un événement est sorti. */
		if (slug !== club.slug) {
			const publie = db
				.select({ id: evenements.id })
				.from(evenements)
				.where(and(eq(evenements.club_id, club.id), sql`${evenements.statut} <> 'brouillon'`))
				.get();
			if (publie) {
				return fail(400, {
					erreur:
						'Des affiches et des QR codes portent déjà cette adresse : elle ne peut plus changer.'
				});
			}
		}

		const logo = await enregistrerImage(d.get('logo'));
		if (!logo.ok) return fail(400, { erreur: logo.erreur });
		if (logo.chemin) supprimerImage(club.logo);

		db.update(clubs)
			.set({
				nom,
				slug,
				couleur,
				commission_centimes: commission,
				frais_payes_par,
				actif,
				...(logo.chemin ? { logo: logo.chemin } : {})
			})
			.where(eq(clubs.id, club.id))
			.run();

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'club_modifie',
				detail: `commission ${commission} c, frais ${frais_payes_par}, actif ${actif}`
			})
			.run();

		return { ok: 'Réglages enregistrés.' };
	},

	/* ---------------------------------------------------------------- Mollie */
	/**
	 * Le lien d'autorisation Mollie. C'est le CLUB qui doit accepter, depuis son
	 * propre compte : on fabrique donc un lien à lui transmettre, plutôt que
	 * d'envoyer le super-admin sur un écran qui ne le concerne pas.
	 */
	mollie: ({ params, locals }) => {
		exigerSuperadmin(locals);
		const club = lireClub(Number(params.id));
		if (!mollieConfigure()) {
			return fail(400, {
				erreur:
					'MOLLIE_CLIENT_ID et MOLLIE_CLIENT_SECRET ne sont pas renseignés dans le fichier .env.'
			});
		}

		db.update(clubs).set({ mollie_statut: 'en_attente' }).where(eq(clubs.id, club.id)).run();
		return {
			lienMollie: urlAutorisation(signerEtat(club.id), config.mollie.redirection),
			ok: 'Lien créé. Transmettez-le au club : valable 24 heures.'
		};
	},

	mollie_delier: async ({ params, locals, request }) => {
		exigerSuperadmin(locals);
		const club = lireClub(Number(params.id));
		if (String((await request.formData()).get('confirme')) !== 'oui') {
			return fail(400, { erreur: 'Confirmation manquante.' });
		}
		db.update(clubs)
			.set({
				mollie_jeton_acces: null,
				mollie_jeton_rafraichissement: null,
				mollie_expire_le: null,
				mollie_org_id: null,
				mollie_profil_id: null,
				mollie_statut: 'non_relie'
			})
			.where(eq(clubs.id, club.id))
			.run();

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'mollie_delie',
				detail: club.nom
			})
			.run();

		return { ok: 'Compte Mollie détaché.' };
	},

	/* --------------------------------------------------------- organisateurs */
	inviter: async ({ request, params, url, locals }) => {
		exigerSuperadmin(locals);
		const club = lireClub(Number(params.id));
		const email = String((await request.formData()).get('email') ?? '').trim();
		if (!email.includes('@')) return fail(400, { erreur: 'Adresse e-mail invalide.' });

		try {
			await inviterOrganisateur(email, club.id, origine(url));
		} catch (erreur) {
			return fail(400, { erreur: (erreur as Error).message });
		}
		return { ok: `Invitation envoyée à ${email}.` };
	},

	retirer: async ({ request, params, locals }) => {
		exigerSuperadmin(locals);
		const club = lireClub(Number(params.id));
		const d = await request.formData();
		if (String(d.get('confirme')) !== 'oui') {
			return fail(400, { erreur: 'Confirmation manquante.' });
		}
		const id = Number(d.get('utilisateur_id'));

		const restants = db
			.select({ n: sql<number>`count(*)` })
			.from(utilisateurs)
			.where(and(eq(utilisateurs.club_id, club.id), eq(utilisateurs.role, 'organisateur')))
			.get();
		if ((restants?.n ?? 0) <= 1) {
			return fail(400, { erreur: 'Impossible : le club doit garder au moins un organisateur.' });
		}

		db.delete(utilisateurs)
			.where(and(eq(utilisateurs.id, id), eq(utilisateurs.club_id, club.id)))
			.run();
		return { ok: 'Organisateur retiré.' };
	},

	/* ------------------------------------------------------------ suppression */
	supprimer: async ({ request, params, locals }) => {
		exigerSuperadmin(locals);
		const club = lireClub(Number(params.id));
		const confirmation = String((await request.formData()).get('confirmation') ?? '').trim();

		if (confirmation !== club.slug) {
			return fail(400, {
				erreur: `Pour supprimer, recopiez exactement « ${club.slug} » dans le champ de confirmation.`
			});
		}

		const couverts = sqlite
			.prepare(
				`select coalesce(sum(r.couverts), 0) as n
				   from reservations r
				   join evenements e on e.id = r.evenement_id
				  where e.club_id = ? and r.statut_paiement = 'paye'`
			)
			.get(club.id) as { n: number };

		supprimerImage(club.logo);
		db.delete(clubs).where(eq(clubs.id, club.id)).run();

		db.insert(journal)
			.values({
				club_id: null,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'club_supprime',
				detail: `${club.nom} (/${club.slug}) — ${couverts.n} couverts payés effacés`
			})
			.run();

		redirect(303, '/admin');
	}
};
