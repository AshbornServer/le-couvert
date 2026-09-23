<script lang="ts">
	import { dateLongue } from '$lib/dates';
	let { data, form } = $props();

	const avecDate = $derived(data.precedents.filter((e) => e.date));
</script>

<svelte:head><title>Nouvel événement</title></svelte:head>

<div class="page">
	<p class="petit"><a href="/gestion">← Mes événements</a></p>
	<h1>Nouvel événement</h1>

	{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}

	{#if avecDate.length > 0}
		<div class="carte">
			<h2>Refaire un événement précédent</h2>
			<p class="muet petit">
				Tout est recopié — menu, services, textes, prix. Il ne reste que la date à changer.
			</p>
			{#each avecDate as e (e.id)}
				<form method="POST" action="?/dupliquer" class="precedent">
					<input type="hidden" name="evenement_id" value={e.id} />
					<span>
						<strong>{e.titre || 'Sans titre'}</strong><br />
						<span class="petit muet">
							{dateLongue(e.date)}{#if e.couverts}&nbsp;— {e.couverts} couverts{/if}
						</span>
					</span>
					<button class="bouton second" type="submit">Dupliquer</button>
				</form>
			{/each}
		</div>
	{/if}

	<div class="carte">
		<h2>Partir d’un modèle</h2>
		<p class="muet petit">Le menu et les services sont déjà écrits. Vous corrigez ce qu’il faut.</p>
		<div class="modeles">
			{#each data.modeles as m (m.cle)}
				<form method="POST" action="?/modele">
					<input type="hidden" name="cle" value={m.cle} />
					<button class="bouton second modele" type="submit">
						<strong>{m.nom}</strong>
						<span class="petit muet">{m.menu} lignes de menu</span>
					</button>
				</form>
			{/each}
		</div>
	</div>

	<div class="carte">
		<h2>Partir de zéro</h2>
		<p class="muet petit">Une page vide, à remplir de haut en bas.</p>
		<form method="POST" action="?/vide">
			<button class="bouton" type="submit">Page vide</button>
		</form>
	</div>
</div>

<style>
	.precedent {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--bord);
		flex-wrap: wrap;
	}
	.precedent:last-of-type {
		border-bottom: none;
	}
	.modeles {
		display: grid;
		gap: 10px;
	}
	@media (min-width: 620px) {
		.modeles {
			grid-template-columns: 1fr 1fr;
		}
	}
	.modele {
		width: 100%;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
		text-align: left;
		min-height: 64px;
	}
</style>
