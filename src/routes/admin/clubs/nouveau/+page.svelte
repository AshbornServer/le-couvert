<script lang="ts">
	import { untrack } from 'svelte';
	import ChoixCouleur from '$lib/ChoixCouleur.svelte';
	import { versSlug } from '$lib/slug';
	let { form } = $props();

	let nom = $state(untrack(() => form?.nom) ?? '');
	let slug = $state(untrack(() => form?.slug) ?? '');
	let slugTouche = $state(Boolean(untrack(() => form?.slug)));
	let couleur = $state(untrack(() => form?.couleur) ?? '#0b6b3a');

	const slugFinal = $derived(slugTouche ? versSlug(slug) : versSlug(nom));
</script>

<svelte:head><title>Nouveau club</title></svelte:head>

<div class="page" style="max-width:620px">
	<p><a class="retour" href="/admin">← Tous les clubs</a></p>
	<div class="carte">
		<h1>Nouveau club</h1>
		<p class="muet">Deux choses à taper. Le reste est déjà réglé.</p>

		{#if form?.erreur}<div class="message erreur">{form.erreur}</div>{/if}

		<form method="POST" enctype="multipart/form-data">
			<div class="champ">
				<label for="nom">Nom du club</label>
				<input id="nom" name="nom" type="text" required bind:value={nom} placeholder="FC Exemple" />
			</div>

			<div class="champ">
				<label for="email">E-mail de l’organisateur principal</label>
				<span class="aide">Il reçoit tout de suite son accès, sans mot de passe.</span>
				<input
					id="email"
					name="email"
					type="email"
					required
					value={form?.email ?? ''}
					placeholder="president@fc-exemple.be"
				/>
			</div>

			<p class="adresse-prevue">
				Page publique : <code>/{slugFinal || 'fc-exemple'}</code>
			</p>

			<!-- Les réglages ont tous un défaut : on les montre sans les demander. -->
			<details class="tiroir">
				<summary>
					<strong>Réglages</strong>
					<span class="resume">
						Déjà remplis : 0,20 € par couvert, payé par le participant, couleur verte.
					</span>
				</summary>
				<div class="dedans">
					<div class="champ">
						<label for="slug">Adresse du site pour ce club</label>
						<span class="aide">La partie après le nom du site.</span>
						<input
							id="slug"
							name="slug"
							type="text"
							value={slugFinal}
							oninput={(e) => {
								slugTouche = true;
								slug = e.currentTarget.value;
							}}
							placeholder="fc-exemple"
						/>
					</div>

					<div class="champ">
						<label for="logo">Logo du club</label>
						<input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
					</div>

					<div class="champ">
						<span class="faux-label">Couleur principale</span>
						<ChoixCouleur bind:valeur={couleur} />
					</div>

					<div class="grille deux">
						<div class="champ">
							<label for="commission">Commission par couvert</label>
							<input id="commission" name="commission" type="text" inputmode="decimal" value="0,20" />
						</div>
						<div class="champ">
							<label for="frais">Ces frais sont payés par</label>
							<select id="frais" name="frais_payes_par">
								<option value="participant" selected>le participant</option>
								<option value="club">le club</option>
							</select>
						</div>
					</div>
				</div>
			</details>

			<button class="bouton large" type="submit">Créer le club et prévenir l’organisateur</button>
		</form>
	</div>
</div>

<style>
	.adresse-prevue {
		padding: 12px 0 18px;
		color: var(--encre-douce);
	}
	.tiroir {
		background: #fafaf8;
		border: 1px solid var(--bord);
		border-radius: var(--rayon);
		margin-bottom: 20px;
	}
	.tiroir summary {
		padding: 16px;
		cursor: pointer;
		min-height: 56px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tiroir .resume {
		color: var(--encre-douce);
		font-size: 16px;
	}
	.dedans {
		padding: 4px 16px 16px;
		border-top: 1px solid var(--bord);
	}
</style>
