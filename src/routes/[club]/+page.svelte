<script lang="ts">
	import { dateLongue, heureBelge } from '$lib/dates';
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.club.nom}</title>
	<meta name="description" content="Les soupers et événements de {data.club.nom}." />
</svelte:head>

<div class="page">
	<div class="centre" style="margin-bottom:24px">
		{#if data.club.logo}
			<img src={data.club.logo} alt="" style="max-height:88px;margin-bottom:12px" />
		{/if}
		<h1 style="color:var(--couleur)">{data.club.nom}</h1>
	</div>

	{#if data.evenements.length === 0}
		<div class="carte centre">
			<h2>Rien à réserver pour le moment</h2>
			<p class="muet">Revenez bientôt : le prochain souper sera annoncé ici.</p>
		</div>
	{:else}
		{#each data.evenements as e (e.slug)}
			<a
				class="carte"
				href="/{data.club.slug}/{e.slug}"
				style="display:block;text-decoration:none;color:inherit"
			>
				{#if e.image}
					<img
						src={e.image}
						alt=""
						style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;margin-bottom:12px"
					/>
				{/if}
				<h2 style="color:var(--couleur);margin-bottom:6px">{e.titre}</h2>
				<p style="margin-bottom:4px">
					<strong>{dateLongue(e.date)}</strong>
					{#if e.heure_debut}&nbsp;— dès {heureBelge(e.heure_debut)}{/if}
				</p>
				{#if e.lieu_nom}<p class="muet" style="margin-bottom:12px">{e.lieu_nom}</p>{/if}
				<span class="bouton">Réserver</span>
			</a>
		{/each}
	{/if}

	<p class="centre petit muet" style="margin-top:24px">
		<a href="/confidentialite">Confidentialité</a>
	</p>
</div>
