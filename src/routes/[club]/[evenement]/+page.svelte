<script lang="ts">
	import PageEvenement from '$lib/PageEvenement.svelte';
	import { dateLongue, limiteLongue } from '$lib/dates';
	let { data, form } = $props();

	const description = $derived(
		[data.evenement.titre, dateLongue(data.evenement.date), data.evenement.lieu_nom]
			.filter(Boolean)
			.join(' — ')
	);
	const ferme = $derived(data.limiteDepassee || data.complet || data.termine);
</script>

<svelte:head>
	<title>{data.evenement.titre} — {data.club.nom}</title>
	<meta name="description" content={description} />
</svelte:head>

{#if ferme}
	<div class="page" style="max-width:680px;padding-bottom:0">
		<div class="message erreur">
			{#if data.termine}
				Cet événement est terminé. Merci à toutes et tous !
			{:else if data.complet}
				<strong>C’est complet</strong> — il n’y a plus de place. Contactez le club si vous voulez
				être prévenu d’une désinscription.
			{:else}
				<strong>Les réservations sont fermées</strong> depuis le {limiteLongue(
					data.evenement.date_limite
				)}.
			{/if}
		</div>
	</div>
{/if}

<PageEvenement
	club={data.club}
	evenement={data.evenement}
	services={data.services}
	menu={data.menu}
	options={data.options}
	placesRestantes={data.placesRestantes}
	fraisParCouvert={data.fraisParCouvert}
	erreur={form?.erreur ?? null}
	{ferme}
/>
