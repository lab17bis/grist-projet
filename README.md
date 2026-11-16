# grist-suivi-projets

> **Widget-outil pour Grist, clé en main.** Il ajoute à un document Grist une application complète de suivi de projets au Système de design de l'État (DSFR) : banque des projets, fiche projet, plan d'action en kanban, liste ou calendrier, journal, documents, vue d'ensemble pour l'encadrement.

Tout se règle dans Grist, sans toucher au code : en-tête et pied de page, listes de valeurs (phases, états, origines, thématiques…), couleurs des étiquettes, délai d'alerte. Le dépôt ne contient que le code : aucune donnée, aucun projet réel.

## À quoi ça sert

Dans une organisation, beaucoup de projets avancent sans qu'on sache qui porte quoi ni où ils en sont. L'outil répond à trois besoins :

| Pour qui | Ce que l'outil permet |
| --- | --- |
| **Porteurs et équipes projet** | Déclarer un projet, le mettre à jour, tenir un plan d'action (kanban, liste ou calendrier), un journal et une liste de documents, sans reporting imposé |
| **Encadrement** | Une vue d'ensemble : chiffres clés, projets à relancer, kanban des phases, calendrier, répartition par structure |
| **Toutes les personnes ayant accès** | Une banque des projets consultable : qui porte quoi, où en est chaque projet. Elle sert aussi d'archive |

- L'annuaire se construit à l'usage : une personne qui déclare un projet ou y est ajoutée rejoint l'annuaire.
- Les droits (administrateur, contributeur, lecteur) sont appliqués par Grist, pas par le widget.
- Un projet peut être marqué « Restreint » pour n'être visible que de son équipe.

Contrairement aux widgets de mise en page [grist-catalogue](https://github.com/lab17bis/grist-catalogue) et [grist-questionnaire](https://github.com/lab17bis/grist-questionnaire), cet outil ne produit pas de page publique : il s'utilise **dans Grist**, et chaque personne doit y être connectée.

Démonstration avec des données fictives (rien n'est enregistré) : <https://lab17bis.github.io/grist-suivi-projets/suivi-projets/>

## Le brancher en 5 minutes

1. **Partir du modèle** : téléchargez [`modele/modele-grist-suivi-projets.grist`](modele/modele-grist-suivi-projets.grist), puis importez-le dans Grist (*Ajouter › Importer un document*). Il contient les tables vides, les formules, les règles d'accès et les pages, widget compris. L'outil attend ce modèle de données : partir d'un document vide demande de recréer les tables décrites dans [`docs/modele-de-donnees.md`](docs/modele-de-donnees.md).
2. **Vérifier le widget** : la page *Interface* contient une vue *Personnalisée* sur la table `Projets`, avec l'adresse `https://lab17bis.github.io/grist-suivi-projets/suivi-projets/` et l'**accès complet au document**. L'interface lit les tables et écrit avec les droits de la personne connectée.
3. **Régler** : en bas du widget, ouvrez *Réglages du suivi*, puis enregistrez. À faire par un propriétaire du document : l'enregistrement modifie la structure des tables.
4. **Inviter** les personnes dans le document (*Partager*), en éditeur pour les contributeurs, en lecteur pour la consultation.

## Le régler

L'écran *Réglages du suivi* regroupe :

| Rubrique | Ce qu'on y règle |
| --- | --- |
| En-tête et pied de page | Logo, bloc-marque, titre, sous-titre, boutons, pied de page, mention d'accessibilité |
| Listes de valeurs | Phases, états, origines, thématiques, états des actions, types d'entrées du journal, types de documents. Les choix des colonnes Grist sont mis à jour en même temps |
| Couleurs des étiquettes | Une couleur par valeur |
| Autres réglages | Domaine des adresses électroniques (suggestion d'adresse et contrôle des profils), délai avant l'alerte « projet à relancer » |

Les réglages sont enregistrés en JSON dans la **description de la colonne `Config_suivi`** de la table `Projets`. Ne supprimez pas cette colonne.

## Le reprendre et l'adapter

- **L'utiliser tel quel** : importez le modèle. Aucune installation n'est nécessaire.
- **L'héberger chez vous** : copiez le dépôt (*Fork*), activez GitHub Pages ou déposez les fichiers sur n'importe quel serveur web statique, puis changez l'adresse du widget dans Grist. Aucune compilation n'est nécessaire.
- **Modifier le code** :

| Dossier ou fichier | Rôle |
| --- | --- |
| `suivi-projets/` | L'application : banque des projets, fiche projet, déclaration, vue d'ensemble, réglages |
| `suivi-projets/commun/` | En-tête et pied de page configurables, communs aux outils `grist-*` |
| `docs/modele-de-donnees.md` | Tables, valeurs de référence et règles d'accès attendues |
| `donnees-fictives/` | Jeu d'exemple inventé, utilisé par la démonstration |
| `modele/` | Modèle de document Grist sans données, à importer |
| `widget-test/` | Page qui vérifie qu'une instance Grist accepte un widget hébergé sur GitHub Pages |
| `tests/` | Tests automatisés de l'interface |
| `vendor/dsfr/` | DSFR 1.15.4, embarqué pour ne dépendre d'aucun service externe |

## Fonctionnement et sécurité

- Le widget n'affiche rien seul : il lit les données du document Grist dans lequel il est intégré, avec les droits de la personne connectée.
- Les droits sont appliqués par les **règles d'accès** du document : le widget ne les contourne jamais. Voir [`docs/modele-de-donnees.md`](docs/modele-de-donnees.md).
- Le dépôt ne contient jamais d'export de données réelles, de clé API, de jeton, d'adresse de document Grist, de nom ni d'adresse électronique réelle. Le modèle `.grist` ne contient que la structure.

## Limites

- Fonctionne uniquement dans Grist, avec des personnes connectées.
- La valeur de visibilité par défaut s'appelle « Académique » : elle n'est pas encore réglable.
- Aucun audit RGAA n'a été mené.

## Autres outils de la même famille

- [grist-catalogue](https://github.com/lab17bis/grist-catalogue) : widget de mise en page pour Grist, catalogue public de fiches au DSFR.
- [grist-questionnaire](https://github.com/lab17bis/grist-questionnaire) : widget de mise en page pour Grist, questionnaires au DSFR avec logique conditionnelle.

Ils partagent les mêmes réglages d'en-tête et de pied de page.

## Écosystème

- **[Grist](https://grist.numerique.gouv.fr)** : tableur-base de données libre ([gristlabs/grist-core](https://github.com/gristlabs/grist-core)), proposé aux agents publics par la [DINUM](https://www.numerique.gouv.fr/) dans [La Suite numérique](https://lasuite.numerique.gouv.fr/).
- **[Système de design de l'État (DSFR)](https://www.systeme-de-design.gouv.fr/)** ([GouvernementFR/dsfr](https://github.com/GouvernementFR/dsfr)). Son usage est réservé aux sites des services de l'État.
- **[Communauté Grist francophone](https://forum.grist.libre.sh/)**.

## Mots-clés

Grist, widget Grist, widget-outil, suivi de projets, gestion de projet, portefeuille de projets, pilotage, kanban, plan d'action, banque de projets, annuaire, DSFR, Système de design de l'État, La Suite numérique, DINUM, service public, administration, transformation publique, clé en main, logiciel libre.

## Licence

Code sous licence MIT (voir `LICENSE`). Le DSFR embarqué dans `vendor/dsfr/` conserve sa propre licence. Réutilisation, adaptation et contributions bienvenues.

Conçu par le Lab 17 bis, laboratoire d'innovation publique de l'académie de Reims. Contact : <lab17bis@ac-reims.fr>
