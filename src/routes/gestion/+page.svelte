<script lang="ts">
	import { euros } from '$lib/argent';
	import { dateLongue, heureBelge, jourLocal } from '$lib/dates';
	import { MODELES } from '$lib/modeles';
	let { data } = $props();

	const libelleStatut: Record<string, string> = {
		brouillon: 'brouillon',
		publie: 'publié',
		termine: 'terminé'
	};
	const couleurStatut: Record<string, string> = {
		brouillon: 'gris',
		publie: 'vert',
		termine: 'orange'
	};

	/** Le souper est-il pour tout de suite ? Alors on met le scanner en avant. */
	const bientot = (date: string | null) =>
		Boolean(date && date >= jourLocal(0) && date <= jourLocal(2));
</script>

<svelte:head><title>{data.club.nom}</title></svelte:head>

<div class="page">
	<div class="rangee" style="justify-content:space-between;margin-bottom:8px">
		<h1 style="margin:0">{data.club.nom}</h1>
		{#if data.club.logo}
			<img src={data.club.logo} alt="" style="max-height:52px" />
		{/if}
	</div>

	{#if data.evenements.length === 0}
		<!-- Premier écran d'un bénévole : le choix du souper, tout de suite. -->
		<div class="carte">
			<h2>Créez votre premier souper</h2>
			<p class="muet">
				Choisissez ce que vous organisez. Le menu et les prix sont déjà écrits, vous les corrigez
				après.
			</p>

			<div class="modeles">
				{#each MODELES as m (m.cle)}
					<form method="POST" action="/gestion/evenements/nouveau?/modele">
						<input type="hidden" name="cle" value={m.cle} />
						<button class="bouton second modele" type="submit">{m.nom}</button>
					</form>
				{/each}
			</div>

			<p class="petit" style="margin-top:16px">
				<a href="/gestion/evenements/nouveau">Autre chose</a>
			</p>
		</div>
	{:else}
		<p class="muet">Votre page publique : <a href="/{data.club.slug}">/{data.club.slug}</a></p>

		<div class="rangee" style="margin-bottom:16px">
			<a class="bouton" href="/gestion/evenements/nouveau">+ Nouveau souper</a>
		</div>

		<div class="carte">
			<h2>Mes soupers</h2>

			<ul class="soupers">
				{#each data.evenements as e (e.id)}
					<li>
						<a class="titre" href="/gestion/evenements/{e.id}/bord">
							{e.titre || 'Sans titre'}
						</a>
						<p class="quand">
							{dateLongue(e.date) || 'date à compléter'}{#if e.heure_debut}
								— {heureBelge(e.heure_debut)}{/if}
						</p>
						<p class="etat">
							<span class="etiquette {couleurStatut[e.statut]}">{libelleStatut[e.statut]}</span>
							<span class="muet">
								{e.couverts} {e.couverts === 1 ? 'couvert' : 'couverts'}{#if e.capacite}
									sur {e.capacite}{/if}
								{#if Number(e.encaisse) > 0} · {euros(Number(e.encaisse))}{/if}
							</span>
						</p>
						<p class="quoi">
							{#if bientot(e.date) && e.statut === 'publie'}
								<a class="bouton" href="/gestion/evenements/{e.id}/scanner">Mode entrée</a>
							{/if}
							<a class="bouton second" href="/gestion/evenements/{e.id}">Modifier</a>
						</p>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
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
		min-height: 60px;
		justify-content: flex-start;
	}
	@media (prefers-reduced-motion: no-preference) {
		@keyframes modele-pose {
			from {
				opacity: 0;
				transform: translateY(12px) rotate(-1deg);
			}
		}
		.modeles form {
			animation: modele-pose var(--ample) var(--elan) both;
		}
		.modeles form:nth-child(2) {
			animation-delay: 60ms;
		}
		.modeles form:nth-child(3) {
			animation-delay: 120ms;
		}
		.modeles form:nth-child(4) {
			animation-delay: 180ms;
		}
		.modeles form:nth-child(5) {
			animation-delay: 240ms;
		}
	}

	/* Une liste, pas un tableau : sept colonnes ne tiennent pas sur un téléphone. */
	.soupers {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.soupers li {
		padding: 16px 0;
		border-bottom: 1px solid var(--bord);
	}
	@media (prefers-reduced-motion: no-preference) {
		@keyframes souper-entre {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
		}
		.soupers li {
			animation: souper-entre var(--moyen) var(--elan) both;
		}
		.soupers li:nth-child(2) {
			animation-delay: 50ms;
		}
		.soupers li:nth-child(3) {
			animation-delay: 100ms;
		}
		.soupers li:nth-child(n + 4) {
			animation-delay: 150ms;
		}
	}
	.soupers li:last-child {
		border-bottom: none;
	}
	.titre {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 22px;
		color: var(--encre);
		text-decoration-color: var(--bord-champ);
		text-underline-offset: 4px;
		display: inline-block;
		min-height: 32px;
	}
	.quand {
		margin: 4px 0 0;
	}
	.etat {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
		margin: 8px 0 0;
	}
	.quoi {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin: 12px 0 0;
	}
</style>
