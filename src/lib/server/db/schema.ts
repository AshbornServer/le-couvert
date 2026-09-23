import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/** Horodatage : secondes depuis 1970 (entier). */
const cree_le = () => integer('cree_le').notNull().default(sql`(unixepoch())`);

/* ------------------------------------------------------------------ clubs */

export const clubs = sqliteTable(
	'clubs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		slug: text('slug').notNull(),
		nom: text('nom').notNull(),
		logo: text('logo'),
		couleur: text('couleur').notNull().default('#0b6b3a'),
		email_contact: text('email_contact'),

		/* Mollie Connect (étape 4) */
		mollie_org_id: text('mollie_org_id'),
		mollie_profil_id: text('mollie_profil_id'),
		mollie_jeton_acces: text('mollie_jeton_acces'),
		mollie_jeton_rafraichissement: text('mollie_jeton_rafraichissement'),
		mollie_expire_le: integer('mollie_expire_le'),
		mollie_statut: text('mollie_statut', {
			enum: ['non_relie', 'en_attente', 'relie', 'erreur']
		})
			.notNull()
			.default('non_relie'),

		/* Commission de la plateforme */
		commission_centimes: integer('commission_centimes').notNull().default(20),
		frais_payes_par: text('frais_payes_par', { enum: ['participant', 'club'] })
			.notNull()
			.default('participant'),

		actif: integer('actif', { mode: 'boolean' }).notNull().default(true),
		cree_le: cree_le()
	},
	(t) => [uniqueIndex('clubs_slug_unique').on(t.slug)]
);

/* ----------------------------------------------------------- utilisateurs */

export const utilisateurs = sqliteTable(
	'utilisateurs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		email: text('email').notNull(),
		nom: text('nom'),
		club_id: integer('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['superadmin', 'organisateur'] }).notNull(),
		derniere_connexion_le: integer('derniere_connexion_le'),
		cree_le: cree_le()
	},
	(t) => [uniqueIndex('utilisateurs_email_unique').on(t.email), index('utilisateurs_club').on(t.club_id)]
);

/** Lien magique : un jeton à usage unique, valable 30 minutes. */
export const jetons_connexion = sqliteTable(
	'jetons_connexion',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		jeton_hache: text('jeton_hache').notNull(),
		email: text('email').notNull(),
		expire_le: integer('expire_le').notNull(),
		utilise_le: integer('utilise_le'),
		cree_le: cree_le()
	},
	(t) => [uniqueIndex('jetons_connexion_unique').on(t.jeton_hache)]
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		utilisateur_id: integer('utilisateur_id')
			.notNull()
			.references(() => utilisateurs.id, { onDelete: 'cascade' }),
		expire_le: integer('expire_le').notNull(),
		cree_le: cree_le()
	},
	(t) => [index('sessions_utilisateur').on(t.utilisateur_id)]
);

/* ------------------------------------------------------------- evenements */

export const evenements = sqliteTable(
	'evenements',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		club_id: integer('club_id')
			.notNull()
			.references(() => clubs.id, { onDelete: 'cascade' }),
		slug: text('slug').notNull(),
		titre: text('titre').notNull().default(''),

		/* L'essentiel */
		date: text('date'), // 'AAAA-MM-JJ'
		heure_debut: text('heure_debut'), // 'HH:MM'
		lieu_nom: text('lieu_nom'),
		lieu_adresse: text('lieu_adresse'),
		image: text('image'),

		/* Réservation */
		capacite: integer('capacite'),
		date_limite: text('date_limite'), // 'AAAA-MM-JJTHH:MM'
		paiement_en_ligne: integer('paiement_en_ligne', { mode: 'boolean' }).notNull().default(false),
		paiement_sur_place: integer('paiement_sur_place', { mode: 'boolean' }).notNull().default(true),
		paiement_virement: integer('paiement_virement', { mode: 'boolean' }).notNull().default(false),
		iban: text('iban'),

		/* Apparence et textes */
		couleur: text('couleur'),
		logo: text('logo'),
		texte_accueil: text('texte_accueil'),
		texte_confirmation: text('texte_confirmation'),

		statut: text('statut', { enum: ['brouillon', 'publie', 'termine'] })
			.notNull()
			.default('brouillon'),
		publie_le: integer('publie_le'),
		cree_le: cree_le(),
		modifie_le: integer('modifie_le')
			.notNull()
			.default(sql`(unixepoch())`),

		/* Rappels et récapitulatif du matin */
		recap_envoye_le: integer('recap_envoye_le'),

		/* RGPD : purge des données participants */
		purge_le: integer('purge_le')
	},
	(t) => [
		uniqueIndex('evenements_club_slug_unique').on(t.club_id, t.slug),
		index('evenements_club').on(t.club_id)
	]
);

export const services = sqliteTable(
	'services',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		evenement_id: integer('evenement_id')
			.notNull()
			.references(() => evenements.id, { onDelete: 'cascade' }),
		libelle: text('libelle').notNull(),
		heure: text('heure'),
		capacite: integer('capacite'),
		ordre: integer('ordre').notNull().default(0)
	},
	(t) => [index('services_evenement').on(t.evenement_id)]
);

export const lignes_menu = sqliteTable(
	'lignes_menu',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		evenement_id: integer('evenement_id')
			.notNull()
			.references(() => evenements.id, { onDelete: 'cascade' }),
		nom: text('nom').notNull(),
		prix_centimes: integer('prix_centimes').notNull().default(0),
		categorie: text('categorie', { enum: ['plat', 'dessert', 'boisson', 'autre'] })
			.notNull()
			.default('plat'),
		stock_max: integer('stock_max'),
		compte_comme_couvert: integer('compte_comme_couvert', { mode: 'boolean' })
			.notNull()
			.default(true),
		ordre: integer('ordre').notNull().default(0)
	},
	(t) => [index('lignes_menu_evenement').on(t.evenement_id)]
);

export const options = sqliteTable(
	'options',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		evenement_id: integer('evenement_id')
			.notNull()
			.references(() => evenements.id, { onDelete: 'cascade' }),
		libelle: text('libelle').notNull(),
		type: text('type', { enum: ['texte', 'case'] })
			.notNull()
			.default('texte'),
		obligatoire: integer('obligatoire', { mode: 'boolean' }).notNull().default(false),
		ordre: integer('ordre').notNull().default(0)
	},
	(t) => [index('options_evenement').on(t.evenement_id)]
);

/* ----------------------------------------------------------- reservations */

export const reservations = sqliteTable(
	'reservations',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		evenement_id: integer('evenement_id')
			.notNull()
			.references(() => evenements.id, { onDelete: 'cascade' }),
		service_id: integer('service_id').references(() => services.id, { onDelete: 'set null' }),

		nom: text('nom').notNull(),
		prenom: text('prenom').notNull(),
		email: text('email'),
		telephone: text('telephone'),

		couverts: integer('couverts').notNull().default(0),
		total_centimes: integer('total_centimes').notNull().default(0),
		frais_centimes: integer('frais_centimes').notNull().default(0),

		statut_paiement: text('statut_paiement', {
			enum: ['en_attente', 'paye', 'annule', 'rembourse', 'expire']
		})
			.notNull()
			.default('en_attente'),
		mode_paiement: text('mode_paiement', {
			enum: ['en_ligne', 'sur_place', 'virement', 'liquide']
		}).notNull(),
		communication_structuree: text('communication_structuree'),

		mollie_paiement_id: text('mollie_paiement_id'),
		paye_le: integer('paye_le'),

		token_gestion: text('token_gestion').notNull(),
		source: text('source', { enum: ['en_ligne', 'manuelle'] })
			.notNull()
			.default('en_ligne'),
		note_interne: text('note_interne'),

		/* Blocage des places pendant le paiement (15 min) */
		bloque_jusqu_a: integer('bloque_jusqu_a'),

		rappel_envoye_le: integer('rappel_envoye_le'),
		cree_le: cree_le()
	},
	(t) => [
		uniqueIndex('reservations_token_unique').on(t.token_gestion),
		index('reservations_evenement').on(t.evenement_id),
		index('reservations_service').on(t.service_id),
		index('reservations_comm').on(t.communication_structuree),
		index('reservations_nom').on(t.nom)
	]
);

export const reservation_lignes = sqliteTable(
	'reservation_lignes',
	{
		reservation_id: integer('reservation_id')
			.notNull()
			.references(() => reservations.id, { onDelete: 'cascade' }),
		ligne_menu_id: integer('ligne_menu_id')
			.notNull()
			.references(() => lignes_menu.id, { onDelete: 'cascade' }),
		quantite: integer('quantite').notNull(),
		prix_centimes: integer('prix_centimes').notNull(), // prix figé au moment de la réservation
		nom: text('nom').notNull() // libellé figé, pour les exports même si le menu change
	},
	(t) => [primaryKey({ columns: [t.reservation_id, t.ligne_menu_id] })]
);

export const reservation_options = sqliteTable(
	'reservation_options',
	{
		reservation_id: integer('reservation_id')
			.notNull()
			.references(() => reservations.id, { onDelete: 'cascade' }),
		option_id: integer('option_id')
			.notNull()
			.references(() => options.id, { onDelete: 'cascade' }),
		libelle: text('libelle').notNull(),
		valeur: text('valeur')
	},
	(t) => [primaryKey({ columns: [t.reservation_id, t.option_id] })]
);

export const tickets = sqliteTable(
	'tickets',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		reservation_id: integer('reservation_id')
			.notNull()
			.references(() => reservations.id, { onDelete: 'cascade' }),
		code_qr: text('code_qr').notNull(),
		scanne_le: integer('scanne_le'),
		scanne_par: text('scanne_par')
	},
	(t) => [uniqueIndex('tickets_code_unique').on(t.code_qr), index('tickets_reservation').on(t.reservation_id)]
);

/* ------------------------------------------------- demandes venues du site */

/** Un club qui demande son espace depuis la page d'accueil publique. */
export const demandes_club = sqliteTable(
	'demandes_club',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		club: text('club').notNull(),
		ville: text('ville'),
		contact: text('contact').notNull(),
		email: text('email').notNull(),
		telephone: text('telephone'),
		evenement: text('evenement'),
		statut: text('statut', { enum: ['nouvelle', 'traitee', 'refusee'] })
			.notNull()
			.default('nouvelle'),
		club_cree_id: integer('club_cree_id').references(() => clubs.id, { onDelete: 'set null' }),
		cree_le: cree_le()
	},
	(t) => [index('demandes_statut').on(t.statut)]
);

/* ------------------------------------------------------------ journalisation */

/** Trace des actions sensibles (paiements, annulations, créations de club). */
export const journal = sqliteTable('journal', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	club_id: integer('club_id'),
	utilisateur_id: integer('utilisateur_id'),
	action: text('action').notNull(),
	detail: text('detail'),
	cree_le: cree_le()
});
