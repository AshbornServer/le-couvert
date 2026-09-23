import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clubs } from '$lib/server/db/schema';

export const load: LayoutServerLoad = ({ locals, url }) => {
	const utilisateur = locals.utilisateur;
	if (!utilisateur) redirect(303, `/connexion?suite=${encodeURIComponent(url.pathname)}`);

	// Le super-admin n'a pas de club : il passe par /admin.
	if (utilisateur.role === 'superadmin') redirect(303, '/admin');
	if (!utilisateur.club_id) error(403, 'Votre compte n’est rattaché à aucun club.');

	const club = db.select().from(clubs).where(eq(clubs.id, utilisateur.club_id)).get();
	if (!club) error(404, 'Club introuvable.');
	if (!club.actif) error(403, 'L’espace de ce club est désactivé.');

	return { club, utilisateur };
};
