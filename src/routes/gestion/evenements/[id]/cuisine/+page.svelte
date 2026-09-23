<script lang="ts">
	import { dateLongue, heureBelge } from '$lib/dates';
	let { data } = $props();

	const e = $derived(data.evenement);
	const plats = $derived(data.cuisine.lignes.filter((l) => l.categorie === 'plat'));
	const autres = $derived(data.cuisine.lignes.filter((l) => l.categorie !== 'plat'));
	const imprime = new Date().toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>Récap cuisine — {e.titre}</title></svelte:head>

<div class="feuille">
	<div class="rangee sans-impression" style="margin-bottom:16px">
		<a class="retour" href="/gestion/evenements/{e.id}/bord">← Les inscrits</a>
		<span style="flex:1"></span>
		<button class="bouton" type="button" onclick={() => window.print()}>Imprimer</button>
	</div>

	<header>
		<h1>{e.titre}</h1>
		<p>{dateLongue(e.date)}{#if e.lieu_nom} — {e.lieu_nom}{/if}</p>
	</header>

	{#if data.cuisine.lignes.length === 0}
		<p class="rien">
			Pas encore de commande. Cette feuille se remplira au fur et à mesure des réservations.
		</p>
	{:else}
		<p class="grand-total">
			<span>{data.cuisine.couverts_total}</span> couverts au total
		</p>
	{/if}

	{#if plats.length > 0}
		<h2>Les plats</h2>
		<table>
			<thead>
				<tr>
					<th></th>
					{#each data.cuisine.services as s (s.id)}
						<th>{s.libelle}{#if s.heure}<br /><span class="petit">{heureBelge(s.heure)}</span>{/if}</th>
					{/each}
					<th>Total</th>
				</tr>
			</thead>
			<tbody>
				{#each plats as l (l.nom)}
					<tr>
						<td class="quoi">{l.nom}</td>
						{#each data.cuisine.services as s (s.id)}
							<td class="chiffre">{l.par_service[s.id] ?? 0}</td>
						{/each}
						<td class="chiffre total">{l.total}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if autres.length > 0}
		<h2>Desserts, boissons et autres</h2>
		<table>
			<thead>
				<tr>
					<th></th>
					{#each data.cuisine.services as s (s.id)}
						<th>{s.libelle}</th>
					{/each}
					<th>Total</th>
				</tr>
			</thead>
			<tbody>
				{#each autres as l (l.nom)}
					<tr>
						<td class="quoi">{l.nom}</td>
						{#each data.cuisine.services as s (s.id)}
							<td class="chiffre">{l.par_service[s.id] ?? 0}</td>
						{/each}
						<td class="chiffre total">{l.total}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if data.cuisine.services.length > 0}
		<h2>Couverts par service</h2>
		<table>
			<tbody>
				{#each data.cuisine.services as s (s.id)}
					<tr>
						<td class="quoi">
							{s.libelle}{#if s.heure} — {heureBelge(s.heure)}{/if}
						</td>
						<td class="chiffre total">{s.couverts}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<p class="pied">Imprimé le {imprime} — les annulations ne sont pas comptées.</p>
</div>

<style>
	.feuille {
		max-width: 780px;
		margin: 0 auto;
		padding: 20px 16px 60px;
	}
	header {
		border-bottom: 3px solid var(--encre);
		padding-bottom: 10px;
		margin-bottom: 16px;
	}
	header h1 {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 32px;
		margin: 0;
	}
	header p {
		margin: 4px 0 0;
		font-size: 18px;
	}
	.grand-total {
		font-size: 22px;
		margin: 0 0 20px;
	}
	.rien {
		font-size: 19px;
		color: var(--encre-douce);
		margin: 0 0 20px;
	}
	.grand-total span {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 50px;
		line-height: 1;
	}
	h2 {
		font-size: 18px;
		margin: 26px 0 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--bord);
		color: var(--encre-douce);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		text-align: right;
		font-size: 15px;
		padding: 6px 10px;
		border-bottom: 2px solid var(--encre);
	}
	th:first-child {
		text-align: left;
	}
	td {
		padding: 10px;
		border-bottom: 1px solid var(--bord);
		font-size: 20px;
	}
	.quoi {
		font-weight: 600;
	}
	.chiffre {
		text-align: right;
		font-variant-numeric: tabular-nums;
		width: 110px;
	}
	.chiffre.total {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 28px;
	}
	.pied {
		margin-top: 28px;
		font-size: 13px;
		color: var(--encre-douce);
	}

	@media print {
		@page {
			size: A4 portrait;
			margin: 14mm;
		}
		.feuille {
			padding: 0;
			max-width: none;
		}
		td {
			font-size: 18px;
		}
		.chiffre.total {
			font-size: 22px;
		}
	}
</style>
