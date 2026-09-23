<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import { MARQUE } from '$lib/marque';

	/**
	 * Les pages se croisent au lieu de sauter. Le navigateur qui ne connaît pas
	 * `startViewTransition` navigue normalement, sans rien perdre.
	 */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		return new Promise((resoudre) => {
			document.startViewTransition(async () => {
				resoudre();
				await navigation.complete;
			});
		});
	});
	let { data, children } = $props();
</script>

{#if data?.utilisateur}
	<header class="entete sans-impression">
		<div class="dedans">
			<a class="marque" href="/">{MARQUE}</a>
			<span class="espace"></span>
			<span class="qui">{data.utilisateur.email}</span>
			{#if data.utilisateur.role === 'superadmin'}
				<a class="retour" href="/admin">Les clubs</a>
			{:else}
				<a class="retour" href="/gestion">Mes soupers</a>
			{/if}
			<form method="POST" action="/deconnexion">
				<button
					class="petit lien-bouton"
					type="submit"
				>
					Se déconnecter
				</button>
			</form>
		</div>
	</header>
{/if}

{@render children?.()}

<style>
	/* L'en-tête est sur l'encre : le texte doit être clair. */
	.lien-bouton {
		background: none;
		border: none;
		color: var(--fond);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
		font: inherit;
		font-size: 17px;
		min-height: 48px;
		padding: 0 8px;
	}
	.lien-bouton:hover {
		color: var(--jaune);
	}
</style>
