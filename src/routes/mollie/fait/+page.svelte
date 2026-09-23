<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Compte de paiement</title></svelte:head>

<div class="page" style="max-width:520px">
	<div class="carte">
		{#if data.etat === 'ok'}
			<h1>C’est relié</h1>
			<p class="muet">
				Le compte du club est relié. L’argent des réservations payées en ligne arrivera
				directement dessus. Vous n’avez plus rien à faire ici.
			</p>
		{:else if data.etat === 'refuse'}
			<h1>Vous avez refusé</h1>
			<p class="muet">
				Rien n’a été relié. Les réservations peuvent toujours se payer sur place ou par virement.
				Redemandez le lien si vous changez d’avis.
			</p>
		{:else}
			<h1>Ça n’a pas marché</h1>
			<p class="muet">
				La liaison a échoué. Redemandez le lien et réessayez ; si ça continue, prévenez la
				personne qui vous l’a envoyé.
			</p>
		{/if}
	</div>
</div>
