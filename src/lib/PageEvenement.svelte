<script lang="ts">
	/**
	 * La page publique de réservation. Le même composant sert d'aperçu en direct
	 * dans l'écran de création (`apercu = true` : tout est inerte).
	 */
	import { enhance } from '$app/forms';
	import { euros } from '$lib/argent';
	import { dateLongue, heureBelge, limiteLongue } from '$lib/dates';
	import { lienMaps } from '$lib/lieu';

	type Club = { nom: string; logo: string | null; couleur: string };
	type Evenement = {
		titre: string;
		date: string | null;
		heure_debut: string | null;
		lieu_nom: string | null;
		lieu_adresse: string | null;
		image: string | null;
		date_limite: string | null;
		paiement_en_ligne: boolean;
		paiement_sur_place: boolean;
		paiement_virement: boolean;
		couleur: string | null;
		logo: string | null;
		texte_accueil: string | null;
	};
	type Service = { id: number; libelle: string; heure: string | null; restant?: number | null };
	type Ligne = {
		id: number;
		nom: string;
		prix_centimes: number;
		categorie: string;
		restant?: number | null;
		compte_comme_couvert: boolean;
	};
	type Option = { id: number; libelle: string; type: string; obligatoire: boolean };

	let {
		club,
		evenement,
		services = [],
		menu = [],
		options = [],
		placesRestantes = null,
		fraisParCouvert = 0,
		apercu = false,
		erreur = null,
		ferme = false
	}: {
		club: Club;
		evenement: Evenement;
		services?: Service[];
		menu?: Ligne[];
		options?: Option[];
		placesRestantes?: number | null;
		fraisParCouvert?: number;
		apercu?: boolean;
		erreur?: string | null;
		ferme?: boolean;
	} = $props();

	let envoi = $state(false);
	let telephoneOuvert = $state(false);
	const inerte = $derived(apercu || ferme);

	/* ------------------------------------------------------------- panier */

	let quantites = $state<Record<number, number>>({});
	let service_id = $state<number | null>(null);
	let mode_paiement = $state<string>('');

	/* Le premier service encore ouvert est déjà choisi : la plupart des gens
	   prennent celui-là, et plus personne ne bute sur « choisissez un service ». */
	$effect(() => {
		if (service_id !== null || services.length === 0) return;
		const libre = services.find((s) => s.restant === null || s.restant === undefined || s.restant > 0);
		if (libre) service_id = libre.id;
	});

	const quantite = (id: number) => quantites[id] ?? 0;

	function changer(ligne: Ligne, pas: number) {
		if (inerte) return;
		const actuel = quantite(ligne.id);
		let suivant = Math.max(0, actuel + pas);
		const plafond = ligne.restant ?? null;
		if (plafond !== null && suivant > plafond) suivant = plafond;
		quantites = { ...quantites, [ligne.id]: suivant };
	}

	const panier = $derived(menu.filter((l) => quantite(l.id) > 0));
	const sousTotal = $derived(panier.reduce((t, l) => t + quantite(l.id) * l.prix_centimes, 0));
	const couverts = $derived(
		panier.filter((l) => l.compte_comme_couvert).reduce((t, l) => t + quantite(l.id), 0)
	);

	const modesPossibles = $derived(
		[
			evenement.paiement_en_ligne ? { cle: 'en_ligne', libelle: 'Payer maintenant en ligne' } : null,
			evenement.paiement_sur_place ? { cle: 'sur_place', libelle: 'Payer sur place, le soir même' } : null,
			evenement.paiement_virement ? { cle: 'virement', libelle: 'Payer par virement bancaire' } : null
		].filter(Boolean) as { cle: string; libelle: string }[]
	);

	const modeChoisi = $derived(mode_paiement || modesPossibles[0]?.cle || '');
	const frais = $derived(modeChoisi === 'en_ligne' ? couverts * fraisParCouvert : 0);
	const total = $derived(sousTotal + frais);

	const couleur = $derived(evenement.couleur || club.couleur);
	const logo = $derived(evenement.logo || club.logo);
	const maps = $derived(lienMaps(evenement.lieu_nom, evenement.lieu_adresse));

	const CATEGORIES: Record<string, string> = {
		plat: 'Les plats',
		dessert: 'Les desserts',
		boisson: 'Les boissons en prévente',
		autre: 'Autres'
	};
	const groupes = $derived(
		(['plat', 'dessert', 'boisson', 'autre'] as const)
			.map((c) => ({ categorie: c, titre: CATEGORIES[c], lignes: menu.filter((l) => l.categorie === c) }))
			.filter((g) => g.lignes.length > 0)
	);

	const libelleBouton = $derived(
		panier.length === 0
			? 'Choisissez dans le menu'
			: modeChoisi === 'en_ligne'
				? `Payer ${euros(total)}`
				: `Confirmer ma réservation — ${euros(total)}`
	);
</script>

<div class="evenement" style="--couleur:{couleur}">
	<!-- ------------------------------------------------------------- en-tête -->
	{#if evenement.image}
		<img class="affiche" src={evenement.image} alt="" />
	{/if}

	<div class="carte souche">
		{#if logo && !evenement.image}
			<img src={logo} alt="" class="logo" />
		{/if}
		<span class="club">{club.nom}</span>
		<h1>{evenement.titre || 'Titre de votre événement'}</h1>
		<p class="quand">
			{#if evenement.date}
				<strong>{dateLongue(evenement.date)}</strong>
				{#if evenement.heure_debut}&nbsp;— dès {heureBelge(evenement.heure_debut)}{/if}
			{:else}
				<span class="muet">Date à compléter</span>
			{/if}
		</p>
		{#if evenement.lieu_nom || evenement.lieu_adresse}
			<p class="ou">
				{#if evenement.lieu_nom}<strong>{evenement.lieu_nom}</strong><br />{/if}
				{evenement.lieu_adresse ?? ''}
				{#if maps}
					<br /><a href={maps} target="_blank" rel="noreferrer noopener">Voir sur Google Maps</a>
				{/if}
			</p>
		{/if}

		{#if placesRestantes !== null && placesRestantes < 20}
			<p class="message {placesRestantes <= 0 ? 'erreur' : 'info'}">
				{#if placesRestantes <= 0}
					Complet — il n’y a plus de place.
				{:else}
					Attention : il ne reste plus que <strong>{placesRestantes}</strong>
					{placesRestantes === 1 ? 'place' : 'places'}.
				{/if}
			</p>
		{/if}

		{#if evenement.texte_accueil}
			<p class="accueil">{evenement.texte_accueil}</p>
		{/if}
	</div>

	<form
		method="POST"
		action="?/reserver"
		use:enhance={() => {
			envoi = true;
			return async ({ update }) => {
				await update({ reset: false });
				envoi = false;
				const souci = document.getElementById('erreur-reservation');
				if (souci) {
					souci.scrollIntoView({ block: 'center' });
					souci.focus();
				}
			};
		}}
	>
	<!-- --------------------------------------------------------------- menu -->
	{#if menu.length > 0}
		<div class="carte">
			<h2>Je choisis</h2>
			{#each groupes as g (g.categorie)}
				{#if groupes.length > 1}<h3 class="groupe">{g.titre}</h3>{/if}
				{#each g.lignes as ligne (ligne.id)}
					<div class="ligne" class:epuise={ligne.restant === 0}>
						<div class="quoi">
							<span class="nom">{ligne.nom}</span>
							<span class="prix">{euros(ligne.prix_centimes)}</span>
							{#if ligne.restant === 0}
								<span class="etiquette rouge">épuisé</span>
							{:else if ligne.restant !== null && ligne.restant !== undefined && ligne.restant < 10}
								<span class="petit muet">plus que {ligne.restant}</span>
							{/if}
						</div>
						<input type="hidden" name="q_{ligne.id}" value={quantite(ligne.id)} />
						<div class="compteur">
							<button
								type="button"
								aria-label="Enlever un {ligne.nom}"
								onclick={() => changer(ligne, -1)}
								disabled={inerte || quantite(ligne.id) === 0}>−</button
							>
							<span class="nombre" aria-live="polite">{quantite(ligne.id)}</span>
							<button
								type="button"
								aria-label="Ajouter un {ligne.nom}"
								onclick={() => changer(ligne, 1)}
								disabled={inerte || ligne.restant === 0}>+</button
							>
						</div>
					</div>
				{/each}
			{/each}

			<div class="total">
				<span>Total</span>
				<strong>{euros(total)}</strong>
			</div>
		</div>
	{/if}

	<!-- ------------------------------------------------------------ service -->
	{#if services.length > 0}
		<div class="carte">
			<h2>Mon service</h2>
			{#each services as s (s.id)}
				{@const complet = s.restant !== null && s.restant !== undefined && s.restant <= 0}
				<label class="choix-ligne" class:epuise={complet}>
					<input
						type="radio"
						name="service_id"
						value={s.id}
						checked={service_id === s.id}
						disabled={inerte || complet}
						onchange={() => (service_id = s.id)}
					/>
					<span>
						<strong>{s.libelle}</strong>
						{#if s.heure}<span class="muet"> — {heureBelge(s.heure)}</span>{/if}
						{#if complet}<span class="etiquette rouge">complet</span>
						{:else if s.restant !== null && s.restant !== undefined && s.restant < 20}
							<span class="petit muet">plus que {s.restant} places</span>
						{/if}
					</span>
				</label>
			{/each}
		</div>
	{/if}

	<!-- -------------------------------------------------------- coordonnées -->
	<div class="carte">
		<h2>Mes coordonnées</h2>
		<div class="grille deux">
			<div class="champ">
				<label for="ap-prenom">Prénom</label>
				<input id="ap-prenom" name="prenom" type="text" autocomplete="given-name" disabled={inerte} required={!inerte} />
			</div>
			<div class="champ">
				<label for="ap-nom">Nom</label>
				<input id="ap-nom" name="nom" type="text" autocomplete="family-name" disabled={inerte} required={!inerte} />
			</div>
		</div>
		<div class="champ">
			<label for="ap-email">Adresse e-mail</label>
			<span class="aide">C’est là que nous envoyons votre ticket.</span>
			<input id="ap-email" name="email" type="email" inputmode="email" autocomplete="email" disabled={inerte} required={!inerte} />
		</div>
		{#if telephoneOuvert}
			<div class="champ">
				<label for="ap-tel">Téléphone</label>
				<span class="aide">Seulement si le club doit vous joindre.</span>
				<input id="ap-tel" name="telephone" type="tel" inputmode="tel" autocomplete="tel" disabled={inerte} />
			</div>
		{:else}
			<button class="ajout-champ" type="button" disabled={inerte} onclick={() => (telephoneOuvert = true)}>
				Ajouter mon numéro de téléphone
			</button>
		{/if}

		{#each options as o (o.id)}
			<div class="champ">
				{#if o.type === 'case'}
					<label class="choix-ligne">
						<input type="checkbox" name="option_{o.id}" disabled={inerte} />
						<span>{o.libelle}{#if o.obligatoire}&nbsp;*{/if}</span>
					</label>
				{:else}
					<label for="ap-option-{o.id}">
						{o.libelle}{#if !o.obligatoire}<span class="muet"> (facultatif)</span>{/if}
					</label>
					<input id="ap-option-{o.id}" name="option_{o.id}" type="text" disabled={inerte} required={o.obligatoire && !inerte} />
				{/if}
			</div>
		{/each}
	</div>

	<!-- ------------------------------------------------------------ paiement -->
	{#if modesPossibles.length > 0}
		<div class="carte">
			<h2>Mon paiement</h2>
			{#each modesPossibles as m (m.cle)}
				<label class="choix-ligne">
					<input
						type="radio"
						name="mode_paiement"
						value={m.cle}
						checked={modeChoisi === m.cle}
						disabled={inerte}
						onchange={() => (mode_paiement = m.cle)}
					/>
					<span>{m.libelle}</span>
				</label>
			{/each}
		</div>
	{/if}

	<!-- ----------------------------------------------------------- validation -->
	<div class="carte">
		<h2>Je vérifie et je valide</h2>
		{#if panier.length === 0}
			<p class="muet">Choisissez d’abord dans le menu, juste au-dessus.</p>
		{:else}
			<table class="tableau recap">
				<tbody>
					{#each panier as l (l.id)}
						<tr>
							<td>{quantite(l.id)} × {l.nom}</td>
							<td class="nombre">{euros(quantite(l.id) * l.prix_centimes)}</td>
						</tr>
					{/each}
					{#if frais > 0}
						<tr>
							<td class="muet">Frais de réservation</td>
							<td class="nombre muet">{euros(frais)}</td>
						</tr>
					{/if}
					<tr class="gros">
						<td><strong>Total</strong></td>
						<td class="nombre"><strong>{euros(total)}</strong></td>
					</tr>
				</tbody>
			</table>
			{#if couverts > 0}
				<p class="petit muet">{couverts} {couverts === 1 ? 'couvert' : 'couverts'}</p>
			{/if}
		{/if}

		{#if erreur}
			<div class="message erreur" id="erreur-reservation" tabindex="-1">{erreur}</div>
		{/if}

		<button
			class="bouton large"
			type={inerte ? 'button' : 'submit'}
			disabled={inerte || panier.length === 0 || envoi}
		>
			{envoi ? 'Un instant…' : libelleBouton}
		</button>

		{#if evenement.date_limite}
			<p class="petit muet centre" style="margin-top:12px">
				Réservations jusqu’au {limiteLongue(evenement.date_limite)}.
			</p>
		{/if}

	</div>
	{#if !inerte}
		<!-- Sur téléphone, le total et le bouton restent sous le pouce. -->
		<div class="barre-basse">
			<span class="somme">{euros(total)}</span>
			<button class="bouton" type="submit" disabled={panier.length === 0 || envoi}>
				{envoi ? 'Un instant…' : panier.length === 0 ? 'Choisissez un plat' : 'Réserver'}
			</button>
		</div>
	{/if}
	</form>

	<p class="petit muet centre pied-page">
		<a href="/confidentialite">Confidentialité</a>
	</p>
</div>

<style>
	.evenement {
		max-width: 680px;
		margin: 0 auto;
		padding: 16px 16px 64px;
	}
	.affiche {
		width: 100%;
		max-height: 300px;
		object-fit: cover;
		border-radius: var(--rayon);
		display: block;
		margin-bottom: 16px;
	}
	.logo {
		max-height: 72px;
		display: block;
		margin-bottom: 12px;
	}
	/* La souche du ticket : le club au-dessus, le titre en gros. */
	.souche .club {
		display: block;
		font-size: 17px;
		font-weight: 600;
		color: var(--rouge);
		margin-bottom: 2px;
	}
	.souche h1 {
		margin-bottom: 10px;
	}
	.quand,
	.ou {
		margin-bottom: 10px;
	}
	.accueil {
		margin: 16px 0 0;
		white-space: pre-line;
	}
	.groupe {
		margin: 22px 0 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--bord);
		color: var(--encre-douce);
		font-size: 17px;
	}

	.ligne {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--bord);
		flex-wrap: wrap;
	}
	.ligne:last-of-type {
		border-bottom: none;
	}
	.ligne.epuise .quoi {
		opacity: 0.55;
	}
	.quoi {
		flex: 1;
		min-width: 160px;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: baseline;
	}
	.nom {
		font-weight: 600;
		font-size: 17px;
	}
	.prix {
		color: var(--encre-douce);
		font-variant-numeric: tabular-nums;
	}

	.compteur {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.compteur button {
		width: 52px;
		height: 52px;
		font-size: 28px;
		line-height: 1;
		font-weight: 700;
		color: var(--couleur);
		background: #fff;
		border: 2px solid var(--couleur);
		border-radius: 10px;
		cursor: pointer;
	}
	.compteur button:disabled {
		color: var(--bord);
		border-color: var(--bord);
		cursor: not-allowed;
	}
	.compteur .nombre {
		min-width: 44px;
		text-align: center;
		font-size: 21px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.total {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 16px;
		padding-top: 14px;
		border-top: 2px solid var(--encre);
		font-size: 21px;
	}
	.total strong {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 28px;
		font-variant-numeric: tabular-nums;
	}

	.choix-ligne {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 10px 12px;
		margin-bottom: 8px;
		border: 2px solid var(--bord);
		border-radius: 10px;
		font-weight: 400;
		cursor: pointer;
	}
	.choix-ligne:has(input:checked) {
		border-color: var(--couleur);
		background: color-mix(in srgb, var(--couleur) 7%, #fff);
	}
	.choix-ligne.epuise {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.choix-ligne input {
		width: 26px;
		height: 26px;
		accent-color: var(--couleur);
		flex: none;
	}

	.recap td {
		padding: 10px 0;
	}
	.recap .gros td {
		border-top: 2px solid var(--encre);
		font-size: 19px;
	}

	.ajout-champ {
		min-height: 48px;
		padding: 0 4px;
		font: inherit;
		font-size: 17px;
		color: var(--couleur-sombre);
		background: none;
		border: none;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.pied-page {
		margin: 20px 0 0;
	}

	/* La barre collante n'a de sens que sur un écran étroit. */
	.barre-basse {
		display: none;
	}
	@media (max-width: 720px) {
		.barre-basse {
			position: sticky;
			bottom: 0;
			z-index: 20;
			display: flex;
			align-items: center;
			gap: 12px;
			margin: 0 -16px;
			padding: 10px 16px;
			background: var(--carte);
			border-top: 2px solid var(--bord);
			box-shadow: 0 -3px 0 var(--bord);
		}
		.barre-basse .somme {
			flex: 1;
			font-family: var(--titre);
			font-weight: 800;
			letter-spacing: -0.02em;
			font-size: 24px;
			font-variant-numeric: tabular-nums;
		}
		.barre-basse .bouton {
			flex: 0 0 auto;
		}
	}
</style>
