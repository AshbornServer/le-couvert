CREATE TABLE `demandes_club` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club` text NOT NULL,
	`ville` text,
	`contact` text NOT NULL,
	`email` text NOT NULL,
	`telephone` text,
	`evenement` text,
	`statut` text DEFAULT 'nouvelle' NOT NULL,
	`club_cree_id` integer,
	`cree_le` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`club_cree_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `demandes_statut` ON `demandes_club` (`statut`);