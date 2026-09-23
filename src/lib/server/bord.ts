/**
 * Les chiffres du tableau de bord.
 *
 * Les agrégats sont écrits en SQL direct : c'est plus lisible qu'un empilement
 * de sous-requêtes, et ça reste rapide même avec des milliers de réservations.
 */
import { sqlite } from './db';
import { conditionOccupe } from './places';

/**
 * « Cette personne vient » : exactement la même règle que le comptage des
 * places (`places.ts`). Un paiement en ligne abandonné (`expire`) ne vient
 * plus : il est rangé avec les annulations, partout.
 */
const VIENT = conditionOccupe('r');
const NE_VIENT_PLUS = `r.statut_paiement in ('annule','rembourse','expire')`;

export type Chiffres = {
	reservations: number;
	couverts: number;
	/** Ce qui arrive vraiment sur le compte du club : frais de réservation déduits. */
	encaisse_centimes: number;
	frais_centimes: number;
	attendu_centimes: number;
	a_payer: number;
	annulees: number;
	scannes: number;
};

export function chiffres(evenement_id: number): Chiffres {
	const ligne = sqlite
		.prepare(
			`select
				count(*) filter (where ${VIENT})                                as reservations,
				coalesce(sum(r.couverts) filter (where ${VIENT}), 0)            as couverts,
				coalesce(sum(r.total_centimes - r.frais_centimes) filter (where r.statut_paiement = 'paye'), 0) as encaisse_centimes,
				coalesce(sum(r.frais_centimes) filter (where r.statut_paiement = 'paye'), 0) as frais_centimes,
				coalesce(sum(r.total_centimes) filter (where r.statut_paiement = 'en_attente' and ${VIENT}), 0) as attendu_centimes,
				count(*) filter (where r.statut_paiement = 'en_attente' and ${VIENT}) as a_payer,
				count(*) filter (where ${NE_VIENT_PLUS})                       as annulees,
				(select count(*) from tickets t
				  join reservations r2 on r2.id = t.reservation_id
				 where r2.evenement_id = @id and t.scanne_le is not null)       as scannes
			 from reservations r
			where r.evenement_id = @id`
		)
		.get({ id: evenement_id }) as Chiffres;
	return ligne;
}

/* ------------------------------------------------------------ récap cuisine */

export type LigneCuisine = {
	nom: string;
	categorie: string;
	ordre: number;
	total: number;
	par_service: Record<number, number>;
};

export type RecapCuisine = {
	services: { id: number; libelle: string; heure: string | null; couverts: number }[];
	lignes: LigneCuisine[];
	couverts_total: number;
};

export function recapCuisine(evenement_id: number): RecapCuisine {
	const services = sqlite
		.prepare(
			`select s.id, s.libelle, s.heure,
					coalesce((select sum(r.couverts) from reservations r
							   where r.service_id = s.id and ${VIENT}), 0) as couverts
			   from services s
			  where s.evenement_id = ?
			  order by s.ordre, s.id`
		)
		.all(evenement_id) as RecapCuisine['services'];

	const brut = sqlite
		.prepare(
			`select lm.nom, lm.categorie, lm.ordre,
					r.service_id,
					sum(rl.quantite) as quantite
			   from reservation_lignes rl
			   join reservations r  on r.id = rl.reservation_id
			   join lignes_menu lm on lm.id = rl.ligne_menu_id
			  where r.evenement_id = ? and ${VIENT}
			  group by lm.id, r.service_id
			  order by lm.ordre, lm.id`
		)
		.all(evenement_id) as {
		nom: string;
		categorie: string;
		ordre: number;
		service_id: number | null;
		quantite: number;
	}[];

	const parNom = new Map<string, LigneCuisine>();
	for (const b of brut) {
		let ligne = parNom.get(b.nom);
		if (!ligne) {
			ligne = { nom: b.nom, categorie: b.categorie, ordre: b.ordre, total: 0, par_service: {} };
			parNom.set(b.nom, ligne);
		}
		ligne.total += b.quantite;
		if (b.service_id !== null) {
			ligne.par_service[b.service_id] = (ligne.par_service[b.service_id] ?? 0) + b.quantite;
		}
	}

	const couverts = sqlite
		.prepare(`select coalesce(sum(r.couverts), 0) as n from reservations r where r.evenement_id = ? and ${VIENT}`)
		.get(evenement_id) as { n: number };

	return {
		services,
		lignes: [...parNom.values()].sort((a, b) => a.ordre - b.ordre),
		couverts_total: couverts.n
	};
}

/* --------------------------------------------------------- liste et filtres */

export type Filtres = {
	recherche?: string;
	statut?: 'tous' | 'paye' | 'a_payer' | 'annule';
	service_id?: number | null;
};

export type LigneListe = {
	id: number;
	nom: string;
	prenom: string;
	email: string | null;
	telephone: string | null;
	couverts: number;
	total_centimes: number;
	statut_paiement: string;
	mode_paiement: string;
	communication_structuree: string | null;
	source: string;
	service_libelle: string | null;
	token_gestion: string;
	cree_le: number;
	scanne_le: number | null;
	commande: string;
	remarques: string | null;
};

export function listeReservations(evenement_id: number, filtres: Filtres = {}): LigneListe[] {
	const conditions: string[] = ['r.evenement_id = @id'];
	const valeurs: Record<string, unknown> = { id: evenement_id };

	if (filtres.recherche?.trim()) {
		conditions.push(`(
			lower(r.nom) like @recherche or lower(r.prenom) like @recherche
			or lower(coalesce(r.email, '')) like @recherche
			or replace(coalesce(r.communication_structuree, ''), ' ', '') like @recherche
		)`);
		valeurs.recherche = `%${filtres.recherche.trim().toLowerCase()}%`;
	}

	if (filtres.statut === 'paye') conditions.push(`r.statut_paiement = 'paye'`);
	else if (filtres.statut === 'a_payer') conditions.push(`r.statut_paiement = 'en_attente' and ${VIENT}`);
	else if (filtres.statut === 'annule') conditions.push(NE_VIENT_PLUS);
	else conditions.push(`(${VIENT} or ${NE_VIENT_PLUS})`);

	if (filtres.service_id) {
		conditions.push('r.service_id = @service_id');
		valeurs.service_id = filtres.service_id;
	}

	return sqlite
		.prepare(
			`select r.id, r.nom, r.prenom, r.email, r.telephone, r.couverts, r.total_centimes,
					r.statut_paiement, r.mode_paiement, r.communication_structuree, r.source,
					r.token_gestion, r.cree_le,
					s.libelle as service_libelle,
					t.scanne_le,
					(select group_concat(rl.quantite || ' × ' || rl.nom, ', ')
					   from reservation_lignes rl where rl.reservation_id = r.id) as commande,
					(select group_concat(ro.libelle || ' : ' || ro.valeur, ' | ')
					   from reservation_options ro where ro.reservation_id = r.id) as remarques
			   from reservations r
			   left join services s on s.id = r.service_id
			   left join tickets  t on t.reservation_id = r.id
			  where ${conditions.join(' and ')}
			  order by lower(r.nom), lower(r.prenom)`
		)
		.all(valeurs) as LigneListe[];
}

/** Les virements encore attendus, pour le rapprochement bancaire. */
export function virementsAttendus(evenement_id: number) {
	return sqlite
		.prepare(
			`select r.id, r.nom, r.prenom, r.total_centimes, r.communication_structuree
			   from reservations r
			  where r.evenement_id = ?
				and r.mode_paiement = 'virement'
				and r.statut_paiement = 'en_attente'
			  order by lower(r.nom)`
		)
		.all(evenement_id) as {
		id: number;
		nom: string;
		prenom: string;
		total_centimes: number;
		communication_structuree: string | null;
	}[];
}
