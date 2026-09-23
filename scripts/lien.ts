/**
 * Imprime un lien de connexion, sans passer par l'e-mail.
 * Pratique pour tester quand aucun fournisseur d'e-mail n'est branché.
 *
 *   npm run lien organisateur@fc-exemple.be
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import * as s from '../src/lib/server/db/schema.ts';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const origine = process.env.ORIGINE_PUBLIQUE ?? 'http://localhost:5000';

const db = drizzle(new Database(process.env.CHEMIN_BASE ?? './data/soupers.db'), { schema: s });

function connus() {
	return db
		.select({ email: s.utilisateurs.email, role: s.utilisateurs.role })
		.from(s.utilisateurs)
		.all();
}

if (!email) {
	console.log('\nUsage : npm run lien <adresse e-mail>\n');
	console.log('Adresses connues :');
	for (const u of connus()) console.log(`  ${u.email}  (${u.role})`);
	console.log('');
	process.exit(1);
}

const utilisateur = db.select().from(s.utilisateurs).where(eq(s.utilisateurs.email, email)).get();
if (!utilisateur) {
	console.log(`\nAucun compte pour « ${email} ».\n`);
	console.log('Adresses connues :');
	for (const u of connus()) console.log(`  ${u.email}  (${u.role})`);
	console.log('');
	process.exit(1);
}

const jeton = randomBytes(32).toString('base64url');
db.insert(s.jetons_connexion)
	.values({
		jeton_hache: createHash('sha256').update(jeton).digest('hex'),
		email,
		expire_le: Math.floor(Date.now() / 1000) + 30 * 60
	})
	.run();

console.log('');
console.log(`Compte  : ${email} (${utilisateur.role})`);
console.log('Valable : 30 minutes, une seule fois');
console.log('');
console.log(`${origine}/connexion/verifier?jeton=${jeton}`);
console.log('');
