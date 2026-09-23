<script lang="ts">
	import { enhance } from '$app/forms';
	import { compteur } from '$lib/compteur';
	import { euros } from '$lib/argent';
	let { data, form } = $props();

	const mois = new Date().toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });

	const libelleMollie: Record<string, string> = {
		non_relie: 'sans paiement en ligne',
		en_attente: 'liaison en cours',
		relie: 'paiement en ligne actif',
		erreur: 'liaison en erreur'
	};
	const couleurMollie: Record<string, string> = {
		non_relie: 'gris',
		en_attente: 'orange',
		relie: 'vert',
		erreur: 'rouge'
	};

	/** « il y a 2 heures », « il y a 3 jours ». */
	function depuis(secondes: number): string {
		const ecart = Math.max(0, Math.floor(Date.now() / 1000) - secondes);
		if (ecart < 3600) return `il y a ${Math.max(1, Math.round(ecart / 60))} min`;
		if (ecart < 86400) return `il y a ${Math.round(ecart / 3600)} h`;
		const jours = Math.round(ecart / 86400);
		return `il y a ${jours} ${jours === 1 ? 'jour' : 'jours'}`;
	}

	let aSuspendre = $state<number | null>(null);
</script>

<svelte:head><title>Les clubs</title></svelte:head>

<div class="page">
	<h1>Les clubs</h1>
	<p class="muet">
		Les clubs ouvrent leur espace tout seuls depuis la page d’accueil. Vous n’avez rien à valider :
		cet écran sert à voir ce qui se passe, et à suspendre un club s’il le faut.
	</p>

	{#if form?.ok}<div class="message ok">{form.ok}</div>{/if}
	{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}

	<div class="chiffres trois">
		<div class="chiffre">
			<div class="valeur" use:compteur={{ valeur: data.clubs.length }}>{data.clubs.length}</div>
			<div class="quoi">
				clubs{#if data.nouveauxCetteSemaine > 0}<br /><span class="petit"
						>dont {data.nouveauxCetteSemaine} cette semaine</span
					>{/if}
			</div>
		</div>
		<div class="chiffre">
			<div class="valeur" use:compteur={{ valeur: data.totalCouverts }}>{data.totalCouverts}</div>
			<div class="quoi">couverts payés, tout confondu</div>
		</div>
		<div class="chiffre">
			<div class="valeur" use:compteur={{ valeur: data.totalCommissions, format: euros }}>
				{euros(data.totalCommissions)}
			</div>
			<div class="quoi">mes commissions — {mois}</div>
		</div>
	</div>

	<div class="rangee" style="margin-bottom:16px">
		<a class="bouton" href="/admin/clubs/nouveau">+ Ouvrir un club moi-même</a>
	</div>

	<div class="carte">
		<h2>Tous les clubs</h2>

		{#if data.clubs.length === 0}
			<p class="muet">
				Aucun club pour l’instant. Le premier qui remplit le formulaire de la page d’accueil
				apparaîtra ici tout seul.
			</p>
		{:else}
			<ul class="liste">
				{#each data.clubs as club (club.id)}
					<li class:sorti={!club.actif}>
						<a class="titre" href="/admin/clubs/{club.id}">{club.nom}</a>

						<p class="detail">
							<code class="petit">/{club.slug}</code>
							{#if club.venuDuSite}
								<span class="muet"> · ouvert tout seul {depuis(club.venuDuSite.cree_le)}</span>
							{/if}
						</p>

						{#if club.venuDuSite}
							<p class="petit muet" style="margin:2px 0 0">
								{club.venuDuSite.contact} · {club.venuDuSite.email}
								{#if club.venuDuSite.ville} · {club.venuDuSite.ville}{/if}
								{#if club.venuDuSite.evenement} · « {club.venuDuSite.evenement} »{/if}
							</p>
						{/if}

						<div class="marques">
							{#if !club.actif}
								<span class="etiquette rouge">suspendu</span>
							{/if}
							<span class="etiquette {couleurMollie[club.mollie_statut]}">
								{libelleMollie[club.mollie_statut]}
							</span>
							<span class="muet petit">
								{club.publies}
								{club.publies === 1 ? 'souper publié' : 'soupers publiés'} · {club.couverts} couverts
								· {euros(club.commission_centimes)} par couvert, payé par {club.frais_payes_par ===
								'participant'
									? 'le participant'
									: 'le club'}
							</span>
						</div>

						<div class="marques">
							<strong>{euros(Number(club.commissions_mois))}</strong>
							<span class="muet petit">ce mois-ci</span>
						</div>

						<div class="actes">
							<a class="bouton second" href="/admin/clubs/{club.id}">Réglages</a>
							<a class="bouton second" href="/{club.slug}">Voir sa page</a>

							{#if aSuspendre === club.id}
								<form method="POST" action="?/suspendre" use:enhance>
									<input type="hidden" name="club_id" value={club.id} />
									<input type="hidden" name="actif" value={club.actif ? 'non' : 'oui'} />
									<button class="bouton danger" type="submit">
										{club.actif ? 'Oui, suspendre' : 'Oui, réactiver'}
									</button>
								</form>
								<button class="bouton second" type="button" onclick={() => (aSuspendre = null)}>
									Non
								</button>
							{:else}
								<button class="bouton second" type="button" onclick={() => (aSuspendre = club.id)}>
									{club.actif ? 'Suspendre' : 'Réactiver'}
								</button>
							{/if}
						</div>

						{#if aSuspendre === club.id && club.actif}
							<p class="message info" style="margin:12px 0 0">
								Sa page publique et l’espace de ses organisateurs se ferment tout de suite. Les
								réservations déjà prises ne sont pas touchées.
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="carte">
		<h2>Ce qui tourne tout seul</h2>
		<ul class="liste">
			<li>
				<span class="titre" style="font-size:18px">Ouverture des clubs</span>
				<p class="detail muet">
					Un club remplit le formulaire de l’accueil, son espace est créé et son accès part par
					e-mail dans la minute. Trois ouvertures par heure et par connexion, au maximum.
				</p>
			</li>
			<li>
				<span class="titre" style="font-size:18px">Rappels et clôtures</span>
				<p class="detail muet">
					Deux jours avant : un e-mail à chaque participant. Le matin même : le récapitulatif aux
					organisateurs. Le lendemain : le souper passe en « terminé ».
				</p>
			</li>
			<li>
				<span class="titre" style="font-size:18px">Paiements et places</span>
				<p class="detail muet">
					Les paiements en ligne bloquent la place quinze minutes, puis la relâchent. Mollie
					prévient dès qu’un paiement arrive.
				</p>
			</li>
			<li>
				<span class="titre" style="font-size:18px">Effacement des données</span>
				<p class="detail muet">
					Douze mois après un souper, les noms, e-mails et téléphones des participants sont
					effacés. Les totaux du club restent.
				</p>
			</li>
		</ul>
		<form method="POST" action="?/taches" use:enhance style="margin-top:8px">
			<button class="bouton second" type="submit">Relancer maintenant</button>
		</form>
	</div>
</div>
