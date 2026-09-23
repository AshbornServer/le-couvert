/**
 * PM2 : le service de production.
 *   pm2 start ecosystem.config.cjs
 *
 * Le fichier `.env` est lu ici et passé en variables d'environnement : en
 * production SvelteKit ne lit pas `.env` lui-même, et l'option `env_file` de
 * PM2 ne fonctionne pas sur toutes les versions.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const racine = __dirname;

function lireEnv() {
	const env = {};
	let contenu = '';
	try {
		contenu = readFileSync(join(racine, '.env'), 'utf8');
	} catch {
		return env;
	}
	for (const ligne of contenu.split('\n')) {
		const nette = ligne.trim();
		if (!nette || nette.startsWith('#')) continue;
		const coupe = nette.indexOf('=');
		if (coupe < 1) continue;
		const cle = nette.slice(0, coupe).trim();
		let valeur = nette.slice(coupe + 1).trim();
		if (
			(valeur.startsWith('"') && valeur.endsWith('"')) ||
			(valeur.startsWith("'") && valeur.endsWith("'"))
		) {
			valeur = valeur.slice(1, -1);
		}
		env[cle] = valeur;
	}
	return env;
}

module.exports = {
	apps: [
		{
			name: 'soupers',
			script: 'build/index.js',
			cwd: racine,
			instances: 1,
			// Un seul processus, volontairement : l'écriture SQLite et la
			// vérification des dernières places supposent un seul écrivain.
			exec_mode: 'fork',
			env: { NODE_ENV: 'production', PORT: '5000', ...lireEnv() },
			max_memory_restart: '400M',
			autorestart: true
		}
	]
};
