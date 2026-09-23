<script lang="ts">
	import { euros } from '$lib/argent';
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	const mois = new Date().toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });

	const libelleMollie: Record<string, string> = {
		non_relie: 'Mollie non relié',
		en_attente: 'Mollie en attente',
		relie: 'Mollie relié',
		erreur: 'Mollie en erreur'
	};
	const couleurMollie: Record<string, string> = {
		non_relie: 'gris',
		en_attente: 'orange',
		relie: 'vert',
		erreur: 'rouge'
	};
</script>

<svelte:head><title>Super-admin</title></svelte:head>

<div class="page large">
	<div class="rangee" style="justify-content:space-between;margin-bottom:16px">
		<h1 style="margin:0">Les clubs</h1>
		<a class="bouton" href="/admin/clubs/nouveau">+ Nouveau club</a>
	</div>

	{#if form?.ok}<div class="message ok">{form.ok}</div>{/if}

	{#if data.demandes.length > 0}
		<section class="carte" style="border-color:var(--couleur)">
			<h2>Demandes à traiter ({data.demandes.length})</h2>
			<p class="muet petit">
				Venues de la page d’accueil. Un clic ouvre l’espace du club et envoie son accès à
				l’organisateur.
			</p>

			<ul class="demandes">
				{#each data.demandes as d (d.id)}
					<li>
						<div>
							<strong>{d.club}</strong>{#if d.ville} <span class="muet">— {d.ville}</span>{/if}
							<br />
							<span class="petit">{d.contact} · {d.email}{#if d.telephone} · {d.telephone}{/if}</span>
							{#if d.evenement}<br /><span class="petit muet">{d.evenement}</span>{/if}
						</div>
						<div class="rangee">
							<form method="POST" action="?/ouvrir_demande" use:enhance>
								<input type="hidden" name="demande_id" value={d.id} />
								<button class="bouton" type="submit">Ouvrir le club</button>
							</form>
							<form method="POST" action="?/refuser_demande" use:enhance>
								<input type="hidden" name="demande_id" value={d.id} />
								<button class="bouton second" type="submit">Écarter</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="grille trois" style="margin-bottom:20px">
		<div class="chiffre">
			<div class="valeur">{data.clubs.length}</div>
			<div class="quoi">clubs</div>
		</div>
		<div class="chiffre">
			<div class="valeur">{data.totalCouverts}</div>
			<div class="quoi">couverts payés (tout confondu)</div>
		</div>
		<div class="chiffre">
			<div class="valeur">{euros(data.totalCommissions)}</div>
			<div class="quoi">mes commissions — {mois}</div>
		</div>
	</div>

	<div class="carte">
		{#if data.clubs.length === 0}
			<p class="muet">Aucun club pour l’instant.</p>
			<a class="bouton" href="/admin/clubs/nouveau">Créer le premier club</a>
		{:else}
			<div class="defilant">
				<table class="tableau">
					<thead>
						<tr>
							<th>Club</th>
							<th>Adresse</th>
							<th>Paiement</th>
							<th class="nombre">Événements</th>
							<th class="nombre">Couverts</th>
							<th class="nombre">Commission</th>
							<th class="nombre">Ce mois</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.clubs as club (club.id)}
							<tr>
								<td>
									<strong>{club.nom}</strong>
									{#if !club.actif}<br /><span class="etiquette gris">désactivé</span>{/if}
								</td>
								<td><code class="petit">/{club.slug}</code></td>
								<td>
									<span class="etiquette {couleurMollie[club.mollie_statut]}">
										{libelleMollie[club.mollie_statut]}
									</span>
								</td>
								<td class="nombre">{club.evenements}</td>
								<td class="nombre">{club.couverts}</td>
								<td class="nombre">
									{euros(club.commission_centimes)}
									<br /><span class="petit muet"
										>{club.frais_payes_par === 'participant' ? 'participant' : 'club'}</span
									>
								</td>
								<td class="nombre">{euros(Number(club.commissions_mois))}</td>
								<td><a class="retour" href="/admin/clubs/{club.id}">Réglages</a></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<div class="carte">
		<h2>Tâches automatiques</h2>
		<p class="muet petit">
			Rappels aux participants deux jours avant, récapitulatif aux organisateurs le matin même,
			clôture des événements passés, purge des données à douze mois. Tout tourne seul chaque heure ;
			ce bouton sert à ne pas attendre.
		</p>
		<form method="POST" action="?/taches" use:enhance>
			<button class="bouton second" type="submit">Relancer les rappels et le ménage</button>
		</form>
	</div>
</div>

<style>
	.demandes {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.demandes li {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		padding: 14px 0;
		border-bottom: 1px solid var(--bord);
	}
	.demandes li:last-child {
		border-bottom: none;
	}
</style>
