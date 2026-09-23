<script lang="ts">
	import { enhance } from '$app/forms';
	let { form, data } = $props();
	let envoi = $state(false);
</script>

<svelte:head><title>Connexion</title></svelte:head>

<div class="page" style="max-width:480px">
	<div class="carte">
		{#if form?.envoye}
			<h1>Regardez vos e-mails</h1>
			<div class="message ok">
				Un lien de connexion vient d’être envoyé à <strong>{form.email}</strong>.
			</div>
			<p class="muet">
				Le lien est valable 30 minutes. Si vous ne voyez rien, vérifiez le dossier « courrier
				indésirable ».
			</p>
			<p class="muet petit">
				Toujours rien après deux minutes ? Cette adresse n’est peut-être pas encore inscrite.
				Demandez au club de vous inviter, ou essayez une autre adresse.
			</p>
			<a class="bouton second large" href="/connexion">Recommencer</a>
		{:else}
			<h1>Connexion</h1>
			<p class="muet">
				Pas de mot de passe : vous recevez un lien par e-mail, vous cliquez, vous êtes connecté.
			</p>

			{#if data.lienPerime && !form}
				<div class="message erreur">
					Ce lien n’est plus valable : il a déjà servi ou il a plus de 30 minutes. Demandez-en un
					nouveau.
				</div>
			{/if}

			{#if form?.erreur}
				<div class="message erreur">{form.erreur}</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					envoi = true;
					return async ({ update }) => {
						await update();
						envoi = false;
					};
				}}
			>
				<input type="hidden" name="suite" value={data.suite} />
				<div class="champ">
					<label for="email">Votre adresse e-mail</label>
					<input
						id="email"
						name="email"
						type="email"
						inputmode="email"
						autocomplete="email"
						required
						placeholder="prenom@exemple.be"
						value={form?.email ?? ''}
					/>
				</div>
				<button class="bouton large" type="submit" disabled={envoi}>
					{envoi ? 'Envoi…' : 'Recevoir mon lien'}
				</button>
			</form>
		{/if}
	</div>
	<p class="centre petit"><a href="/confidentialite">Confidentialité</a></p>
</div>
