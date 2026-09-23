import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clubs, demandes_club, journal } from '$lib/server/db/schema';
import { inviterOrganisateur } from '$lib/server/auth';
import { origine } from '$lib/server/config';
import { exigerSuperadmin } from '$lib/server/evenement';
import { lancerRappels } from '$lib/server/rappels';
import { lancerMenageRgpd } from '$lib/server/rgpd';
import { libererBlocagesExpires } from '$lib/server/places';
import { slugValide, versSlug } from '$lib/slug';

/** Premier jour du mois courant, en secondes. */
function debutDuMois(): number {
	const d = new Date();
	return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

export const load: PageServerLoad = () => {
	const debut = debutDuMois();

	const liste = db
		.select({
			id: clubs.id,
			slug: clubs.slug,
			nom: clubs.nom,
			actif: clubs.actif,
			mollie_statut: clubs.mollie_statut,
			commission_centimes: clubs.commission_centimes,
			frais_payes_par: clubs.frais_payes_par,
			evenements: sql<number>`(select count(*) from evenements e where e.club_id = clubs.id)`,
			couverts: sql<number>`coalesce((
				select sum(r.couverts) from reservations r
				join evenements e on e.id = r.evenement_id
				where e.club_id = clubs.id and r.statut_paiement = 'paye'
			), 0)`,
			/* Ce que la plateforme prélève vraiment : quand le club prend les frais
			   en charge, `frais_centimes` reste à 0 mais l'applicationFee est bien
			   retenue par Mollie. */
			commissions_mois: sql<number>`coalesce((
				select sum(case when clubs.frais_payes_par = 'participant'
						 then r.frais_centimes
						 else r.couverts * clubs.commission_centimes end)
				  from reservations r
				  join evenements e on e.id = r.evenement_id
				 where e.club_id = clubs.id and r.statut_paiement = 'paye' and r.paye_le >= ${debut}
			), 0)`
		})
		.from(clubs)
		.orderBy(clubs.nom)
		.all();

	const totalCommissions = liste.reduce((s, c) => s + Number(c.commissions_mois), 0);
	const totalCouverts = liste.reduce((s, c) => s + Number(c.couverts), 0);

	/* Les clubs qui ont demandé leur espace depuis la page d'accueil. */
	const demandes = db
		.select()
		.from(demandes_club)
		.where(eq(demandes_club.statut, 'nouvelle'))
		.orderBy(demandes_club.cree_le)
		.all();

	return { clubs: liste, totalCommissions, totalCouverts, demandes };
};

export const actions: Actions = {
	/** Un clic : le club est ouvert et son organisateur reçoit son accès. */
	ouvrir_demande: async ({ request, locals, url }) => {
		exigerSuperadmin(locals);
		const id = Number((await request.formData()).get('demande_id'));
		const demande = db.select().from(demandes_club).where(eq(demandes_club.id, id)).get();
		if (!demande) return fail(404, { erreur: 'Demande introuvable.' });

		let slug = versSlug(demande.club);
		if (!slugValide(slug)) slug = `club-${demande.id}`;
		for (let n = 2; db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, slug)).get(); n++) {
			slug = `${versSlug(demande.club)}-${n}`;
		}

		const cree = db
			.insert(clubs)
			.values({ nom: demande.club, slug, email_contact: demande.email })
			.returning({ id: clubs.id })
			.get();

		try {
			await inviterOrganisateur(demande.email, cree.id, origine(url));
		} catch (erreur) {
			db.delete(clubs).where(eq(clubs.id, cree.id)).run();
			return fail(400, { erreur: (erreur as Error).message });
		}

		db.update(demandes_club)
			.set({ statut: 'traitee', club_cree_id: cree.id })
			.where(eq(demandes_club.id, id))
			.run();

		db.insert(journal)
			.values({
				club_id: cree.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'club_cree',
				detail: `${demande.club} (/${slug}) depuis une demande du site`
			})
			.run();

		return { ok: `${demande.club} est ouvert. ${demande.contact} a reçu son accès.` };
	},

	refuser_demande: async ({ request, locals }) => {
		exigerSuperadmin(locals);
		const id = Number((await request.formData()).get('demande_id'));
		db.update(demandes_club).set({ statut: 'refusee' }).where(eq(demandes_club.id, id)).run();
		return { ok: 'Demande écartée.' };
	},

	/** Relance les tâches de fond sans attendre l'heure suivante. */
	taches: async () => {
		const liberes = libererBlocagesExpires();
		lancerMenageRgpd();
		const bilan = await lancerRappels();
		return {
			ok: `${bilan.rappels} rappel(s) envoyé(s), ${bilan.recaps} récapitulatif(s) aux organisateurs, ${bilan.termines} événement(s) clôturé(s), ${liberes} blocage(s) de paiement libéré(s).`
		};
	}
};
