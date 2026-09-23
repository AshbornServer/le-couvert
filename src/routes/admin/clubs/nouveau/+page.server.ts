import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { origine } from '$lib/server/config';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { clubs, journal } from '$lib/server/db/schema';
import { inviterOrganisateur } from '$lib/server/auth';
import { exigerSuperadmin } from '$lib/server/evenement';
import { versSlug, slugValide } from '$lib/slug';
import { centimes } from '$lib/argent';
import { enregistrerImage } from '$lib/server/televersement';

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		exigerSuperadmin(locals);
		const d = await request.formData();
		const nom = String(d.get('nom') ?? '').trim();
		const slugSaisi = String(d.get('slug') ?? '').trim();
		const email = String(d.get('email') ?? '').trim();
		const couleur = String(d.get('couleur') ?? '#0b6b3a');
		const commission = centimes(String(d.get('commission') ?? '0,20'));
		const frais_payes_par = d.get('frais_payes_par') === 'club' ? 'club' : 'participant';

		const renvoi = { nom, slug: slugSaisi, email, couleur };

		if (!nom) return fail(400, { ...renvoi, erreur: 'Le nom du club est obligatoire.' });
		if (!email.includes('@')) {
			return fail(400, { ...renvoi, erreur: 'L’adresse e-mail de l’organisateur est obligatoire.' });
		}

		const slug = versSlug(slugSaisi || nom);
		if (!slugValide(slug)) {
			return fail(400, {
				...renvoi,
				erreur: 'Adresse du club invalide ou réservée. Utilisez des lettres, des chiffres et des tirets.'
			});
		}
		if (db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, slug)).get()) {
			return fail(400, { ...renvoi, erreur: `L’adresse « /${slug} » est déjà prise.` });
		}

		const logo = await enregistrerImage(d.get('logo'));
		if (!logo.ok) return fail(400, { ...renvoi, erreur: logo.erreur });

		const insere = db
			.insert(clubs)
			.values({
				nom,
				slug,
				couleur,
				logo: logo.chemin || null,
				email_contact: email.toLowerCase(),
				commission_centimes: commission,
				frais_payes_par
			})
			.returning({ id: clubs.id })
			.get();

		const origineMail = origine(url);
		try {
			await inviterOrganisateur(email, insere.id, origineMail);
		} catch (erreur) {
			db.delete(clubs).where(eq(clubs.id, insere.id)).run();
			return fail(400, { ...renvoi, erreur: (erreur as Error).message });
		}

		db.insert(journal)
			.values({
				club_id: insere.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'club_cree',
				detail: `${nom} (/${slug}) — organisateur ${email}`
			})
			.run();

		redirect(303, `/admin/clubs/${insere.id}?cree=1`);
	}
};
