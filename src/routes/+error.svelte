<script lang="ts">
	import { page } from '$app/state';
	import { SLUGS_RESERVES } from '$lib/slug';

	/**
	 * Le retour se déduit du chemin : un participant perdu doit retomber sur les
	 * soupers de son club, jamais sur un écran de connexion qui ne le concerne pas.
	 */
	const segment = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? '');
	const retourClub = $derived(
		segment && !SLUGS_RESERVES.has(segment) ? `/${segment}` : null
	);

	const titre = $derived(page.status === 404 ? 'Cette page n’existe pas' : 'Ça n’a pas marché');
	const explique = $derived(
		page.status === 404
			? 'Le lien est peut-être incomplet, ou l’événement a été retiré.'
			: 'Réessayez dans un instant. Si ça continue, prévenez le club.'
	);
</script>

<svelte:head><title>{titre}</title></svelte:head>

<div class="page" style="max-width:520px">
	<div class="carte">
		<h1>{titre}</h1>
		<p class="muet">{explique}</p>
		{#if page.error?.message && page.error.message !== titre}
			<p class="petit muet">{page.error.message}</p>
		{/if}
		{#if retourClub}
			<a class="bouton" href={retourClub}>Voir les soupers du club</a>
		{/if}
	</div>
</div>
