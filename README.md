# Suivi des projets de l'académie : widget Grist au DSFR

**Recenser, suivre et piloter les projets d'une organisation publique dans Grist, avec une interface au Système de design de l'État (DSFR) : banque des projets, fiche projet, plan d'action en kanban, liste ou calendrier, vue d'ensemble pour l'encadrement.**

Conçu par le [Lab 17 bis](https://lab17bis.github.io/ressources/), laboratoire d'innovation publique de l'[académie de Reims](https://www.ac-reims.fr/), au sein de l'équipe Dynamique Modernisation et Transformation (DMT) du rectorat.

> Les données restent dans un document Grist sur l'instance `grist.numerique.gouv.fr`. Ce dépôt ne contient que l'interface.

## En bref

Dans une académie, beaucoup de projets avancent sans qu'on sache qui porte quoi ni où ils en sont. Cet outil répond à trois besoins :

| Pour qui | Ce que l'outil permet |
| --- | --- |
| **Porteurs et équipes projet** | Déclarer un projet, le mettre à jour, tenir un plan d'action (kanban, liste ou calendrier), un journal et une liste de documents, sans reporting imposé. |
| **Encadrement** | Une vue d'ensemble : chiffres clés, projets à relancer, kanban des phases, calendrier, répartition par structure. |
| **Tous les agents** | Une banque des projets consultable : qui porte quoi, où en est chaque projet. Elle sert aussi d'archive. |

- L'annuaire se construit à l'usage : une personne qui déclare un projet ou y est ajoutée rejoint l'annuaire.
- Les droits (administrateur, contributeur, lecteur) sont appliqués par Grist, pas par le widget.
- Un projet peut être marqué « Restreint » pour n'être visible que de son équipe.

Contrairement aux catalogues du Lab 17 bis, cet outil exige que chaque personne soit **connectée à Grist** : il s'utilise dans Grist, comme widget, et non comme page publique.

## Ce que contient ce dépôt

- `suivi-projets/` : l'interface : banque des projets, fiche projet (plan d'action en liste, kanban ou calendrier, journal, documents), déclaration et modification, vue d'ensemble (chiffres clés, projets à relancer, kanban des phases, calendrier des projets, répartition par structure).
- `vendor/dsfr/` : feuilles de style, polices et icônes du DSFR (version 1.15.4, licence MIT), embarquées pour ne dépendre d'aucun service externe.
- `widget-test/` : page de test qui vérifie que l'instance Grist accepte un widget hébergé sur GitHub Pages.
- `docs/` : modèle de données et règles d'accès attendues.
- `donnees-fictives/` : un jeu d'exemple inventé, pour développer sans données réelles.

## Ce que ce dépôt ne contient jamais

- Aucun fichier `.grist`, aucun export de document (CSV, XLSX, JSON) issu de la base réelle.
- Aucune clé API, aucun jeton, aucun identifiant ou adresse de document Grist.
- Aucun nom, aucune adresse électronique, aucun projet réel.

Le widget n'affiche rien seul : il lit les données du document Grist dans lequel il est intégré, avec les droits de la personne connectée.

## Brancher l'interface

1. Dans le document Grist, ajouter un widget **Personnalisé** sur la table `Projets`.
2. Saisir l'adresse : `https://lab17bis.github.io/projets/suivi-projets/`.
3. Accorder l'accès **Accès complet au document** : l'interface lit les six tables et écrit avec les droits de la personne connectée.

Ouverte directement dans un navigateur, hors de Grist, l'adresse affiche une démonstration avec les données fictives. Rien n'y est enregistré.

## Brancher le widget de test

1. Activer GitHub Pages sur ce dépôt (Settings › Pages › branche `main`, dossier `/`).
2. Dans le document Grist, ajouter un widget **Personnalisé** sur la table `Projets`.
3. Saisir l'adresse : `https://lab17bis.github.io/projets/widget-test/`.
4. Accorder l'accès **Lecture de la table** au widget.

Si le widget affiche le nombre de projets visibles, l'hébergement fonctionne.

## Écosystème

- **[Grist](https://grist.numerique.gouv.fr)** : tableur-base de données libre ([gristlabs/grist-core](https://github.com/gristlabs/grist-core)), proposé aux agents de l'État par la [DINUM](https://www.numerique.gouv.fr/) dans [La Suite numérique](https://lasuite.numerique.gouv.fr/).
- **[Système de design de l'État (DSFR)](https://www.systeme-de-design.gouv.fr/)** ([GouvernementFR/dsfr](https://github.com/GouvernementFR/dsfr)).
- **[Communauté Grist francophone](https://forum.grist.libre.sh/)**.
- Autres outils du Lab 17 bis : [catalogue de ressources et d'interventions](https://github.com/lab17bis/ressources), [questionnaires DSFR avec logique conditionnelle](https://github.com/lab17bis/questionnaires).

## Mots-clés

Grist, widget Grist, suivi de projets, gestion de projet, portefeuille de projets, pilotage, kanban, diagramme de Gantt, plan d'action, banque de projets, DSFR, Système de design de l'État, La Suite numérique, DINUM, Éducation nationale, académie de Reims, rectorat, innovation publique, transformation publique.

Contact : Lab 17 bis, <lab17bis@ac-reims.fr>
