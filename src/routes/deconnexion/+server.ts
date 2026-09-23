import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fermerSession } from '$lib/server/auth';

export const POST: RequestHandler = ({ cookies }) => {
	fermerSession(cookies);
	redirect(303, '/connexion');
};
