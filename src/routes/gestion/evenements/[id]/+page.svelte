<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageEvenement from '$lib/PageEvenement.svelte';
	import { centimes, euros } from '$lib/argent';
	import { heureBelge, limiteLongue, veilleAVingtHeures } from '$lib/dates';
	import { lienMaps } from '$lib/lieu';

	let { data, form } = $props();

	/* ------------------------------------------------- état du formulaire */

	let compteur = 0;
	const nouvelleCle = () => `n${++compteur}`;

	const e0 = untrack(() => data.evenement);

	let titre = $state(e0.titre);
	let date = $state(e0.date ?? '');
	let heure_debut = $state(e0.heure_debut ?? '');
	let lieu_nom = $state(e0.lieu_nom ?? '');
	let lieu_adresse = $state(e0.lieu_adresse ?? '');
	let image = $state(e0.image ?? '');
	let capacite = $state(e0.capacite ? String(e0.capacite) : '');
	let date_limite = $state(e0.date_limite ?? '');
	let paiement_en_ligne = $state(e0.paiement_en_ligne);
	let paiement_sur_place = $state(e0.paiement_sur_place);
	let paiement_virement = $state(e0.paiement_virement);
	let iban = $state(e0.iban ?? '');
	let couleur = $state(e0.couleur ?? untrack(() => data.club.couleur));
	let logo = $state(e0.logo ?? '');
	let texte_accueil = $state(e0.texte_accueil ?? '');
	let texte_confirmation = $state(
		e0.texte_confirmation ??
			'Merci et à bientôt ! Présentez votre ticket à l’entrée, sur papier ou sur votre téléphone.'
	);

	type RangeeService = {
		cle: string;
		id: number | null;
		libelle: string;
		heure: string;
		capacite: string;
	};
	type RangeeMenu = {
		cle: string;
		id: number | null;
		nom: string;
		prix: string;
		categorie: 'plat' | 'dessert' | 'boisson' | 'autre';
		stock_max: string;
		compte_comme_couvert: boolean;
	};
	type RangeeOption = {
		cle: string;
		id: number | null;
		libelle: string;
		type: 'texte' | 'case';
		obligatoire: boolean;
	};

	let services = $state<RangeeService[]>(
		untrack(() => data.services).map((s) => ({
			cle: nouvelleCle(),
			id: s.id,
			libelle: s.libelle,
			heure: s.heure ?? '',
			capacite: s.capacite ? String(s.capacite) : ''
		}))
	);

	let menu = $state<RangeeMenu[]>(
		untrack(() => data.menu).map((l) => ({
			cle: nouvelleCle(),
			id: l.id,
			nom: l.nom,
			prix: (l.prix_centimes / 100).toFixed(2).replace('.', ','),
			categorie: l.categorie,
			stock_max: l.stock_max ? String(l.stock_max) : '',
			compte_comme_couvert: l.compte_comme_couvert
		}))
	);

	let questions = $state<RangeeOption[]>(
		untrack(() => data.options).map((o) => ({
			cle: nouvelleCle(),
			id: o.id,
			libelle: o.libelle,
			type: o.type,
			obligatoire: o.obligatoire
		}))
	);

	/* ------------------------------------------------ ajout / suppression */

	const ajouterService = () =>
		(services = [
			...services,
			{
				cle: nouvelleCle(),
				id: null,
				libelle: `Service ${services.length + 1}`,
				heure: '',
				capacite: ''
			}
		]);

	const ajouterLigne = (categorie: RangeeMenu['categorie'] = 'plat') =>
		(menu = [
			...menu,
			{
				cle: nouvelleCle(),
				id: null,
				nom: '',
				prix: '',
				categorie,
				stock_max: '',
				compte_comme_couvert: categorie === 'plat'
			}
		]);

	const ajouterQuestionSimple = () =>
		(questions = [
			...questions,
			{ cle: nouvelleCle(), id: null, libelle: '', type: 'texte', obligatoire: false }
		]);

	const ajouterQuestion = () =>
		(questions = [
			...questions,
			{ cle: nouvelleCle(), id: null, libelle: '', type: 'texte', obligatoire: false }
		]);

	function deplacer<T>(liste: T[], de: number, vers: number): T[] {
		if (vers < 0 || vers >= liste.length) return liste;
		const copie = [...liste];
		const [element] = copie.splice(de, 1);
		copie.splice(vers, 0, element);
		return copie;
	}

	/* ------------------------------------------- enregistrement du brouillon */

	let etat = $state<'repos' | 'envoi' | 'enregistre' | 'erreur'>('repos');
	let enregistreLe = $state<string>('');
	let manque = $state<string[]>(untrack(() => data.manque));
	let messageErreur = $state('');
	let dernierEnvoi = '';
	let minuteur: ReturnType<typeof setTimeout> | undefined;

	function instantane() {
		return {
			titre,
			date,
			heure_debut,
			lieu_nom,
			lieu_adresse,
			image,
			capacite: capacite === '' ? null : Number(capacite),
			date_limite,
			paiement_en_ligne,
			paiement_sur_place,
			paiement_virement,
			iban,
			couleur,
			logo,
			texte_accueil,
			texte_confirmation,
			services: services.map((s) => ({
				cle: s.cle,
				id: s.id,
				libelle: s.libelle,
				heure: s.heure || null,
				capacite: s.capacite === '' ? null : Number(s.capacite)
			})),
			menu: menu.map((l) => ({
				cle: l.cle,
				id: l.id,
				nom: l.nom,
				prix_centimes: centimes(l.prix),
				categorie: l.categorie,
				stock_max: l.stock_max === '' ? null : Number(l.stock_max),
				compte_comme_couvert: estUnCouvert(l.categorie)
			})),
			options: questions.map((o) => ({
				cle: o.cle,
				id: o.id,
				libelle: o.libelle,
				type: o.type,
				obligatoire: o.obligatoire
			}))
		};
	}

	async function enregistrer() {
		const charge = instantane();
		const texte = JSON.stringify(charge);
		if (texte === dernierEnvoi) return;

		etat = 'envoi';
		try {
			const reponse = await fetch(`/gestion/evenements/${data.evenement.id}/brouillon`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: texte
			});
			if (!reponse.ok) throw new Error(`Enregistrement refusé (${reponse.status})`);
			const resultat = await reponse.json();

			// On adopte les identifiants des lignes qui viennent d'être créées.
			services = services.map((s) => ({ ...s, id: s.id ?? resultat.cles.services[s.cle] ?? null }));
			menu = menu.map((l) => ({ ...l, id: l.id ?? resultat.cles.menu[l.cle] ?? null }));
			questions = questions.map((o) => ({
				...o,
				id: o.id ?? resultat.cles.options[o.cle] ?? null
			}));

			manque = resultat.manque;
			dernierEnvoi = JSON.stringify(instantane());
			enregistreLe = new Date().toLocaleTimeString('fr-BE', {
				hour: '2-digit',
				minute: '2-digit'
			});
			etat = 'enregistre';
			messageErreur = '';
		} catch (erreur) {
			etat = 'erreur';
			messageErreur = (erreur as Error).message;
		}
	}

	/* Enregistrement automatique, une seconde après la dernière frappe. */
	$effect(() => {
		const texte = JSON.stringify(instantane());
		if (texte === dernierEnvoi) return;
		clearTimeout(minuteur);
		minuteur = setTimeout(enregistrer, 1000);
		return () => clearTimeout(minuteur);
	});

	/* ------------------------------------------------------ téléversements */

	let envoiImage = $state(false);
	let envoiLogo = $state(false);

	async function televerser(fichier: File, cible: 'image' | 'logo') {
		const corps = new FormData();
		corps.set('fichier', fichier);
		if (cible === 'image') envoiImage = true;
		else envoiLogo = true;
		try {
			const reponse = await fetch(`/gestion/evenements/${data.evenement.id}/image`, {
				method: 'POST',
				body: corps
			});
			if (!reponse.ok) {
				const detail = await reponse.json().catch(() => null);
				throw new Error(detail?.message ?? 'Image refusée.');
			}
			const { chemin } = await reponse.json();
			if (cible === 'image') image = chemin;
			else logo = chemin;
		} catch (erreur) {
			messageErreur = (erreur as Error).message;
			etat = 'erreur';
		} finally {
			envoiImage = false;
			envoiLogo = false;
		}
	}

	/* ------------------------------------------------------------- aperçu */

	let apercuOuvert = $state(false);
	let lienCopie = $state(false);

	async function copierLien() {
		try {
			await navigator.clipboard.writeText(data.lienPublic);
			lienCopie = true;
			setTimeout(() => (lienCopie = false), 2500);
		} catch {
			messageErreur = 'Copie impossible : sélectionnez le lien à la main.';
		}
	}

	const statut = $derived(data.evenement.statut);
	const maps = $derived(lienMaps(lieu_nom, lieu_adresse));
	const fraisParCouvert = $derived(
		data.club.frais_payes_par === 'participant' ? data.club.commission_centimes : 0
	);

	const apercu = $derived({
		club: { nom: data.club.nom, logo: data.club.logo, couleur: data.club.couleur },
		evenement: {
			titre,
			date: date || null,
			heure_debut: heure_debut || null,
			lieu_nom: lieu_nom || null,
			lieu_adresse: lieu_adresse || null,
			image: image || null,
			date_limite: date_limite || null,
			paiement_en_ligne,
			paiement_sur_place,
			paiement_virement,
			couleur,
			logo: logo || null,
			texte_accueil: texte_accueil || null
		},
		services: services.map((s, i) => ({ id: i, libelle: s.libelle, heure: s.heure || null })),
		menu: menu.map((l, i) => ({
			id: i,
			nom: l.nom || 'Ligne sans nom',
			prix_centimes: centimes(l.prix),
			categorie: l.categorie,
			compte_comme_couvert: l.compte_comme_couvert
		})),
		options: questions.map((o, i) => ({
			id: i,
			libelle: o.libelle || 'Question sans texte',
			type: o.type,
			obligatoire: o.obligatoire
		}))
	});

	/* « Compte comme couvert » se déduit de la catégorie : un plat nourrit,
	   un dessert ou une boisson non. On ne pose plus la question. */
	const estUnCouvert = (categorie: RangeeMenu['categorie']) => categorie === 'plat';

	/* Ce qui ne peut plus être retiré : déjà commandé ou déjà répondu. */
	const verrouLigne = (id: number | null) => id !== null && data.lignesCommandees.includes(id);
	const verrouService = (id: number | null) => id !== null && data.servicesUtilises.includes(id);
	const verrouQuestion = (id: number | null) => id !== null && data.optionsRepondues.includes(id);

	/* Le tiroir : ce qui est déjà réglé, écrit en clair pour ne pas avoir à l'ouvrir. */
	const resumeTiroir = $derived(
		[
			services.length > 0
				? `${services.length} ${services.length === 1 ? 'heure de passage' : 'heures de passage'} : ${services.map((s) => heureBelge(s.heure) || s.libelle).join(' et ')}`
				: 'Tout le monde arrive à l’heure de début',
			questions.length > 0
				? `${questions.length} question${questions.length > 1 ? 's' : ''} : ${questions.map((q) => q.libelle || 'sans texte').join(', ')}`
				: 'Aucune question posée',
			image ? 'Une affiche' : 'Pas d’affiche',
			capacite ? `${capacite} places au total` : 'Pas de limite de places'
		].join(' · ')
	);

	let stockOuvert = $state(untrack(() => data.menu.some((l) => l.stock_max !== null)));

	/* La date limite, en toutes lettres. */
	const limiteLisible = $derived(date_limite ? limiteLongue(date_limite) : '');
	let limiteOuverte = $state(false);

	function limiteVeille() {
		if (date) date_limite = veilleAVingtHeures(date);
		limiteOuverte = false;
	}
	function limiteTroisJours() {
		if (!date) return;
		const d = new Date(`${date}T20:00`);
		d.setDate(d.getDate() - 3);
		date_limite = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T20:00`;
		limiteOuverte = false;
	}

	/* Même défaut que le serveur, pour que l'écran ne mente jamais. */
	$effect(() => {
		if (date && !date_limite) date_limite = veilleAVingtHeures(date);
	});
	let ouvrirSuppression = $state(false);
</script>

<svelte:head><title>{titre || 'Nouveau souper'}</title></svelte:head>

<div class="editeur">
	<div class="colonne">
		<!-- ══════════════════════════════════════ la barre, toujours visible -->
		<div class="barre sans-impression">
			<a class="retour" href="/gestion">← Mes soupers</a>
			<a class="retour" href="/gestion/evenements/{data.evenement.id}/bord">Les inscrits</a>
			<span class="espace"></span>
			<span class="etat" class:souci={etat === 'erreur'}>
				{#if etat === 'envoi'}Enregistrement…
				{:else if etat === 'erreur'}Non enregistré
				{:else if enregistreLe}Enregistré à {enregistreLe}
				{:else}Enregistré au fur et à mesure{/if}
			</span>

			{#if statut === 'brouillon'}
				<form method="POST" action="?/publier" use:enhance={() => async ({ update }) => {
					await update();
					await invalidateAll();
				}}>
					<button class="bouton" type="submit" disabled={manque.length > 0}>
						{manque.length > 0
							? `Publier (${manque.length} ${manque.length === 1 ? 'chose' : 'choses'} à finir)`
							: 'Publier le souper'}
					</button>
				</form>
			{:else}
				<span class="etiquette vert">en ligne</span>
			{/if}

			<button class="bouton second apercu-mobile" type="button" onclick={() => (apercuOuvert = true)}>
				Voir ma page
			</button>
		</div>

		{#if etat === 'erreur'}
			<div class="message erreur">
				<strong>Vos derniers changements ne sont pas enregistrés.</strong><br />
				Vérifiez votre connexion, puis touchez « Enregistrer maintenant ». Ne fermez pas cette page.
				<div class="rangee" style="margin-top:10px">
					<button class="bouton" type="button" onclick={enregistrer}>Enregistrer maintenant</button>
				</div>
				{#if messageErreur}<p class="petit" style="margin:8px 0 0">{messageErreur}</p>{/if}
			</div>
		{/if}
		{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}
		{#if form?.ok}<div class="message ok">{form.ok}</div>{/if}

		{#if statut === 'brouillon' && manque.length > 0}
			<div class="message neutre">
				<strong>Avant de publier, il manque :</strong>
				<ul>
					{#each manque as m (m)}<li>{m}</li>{/each}
				</ul>
			</div>
		{/if}

		<h1>{titre || 'Nouveau souper'}</h1>

		<!-- ══════════════════════════════════════════════ 1. quand et où -->
		<section class="carte">
			<h2><span class="numero">1</span> Quand et où</h2>

			<div class="champ">
				<label for="titre">Titre du souper</label>
				<input id="titre" type="text" bind:value={titre} placeholder="Souper spaghetti" />
			</div>

			<div class="grille deux">
				<div class="champ">
					<label for="date">Date</label>
					<input id="date" type="date" bind:value={date} />
				</div>
				<div class="champ">
					<label for="heure">Heure de début</label>
					<input id="heure" type="time" bind:value={heure_debut} />
				</div>
			</div>

			<div class="champ">
				<label for="lieu">Nom de la salle</label>
				<input id="lieu" type="text" bind:value={lieu_nom} placeholder="Salle du club" />
			</div>

			<div class="champ">
				<label for="adresse">Adresse</label>
				<span class="aide">Le lien Google Maps est créé tout seul.</span>
				<input
					id="adresse"
					type="text"
					bind:value={lieu_adresse}
					placeholder="Rue du Stade 12, 7500 Tournai"
				/>
				{#if maps}
					<p class="petit" style="margin-top:6px">
						<a href={maps} target="_blank" rel="noreferrer noopener">Vérifier sur Maps</a>
					</p>
				{/if}
			</div>

			<div class="limite">
				{#if limiteOuverte}
					<span class="faux-label">Fermer les réservations</span>
					<div class="rangee">
						<button class="bouton second" type="button" onclick={limiteVeille}>La veille au soir</button>
						<button class="bouton second" type="button" onclick={limiteTroisJours}>3 jours avant</button>
					</div>
					<div class="champ" style="margin-top:12px">
						<label for="limite">Ou une autre date</label>
						<input id="limite" type="datetime-local" bind:value={date_limite} />
					</div>
					<button class="lien" type="button" onclick={() => (limiteOuverte = false)}>Fermer</button>
				{:else if limiteLisible}
					<p>
						Réservations ouvertes jusqu’au <strong>{limiteLisible}</strong>.
						<button class="lien" type="button" onclick={() => (limiteOuverte = true)}>Changer</button>
					</p>
				{:else}
					<p class="muet">Mettez la date ci-dessus, la limite se règle toute seule.</p>
				{/if}
			</div>
		</section>

		<!-- ═════════════════════════════════════════════ 2. menu et prix -->
		<section class="carte">
			<h2><span class="numero">2</span> Menu et prix</h2>

			{#each menu as l, i (l.cle)}
				<div class="ligne-menu">
					<div class="rangee-ligne">
						<div class="champ sans-marge grand">
							<label for="m-nom-{l.cle}">Nom</label>
							<input id="m-nom-{l.cle}" type="text" bind:value={l.nom} placeholder="Spaghetti bolo adulte" />
						</div>
						<div class="champ sans-marge petit-champ">
							<label for="m-prix-{l.cle}">Prix</label>
							<input id="m-prix-{l.cle}" type="text" inputmode="decimal" bind:value={l.prix} placeholder="16,00" />
						</div>
						<div class="champ sans-marge moyen">
							<label for="m-cat-{l.cle}">Catégorie</label>
							<select id="m-cat-{l.cle}" bind:value={l.categorie}>
								<option value="plat">plat</option>
								<option value="dessert">dessert</option>
								<option value="boisson">boisson en prévente</option>
							</select>
						</div>
						{#if stockOuvert}
							<div class="champ sans-marge petit-champ">
								<label for="m-stock-{l.cle}">Stock</label>
								<input id="m-stock-{l.cle}" type="number" min="0" inputmode="numeric" bind:value={l.stock_max} placeholder="—" />
							</div>
						{/if}
					</div>
					<div class="outils">
						<button type="button" onclick={() => (menu = deplacer(menu, i, i - 1))}>Monter</button>
						<button type="button" onclick={() => (menu = deplacer(menu, i, i + 1))}>Descendre</button>
						<button
							type="button"
							class="rouge"
							disabled={verrouLigne(l.id)}
							onclick={() => (menu = menu.filter((x) => x.cle !== l.cle))}
						>
							Enlever
						</button>
					</div>
					{#if verrouLigne(l.id)}
						<p class="petit muet verrou">
							Déjà commandée : on ne peut plus l’enlever. Mettez son stock à 0 pour arrêter de la
							vendre.
						</p>
					{/if}
				</div>
			{/each}

			<div class="rangee">
				<button class="bouton second" type="button" onclick={() => ajouterLigne('plat')}>+ Plat</button>
				<button class="bouton second" type="button" onclick={() => ajouterLigne('dessert')}>+ Dessert</button>
				<button class="bouton second" type="button" onclick={() => ajouterLigne('boisson')}>
					+ Boisson en prévente
				</button>
			</div>
		</section>

		<!-- ══════════════════════════════════════ 3. comment les gens paient -->
		<section class="carte">
			<h2><span class="numero">3</span> Comment les gens paient</h2>

			{#if data.club.mollie_statut === 'relie'}
				<label class="case grande">
					<input type="checkbox" bind:checked={paiement_en_ligne} />
					<span>En ligne, tout de suite (Bancontact, carte)</span>
				</label>
			{/if}
			<label class="case grande">
				<input type="checkbox" bind:checked={paiement_sur_place} />
				<span>Sur place, le soir même</span>
			</label>
			<label class="case grande">
				<input type="checkbox" bind:checked={paiement_virement} />
				<span>Par virement bancaire</span>
			</label>

			{#if paiement_virement}
				<div class="champ" style="margin-top:14px">
					<label for="iban">Numéro de compte du club</label>
					<span class="aide">
						Chaque réservation reçoit sa communication structurée, créée automatiquement.
					</span>
					<input id="iban" type="text" bind:value={iban} placeholder="BE68 5390 0754 7034" />
				</div>
			{/if}
		</section>

		<!-- ═══════════════════════════════════════════════════ le tiroir -->
		<details class="tiroir">
			<summary>
				<strong>Modifier si besoin</strong>
				<span class="resume">{resumeTiroir}</span>
			</summary>

			<div class="dedans-tiroir">
				<h3>Heures de passage à table</h3>
				<p class="muet petit">
					Deux services à 18 h 30 et 20 h 30, par exemple. Sans service, tout le monde arrive à
					l’heure de début.
				</p>
				{#each services as s (s.cle)}
					<div class="rangee-ligne">
						<div class="champ sans-marge grand">
							<label for="s-libelle-{s.cle}">Nom</label>
							<input id="s-libelle-{s.cle}" type="text" bind:value={s.libelle} />
						</div>
						<div class="champ sans-marge petit-champ">
							<label for="s-heure-{s.cle}">Heure</label>
							<input id="s-heure-{s.cle}" type="time" bind:value={s.heure} />
						</div>
						<div class="champ sans-marge petit-champ">
							<label for="s-cap-{s.cle}">Places</label>
							<input id="s-cap-{s.cle}" type="number" min="0" inputmode="numeric" bind:value={s.capacite} />
						</div>
						<div class="outils">
							<button
								type="button"
								class="rouge"
								disabled={verrouService(s.id)}
								onclick={() => (services = services.filter((x) => x.cle !== s.cle))}
							>
								Enlever
							</button>
						</div>
						{#if verrouService(s.id)}
							<p class="petit muet verrou">Des gens y sont inscrits : on ne peut plus l’enlever.</p>
						{/if}
					</div>
				{/each}
				<button class="bouton second" type="button" onclick={ajouterService}>
					+ Ajouter une heure
				</button>

				<h3 class="haut-2">Questions posées aux participants</h3>
				<p class="muet petit">Allergies, remarque, voisins de table…</p>
				{#each questions as o (o.cle)}
					<div class="rangee-ligne">
						<div class="champ sans-marge grand">
							<label for="o-lib-{o.cle}">Question</label>
							<input id="o-lib-{o.cle}" type="text" bind:value={o.libelle} placeholder="Allergies ou remarque" />
						</div>
						<div class="outils">
							<button
								type="button"
								class="rouge"
								disabled={verrouQuestion(o.id)}
								onclick={() => (questions = questions.filter((x) => x.cle !== o.cle))}
							>
								Enlever
							</button>
						</div>
						{#if verrouQuestion(o.id)}
							<p class="petit muet verrou">
								Des participants y ont répondu : l’enlever effacerait leurs réponses.
							</p>
						{/if}
					</div>
				{/each}
				<button class="bouton second" type="button" onclick={ajouterQuestionSimple}>
					+ Ajouter une question
				</button>

				<h3 class="haut-2">Affiche ou photo</h3>
				{#if image}
					<img src={image} alt="" class="vignette" />
					<button class="bouton second" type="button" onclick={() => (image = '')}>
						Enlever l’image
					</button>
				{:else}
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						disabled={envoiImage}
						onchange={(ev) => {
							const f = ev.currentTarget.files?.[0];
							if (f) televerser(f, 'image');
						}}
					/>
					{#if envoiImage}<p class="petit muet">Envoi de l’image…</p>{/if}
				{/if}

				<h3 class="haut-2">Places et stocks</h3>
				<div class="champ">
					<label for="capacite">Nombre de couverts maximum</label>
					<span class="aide">Laissez vide s’il n’y a pas de limite.</span>
					<input id="capacite" type="number" min="0" inputmode="numeric" bind:value={capacite} />
				</div>
				<label class="case">
					<input type="checkbox" bind:checked={stockOuvert} />
					<span>Limiter les quantités plat par plat</span>
				</label>

				<h3 class="haut-2">Texte d’accueil</h3>
				<div class="champ">
					<label for="accueil">Quelques phrases en haut de votre page</label>
					<textarea id="accueil" bind:value={texte_accueil}></textarea>
				</div>
			</div>
		</details>

		<!-- ═════════════════════════════════════════════ publié : le lien -->
		{#if statut === 'publie'}
			<section class="carte" style="border-color:var(--couleur)">
				<h2>Votre lien à partager</h2>

				<div class="champ">
					<span class="faux-label">Adresse de votre page</span>
					<input type="text" readonly value={data.lienPublic} onclick={(ev) => ev.currentTarget.select()} />
				</div>

				<div class="rangee">
					<button class="bouton" type="button" onclick={copierLien}>
						{lienCopie ? 'Lien copié !' : 'Copier le lien'}
					</button>
					<a
						class="bouton second"
						href="https://www.facebook.com/sharer/sharer.php?u={encodeURIComponent(data.lienPublic)}"
						target="_blank"
						rel="noreferrer noopener"
					>
						Partager sur Facebook
					</a>
					<a class="bouton second" href="/gestion/evenements/{data.evenement.id}/qr" download>
						Télécharger le QR code
					</a>
				</div>

				<p class="petit muet haut-1">
					Le QR code mène droit à la page de réservation : à coller sur les affiches et les tracts.
				</p>

				{#if data.couvertsReserves === 0}
					<form method="POST" action="?/depublier" use:enhance class="haut-1">
						<button class="bouton second" type="submit">Remettre en brouillon</button>
					</form>
				{/if}
			</section>
		{/if}

		<!-- ═══════════════════════════════════════════════ suppression -->
		{#if data.couvertsReserves === 0}
			<section class="carte">
				<h2 class="discret">Supprimer ce souper</h2>
				{#if !ouvrirSuppression}
					<button class="bouton danger" type="button" onclick={() => (ouvrirSuppression = true)}>
						Supprimer
					</button>
				{:else}
					<form method="POST" action="?/supprimer">
						<input type="hidden" name="confirmation" value="SUPPRIMER" />
						<p>Personne n’a réservé : rien ne sera perdu.</p>
						<div class="rangee">
							<button class="bouton danger" type="submit">Oui, supprimer</button>
							<button class="bouton second" type="button" onclick={() => (ouvrirSuppression = false)}>
								Non, garder
							</button>
						</div>
					</form>
				{/if}
			</section>
		{/if}
	</div>

	<!-- ═══════════════════════════════════════════ l'aperçu, à droite -->
	<aside class="apercu sans-impression" class:ouvert={apercuOuvert}>
		<div class="apercu-barre">
			<strong>Ce que les gens verront</strong>
			<span class="espace"></span>
			<button class="bouton second fermer" type="button" onclick={() => (apercuOuvert = false)}>
				Fermer
			</button>
		</div>
		<div class="apercu-cadre">
			<PageEvenement
				club={apercu.club}
				evenement={apercu.evenement}
				services={apercu.services}
				menu={apercu.menu}
				options={apercu.options}
				{fraisParCouvert}
				apercu={true}
			/>
		</div>
	</aside>
</div>

<style>
	.editeur {
		display: block;
		max-width: 780px;
		margin: 0 auto;
		padding: 0 16px 64px;
	}

	/* La barre reste sous les yeux : c'est là qu'on publie et qu'on voit si
	   l'enregistrement se fait. */
	.barre {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 10px 0;
		margin-bottom: 8px;
		background: var(--fond);
		border-bottom: 1px solid var(--bord);
	}
	.espace {
		flex: 1;
	}
	.etat {
		font-size: 16px;
		color: var(--encre-douce);
	}
	.etat.souci {
		color: var(--rouge);
		font-weight: 700;
	}

	h2 .numero {
		font-family: var(--titre);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		margin-right: 8px;
		border-radius: 999px;
		background: var(--couleur);
		color: #fff;
		font-size: 16px;
	}
	h2.discret {
		font-size: 17px;
		color: var(--encre-douce);
	}

	.message :global(ul) {
		margin: 8px 0 0;
		padding-left: 22px;
	}

	.champ.sans-marge {
		margin-bottom: 0;
	}
	.rangee-ligne {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: flex-end;
		padding: 12px 0;
	}
	.rangee-ligne .grand {
		flex: 1 1 200px;
	}
	.rangee-ligne .moyen {
		flex: 0 1 170px;
	}
	.rangee-ligne .petit-champ {
		flex: 0 1 108px;
	}

	.ligne-menu {
		border-bottom: 1px solid var(--bord);
		padding-bottom: 12px;
		margin-bottom: 6px;
	}

	.outils {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
	}
	.outils button {
		min-height: 48px;
		padding: 8px 14px;
		font: inherit;
		font-size: 16px;
		color: var(--couleur-sombre);
		background: #fff;
		border: 2px solid var(--bord-champ);
		border-radius: var(--rayon);
		cursor: pointer;
	}
	.outils button.rouge {
		color: var(--rouge);
		border-color: #d9a7a2;
	}
	.outils button:disabled {
		color: #4a4f55;
		background: #e6e7e4;
		border-color: #b9bdb8;
		cursor: not-allowed;
	}
	.verrou {
		margin: 4px 0 0;
		flex-basis: 100%;
	}

	.lien {
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

	.case {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 400;
		margin: 0;
		min-height: 48px;
	}
	.case input {
		width: 26px;
		height: 26px;
		accent-color: var(--couleur);
		flex: none;
	}
	.case.grande {
		width: 100%;
		padding: 10px 14px;
		margin-bottom: 8px;
		border: 2px solid var(--bord-champ);
		border-radius: var(--rayon);
		cursor: pointer;
		min-height: 56px;
	}
	.case.grande:has(input:checked) {
		border-color: var(--couleur);
		background: color-mix(in srgb, var(--couleur) 6%, #fff);
	}

	.limite {
		padding-top: 6px;
		border-top: 1px solid var(--bord);
	}
	.limite p {
		margin: 10px 0 0;
	}

	.vignette {
		display: block;
		max-width: 100%;
		max-height: 180px;
		border-radius: var(--rayon);
		margin-bottom: 10px;
	}

	/* Le tiroir montre en clair ce qu'il contient : ce n'est pas un menu caché. */
	.tiroir {
		background: var(--carte);
		border: 1px solid var(--bord);
		border-radius: var(--rayon);
		margin-bottom: 16px;
	}
	.tiroir summary {
		padding: 18px 16px;
		cursor: pointer;
		min-height: 56px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tiroir summary strong {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 20px;
	}
	.tiroir .resume {
		color: var(--encre-douce);
		font-size: 16px;
	}
	.dedans-tiroir {
		padding: 0 16px 20px;
		border-top: 1px solid var(--bord);
	}
	.dedans-tiroir h3 {
		font-size: 18px;
		margin: 20px 0 6px;
	}
	.haut-1 {
		margin-top: 12px;
	}
	.haut-2 {
		margin-top: 26px;
	}

	/* ------------------------------------------------------------- aperçu */
	.apercu {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: var(--fond);
		display: none;
		flex-direction: column;
	}
	.apercu.ouvert {
		display: flex;
	}
	.apercu-barre {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: var(--carte);
		border-bottom: 1px solid var(--bord);
	}
	.apercu-cadre {
		flex: 1;
		overflow-y: auto;
	}

	@media (min-width: 1100px) {
		.editeur {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 420px;
			gap: 24px;
			max-width: 1320px;
		}
		.apercu {
			position: sticky;
			top: 16px;
			inset: auto;
			display: flex;
			height: calc(100vh - 32px);
			border: 1px solid var(--bord);
			border-radius: var(--rayon);
			overflow: hidden;
		}
		.apercu .fermer,
		.apercu-mobile {
			display: none;
		}
	}
</style>
