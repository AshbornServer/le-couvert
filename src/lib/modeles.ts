/**
 * Modèles de départ : un clic et l'événement est prérempli.
 * Les prix sont des points de départ, l'organisateur les corrige.
 */

export type LigneModele = {
	nom: string;
	prix_centimes: number;
	categorie: 'plat' | 'dessert' | 'boisson' | 'autre';
	compte_comme_couvert: boolean;
};

export type Modele = {
	cle: string;
	nom: string;
	titre: string;
	heure_debut: string;
	services: { libelle: string; heure: string }[];
	menu: LigneModele[];
	options: { libelle: string; type: 'texte' | 'case' }[];
	texte_accueil: string;
};

const PLAT = (nom: string, prix: number): LigneModele => ({
	nom,
	prix_centimes: prix,
	categorie: 'plat',
	compte_comme_couvert: true
});
const DESSERT = (nom: string, prix: number): LigneModele => ({
	nom,
	prix_centimes: prix,
	categorie: 'dessert',
	compte_comme_couvert: false
});
const BOISSON = (nom: string, prix: number): LigneModele => ({
	nom,
	prix_centimes: prix,
	categorie: 'boisson',
	compte_comme_couvert: false
});

const ALLERGIES = { libelle: 'Allergies ou remarque', type: 'texte' as const };
const TABLE = { libelle: 'Je souhaite être à table avec…', type: 'texte' as const };

export const MODELES: Modele[] = [
	{
		cle: 'spaghetti',
		nom: 'Souper spaghetti',
		titre: 'Souper spaghetti',
		heure_debut: '18:30',
		services: [
			{ libelle: 'Premier service', heure: '18:30' },
			{ libelle: 'Deuxième service', heure: '20:30' }
		],
		menu: [
			PLAT('Spaghetti bolo adulte', 1600),
			PLAT('Spaghetti végé adulte', 1500),
			PLAT('Spaghetti enfant', 800),
			DESSERT('Tiramisu', 400)
		],
		options: [ALLERGIES, TABLE],
		texte_accueil:
			'Notre souper spaghetti annuel ! Toute l’équipe vous attend. Réservez votre table, les bénévoles s’occupent du reste.'
	},
	{
		cle: 'boulets',
		nom: 'Souper boulets',
		titre: 'Souper boulets frites',
		heure_debut: '18:30',
		services: [
			{ libelle: 'Premier service', heure: '18:30' },
			{ libelle: 'Deuxième service', heure: '20:30' }
		],
		menu: [
			PLAT('Boulets frites adulte', 1600),
			PLAT('Boulets frites enfant', 900),
			PLAT('Boulet supplémentaire', 400),
			DESSERT('Part de tarte', 350)
		],
		options: [ALLERGIES, TABLE],
		texte_accueil:
			'Boulets sauce lapin et frites maison, préparés par nos bénévoles. Venez nombreux soutenir le club !'
	},
	{
		cle: 'moules',
		nom: 'Moules-frites',
		titre: 'Souper moules-frites',
		heure_debut: '18:00',
		services: [
			{ libelle: 'Premier service', heure: '18:00' },
			{ libelle: 'Deuxième service', heure: '20:00' }
		],
		menu: [
			PLAT('Moules nature + frites', 2400),
			PLAT('Moules à la crème + frites', 2600),
			PLAT('Vol-au-vent + frites', 1600),
			PLAT('Menu enfant', 1000),
			DESSERT('Dame blanche', 500)
		],
		options: [ALLERGIES, TABLE],
		texte_accueil:
			'Nos moules-frites sont de retour ! Places limitées, réservez sans attendre.'
	},
	{
		cle: 'barbecue',
		nom: 'Barbecue',
		titre: 'Barbecue du club',
		heure_debut: '12:00',
		services: [],
		menu: [
			PLAT('Assiette adulte (3 pièces + crudités)', 1800),
			PLAT('Assiette enfant (1 pièce + crudités)', 900),
			PLAT('Brochette supplémentaire', 450),
			BOISSON('Bière — 6 jetons boisson en prévente', 1500),
			DESSERT('Part de gâteau', 300)
		],
		options: [ALLERGIES, { libelle: 'Je viens avec un plat à partager', type: 'texte' }],
		texte_accueil:
			'Barbecue du club, dans le jardin et à l’abri s’il pleut. Ambiance familiale, tout le monde est bienvenu.'
	},
	{
		cle: 'fancy-fair',
		nom: 'Fancy-fair',
		titre: 'Fancy-fair de l’école',
		heure_debut: '11:30',
		services: [
			{ libelle: 'Dîner — 11 h 30', heure: '11:30' },
			{ libelle: 'Dîner — 13 h 00', heure: '13:00' }
		],
		menu: [
			PLAT('Dîner adulte', 1400),
			PLAT('Dîner enfant', 700),
			BOISSON('Carte de 10 jetons boisson', 1200),
			DESSERT('Assiette de pâtisseries', 500),
			{
				nom: 'Ticket tombola (5 numéros)',
				prix_centimes: 500,
				categorie: 'autre',
				compte_comme_couvert: false
			}
		],
		options: [ALLERGIES, { libelle: 'Classe de votre enfant', type: 'texte' }],
		texte_accueil:
			'La fancy-fair de l’école : spectacle des enfants, dîner, château gonflable et tombola. Réservez vos repas à l’avance, ça aide beaucoup les bénévoles.'
	}
];

export const modeleParCle = (cle: string) => MODELES.find((m) => m.cle === cle);
