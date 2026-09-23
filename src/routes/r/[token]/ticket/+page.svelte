<script lang="ts">
	import { euros } from '$lib/argent';
	import { dateLongue, heureBelge } from '$lib/dates';
	let { data } = $props();

	const r = $derived(data.reservation);
	const e = $derived(data.evenement);
	const couleur = $derived(e.couleur || data.club.couleur);
	const valable = $derived(
		r.statut_paiement !== 'annule' && r.statut_paiement !== 'rembourse' && r.statut_paiement !== 'expire'
	);
</script>

<svelte:head>
	<title>Ticket — {e.titre}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page" style="--couleur:{couleur};max-width:520px">
	<div class="ticket">
		<div class="haut" style="background:{couleur}">
			<strong>{data.club.nom}</strong>
			<span>{e.titre}</span>
		</div>

		{#if !valable}
			<div class="message erreur" style="margin:16px">
				Ce ticket n’est plus valable : la réservation a été annulée.
			</div>
		{/if}

		<div class="corps">
			<p class="nom">{r.prenom} {r.nom}</p>
			<p class="gros">{r.couverts} {r.couverts === 1 ? 'couvert' : 'couverts'}</p>

			<table class="tableau">
				<tbody>
					<tr><th>Date</th><td>{dateLongue(e.date)}</td></tr>
					{#if data.service}
						<tr>
							<th>Service</th>
							<td>
								{data.service.libelle}
								{#if data.service.heure}— {heureBelge(data.service.heure)}{/if}
							</td>
						</tr>
					{:else if e.heure_debut}
						<tr><th>Heure</th><td>dès {heureBelge(e.heure_debut)}</td></tr>
					{/if}
					{#if e.lieu_nom || e.lieu_adresse}
						<tr>
							<th>Lieu</th>
							<td>{[e.lieu_nom, e.lieu_adresse].filter(Boolean).join(' — ')}</td>
						</tr>
					{/if}
					<tr>
						<th>Paiement</th>
						<td>
							{#if r.statut_paiement === 'paye'}
								payé — {euros(r.total_centimes)}
							{:else if r.mode_paiement === 'sur_place'}
								<strong>à payer sur place : {euros(r.total_centimes)}</strong>
							{:else if r.mode_paiement === 'virement'}
								<strong>virement : {euros(r.total_centimes)}</strong>
								{#if r.communication_structuree}<br />{r.communication_structuree}{/if}
							{:else}
								{euros(r.total_centimes)}
							{/if}
						</td>
					</tr>
				</tbody>
			</table>

			<div class="commande">
				{#each data.lignes as l (l.ligne_menu_id)}
					<p>{l.quantite} × {l.nom}</p>
				{/each}
				{#each data.reponses as rep (rep.option_id)}
					<p class="petit muet">{rep.libelle} : {rep.valeur}</p>
				{/each}
			</div>
		</div>

		{#if data.ticket && valable}
			<div class="qr">
				<img src="/r/{r.token_gestion}/qr.png" alt="QR code du ticket" width="240" height="240" />
				<p class="petit muet">À présenter à l’entrée</p>
			</div>
		{/if}
	</div>

	<div class="rangee sans-impression" style="justify-content:center;margin-top:20px">
		<button class="bouton" type="button" onclick={() => window.print()}>Imprimer</button>
		<a class="bouton second" href="/r/{r.token_gestion}">Retour à ma réservation</a>
	</div>
</div>

<style>
	.ticket {
		position: relative;
		background: #fff;
		border: 1px solid var(--bord);
		border-radius: var(--rayon);
		/* Posé sur la table, pas en lévitation. */
		box-shadow: 5px 5px 0 var(--bord);
	}
	.haut {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-top-left-radius: var(--rayon);
		border-top-right-radius: var(--rayon);
	}
	.haut strong {
		font-size: 17px;
		font-weight: 600;
		opacity: 0.9;
	}
	.haut span {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 26px;
		line-height: 1.05;
	}
	.corps {
		padding: 16px;
	}
	.nom {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 24px;
		margin: 0;
	}
	.gros {
		font-size: 17px;
		margin: 0 0 12px;
		color: var(--encre-douce);
	}
	.tableau th {
		width: 38%;
		text-transform: none;
		font-size: 15px;
		white-space: nowrap;
	}
	.commande {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px dashed var(--bord);
	}
	.commande p {
		margin: 0 0 4px;
	}
	/* La perforation du carnet à souches, encoches comprises. */
	.qr {
		position: relative;
		text-align: center;
		padding: 22px 16px 20px;
		border-top: 2px dashed var(--bord);
	}
	.qr::before,
	.qr::after {
		content: '';
		position: absolute;
		top: -12px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--fond);
		border: 1px solid var(--bord);
	}
	.qr::before {
		left: -12px;
	}
	.qr::after {
		right: -12px;
	}
	.qr img {
		max-width: 100%;
		height: auto;
	}

	@media print {
		.ticket {
			border: 1px solid #000;
			box-shadow: none;
		}
		.haut {
			color: #000;
			background: #fff !important;
			border-bottom: 2px solid #000;
		}
		.qr::before,
		.qr::after {
			display: none;
		}
	}
</style>
