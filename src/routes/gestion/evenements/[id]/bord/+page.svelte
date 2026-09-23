<script lang="ts">
	import { enhance } from '$app/forms';
	import { compteur } from '$lib/compteur';
	import { euros } from '$lib/argent';
	import { dateLongue, heureBelge } from '$lib/dates';
	let { data, form } = $props();

	const e = $derived(data.evenement);
	const base = $derived(`/gestion/evenements/${e.id}`);

	let ouvrirAjout = $state(false);
	let quantitesAjout = $state<Record<number, number>>({});
	let recherche = $state('');
	let lienCopie = $state(false);

	/* La liste part avec la page : le filtre se fait sans aller-retour. */
	const visibles = $derived(
		recherche.trim().length === 0
			? data.reservations
			: data.reservations.filter((r) =>
					`${r.nom} ${r.prenom} ${r.email ?? ''} ${r.communication_structuree ?? ''}`
						.toLowerCase()
						.includes(recherche.trim().toLowerCase())
				)
	);

	const totalAjout = $derived(
		data.menu.reduce((t, l) => t + (quantitesAjout[l.id] ?? 0) * l.prix_centimes, 0)
	);
	const couvertsAjout = $derived(
		data.menu
			.filter((l) => l.compte_comme_couvert)
			.reduce((t, l) => t + (quantitesAjout[l.id] ?? 0), 0)
	);

	const libelleStatut: Record<string, string> = {
		paye: 'payé',
		en_attente: 'à payer',
		annule: 'annulé',
		rembourse: 'remboursé',
		expire: 'paiement abandonné'
	};
	const couleurStatut: Record<string, string> = {
		paye: 'vert',
		en_attente: 'orange',
		annule: 'rouge',
		rembourse: 'rouge',
		expire: 'gris'
	};
	const libelleMode: Record<string, string> = {
		en_ligne: 'en ligne',
		sur_place: 'sur place',
		virement: 'virement',
		liquide: 'liquide'
	};
	const parti = (statut: string) => ['annule', 'rembourse', 'expire'].includes(statut);

	async function copierLien() {
		try {
			await navigator.clipboard.writeText(data.lienPublic);
			lienCopie = true;
			setTimeout(() => (lienCopie = false), 2500);
		} catch {
			lienCopie = false;
		}
	}
</script>

<svelte:head><title>Les inscrits — {e.titre}</title></svelte:head>

<div class="page">
	<div class="barre sans-impression">
		<a class="retour" href="/gestion">← Mes soupers</a>
		<span class="espace"></span>
		<a class="retour" href={base}>Modifier le souper</a>
	</div>

	<h1>{e.titre}</h1>
	<p class="muet">
		{dateLongue(e.date)}{#if e.heure_debut} — dès {heureBelge(e.heure_debut)}{/if}
		{#if e.statut !== 'publie'}· <span class="etiquette gris">brouillon</span>{/if}
	</p>

	{#if form?.ok}
		<div class="message ok">
			{form.ok}
			{#if form.lienTicket}
				<a href={form.lienTicket} target="_blank" rel="noreferrer">Imprimer le ticket</a>
			{/if}
		</div>
	{/if}
	{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}

	<!-- ═══════════════════════════════════ personne encore : le lien à partager -->
	{#if data.chiffres.reservations === 0 && data.chiffres.annulees === 0}
		<div class="carte">
			<h2>Personne n’a encore réservé</h2>
			<p class="muet">
				C’est normal si le lien vient de partir. Voici l’adresse à donner, à coller sur Facebook
				ou à imprimer sur l’affiche.
			</p>
			<div class="champ">
				<input type="text" readonly value={data.lienPublic} onclick={(ev) => ev.currentTarget.select()} />
			</div>
			<div class="rangee">
				<button class="bouton" type="button" onclick={copierLien}>
					{lienCopie ? 'Lien copié !' : 'Copier le lien'}
				</button>
				<a class="bouton second" href="{base}/qr" download>Télécharger le QR code</a>
			</div>
		</div>
	{:else}
		<div class="grille quatre">
			<div class="chiffre">
				<div class="valeur" use:compteur={{ valeur: data.chiffres.reservations }}>
					{data.chiffres.reservations}
				</div>
				<div class="quoi">réservations</div>
			</div>
			<div class="chiffre">
				<div class="valeur" use:compteur={{ valeur: data.chiffres.couverts }}>
					{data.chiffres.couverts}
				</div>
				<div class="quoi">
					couverts{#if data.places.capacite}<br /><span class="petit">sur {data.places.capacite}</span>{/if}
				</div>
			</div>
			<div class="chiffre">
				<div class="valeur" use:compteur={{ valeur: data.chiffres.encaisse_centimes, format: euros }}>
					{euros(data.chiffres.encaisse_centimes)}
				</div>
				<div class="quoi">
					sur le compte du club{#if data.chiffres.frais_centimes > 0}<br /><span class="petit"
							>hors {euros(data.chiffres.frais_centimes)} de frais</span
						>{/if}
				</div>
			</div>
			<div class="chiffre">
				<div
					class="valeur"
					style="color:var(--orange)"
					use:compteur={{ valeur: data.chiffres.attendu_centimes, format: euros }}
				>
					{euros(data.chiffres.attendu_centimes)}
				</div>
				<div class="quoi">{data.chiffres.a_payer} réservations à encaisser</div>
			</div>
		</div>
	{/if}

	<div class="rangee sans-impression" style="margin-bottom:20px">
		<button class="bouton" type="button" onclick={() => (ouvrirAjout = !ouvrirAjout)}>
			+ Ajouter une réservation
		</button>
		<a class="bouton second" href="{base}/cuisine">Récap cuisine</a>
		<a class="bouton second" href="{base}/scanner">Mode entrée</a>
	</div>

	<!-- ═══════════════════════════════════════════ réservation à la main -->
	{#if ouvrirAjout || form?.ouvrirAjout}
		<section class="carte sans-impression">
			<h2>Ajouter une réservation</h2>
			<p class="muet petit">Pour quelqu’un qui téléphone, ou une vente à la caisse.</p>

			<form method="POST" action="?/ajouter" use:enhance>
				<div class="grille deux">
					<div class="champ">
						<label for="a-prenom">Prénom</label>
						<input id="a-prenom" name="prenom" type="text" required />
					</div>
					<div class="champ">
						<label for="a-nom">Nom</label>
						<input id="a-nom" name="nom" type="text" required />
					</div>
				</div>
				<div class="grille deux">
					<div class="champ">
						<label for="a-email">E-mail <span class="muet">(facultatif)</span></label>
						<input id="a-email" name="email" type="email" />
					</div>
					<div class="champ">
						<label for="a-tel">Téléphone <span class="muet">(facultatif)</span></label>
						<input id="a-tel" name="telephone" type="tel" />
					</div>
				</div>

				{#if data.services.length > 0}
					<div class="champ">
						<label for="a-service">Heure de passage</label>
						<select id="a-service" name="service_id" required>
							{#each data.services as s (s.id)}
								<option value={s.id}>
									{s.libelle}{#if s.heure} — {heureBelge(s.heure)}{/if}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<span class="faux-label">Commande</span>
				{#each data.menu as l (l.id)}
					<div class="rangee-commande">
						<label class="quoi" for="a-q-{l.id}">
							{l.nom} <span class="muet">{euros(l.prix_centimes)}</span>
						</label>
						<input
							id="a-q-{l.id}"
							type="number"
							min="0"
							max="99"
							inputmode="numeric"
							name="q_{l.id}"
							value={quantitesAjout[l.id] ?? 0}
							oninput={(ev) =>
								(quantitesAjout = { ...quantitesAjout, [l.id]: Number(ev.currentTarget.value) || 0 })}
						/>
					</div>
				{/each}

				<p class="total-ajout">
					{couvertsAjout} {couvertsAjout === 1 ? 'couvert' : 'couverts'} —
					<strong>{euros(totalAjout)}</strong>
				</p>

				{#each data.options as o (o.id)}
					<div class="champ">
						<label for="a-opt-{o.id}">{o.libelle} <span class="muet">(facultatif)</span></label>
						<input id="a-opt-{o.id}" name="option_{o.id}" type="text" />
					</div>
				{/each}

				<div class="champ">
					<label for="a-encaissement">Paiement</label>
					<select id="a-encaissement" name="encaissement">
						<option value="liquide">payé en liquide</option>
						<option value="a_payer">à payer sur place</option>
						<option value="virement_recu">virement déjà reçu</option>
					</select>
				</div>

				<label class="case-ligne">
					<input type="checkbox" name="envoyer_mail" value="oui" checked />
					<span>Envoyer le ticket par e-mail, s’il y a une adresse</span>
				</label>

				<div class="rangee">
					<button class="bouton" type="submit">Enregistrer la réservation</button>
					<button class="bouton second" type="button" onclick={() => (ouvrirAjout = false)}>
						Annuler
					</button>
				</div>
			</form>
		</section>
	{/if}

	<!-- ════════════════════════════════════════════════ récap cuisine -->
	{#if data.cuisine.lignes.length > 0}
		<section class="carte">
			<h2>Récap cuisine</h2>
			<p class="muet petit">Payé et à payer confondus : tout le monde vient manger.</p>

			<div class="defilant">
				<table class="tableau cuisine">
					<thead>
						<tr>
							<th>Plat</th>
							{#each data.cuisine.services as s (s.id)}
								<th class="nombre">
									{s.libelle}{#if s.heure}<br /><span class="petit">{heureBelge(s.heure)}</span>{/if}
								</th>
							{/each}
							<th class="nombre">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each data.cuisine.lignes as l (l.nom)}
							<tr>
								<td>{l.nom}</td>
								{#each data.cuisine.services as s (s.id)}
									<td class="nombre">{l.par_service[s.id] ?? 0}</td>
								{/each}
								<td class="nombre"><strong>{l.total}</strong></td>
							</tr>
						{/each}
						<tr class="couverts">
							<td><strong>Couverts</strong></td>
							{#each data.cuisine.services as s (s.id)}
								<td class="nombre"><strong>{s.couverts}</strong></td>
							{/each}
							<td class="nombre"><strong>{data.cuisine.couverts_total}</strong></td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- ═══════════════════════════════════════════ virements attendus -->
	{#if data.virements.length > 0}
		<section class="carte sans-impression">
			<h2>Virements attendus ({data.virements.length})</h2>
			<p class="muet petit">
				Recopiez la communication lue sur l’extrait de compte : la réservation passe en « payé ».
			</p>

			<form method="POST" action="?/rapprocher" use:enhance class="rangee" style="margin-bottom:16px">
				<input
					name="communication"
					type="text"
					placeholder="+++000/5000/08122+++"
					style="flex:1 1 240px"
					aria-label="Communication structurée"
				/>
				<button class="bouton" type="submit">Trouver ce virement</button>
			</form>

			<ul class="liste-simple">
				{#each data.virements as v (v.id)}
					<li>
						<span>{v.nom} {v.prenom}</span>
						<code class="petit">{v.communication_structuree}</code>
						<strong>{euros(v.total_centimes)}</strong>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ════════════════════════════════════════════ les réservations -->
	<section class="carte">
		<h2>Les inscrits ({visibles.length})</h2>

		<div class="champ sans-impression">
			<label for="recherche">Chercher quelqu’un</label>
			<input
				id="recherche"
				type="search"
				bind:value={recherche}
				placeholder="Un nom, un e-mail, une communication"
			/>
		</div>

		{#if visibles.length === 0}
			<p class="muet">
				{#if recherche.trim()}
					Personne à ce nom.
				{:else}
					Pas encore de réservation.
				{/if}
			</p>
		{:else}
			<ul class="inscrits">
				{#each visibles as r (r.id)}
					<li class:parti={parti(r.statut_paiement)}>
						<div class="qui">
							<span class="nom">{r.nom} {r.prenom}</span>
							<span class="etiquette {couleurStatut[r.statut_paiement]}">
								{libelleStatut[r.statut_paiement]}
							</span>
						</div>

						<p class="detail">
							{r.couverts} {r.couverts === 1 ? 'couvert' : 'couverts'}
							{#if r.service_libelle} · {r.service_libelle}{/if}
							· <strong>{euros(r.total_centimes)}</strong>
							<span class="muet">({libelleMode[r.mode_paiement]})</span>
						</p>

						{#if r.commande}<p class="commande">{r.commande}</p>{/if}
						{#if r.remarques}<p class="remarque">{r.remarques}</p>{/if}
						{#if r.communication_structuree && r.statut_paiement === 'en_attente'}
							<p class="petit muet"><code>{r.communication_structuree}</code></p>
						{/if}
						<p class="petit muet">
							{#if r.source === 'manuelle'}pris au guichet{:else}réservé en ligne{/if}
							{#if r.scanne_le} · déjà entré{/if}
							{#if r.email} · {r.email}{/if}
							{#if r.telephone} · {r.telephone}{/if}
						</p>

						<div class="actes sans-impression">
							{#if r.statut_paiement === 'en_attente'}
								<form method="POST" action="?/marquer_paye" use:enhance>
									<input type="hidden" name="reservation_id" value={r.id} />
									<input type="hidden" name="mode" value="liquide" />
									<button class="bouton second" type="submit">A payé</button>
								</form>
							{:else if r.statut_paiement === 'paye'}
								<form method="POST" action="?/marquer_impaye" use:enhance>
									<input type="hidden" name="reservation_id" value={r.id} />
									<button class="bouton second" type="submit">Pas payé finalement</button>
								</form>
							{/if}

							<a class="bouton second" href="/r/{r.token_gestion}/ticket" target="_blank" rel="noreferrer">
								Ticket
							</a>

							{#if !parti(r.statut_paiement)}
								<form method="POST" action="?/annuler" use:enhance>
									<input type="hidden" name="reservation_id" value={r.id} />
									<input type="hidden" name="prevenir" value="oui" />
									<button class="bouton danger" type="submit">
										Annuler{#if r.mode_paiement === 'en_ligne' && r.statut_paiement === 'paye'}
											 et rembourser{/if}
									</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="exports sans-impression">
			<h3>Imprimer et exporter</h3>
			<div class="rangee">
				<a class="bouton second" href="{base}/export.pdf">Liste à cocher (PDF)</a>
				<a class="bouton second" href="{base}/export.csv">Liste pour Excel</a>
			</div>
		</div>
	</section>
</div>

<style>
	.barre {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}
	.espace {
		flex: 1;
	}

	.grille.quatre {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}
	@media (min-width: 900px) {
		.grille.quatre {
			grid-template-columns: repeat(4, 1fr);
			gap: 16px;
		}
	}

	.cuisine .nombre {
		font-variant-numeric: tabular-nums;
	}
	.cuisine .couverts td {
		border-top: 2px solid var(--encre);
		font-size: 19px;
	}

	.liste-simple {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste-simple li {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid var(--bord);
	}
	.liste-simple li:last-child {
		border-bottom: none;
	}

	/* Une liste de cartes, pas un tableau : l'organisateur est sur son téléphone. */
	.inscrits {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.inscrits li {
		padding: 18px 0;
		border-bottom: 1px solid var(--bord);
	}
	@media (prefers-reduced-motion: no-preference) {
		@keyframes glisse {
			from {
				opacity: 0;
				transform: translateX(-10px);
			}
		}
		/* Les dix premières seulement : au-delà, la cascade devient une attente. */
		.inscrits li:nth-child(-n + 10) {
			animation: glisse var(--moyen) var(--elan) both;
		}
		.inscrits li:nth-child(2) {
			animation-delay: 30ms;
		}
		.inscrits li:nth-child(3) {
			animation-delay: 60ms;
		}
		.inscrits li:nth-child(4) {
			animation-delay: 90ms;
		}
		.inscrits li:nth-child(5) {
			animation-delay: 120ms;
		}
		.inscrits li:nth-child(n + 6) {
			animation-delay: 150ms;
		}
	}
	.inscrits li:last-child {
		border-bottom: none;
	}
	.inscrits li.parti {
		background: #f7f7f5;
		margin: 0 -16px;
		padding: 18px 16px;
	}
	.qui {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	.nom {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 21px;
	}
	.detail {
		margin: 6px 0 0;
	}
	.commande {
		margin: 4px 0 0;
		color: var(--encre-douce);
	}
	.remarque {
		margin: 6px 0 0;
		padding: 8px 12px;
		background: var(--orange-fond);
		border-left: 4px solid var(--orange);
		border-radius: 4px;
	}
	.actes {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 12px;
	}

	.rangee-commande {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--bord);
	}
	.rangee-commande .quoi {
		flex: 1;
		font-weight: 400;
		margin: 0;
	}
	.rangee-commande input {
		width: 92px;
		flex: none;
	}
	.total-ajout {
		margin: 12px 0 18px;
		font-size: 19px;
	}

	.case-ligne {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 400;
		margin-bottom: 16px;
		min-height: 48px;
	}
	.case-ligne input {
		width: 26px;
		height: 26px;
		accent-color: var(--couleur);
	}

	.exports {
		margin-top: 28px;
		padding-top: 18px;
		border-top: 1px solid var(--bord);
	}
	.exports h3 {
		font-size: 17px;
		color: var(--encre-douce);
	}
</style>
