<script lang="ts">
	import { enhance } from '$app/forms';
	import { MARQUE } from '$lib/marque';
	let { data, form } = $props();

	const v = $derived(form?.valeurs);
	let envoi = $state(false);

	const questions = [
		{
			q: 'Et si quelqu’un n’a pas de téléphone ?',
			r: 'Il vous appelle, et vous ajoutez sa réservation à la main en trente secondes. Elle compte comme les autres : même ticket, même récap cuisine.'
		},
		{
			q: 'On est obligés de faire payer en ligne ?',
			r: 'Non. Vous cochez ce que vous acceptez : sur place, par virement, en ligne. Les trois, ou un seul.'
		},
		{
			q: 'Qui touche l’argent ?',
			r: 'Le club, directement sur son compte. Nous ne touchons jamais à votre caisse : les paiements en ligne passent par Mollie, qui verse au club.'
		},
		{
			q: 'Faut-il installer quelque chose ?',
			r: 'Rien. Tout se passe dans le navigateur, sur l’ordinateur du secrétaire comme sur le téléphone du président.'
		},
		{
			q: 'Que devenez-vous des données de nos membres ?',
			r: 'Le strict nécessaire est enregistré, et tout est supprimé douze mois après le souper. Aucun autre club ne voit vos listes.'
		},
		{
			q: 'On peut refaire le souper de l’année passée ?',
			r: 'Oui, en un clic. Le menu, les prix, les services et les textes sont recopiés ; vous changez la date.'
		}
	];
</script>

<svelte:head>
	<title>{MARQUE} — les réservations de vos soupers de club</title>
	<meta
		name="description"
		content="Créez votre souper spaghetti en dix minutes, partagez un lien, et sachez exactement combien de portions préparer. Pour les clubs, écoles et asbl de Belgique."
	/>
</svelte:head>

<div class="vitrine">
	<!-- ═══════════════════════════════════════════════════════ le soir -->
	<div class="soir">
		<header>
			<span class="logo">{MARQUE}</span>
			<a href="/connexion">J’ai déjà un espace</a>
		</header>

		<section class="accroche">
			<div class="dire">
				<h1>Le souper du club se remplit tout seul.</h1>
				<p class="chapeau">
					Vous préparez votre souper spaghetti en dix minutes. Les gens réservent depuis leur
					téléphone, paient s’ils le veulent, et vous savez exactement combien de portions sortir
					de la cuisine.
				</p>
				<div class="actes">
					<a class="acte premier" href="#demander">Demander l’espace de mon club</a>
					{#if data.demo}
						<a class="acte second" href={data.demo}>Voir un vrai souper</a>
					{/if}
				</div>
				<p class="petitesse">
					Gratuit pour le club. 0,20 € par couvert réservé et payé en ligne.
				</p>
			</div>

			<!-- Le ticket : l'objet que le produit fabrique vraiment. -->
			<div class="ticket" aria-hidden="true">
				<div class="souche">
					<span class="club">FC Exemple</span>
					<strong>Souper spaghetti</strong>
					<span class="quand">samedi 17 octobre · 18 h 30</span>
				</div>
				<div class="perfo"></div>
				<div class="corps">
					<div class="qui">
						<span class="nom">Julien Merchez</span>
						<span class="combien">3 couverts</span>
						<span class="ligne">2 × bolo adulte</span>
						<span class="ligne">1 × enfant</span>
						<span class="ligne">3 × tiramisu</span>
					</div>
					<div class="code">
						<svg viewBox="0 0 21 21" role="presentation">
							<rect width="21" height="21" fill="#fff" />
							<g fill="#141b2d">
								<path d="M0 0h7v7H0zm1 1v5h5V1z" /><path d="M2 2h3v3H2z" />
								<path d="M14 0h7v7h-7zm1 1v5h5V1z" /><path d="M16 2h3v3h-3z" />
								<path d="M0 14h7v7H0zm1 1v5h5v-5z" /><path d="M2 16h3v3H2z" />
								<path d="M9 0h1v2H9zm2 1h1v1h-1zM9 3h2v1H9zm3-3h1v1h-1z" />
								<path d="M0 9h2v1H0zm3 0h1v1H3zm2 0h2v1H5zm4 0h1v1H9zm2 0h1v2h-1zm3 0h1v1h-1zm2 0h2v1h-2zm3 0h2v1h-2z" />
								<path d="M9 11h1v1H9zm2 1h1v1h-1zm2-1h2v1h-2zm4 0h1v1h-1zm2 1h2v1h-2z" />
								<path d="M9 13h2v1H9zm4 0h1v2h-1zm3 0h1v1h-1zm3 1h2v1h-2z" />
								<path d="M9 15h1v2H9zm2 1h2v1h-2zm4-1h1v1h-1zm2 1h1v1h-1zm2-1h1v2h-1z" />
								<path d="M9 18h2v1H9zm3 0h1v1h-1zm2 1h2v1h-2zm4-1h1v1h-1zm-3-1h1v1h-1z" />
								<path d="M9 20h1v1H9zm2 0h1v1h-1zm3 0h1v1h-1zm3 0h2v1h-2zm3 0h1v1h-1z" />
							</g>
						</svg>
						<span class="ref">R-000-5000-081</span>
					</div>
				</div>
			</div>
		</section>
	</div>

	<!-- ═══════════════════════════════════════════════════════ le papier -->
	<main class="papier">
		<!-- ------------------------------------------------- ce que ça remplace -->
		<section class="bloc remplace">
			<h2>Ce que ça remplace</h2>
			<div class="deux">
				<div class="avant">
					<h3>Aujourd’hui</h3>
					<ul>
						<li>Le carnet de tickets photocopiés, qu’on perd</li>
						<li>Les appels le dimanche soir pendant le repas</li>
						<li>Le tableur que seul le trésorier comprend</li>
						<li>Les « on est combien ? » la veille, à 23 h</li>
						<li>La caisse à recompter trois fois</li>
					</ul>
				</div>
				<div class="apres">
					<h3>Avec {MARQUE}</h3>
					<ul>
						<li>Un lien, un QR code sur l’affiche</li>
						<li>Les réservations arrivent toutes seules</li>
						<li>Les totaux par plat et par service, tenus à jour</li>
						<li>Une feuille A4 pour la cuisine, imprimée en un clic</li>
						<li>Qui a payé, qui doit encore payer, sans discussion</li>
					</ul>
				</div>
			</div>
		</section>

		<!-- --------------------------------------------------- comment ça marche -->
		<section class="bloc marche">
			<h2>Comment ça marche</h2>
			<ol>
				<li>
					<span class="rang">1</span>
					<div>
						<h3>Vous préparez le souper</h3>
						<p>
							Une seule page qui défile : le titre, la date, la salle, le menu, les services de
							18 h 30 et 20 h 30. Un modèle « souper spaghetti » est déjà prêt, vous corrigez les
							prix. L’aperçu de la page publique s’affiche à côté, pendant que vous tapez.
						</p>
					</div>
				</li>
				<li>
					<span class="rang">2</span>
					<div>
						<h3>Vous partagez le lien</h3>
						<p>
							Vous obtenez une adresse courte et un QR code à télécharger, à coller sur les
							affiches et les tracts. Sur Facebook, dans le groupe WhatsApp du club, ça se colle
							tel quel.
						</p>
					</div>
				</li>
				<li>
					<span class="rang">3</span>
					<div>
						<h3>Le soir, vous scannez</h3>
						<p>
							À l’entrée, un téléphone suffit. Écran vert : la personne entre, avec son nom, son
							service et sa commande. Écran rouge : ticket déjà passé ou annulé. Rien à installer.
						</p>
					</div>
				</li>
			</ol>
		</section>

		<!-- ------------------------------------------------------ pour la cuisine -->
		<section class="bloc cuisine">
			<div class="mots">
				<h2>La cuisine sait quoi préparer</h2>
				<p>
					Le total par plat et par service, en gros caractères, sur une feuille A4 qu’on scotche
					au frigo. Il se met à jour à chaque réservation, y compris celles prises au téléphone.
				</p>
			</div>
			<div class="feuille" aria-hidden="true">
				<div class="tete">
					<strong>Souper spaghetti</strong>
					<span>samedi 17 octobre</span>
				</div>
				<p class="gros"><span>125</span> couverts</p>
				<table>
					<thead>
						<tr><th></th><th>18 h 30</th><th>20 h 30</th><th>Total</th></tr>
					</thead>
					<tbody>
						<tr><td>Bolo adulte</td><td>46</td><td>33</td><td class="t">79</td></tr>
						<tr><td>Végé adulte</td><td>8</td><td>6</td><td class="t">14</td></tr>
						<tr><td>Enfant</td><td>17</td><td>15</td><td class="t">32</td></tr>
						<tr><td>Tiramisu</td><td>35</td><td>24</td><td class="t">59</td></tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- ------------------------------------------------ ce que voient les gens -->
		<section class="bloc invites">
			<h2>Ce que vos invités voient</h2>
			<div class="trois">
				<div>
					<h3>Une page, pas un formulaire</h3>
					<p>
						L’affiche, la date, la salle, le menu avec des gros boutons plus et moins. Le total
						s’affiche pendant qu’ils choisissent.
					</p>
				</div>
				<div>
					<h3>Pas de compte à créer</h3>
					<p>
						Nom, prénom, e-mail. C’est tout. Ils reçoivent leur ticket et un lien pour annuler
						s’ils ont un empêchement.
					</p>
				</div>
				<div>
					<h3>Bancontact, ou pas</h3>
					<p>
						Ils paient tout de suite, ou le soir même, ou par virement avec une communication
						structurée qui se retrouve toute seule.
					</p>
				</div>
			</div>
		</section>

		<!-- --------------------------------------------------------------- le prix -->
		<section class="bloc prix">
			<p class="montant"><span>0,20 €</span> par couvert</p>
			<p class="explique">
				Rien d’autre. Pas d’abonnement, pas de contrat, pas de frais si personne ne réserve. Cette
				part est prélevée uniquement sur les couverts payés en ligne — et vous décidez si c’est le
				club ou le participant qui la prend en charge.
			</p>
			<ul class="franc">
				<li>L’argent arrive directement sur le compte du club</li>
				<li>Les réservations payées sur place ou par virement ne coûtent rien</li>
				<li>Vous pouvez arrêter quand vous voulez, vos données partent avec vous</li>
			</ul>
		</section>

		<!-- ------------------------------------------------------------- questions -->
		<section class="bloc questions">
			<h2>Les questions qu’on nous pose</h2>
			<div class="paires">
				{#each questions as item (item.q)}
					<div class="paire">
						<h3>{item.q}</h3>
						<p>{item.r}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- --------------------------------------------------------------- demande -->
		<section class="bloc demander" id="demander">
			{#if form?.envoye}
				<h2>C’est noté</h2>
				<p class="chapeau">
					La demande pour <strong>{form.club}</strong> est arrivée. Nous ouvrons l’espace du club
					et vous recevez votre lien de connexion par e-mail. D’ici là, vous n’avez rien à faire.
				</p>
				<a class="acte premier" href="/">Revenir au début</a>
			{:else}
				<h2>Demander l’espace de votre club</h2>
				<p class="chapeau">
					Six lignes, et on s’occupe du reste. Nous ouvrons l’espace et vous envoyons votre lien
					de connexion.
				</p>

				{#if form?.erreur}
					<p class="souci">{form.erreur}</p>
				{/if}

				<form
					method="POST"
					action="?/demande"
					use:enhance={() => {
						envoi = true;
						return async ({ update }) => {
							await update();
							envoi = false;
						};
					}}
				>
					<div class="paire-champs">
						<p class="champ">
							<label for="club">Nom du club</label>
							<input id="club" name="club" type="text" required value={v?.club ?? ''} placeholder="FC Exemple" />
						</p>
						<p class="champ">
							<label for="ville">Commune</label>
							<input id="ville" name="ville" type="text" value={v?.ville ?? ''} placeholder="Tournai" />
						</p>
					</div>
					<div class="paire-champs">
						<p class="champ">
							<label for="contact">Votre nom</label>
							<input id="contact" name="contact" type="text" required value={v?.contact ?? ''} />
						</p>
						<p class="champ">
							<label for="email">Votre e-mail</label>
							<input id="email" name="email" type="email" inputmode="email" required value={v?.email ?? ''} />
						</p>
					</div>
					<div class="paire-champs">
						<p class="champ">
							<label for="telephone">Téléphone <span class="facultatif">(facultatif)</span></label>
							<input id="telephone" name="telephone" type="tel" inputmode="tel" value={v?.telephone ?? ''} />
						</p>
						<p class="champ">
							<label for="evenement">Ce que vous organisez</label>
							<input
								id="evenement"
								name="evenement"
								type="text"
								value={v?.evenement ?? ''}
								placeholder="Souper boulets, le 8 novembre"
							/>
						</p>
					</div>

					<button class="acte premier" type="submit" disabled={envoi}>
						{envoi ? 'Un instant…' : 'Envoyer ma demande'}
					</button>
					<p class="petitesse">
						Ces informations servent uniquement à ouvrir votre espace.
						<a href="/confidentialite">Confidentialité</a>
					</p>
				</form>
			{/if}
		</section>
	</main>

	<footer class="pied">
		<span>{MARQUE}</span>
		<a href="/confidentialite">Confidentialité</a>
		<a href="/connexion">Se connecter</a>
	</footer>
</div>

<style>
	/**
	 * La vitrine hérite des jetons de `app.css` (encre, rouge carnet, jaune
	 * bristol, titrage). Elle n'ajoute que son papier légèrement plus clair.
	 */
	.vitrine {
		--papier: #fbfaf7;
		--papier-creuse: #f1eee7;
		--trait: var(--bord);

		background: var(--papier);
		color: var(--encre);
		font-family: var(--texte);
		font-size: 17px;
		line-height: 1.6;
		overflow-x: hidden;
	}

	/* Tailles et marges dans le MÊME sélecteur que la famille : sinon
	   `.vitrine :global(h2)` est plus spécifique et écrase les marges. */
	.vitrine :global(h1),
	.vitrine :global(h2),
	.vitrine :global(h3) {
		font-family: var(--titre);
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.02;
	}
	.vitrine :global(h1) {
		font-size: clamp(2.4rem, 5.6vw, 3.7rem);
		margin: 0;
		text-wrap: balance;
	}
	.vitrine :global(h2) {
		font-size: clamp(1.7rem, 3.4vw, 2.4rem);
		margin: 0 0 28px;
	}
	.vitrine :global(h3) {
		font-size: 1.2rem;
		letter-spacing: -0.01em;
		margin: 0 0 8px;
	}
	p {
		margin: 0 0 1em;
	}
	a {
		color: inherit;
	}

	/* ═══════════════════════════════════════════════════════════ le soir */
	.soir {
		background: var(--encre);
		color: var(--papier);
		padding-bottom: 60px;
	}

	.soir header {
		max-width: 1140px;
		margin: 0 auto;
		padding: 22px 24px;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
	}
	.logo {
		font-family: var(--titre);
		font-weight: 800;
		font-size: 21px;
		letter-spacing: -0.02em;
	}
	.soir header a {
		font-size: 16px;
		text-decoration-color: rgba(251, 250, 247, 0.35);
		text-underline-offset: 4px;
	}
	.soir header a:hover {
		text-decoration-color: var(--jaune);
	}

	.accroche {
		max-width: 1140px;
		margin: 0 auto;
		padding: 18px 24px 0;
		display: grid;
		gap: 44px;
	}
	.dire {
		max-width: 34ch;
	}
	.chapeau {
		font-size: 1.22rem;
		line-height: 1.5;
		color: rgba(251, 250, 247, 0.78);
		margin-top: 1.1em;
		max-width: 46ch;
	}
	.petitesse {
		font-size: 0.94rem;
		color: rgba(251, 250, 247, 0.6);
		margin: 0;
	}

	.actes {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin: 26px 0 16px;
	}
	.acte {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 56px;
		padding: 15px 26px;
		font-family: var(--texte);
		font-size: 1.06rem;
		font-weight: 600;
		border-radius: 3px;
		text-decoration: none;
		border: 2px solid transparent;
		cursor: pointer;
	}
	.acte.premier {
		background: var(--jaune);
		color: var(--encre);
		/* Ombre franche, comme une étiquette collée : pas un flou gris. */
		box-shadow: 4px 4px 0 var(--rouge);
	}
	.acte.premier:hover {
		box-shadow: 2px 2px 0 var(--rouge);
		transform: translate(2px, 2px);
	}
	.acte.second {
		border-color: rgba(251, 250, 247, 0.4);
		color: var(--papier);
	}
	.acte.second:hover {
		border-color: var(--jaune);
		color: var(--jaune);
	}

	/* ─────────────────────────────────────────────────────────── le ticket */
	.ticket {
		background: var(--papier);
		color: var(--encre);
		border-radius: 4px;
		max-width: 380px;
		box-shadow:
			0 26px 0 -18px rgba(0, 0, 0, 0.35),
			0 40px 70px -30px rgba(0, 0, 0, 0.8);
		transform: rotate(-1.4deg);
		animation: pose 700ms cubic-bezier(0.16, 0.84, 0.28, 1) both;
	}
	@keyframes pose {
		from {
			opacity: 0;
			transform: rotate(-5deg) translateY(18px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticket {
			animation: none;
		}
		.acte.premier:hover {
			transform: none;
		}
	}

	.souche {
		padding: 20px 22px 18px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.souche .club {
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--rouge);
	}
	.souche strong {
		font-family: var(--titre);
		font-weight: 800;
		font-size: 1.6rem;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}
	.souche .quand {
		font-size: 0.97rem;
		color: var(--encre-douce);
	}

	/* La perforation du carnet à souches. */
	.perfo {
		position: relative;
		height: 20px;
		border-top: 2px dashed var(--trait);
	}
	.perfo::before,
	.perfo::after {
		content: '';
		position: absolute;
		top: -12px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--encre);
	}
	.perfo::before {
		left: -11px;
	}
	.perfo::after {
		right: -11px;
	}

	.corps {
		padding: 2px 22px 22px;
		display: flex;
		gap: 18px;
		align-items: flex-start;
		justify-content: space-between;
	}
	.qui {
		display: flex;
		flex-direction: column;
	}
	.qui .nom {
		font-weight: 600;
		font-size: 1.06rem;
	}
	.qui .combien {
		color: var(--vert);
		font-weight: 600;
		margin-bottom: 8px;
	}
	.qui .ligne {
		font-size: 0.92rem;
		color: var(--encre-douce);
	}
	.code {
		text-align: center;
		flex: none;
	}
	.code svg {
		width: 92px;
		height: 92px;
		display: block;
		image-rendering: pixelated;
	}
	.code .ref {
		/* Un numéro de ticket : la chasse fixe est l'écriture juste, ici. */
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.66rem;
		letter-spacing: 0.02em;
		color: var(--encre-douce);
	}

	@media (min-width: 900px) {
		.accroche {
			grid-template-columns: 1fr auto;
			align-items: center;
			gap: 48px;
			padding-top: 34px;
		}
		.soir {
			padding-bottom: 78px;
		}
	}

	/* ═══════════════════════════════════════════════════════════ le papier */
	.papier {
		max-width: 1140px;
		margin: 0 auto;
		padding: 0 24px;
	}
	.bloc {
		padding: 68px 0;
		border-bottom: 1px solid var(--trait);
	}
	.bloc:last-child {
		border-bottom: none;
	}

	/* ------------------------------------------------------------ remplace */
	.deux {
		display: grid;
		gap: 36px;
	}
	.remplace ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.remplace li {
		padding: 11px 0 11px 30px;
		position: relative;
		border-bottom: 1px solid var(--trait);
	}
	.remplace li:last-child {
		border-bottom: none;
	}
	.avant :global(h3),
	.apres :global(h3) {
		padding-bottom: 10px;
		border-bottom: 3px solid var(--encre);
		margin-bottom: 4px;
	}
	.avant {
		color: var(--encre-douce);
	}
	.avant h3 {
		border-bottom-color: var(--trait);
	}
	.avant li::before {
		content: '×';
		position: absolute;
		left: 4px;
		color: var(--rouge);
		font-weight: 700;
	}
	.apres li::before {
		content: '';
		position: absolute;
		left: 4px;
		top: 20px;
		width: 11px;
		height: 6px;
		border-left: 2.5px solid var(--vert);
		border-bottom: 2.5px solid var(--vert);
		transform: rotate(-45deg);
	}
	@media (min-width: 760px) {
		.deux {
			grid-template-columns: 1fr 1fr;
			gap: 48px;
		}
	}

	/* -------------------------------------------------------------- marche -->*/
	.marche ol {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 34px;
	}
	.marche li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 20px;
		align-items: start;
	}
	.rang {
		font-family: var(--titre);
		font-weight: 800;
		font-size: 1.5rem;
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--encre);
		color: var(--jaune);
	}
	.marche p {
		max-width: 64ch;
		margin: 0;
		color: var(--encre-douce);
	}

	/* ------------------------------------------------------------- cuisine */
	.cuisine {
		display: grid;
		gap: 40px;
		align-items: center;
	}
	.cuisine .mots p {
		max-width: 46ch;
		color: var(--encre-douce);
	}
	.feuille {
		background: #fff;
		border: 1px solid var(--trait);
		padding: 24px;
		box-shadow: 4px 4px 0 var(--trait);
	}
	.feuille .tete {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		padding-bottom: 10px;
		border-bottom: 3px solid var(--encre);
	}
	.feuille .tete strong {
		font-family: var(--titre);
		font-size: 1.25rem;
	}
	.feuille .tete span {
		font-size: 0.9rem;
		color: var(--encre-douce);
	}
	.feuille .gros {
		font-size: 1.05rem;
		margin: 14px 0 12px;
	}
	.feuille .gros span {
		font-family: var(--titre);
		font-weight: 800;
		font-size: 3rem;
		line-height: 1;
		margin-right: 6px;
	}
	.feuille table {
		width: 100%;
		border-collapse: collapse;
	}
	.feuille th {
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--encre-douce);
		text-align: right;
		padding: 4px 6px;
		border-bottom: 1px solid var(--trait);
	}
	.feuille th:first-child {
		text-align: left;
	}
	.feuille td {
		padding: 9px 6px;
		text-align: right;
		border-bottom: 1px solid var(--papier-creuse);
		font-variant-numeric: tabular-nums;
	}
	.feuille td:first-child {
		text-align: left;
		font-weight: 500;
	}
	.feuille td.t {
		font-family: var(--titre);
		font-weight: 800;
		font-size: 1.3rem;
	}
	@media (min-width: 880px) {
		.cuisine {
			grid-template-columns: 1fr 420px;
			gap: 56px;
		}
	}

	/* ------------------------------------------------------------- invités */
	.trois {
		display: grid;
		gap: 30px;
	}
	.trois h3 {
		padding-top: 14px;
		border-top: 3px solid var(--jaune);
	}
	.trois p {
		margin: 0;
		color: var(--encre-douce);
	}
	@media (min-width: 760px) {
		.trois {
			grid-template-columns: repeat(3, 1fr);
			gap: 34px;
		}
	}

	/* ----------------------------------------------------------------- prix */
	.prix {
		background: var(--papier-creuse);
		margin: 0 -24px;
		padding: 62px 24px;
		border-bottom: none;
	}
	.montant {
		font-family: var(--titre);
		font-weight: 800;
		font-size: clamp(1.4rem, 3vw, 2rem);
		letter-spacing: -0.02em;
		margin-bottom: 0.5em;
	}
	.montant span {
		font-size: clamp(3.4rem, 11vw, 6rem);
		line-height: 0.9;
		display: block;
		color: var(--rouge);
	}
	.explique {
		max-width: 58ch;
		font-size: 1.1rem;
	}
	.franc {
		margin: 0;
		padding: 0;
		list-style: none;
		max-width: 58ch;
	}
	.franc li {
		padding: 10px 0 10px 26px;
		position: relative;
		border-top: 1px solid var(--trait);
		color: var(--encre-douce);
	}
	.franc li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 19px;
		width: 10px;
		height: 10px;
		background: var(--vert);
		border-radius: 50%;
	}

	/* ------------------------------------------------------------ questions */
	.paires {
		display: grid;
		gap: 28px;
	}
	.paire h3 {
		font-size: 1.1rem;
	}
	.paire p {
		margin: 0;
		color: var(--encre-douce);
		max-width: 56ch;
	}
	@media (min-width: 760px) {
		.paires {
			grid-template-columns: 1fr 1fr;
			gap: 34px 48px;
		}
	}

	/* -------------------------------------------------------------- demande */
	.demander {
		padding-top: 68px;
	}
	.demander .chapeau {
		color: var(--encre-douce);
		font-size: 1.12rem;
		max-width: 52ch;
		margin-top: 0;
	}
	.demander form {
		max-width: 620px;
		margin-top: 26px;
	}
	.paire-champs {
		display: grid;
		gap: 0 20px;
	}
	.champ {
		margin: 0 0 18px;
	}
	.champ label {
		display: block;
		font-weight: 600;
		font-size: 1rem;
		margin-bottom: 6px;
	}
	.facultatif {
		font-weight: 400;
		color: var(--encre-douce);
	}
	.champ input {
		width: 100%;
		min-height: 54px;
		padding: 13px 14px;
		font: inherit;
		color: var(--encre);
		background: #fff;
		border: 2px solid var(--trait);
		border-radius: 3px;
	}
	.champ input:focus-visible,
	.acte:focus-visible,
	.vitrine a:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--rouge);
		outline-offset: 2px;
	}
	.demander .petitesse {
		color: var(--encre-douce);
		margin-top: 14px;
	}
	.souci {
		background: #fdecef;
		border-left: 4px solid var(--rouge);
		padding: 12px 16px;
		max-width: 620px;
	}
	@media (min-width: 620px) {
		.paire-champs {
			grid-template-columns: 1fr 1fr;
		}
	}

	/* ---------------------------------------------------------------- pied */
	.pied {
		max-width: 1140px;
		margin: 0 auto;
		padding: 28px 24px 40px;
		display: flex;
		gap: 22px;
		flex-wrap: wrap;
		align-items: center;
		font-size: 0.95rem;
		color: var(--encre-douce);
		border-top: 1px solid var(--trait);
	}
	.pied span {
		font-family: var(--titre);
		font-weight: 800;
		color: var(--encre);
	}
</style>
