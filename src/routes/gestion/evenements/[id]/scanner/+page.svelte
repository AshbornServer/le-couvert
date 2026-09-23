<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { euros } from '$lib/argent';
	let { data } = $props();

	type Verdict = {
		etat: 'valide' | 'deja' | 'inconnu' | 'annule' | 'autre_evenement';
		message: string;
		nom?: string;
		couverts?: number;
		service?: string | null;
		commande?: string | null;
		remarques?: string | null;
		a_payer_centimes?: number;
	};

	let video: HTMLVideoElement | null = null;
	let toile: HTMLCanvasElement | null = null;
	let flux: MediaStream | null = null;
	let boucle: number | null = null;

	let camera = $state(false);
	let ouverture = $state(false);
	let probleme = $state('');
	let verdict = $state<Verdict | null>(null);
	let recherche = $state('');
	let entres = $state<Record<number, boolean>>(
		untrack(() =>
			Object.fromEntries(data.personnes.filter((p) => p.scanne_le).map((p) => [p.id, true]))
		)
	);
	let dernierCode = '';
	let dernierInstant = 0;

	const base = untrack(() => `/gestion/evenements/${data.evenement.id}`);

	const trouvees = $derived(
		recherche.trim().length < 2
			? []
			: data.personnes
					.filter((p) =>
						`${p.nom} ${p.prenom}`.toLowerCase().includes(recherche.trim().toLowerCase())
					)
					.slice(0, 25)
	);

	const comptes = $derived({
		entres: Object.values(entres).filter(Boolean).length,
		total: data.personnes.filter((p) => p.statut !== 'annule' && p.statut !== 'rembourse').length
	});

	/* ------------------------------------------------------------- caméra */

	async function demarrer() {
		probleme = '';
		ouverture = true;
		try {
			flux = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' } },
				audio: false
			});
			if (!video) return;
			video.srcObject = flux;
			await video.play();
			camera = true;
			lire();
		} catch (erreur) {
			probleme =
				'La caméra n’est pas accessible. Autorisez-la dans le navigateur, ou cherchez le nom à la main juste en dessous.';
			console.error(erreur);
		} finally {
			ouverture = false;
		}
	}

	function arreter() {
		camera = false;
		if (boucle) cancelAnimationFrame(boucle);
		boucle = null;
		flux?.getTracks().forEach((piste) => piste.stop());
		flux = null;
	}

	let decoder: ((d: Uint8ClampedArray, l: number, h: number) => { data: string } | null) | null = null;

	async function chargerDecodeur() {
		if (decoder) return decoder;
		const module = await import('jsqr');
		const jsQR = module.default ?? module;
		decoder = (donnees, l, h) => jsQR(donnees, l, h, { inversionAttempts: 'dontInvert' });
		return decoder;
	}

	async function lire() {
		if (!camera || !video || !toile) return;

		if (video.readyState === video.HAVE_ENOUGH_DATA) {
			const contexte = toile.getContext('2d', { willReadFrequently: true });
			if (contexte) {
				// On ne scanne qu'un carré central : plus rapide sur un vieux téléphone.
				const cote = Math.min(video.videoWidth, video.videoHeight);
				toile.width = 400;
				toile.height = 400;
				contexte.drawImage(
					video,
					(video.videoWidth - cote) / 2,
					(video.videoHeight - cote) / 2,
					cote,
					cote,
					0,
					0,
					400,
					400
				);
				const image = contexte.getImageData(0, 0, 400, 400);
				const lireCode = await chargerDecodeur();
				const trouve = lireCode(image.data, image.width, image.height);
				if (trouve?.data) await verifier({ code: trouve.data });
			}
		}
		boucle = requestAnimationFrame(() => void lire());
	}

	/* ---------------------------------------------------------- vérification */

	async function verifier(charge: { code?: string; reservation_id?: number }) {
		const cle = charge.code ?? `id:${charge.reservation_id}`;
		const maintenant = Date.now();

		// Un QR reste devant l'objectif plusieurs secondes : on ne relit pas en boucle.
		if (cle === dernierCode && maintenant - dernierInstant < 3000) return;
		dernierCode = cle;
		dernierInstant = maintenant;

		try {
			const reponse = await fetch(`${base}/scanner/verifier`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(charge)
			});
			const resultat: Verdict = await reponse.json();
			verdict = resultat;

			if (resultat.etat === 'valide' && charge.reservation_id) {
				entres = { ...entres, [charge.reservation_id]: true };
			}
			if (navigator.vibrate) navigator.vibrate(resultat.etat === 'valide' ? 60 : [60, 60, 60]);
		} catch {
			verdict = { etat: 'inconnu', message: 'Pas de réseau — réessayez' };
		}
	}

	onDestroy(arreter);
</script>

<svelte:head><title>Scanner — {data.evenement.titre}</title></svelte:head>

<div class="page" style="max-width:620px">
	<div class="rangee" style="margin-bottom:12px">
		<a class="retour" href="{base}/bord">← Les inscrits</a>
		<span style="flex:1"></span>
		<span class="compteur-entrees">{comptes.entres} / {comptes.total} entrés</span>
	</div>

	<h1>Mode entrée</h1>

	{#if verdict}
		<button
			class="verdict {verdict.etat}"
			type="button"
			onclick={() => (verdict = null)}
			aria-live="assertive"
		>
			<span class="grand">
				{#if verdict.etat === 'valide'}✓{:else}✕{/if}
			</span>
			<strong>{verdict.message}</strong>
			{#if verdict.nom}
				<span class="qui">{verdict.nom}</span>
				<span class="detail">
					{verdict.couverts} {verdict.couverts === 1 ? 'couvert' : 'couverts'}
					{#if verdict.service} — {verdict.service}{/if}
				</span>
				{#if verdict.commande}<span class="detail">{verdict.commande}</span>{/if}
				{#if verdict.remarques}<span class="detail alerte">{verdict.remarques}</span>{/if}
				{#if verdict.a_payer_centimes}
					<span class="apayer">À encaisser : {euros(verdict.a_payer_centimes)}</span>
				{/if}
			{/if}
			<span class="petit">Toucher pour continuer</span>
		</button>
	{/if}

	<div class="carte">
		{#if probleme}<div class="message erreur">{probleme}</div>{/if}

		<div class="cadre" class:actif={camera}>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={video} playsinline muted></video>
			<canvas bind:this={toile} hidden></canvas>
			{#if camera}<div class="viseur"></div>{/if}
		</div>

		{#if !camera}
			<button class="bouton large" type="button" onclick={demarrer} disabled={ouverture}>
				{ouverture ? 'Ouverture de la caméra…' : 'Ouvrir la caméra'}
			</button>
			<p class="petit muet centre" style="margin-top:10px">
				Visez le QR code du ticket. Écran vert : c’est bon. Écran rouge : à vérifier.
			</p>
		{:else}
			<button class="bouton second large" type="button" onclick={arreter}>Fermer la caméra</button>
		{/if}
	</div>

	<div class="carte">
		<h2>Chercher un nom</h2>
		<p class="muet petit">
			Si le téléphone du participant est vide, ou si la caméra ne veut pas.
		</p>
		<div class="champ">
			<label for="recherche">Nom de la personne</label>
			<input id="recherche" type="search" bind:value={recherche} placeholder="Dubois" />
		</div>

		{#if recherche.trim().length >= 2}
			{#if trouvees.length === 0}
				<p class="muet">Personne à ce nom.</p>
			{:else}
				{#each trouvees as p (p.id)}
					<div class="personne">
						<span>
							<strong>{p.nom}</strong> {p.prenom}
							<br /><span class="petit muet">
								{p.couverts} couv.{#if p.service} — {p.service}{/if}
								{#if p.statut === 'en_attente'} — à payer{/if}
							</span>
						</span>
						{#if entres[p.id]}
							<span class="etiquette vert">entré</span>
						{:else if p.statut === 'annule' || p.statut === 'rembourse'}
							<span class="etiquette rouge">annulé</span>
						{:else}
							<button class="bouton" type="button" onclick={() => verifier({ reservation_id: p.id })}>
								Faire entrer
							</button>
						{/if}
					</div>
				{/each}
			{/if}
		{/if}
	</div>
</div>

<style>
	.cadre {
		position: relative;
		background: #111;
		border-radius: var(--rayon);
		overflow: hidden;
		aspect-ratio: 1;
		margin-bottom: 14px;
		display: none;
	}
	.cadre.actif {
		display: block;
	}
	.cadre video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.viseur {
		position: absolute;
		inset: 18%;
		border: 4px solid rgba(255, 255, 255, 0.9);
		border-radius: var(--rayon);
		pointer-events: none;
	}

	.verdict {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		border: none;
		font: inherit;
		color: #fff;
		text-align: center;
		cursor: pointer;
	}
	.verdict.valide {
		background: var(--vert);
	}
	.verdict.deja,
	.verdict.annule,
	.verdict.inconnu,
	.verdict.autre_evenement {
		background: var(--rouge);
	}
	.verdict .grand {
		font-size: 96px;
		line-height: 1;
	}
	.verdict strong {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 30px;
	}
	.verdict .qui {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 26px;
		margin-top: 8px;
	}
	.verdict .detail {
		font-size: 18px;
	}
	.verdict .detail.alerte {
		background: rgba(255, 255, 255, 0.2);
		padding: 6px 12px;
		border-radius: 8px;
		font-weight: 600;
	}
	.verdict .apayer {
		margin-top: 10px;
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 24px;
		background: var(--jaune);
		color: var(--encre);
		padding: 8px 18px;
		border-radius: var(--rayon);
	}
	.verdict .petit {
		margin-top: 20px;
		opacity: 0.85;
	}

	.compteur-entrees {
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.personne {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--bord);
	}
	.personne:last-of-type {
		border-bottom: none;
	}
</style>
