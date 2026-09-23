import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clubs, journal } from '$lib/server/db/schema';
import { exigerSuperadmin } from '$lib/server/evenement';
import { ouverturesRecentes } from '$lib/server/club';
import { lancerRappels } from '$lib/server/rappels';
import { lancerMenageRgpd } from '$lib/server/rgpd';
import { libererBlocagesExpires } from '$lib/server/places';
import { maintenant } from '$lib/dates';

/** Premier jour du mois courant, en secondes. */
function debutDuMois(): number {
	const d = new Date();
	return Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000);
}

const COMMISSION = `case when clubs.frais_payes_par = 'participant'
	then r.frais_centimes
	else r.couverts * clubs.commission_centimes end`;

export const load: PageServerLoad = () => {
	const debut = debutDuMois();

	const liste = db
		.select({
			id: clubs.id,
			slug: clubs.slug,
			nom: clubs.nom,
			actif: clubs.actif,
			cree_le: clubs.cree_le,
			mollie_statut: clubs.mollie_statut,
			commission_centimes: clubs.commission_centimes,
			frais_payes_par: clubs.frais_payes_par,
			evenements: sql<number>`(select count(*) from evenements e where e.club_id = clubs.id)`,
			publies: sql<number>`(select count(*) from evenements e where e.club_id = clubs.id and e.statut = 'publie')`,
			couverts: sql<number>`coalesce((
				select sum(r.couverts) from reservations r
				 join evenements e on e.id = r.evenement_id
				where e.club_id = clubs.id and r.statut_paiement = 'paye'
			), 0)`,
			commissions_mois: sql<number>`coalesce((
				select sum(${sql.raw(COMMISSION)})
				  from reservations r
				  join evenements e on e.id = r.evenement_id
				 where e.club_id = clubs.id and r.statut_paiement = 'paye' and r.paye_le >= ${debut}
			), 0)`
		})
		.from(clubs)
		.orderBy(sql`${clubs.cree_le} desc`)
		.all();

	/* Qui a ouvert son espace tout seul, et quand. */
	const recentes = new Map(ouverturesRecentes().map((o) => [o.club_id, o]));

	return {
		clubs: liste.map((c) => ({ ...c, venuDuSite: recentes.get(c.id) ?? null })),
		totalCommissions: liste.reduce((s, c) => s + Number(c.commissions_mois), 0),
		totalCouverts: liste.reduce((s, c) => s + Number(c.couverts), 0),
		nouveauxCetteSemaine: recentes.size
	};
};

export const actions: Actions = {
	/** Suspendre un club : sa page publique et son espace ferment aussitôt. */
	suspendre: async ({ request, locals }) => {
		exigerSuperadmin(locals);
		const d = await request.formData();
		const id = Number(d.get('club_id'));
		const actif = String(d.get('actif')) === 'oui';

		const club = db.select().from(clubs).where(eq(clubs.id, id)).get();
		if (!club) return fail(404, { erreur: 'Club introuvable.' });

		db.update(clubs).set({ actif }).where(eq(clubs.id, id)).run();
		db.insert(journal)
			.values({
				club_id: id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: actif ? 'club_reactive' : 'club_suspendu',
				detail: club.nom
			})
			.run();

		return {
			ok: actif ? `${club.nom} est réactivé.` : `${club.nom} est suspendu : son espace est fermé.`
		};
	},

	/** Relance les tâches de fond sans attendre l'heure suivante. */
	taches: async ({ locals }) => {
		exigerSuperadmin(locals);
		const liberes = libererBlocagesExpires();
		lancerMenageRgpd();
		const bilan = await lancerRappels();
		void maintenant();
		return {
			ok: `${bilan.rappels} rappel(s) envoyé(s), ${bilan.recaps} récapitulatif(s) aux organisateurs, ${bilan.termines} événement(s) clôturé(s), ${liberes} blocage(s) de paiement libéré(s).`
		};
	}
};
