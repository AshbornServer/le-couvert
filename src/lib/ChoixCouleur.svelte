<script lang="ts">
	let { valeur = $bindable('#0b6b3a'), nom = 'couleur' } = $props();

	const proposees = [
		{ code: '#0b6b3a', nom: 'Vert' },
		{ code: '#1552a0', nom: 'Bleu' },
		{ code: '#b3261e', nom: 'Rouge' },
		{ code: '#7b1f3a', nom: 'Bordeaux' },
		{ code: '#c2610a', nom: 'Orange' },
		{ code: '#4b3b8f', nom: 'Violet' }
	];
</script>

<div class="choix">
	{#each proposees as c (c.code)}
		<button
			type="button"
			class="pastille"
			class:choisie={valeur.toLowerCase() === c.code}
			style="background:{c.code}"
			title={c.nom}
			aria-label={c.nom}
			onclick={() => (valeur = c.code)}
		></button>
	{/each}
	<label class="perso">
		<span class="petit">Autre</span>
		<input type="color" bind:value={valeur} aria-label="Choisir une autre couleur" />
	</label>
	<input type="hidden" name={nom} value={valeur} />
</div>

<style>
	.choix {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}
	.pastille {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		border: 3px solid var(--bord);
		cursor: pointer;
		padding: 0;
	}
	.pastille.choisie {
		border-color: var(--encre);
		box-shadow:
			0 0 0 3px #fff inset,
			3px 3px 0 var(--encre);
	}
	.perso {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-weight: 400;
	}
	.perso input[type='color'] {
		width: 56px;
		height: 48px;
		min-height: 48px;
		padding: 2px;
		border: 2px solid var(--bord-champ);
		border-radius: var(--rayon);
		background: #fff;
		cursor: pointer;
	}
</style>
