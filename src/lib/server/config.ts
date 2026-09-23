import { env } from '$env/dynamic/private';

/** Toute la configuration au même endroit, lue dans `.env`. */
export const config = {
	get origine() {
		return env.ORIGINE_PUBLIQUE ?? '';
	},
	get cheminBase() {
		return env.CHEMIN_BASE ?? './data/soupers.db';
	},
	get dossierMigrations() {
		return env.DOSSIER_MIGRATIONS ?? './drizzle';
	},
	get dossierTeleversements() {
		return env.DOSSIER_TELEVERSEMENTS ?? './data/televersements';
	},
	get fournisseurMail() {
		return (env.FOURNISSEUR_MAIL ?? 'console').toLowerCase();
	},
	get cleMail() {
		return env.CLE_API_MAIL ?? '';
	},
	get mailExpediteur() {
		return env.MAIL_EXPEDITEUR ?? 'ne-pas-repondre@exemple.be';
	},
	get mailNomExpediteur() {
		return env.MAIL_NOM_EXPEDITEUR ?? 'Réservations';
	},
	get emailsSuperadmin(): string[] {
		return (env.EMAILS_SUPERADMIN ?? '')
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean);
	},
	get production() {
		return env.NODE_ENV === 'production';
	},
	mollie: {
		get clientId() {
			return env.MOLLIE_CLIENT_ID ?? '';
		},
		get clientSecret() {
			return env.MOLLIE_CLIENT_SECRET ?? '';
		},
		get redirection() {
			return env.MOLLIE_REDIRECTION ?? '';
		}
	}
};

/** L'origine publique, avec repli sur celle de la requête en développement. */
export function origine(url: URL): string {
	return config.origine || url.origin;
}
