/**
 * Action Svelte : un nombre qui monte jusqu'à sa valeur.
 *
 * Sert aux chiffres du tableau de bord. Respecte `prefers-reduced-motion` :
 * dans ce cas la valeur s'affiche d'un coup, sans compte.
 */
type Reglages = { valeur: number; format?: (n: number) => string; duree?: number };

export function compteur(element: HTMLElement, reglages: Reglages) {
	const format = reglages.format ?? ((n: number) => String(Math.round(n)));
	const immobile = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let animation: number | undefined;
	let depuis = 0;

	function afficher(valeur: number) {
		element.textContent = format(valeur);
	}

	function courir(vers: number, duree: number) {
		if (animation) cancelAnimationFrame(animation);
		if (immobile || duree <= 0) {
			afficher(vers);
			depuis = vers;
			return;
		}

		const debut = performance.now();
		const de = depuis;

		function pas(instant: number) {
			const avance = Math.min(1, (instant - debut) / duree);
			// Ralentit en arrivant, comme un compteur mécanique.
			const adouci = 1 - Math.pow(1 - avance, 3);
			afficher(de + (vers - de) * adouci);
			if (avance < 1) animation = requestAnimationFrame(pas);
			else depuis = vers;
		}
		animation = requestAnimationFrame(pas);
	}

	courir(reglages.valeur, reglages.duree ?? 750);

	return {
		update(suivant: Reglages) {
			courir(suivant.valeur, suivant.duree ?? 450);
		},
		destroy() {
			if (animation) cancelAnimationFrame(animation);
		}
	};
}
