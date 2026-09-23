<script lang="ts">
	import { enhance } from '$app/forms';
	import { euros } from '$lib/argent';
	import { dateLongue, heureBelge, limiteLongue } from '$lib/dates';
	import { lienMaps } from '$lib/lieu';
	let { data, form } = $props();

	const r = $derived(data.reservation);
	const e = $derived(data.evenement);
	const couleur = $derived(e.couleur || data.club.couleur);
	const maps = $derived(lienMaps(e.lieu_nom, e.lieu_adresse));
	const annule = $derived(
		form?.annule || r.statut_paiement === 'annule' || r.statut_paiement === 'rembourse'
	);
	const expire = $derived(r.statut_paiement === 'expire');

	let ouvrirAnnulation = $state(false);
</script>

<svelte:head>
	<title>Ma réservation — {e.titre}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page" style="--couleur:{couleur};max-width:640px">
	{#if data.nouveau && !annule}
		<div class="message ok">
			<strong>C’est réservé, merci !</strong>
			{#if r.email}
				Un e-mail avec votre ticket part vers {r.email}.
			{/if}
		</div>
	{/if}

	{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}
	{#if form?.renvoye}<div class="message ok">E-mail renvoyé.</div>{/if}
	{#if form?.ok}<div class="message ok">{form.ok}</div>{/if}

	{#if annule}
		<div class="message erreur">
			<strong>Réservation annulée.</strong>
			{#if form?.rembourse || r.statut_paiement === 'rembourse'}
				Le remboursement de {euros(r.total_centimes)} a été demandé ; comptez quelques jours
				ouvrables.
			{/if}
			Votre ticket n’est plus valable.
		</div>
	{/if}

	<div class="carte">
		<h1 style="color:var(--couleur)">{e.titre}</h1>
		<p>
			<strong>{dateLongue(e.date)}</strong>
			{#if data.service}
				<br />Service : <strong>{data.service.libelle}</strong>
				{#if data.service.heure}({heureBelge(data.service.heure)}){/if}
			{:else if e.heure_debut}
				<br />dès {heureBelge(e.heure_debut)}
			{/if}
		</p>
		{#if e.lieu_nom || e.lieu_adresse}
			<p class="muet">
				{#if e.lieu_nom}<strong>{e.lieu_nom}</strong><br />{/if}
				{e.lieu_adresse ?? ''}
				{#if maps}<br /><a href={maps} target="_blank" rel="noreferrer noopener">Voir sur Google Maps</a>{/if}
			</p>
		{/if}
		<p class="petit muet">Au nom de {r.prenom} {r.nom}</p>
	</div>

	<div class="carte">
		<h2>Ma commande</h2>
		<table class="tableau">
			<tbody>
				{#each data.lignes as l (l.ligne_menu_id)}
					<tr>
						<td>{l.quantite} × {l.nom}</td>
						<td class="nombre">{euros(l.quantite * l.prix_centimes)}</td>
					</tr>
				{/each}
				{#if r.frais_centimes > 0}
					<tr>
						<td class="muet">Frais de réservation</td>
						<td class="nombre muet">{euros(r.frais_centimes)}</td>
					</tr>
				{/if}
				<tr>
					<td><strong>Total</strong></td>
					<td class="nombre"><strong>{euros(r.total_centimes)}</strong></td>
				</tr>
			</tbody>
		</table>

		{#if data.reponses.length > 0}
			<div style="margin-top:14px">
				{#each data.reponses as rep (rep.option_id)}
					<p class="petit"><strong>{rep.libelle} :</strong> {rep.valeur}</p>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ------------------------------------------------------------ paiement -->
	{#if !annule}
		<div class="carte">
			<h2>Mon paiement</h2>
			{#if r.statut_paiement === 'paye'}
				<div class="message ok">C’est payé. Il n’y a plus rien à faire.</div>
			{:else if r.mode_paiement === 'sur_place'}
				<div class="message info">
					<strong>À payer sur place : {euros(r.total_centimes)}</strong><br />
					Prévoyez de quoi payer le soir même.
				</div>
			{:else if r.mode_paiement === 'virement'}
				<div class="message info">
					<strong>À payer par virement : {euros(r.total_centimes)}</strong>
					{#if e.iban}<br />Compte : <strong>{e.iban}</strong>{/if}
					<br />Communication : <strong>{r.communication_structuree}</strong>
					<br /><span class="petit">
						Recopiez bien la communication : c’est elle qui permet de retrouver votre paiement.
					</span>
				</div>
			{:else if r.statut_paiement === 'expire' || data.paiement === 'expire'}
				<div class="message info">
					<strong>Votre paiement n’est pas arrivé à temps</strong><br />
					La place a été relâchée pour laisser la main aux autres. Vous pouvez reprendre votre
					réservation, si des places restent.
				</div>
				<form method="POST" action="?/reprendre" use:enhance>
					<button class="bouton" type="submit">Reprendre ma réservation</button>
				</form>
			{:else if data.paiement === 'impossible'}
				<div class="message info">
					<strong>Le paiement en ligne ne répond pas</strong><br />
					Votre réservation est gardée. Réessayez, ou payez sur place le soir même.
				</div>
				<div class="rangee">
					<a class="bouton" href="/r/{r.token_gestion}/payer">Réessayer de payer</a>
					{#if e.paiement_sur_place}
						<form method="POST" action="?/payer_sur_place" use:enhance>
							<button class="bouton second" type="submit">Je paierai sur place</button>
						</form>
					{/if}
				</div>
			{:else if r.mode_paiement === 'en_ligne'}
				<div class="message info">
					<strong>Paiement en ligne à terminer : {euros(r.total_centimes)}</strong>
				</div>
				<a class="bouton" href="/r/{r.token_gestion}/payer">Payer maintenant</a>
			{/if}
		</div>

		<!-- -------------------------------------------------------- mon ticket -->
		{#if !expire && data.ticket}
		<div class="carte centre">
			<h2>Mon ticket d’entrée</h2>
			{#if data.ticket}
				<img
					src="/r/{r.token_gestion}/qr.png"
					alt="QR code de votre ticket"
					width="220"
					height="220"
					style="max-width:100%;height:auto"
				/>
				<p class="petit muet">À présenter à l’entrée, sur le téléphone ou imprimé.</p>
				<div class="rangee" style="justify-content:center">
					<a class="bouton" href="/r/{r.token_gestion}/ticket">Voir et imprimer mon ticket</a>
					{#if e.date}
						<a class="bouton second" href="/r/{r.token_gestion}/agenda.ics" download>
							Ajouter à mon agenda
						</a>
					{/if}
				</div>
			{/if}
		</div>
		{/if}
	{/if}

	<!-- ------------------------------------------------------------ gestion -->
	<div class="carte">
		<h2>Mon lien personnel</h2>
		<p class="muet petit">
			Gardez cette adresse : elle donne accès à votre réservation, sans mot de passe.
		</p>

		{#if r.email && !annule}
			<form method="POST" action="?/renvoyer" use:enhance>
				<button class="bouton second" type="submit">Me renvoyer l’e-mail</button>
			</form>
		{/if}

		{#if data.annulable && !annule}
			<div style="margin-top:16px">
				{#if !ouvrirAnnulation}
					<button class="bouton danger" type="button" onclick={() => (ouvrirAnnulation = true)}>
						Annuler ma réservation
					</button>
				{:else}
					<div class="message info">
						{#if r.statut_paiement === 'paye' && r.mode_paiement === 'en_ligne'}
							Votre paiement sera remboursé automatiquement.
						{:else}
							Il n’y a rien à rembourser.
						{/if}
					</div>
					<form method="POST" action="?/annuler" use:enhance>
						<div class="rangee">
							<button class="bouton danger" type="submit">Oui, annuler</button>
							<button class="bouton second" type="button" onclick={() => (ouvrirAnnulation = false)}>
								Non, garder
							</button>
						</div>
					</form>
				{/if}
			</div>
			{#if e.date_limite}
				<p class="petit muet" style="margin-top:10px">
					Annulation possible jusqu’au {limiteLongue(e.date_limite)}.
				</p>
			{/if}
		{:else if !annule}
			<p class="petit muet">
				Il est trop tard pour annuler en ligne. Contactez le club, il fera le nécessaire.
			</p>
		{/if}
	</div>

	<p class="centre petit muet">
		<a href="/{data.club.slug}">{data.club.nom}</a> —
		<a href="/confidentialite">Confidentialité</a>
	</p>
</div>
