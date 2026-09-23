CREATE TABLE `clubs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`nom` text NOT NULL,
	`logo` text,
	`couleur` text DEFAULT '#0b6b3a' NOT NULL,
	`email_contact` text,
	`mollie_org_id` text,
	`mollie_jeton_acces` text,
	`mollie_jeton_rafraichissement` text,
	`mollie_expire_le` integer,
	`mollie_statut` text DEFAULT 'non_relie' NOT NULL,
	`commission_centimes` integer DEFAULT 20 NOT NULL,
	`frais_payes_par` text DEFAULT 'participant' NOT NULL,
	`actif` integer DEFAULT true NOT NULL,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_slug_unique` ON `clubs` (`slug`);--> statement-breakpoint
CREATE TABLE `evenements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`slug` text NOT NULL,
	`titre` text DEFAULT '' NOT NULL,
	`date` text,
	`heure_debut` text,
	`lieu_nom` text,
	`lieu_adresse` text,
	`image` text,
	`capacite` integer,
	`date_limite` text,
	`paiement_en_ligne` integer DEFAULT false NOT NULL,
	`paiement_sur_place` integer DEFAULT true NOT NULL,
	`paiement_virement` integer DEFAULT false NOT NULL,
	`iban` text,
	`couleur` text,
	`logo` text,
	`texte_accueil` text,
	`texte_confirmation` text,
	`statut` text DEFAULT 'brouillon' NOT NULL,
	`publie_le` integer,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL,
	`modifie_le` integer DEFAULT (unixepoch()) NOT NULL,
	`purge_le` integer,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evenements_club_slug_unique` ON `evenements` (`club_id`,`slug`);--> statement-breakpoint
CREATE INDEX `evenements_club` ON `evenements` (`club_id`);--> statement-breakpoint
CREATE TABLE `jetons_connexion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jeton_hache` text NOT NULL,
	`email` text NOT NULL,
	`expire_le` integer NOT NULL,
	`utilise_le` integer,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jetons_connexion_unique` ON `jetons_connexion` (`jeton_hache`);--> statement-breakpoint
CREATE TABLE `journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer,
	`utilisateur_id` integer,
	`action` text NOT NULL,
	`detail` text,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lignes_menu` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evenement_id` integer NOT NULL,
	`nom` text NOT NULL,
	`prix_centimes` integer DEFAULT 0 NOT NULL,
	`categorie` text DEFAULT 'plat' NOT NULL,
	`stock_max` integer,
	`compte_comme_couvert` integer DEFAULT true NOT NULL,
	`ordre` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`evenement_id`) REFERENCES `evenements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lignes_menu_evenement` ON `lignes_menu` (`evenement_id`);--> statement-breakpoint
CREATE TABLE `options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evenement_id` integer NOT NULL,
	`libelle` text NOT NULL,
	`type` text DEFAULT 'texte' NOT NULL,
	`obligatoire` integer DEFAULT false NOT NULL,
	`ordre` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`evenement_id`) REFERENCES `evenements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `options_evenement` ON `options` (`evenement_id`);--> statement-breakpoint
CREATE TABLE `reservation_lignes` (
	`reservation_id` integer NOT NULL,
	`ligne_menu_id` integer NOT NULL,
	`quantite` integer NOT NULL,
	`prix_centimes` integer NOT NULL,
	`nom` text NOT NULL,
	PRIMARY KEY(`reservation_id`, `ligne_menu_id`),
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ligne_menu_id`) REFERENCES `lignes_menu`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reservation_options` (
	`reservation_id` integer NOT NULL,
	`option_id` integer NOT NULL,
	`libelle` text NOT NULL,
	`valeur` text,
	PRIMARY KEY(`reservation_id`, `option_id`),
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evenement_id` integer NOT NULL,
	`service_id` integer,
	`nom` text NOT NULL,
	`prenom` text NOT NULL,
	`email` text,
	`telephone` text,
	`couverts` integer DEFAULT 0 NOT NULL,
	`total_centimes` integer DEFAULT 0 NOT NULL,
	`frais_centimes` integer DEFAULT 0 NOT NULL,
	`statut_paiement` text DEFAULT 'en_attente' NOT NULL,
	`mode_paiement` text NOT NULL,
	`communication_structuree` text,
	`mollie_paiement_id` text,
	`paye_le` integer,
	`token_gestion` text NOT NULL,
	`source` text DEFAULT 'en_ligne' NOT NULL,
	`note_interne` text,
	`bloque_jusqu_a` integer,
	`rappel_envoye_le` integer,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`evenement_id`) REFERENCES `evenements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_token_unique` ON `reservations` (`token_gestion`);--> statement-breakpoint
CREATE INDEX `reservations_evenement` ON `reservations` (`evenement_id`);--> statement-breakpoint
CREATE INDEX `reservations_service` ON `reservations` (`service_id`);--> statement-breakpoint
CREATE INDEX `reservations_comm` ON `reservations` (`communication_structuree`);--> statement-breakpoint
CREATE INDEX `reservations_nom` ON `reservations` (`nom`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evenement_id` integer NOT NULL,
	`libelle` text NOT NULL,
	`heure` text,
	`capacite` integer,
	`ordre` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`evenement_id`) REFERENCES `evenements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `services_evenement` ON `services` (`evenement_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`utilisateur_id` integer NOT NULL,
	`expire_le` integer NOT NULL,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_utilisateur` ON `sessions` (`utilisateur_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reservation_id` integer NOT NULL,
	`code_qr` text NOT NULL,
	`scanne_le` integer,
	`scanne_par` text,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_code_unique` ON `tickets` (`code_qr`);--> statement-breakpoint
CREATE INDEX `tickets_reservation` ON `tickets` (`reservation_id`);--> statement-breakpoint
CREATE TABLE `utilisateurs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`nom` text,
	`club_id` integer,
	`role` text NOT NULL,
	`derniere_connexion_le` integer,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `utilisateurs_email_unique` ON `utilisateurs` (`email`);--> statement-breakpoint
CREATE INDEX `utilisateurs_club` ON `utilisateurs` (`club_id`);