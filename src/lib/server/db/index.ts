import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config';
import * as schema from './schema';

const chemin = config.cheminBase;
mkdirSync(dirname(chemin), { recursive: true });

export const sqlite = new Database(chemin);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });

/** Applique les migrations au démarrage : rien à lancer à la main sur le serveur. */
{
	try {
		migrate(db, { migrationsFolder: config.dossierMigrations });
	} catch (erreur) {
		console.error('[base] migrations impossibles :', erreur);
		throw erreur;
	}
}

export { schema };
