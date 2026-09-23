<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import ChoixCouleur from '$lib/ChoixCouleur.svelte';
	import { euros } from '$lib/argent';
	import { dateLongue } from '$lib/dates';
	let { data, form } = $props();

	let couleur = $state(untrack(() => data.club.couleur));
	let ouvrirSuppression = $state(false);
	let ouvrirDetache = $state(false);
	let aRetirer = $state<number | null>(null);
	let copie = $state(false);

	async function copier(texte: string) {
		try {
			await navigator.clipboard.writeText(texte);
			copie = true;
			setTimeout(() => (copie = false), 2500);
		} catch {
			copie = false;
		}
	}

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

	function jamais(t: number | null) {
		return t ? new Date(t * 1000).toLocaleDateString('fr-BE') : 'jamais connecté';
	}
</script>

<svelte:head><title>{data.club.nom} — réglages</title></svelte:head>

<div class="page">
	<p><a class="retour" href="/admin">← Tous les clubs</a></p>

	<h1>{data.club.nom}</h1>
	<p class="muet">
		Page publique : <a href="/{data.club.slug}">/{data.club.slug}</a>
	</p>

	<!-- Où en est ce club, en trois lignes. -->
	<ul class="liste avancement">
		<li class="fait">Espace ouvert</li>
		<li class={data.organisateurs.some((o) => o.derniere_connexion_le) ? 'fait' : 'attente'}>
			{#if data.organisateurs.some((o) => o.derniere_connexion_le)}
				L’organisateur s’est connecté
			{:else}
				L’organisateur a reçu son accès, il ne s’est pas encore connecté
			{/if}
		</li>
		<li class={data.mollieRelie ? 'fait' : 'attente'}>
			{data.mollieRelie
				? 'Paiement en ligne actif'
				: 'Paiement en ligne pas relié — le lien est parti avec l’invitation'}
		</li>
	</ul>

	{#if data.cree}
		<div class="message ok">
			Club créé. L’organisateur a reçu son lien de connexion par e-mail.
		</div>
	{/if}
	{#if form?.ok}<div class="message ok">{form.ok}</div>{/if}
	{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}

	<!-- ------------------------------------------------------------ Mollie -->
	<div class="carte">
		<h2>Compte Mollie du club</h2>
		<p class="muet petit">
			L’argent des réservations arrive directement sur le compte du club. La commission est
			prélevée automatiquement au passage.
		</p>
		{#if data.mollie === 'ok'}
			<div class="message ok">Compte Mollie relié.</div>
		{:else if data.mollie === 'refuse'}
			<div class="message erreur">Le club a refusé l’autorisation Mollie.</div>
		{:else if data.mollie === 'erreur'}
			<div class="message erreur">
				La liaison a échoué. Vérifiez MOLLIE_CLIENT_ID, MOLLIE_CLIENT_SECRET et l’adresse de
				redirection, puis réessayez.
			</div>
		{/if}

		<div class="rangee" style="margin-bottom:12px">
			<span class="etiquette {data.mollieRelie ? 'vert' : 'gris'}">
				{data.mollieRelie ? 'Compte relié' : 'Pas encore relié'}
			</span>
			{#if data.mollieOnboarding === 'peut_encaisser'}
				<span class="etiquette vert">peut encaisser</span>
			{:else if data.mollieOnboarding}
				<span class="etiquette orange">dossier Mollie en cours de vérification</span>
			{/if}
			{#if data.club.mollie_org_id}
				<span class="petit muet">organisation : {data.club.mollie_org_id}</span>
			{/if}
		</div>

		{#if !data.mollieConfigure}
			<div class="message info">
				Renseignez d’abord <code>MOLLIE_CLIENT_ID</code> et <code>MOLLIE_CLIENT_SECRET</code> dans
				le fichier <code>.env</code> de la plateforme.
			</div>
		{/if}

		{#if form?.lienMollie}
			<div class="message ok">
				<strong>Lien à transmettre au club</strong><br />
				C’est le club qui accepte, depuis son propre compte Mollie. Envoyez-lui cette adresse ;
				elle est valable 24 heures.
			</div>
			<div class="champ">
				<input type="text" readonly value={form.lienMollie} onclick={(ev) => ev.currentTarget.select()} />
			</div>
			<div class="rangee">
				<button class="bouton" type="button" onclick={() => copier(form.lienMollie)}>
					{copie ? 'Copié !' : 'Copier le lien'}
				</button>
				<a class="bouton second" href={form.lienMollie} target="_blank" rel="noreferrer noopener">
					Ouvrir moi-même
				</a>
			</div>
		{:else}
			<div class="rangee">
				<form method="POST" action="?/mollie" use:enhance>
					<button class="bouton" type="submit" disabled={!data.mollieConfigure}>
						{data.mollieRelie ? 'Refaire un lien de liaison' : 'Créer le lien pour le club'}
					</button>
				</form>
				{#if data.mollieRelie}
					{#if !ouvrirDetache}
						<button class="bouton danger" type="button" onclick={() => (ouvrirDetache = true)}>
							Enlever le compte Mollie
						</button>
					{/if}
				{/if}
			</div>

			{#if ouvrirDetache}
				<div class="message info" style="margin-top:12px">
					Les paiements en ligne s’arrêteront tout de suite pour les événements publiés.
				</div>
				<form method="POST" action="?/mollie_delier" use:enhance>
					<input type="hidden" name="confirme" value="oui" />
					<div class="rangee">
						<button class="bouton danger" type="submit">Oui, enlever</button>
						<button class="bouton second" type="button" onclick={() => (ouvrirDetache = false)}>
							Non, garder
						</button>
					</div>
				</form>
			{/if}
		{/if}

		<p class="petit muet" style="margin-top:12px">
			Une fois relié, chaque paiement arrive directement sur le compte du club, et la commission de
			{(data.club.commission_centimes / 100).toFixed(2).replace('.', ',')} € par couvert est
			prélevée au passage.
		</p>
	</div>

	<!-- ---------------------------------------------------------- réglages -->
	<div class="carte">
		<h2>Réglages</h2>
		<form method="POST" action="?/reglages" enctype="multipart/form-data">
			<div class="champ">
				<label for="nom">Nom du club</label>
				<input id="nom" name="nom" type="text" required value={data.club.nom} />
			</div>

			<div class="champ">
				<label for="slug">Adresse du site pour ce club</label>
				{#if data.slugVerrouille}
					<span class="aide">
						Des affiches et des QR codes portent cette adresse : elle ne peut plus changer.
					</span>
					<input id="slug" name="slug" type="text" readonly value={data.club.slug} />
				{:else}
					<span class="aide">La partie après le nom du site.</span>
					<input id="slug" name="slug" type="text" required value={data.club.slug} />
				{/if}
			</div>

			<div class="champ">
				<label for="logo">Remplacer le logo <span class="muet">(facultatif)</span></label>
				{#if data.club.logo}
					<img
						src={data.club.logo}
						alt="Logo actuel"
						style="max-height:64px;display:block;margin-bottom:8px"
					/>
				{/if}
				<input id="logo" name="logo" type="file" accept="image/*" />
			</div>

			<div class="champ">
				<span class="faux-label">Couleur principale</span>
				<ChoixCouleur bind:valeur={couleur} />
			</div>

			<div class="grille deux">
				<div class="champ">
					<label for="commission">Commission par couvert</label>
					<input
						id="commission"
						name="commission"
						type="text"
						inputmode="decimal"
						value={(data.club.commission_centimes / 100).toFixed(2).replace('.', ',')}
					/>
				</div>
				<div class="champ">
					<label for="frais">Ces frais sont payés par</label>
					<select id="frais" name="frais_payes_par">
						<option value="participant" selected={data.club.frais_payes_par === 'participant'}>
							le participant
						</option>
						<option value="club" selected={data.club.frais_payes_par === 'club'}>le club</option>
					</select>
				</div>
			</div>

			<div class="champ">
				<label for="actif">Espace du club</label>
				<select id="actif" name="actif">
					<option value="oui" selected={data.club.actif}>actif</option>
					<option value="non" selected={!data.club.actif}>désactivé</option>
				</select>
			</div>

			<button class="bouton" type="submit">Enregistrer les réglages du club</button>
		</form>
	</div>

	<!-- ----------------------------------------------------- organisateurs -->
	<div class="carte">
		<h2>Organisateurs</h2>
		{#if data.organisateurs.length === 0}
			<p class="muet">Aucun organisateur.</p>
		{:else}
			<div class="defilant">
				<table class="tableau">
					<thead>
						<tr><th>E-mail</th><th>Dernière connexion</th><th></th></tr>
					</thead>
					<tbody>
						{#each data.organisateurs as o (o.id)}
							<tr>
								<td>{o.email}</td>
								<td class="petit muet">{jamais(o.derniere_connexion_le)}</td>
								<td>
									{#if aRetirer === o.id}
										<form method="POST" action="?/retirer" use:enhance>
											<input type="hidden" name="utilisateur_id" value={o.id} />
											<input type="hidden" name="confirme" value="oui" />
											<div class="rangee">
												<button class="bouton danger" type="submit">Oui, enlever</button>
												<button class="bouton second" type="button" onclick={() => (aRetirer = null)}>
													Non
												</button>
											</div>
										</form>
									{:else}
										<button class="lien-danger" type="button" onclick={() => (aRetirer = o.id)}>
											Enlever
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<form method="POST" action="?/inviter" style="margin-top:16px">
			<div class="champ">
				<label for="invite">Inviter un organisateur</label>
				<span class="aide">Il reçoit un lien de connexion, sans mot de passe à retenir.</span>
				<input id="invite" name="email" type="email" required placeholder="tresorier@fc-exemple.be" />
			</div>
			<button class="bouton second" type="submit">Envoyer l’invitation</button>
		</form>
	</div>

	<!-- ------------------------------------------------------- événements -->
	<div class="carte">
		<h2>Événements du club</h2>
		{#if data.evenements.length === 0}
			<p class="muet">Aucun événement pour l’instant.</p>
		{:else}
			<div class="defilant">
				<table class="tableau">
					<thead>
						<tr>
							<th>Événement</th>
							<th>Date</th>
							<th>État</th>
							<th class="nombre">Couverts</th>
							<th class="nombre">Commissions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.evenements as e (e.id)}
							<tr>
								<td>
									{#if e.statut === 'publie'}
										<a href="/{data.club.slug}/{e.slug}">{e.titre || 'Sans titre'}</a>
									{:else}
										{e.titre || 'Sans titre'}
									{/if}
								</td>
								<td>{dateLongue(e.date) || '—'}</td>
								<td
									><span class="etiquette {couleurStatut[e.statut]}">{libelleStatut[e.statut]}</span
									></td
								>
								<td class="nombre">{e.couverts}</td>
								<td class="nombre">{euros(Number(e.commissions))}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- ------------------------------------------------------- suppression -->
	<div class="carte" style="border-color:var(--rouge)">
		<h2>Supprimer le club</h2>
		<p class="muet petit">
			Tout est effacé : événements, réservations, tickets. C’est définitif et sans retour.
		</p>
		{#if !ouvrirSuppression}
			<button class="bouton danger" type="button" onclick={() => (ouvrirSuppression = true)}>
				Je veux supprimer ce club
			</button>
		{:else}
			<form method="POST" action="?/supprimer">
				<div class="champ">
					<label for="confirmation">
						Recopiez <code>{data.club.slug}</code> pour confirmer
					</label>
					<input id="confirmation" name="confirmation" type="text" required autocomplete="off" />
				</div>
				<div class="rangee">
					<button class="bouton danger" type="submit">Supprimer définitivement</button>
					<button class="bouton second" type="button" onclick={() => (ouvrirSuppression = false)}>
						Annuler
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.avancement {
		margin-bottom: 20px;
	}
	.avancement :global(li) {
		position: relative;
		padding: 10px 0 10px 32px;
	}
	.avancement :global(li)::before {
		position: absolute;
		left: 2px;
		font-weight: 700;
	}
	.avancement :global(.fait)::before {
		content: '✓';
		color: var(--vert);
	}
	.avancement :global(.attente) {
		color: var(--orange);
	}
	.avancement :global(.attente)::before {
		content: '•';
	}
	.lien-danger {
		min-height: 48px;
		padding: 0 4px;
		font: inherit;
		font-size: 17px;
		color: var(--rouge);
		background: none;
		border: none;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
