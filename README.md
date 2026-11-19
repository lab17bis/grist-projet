# grist-projet

> **Widget-outil pour Grist, clé en main.** Il transforme un document Grist en espace d'équipe pour gérer des projets ensemble, au Système de design de l'État (DSFR) : base des projets de l'équipe, page de chaque projet (plan d'action avec sous-actions, jalons et dépendances, en liste, kanban ou chronologie ; journal ; documents), travail de chacun, vue d'ensemble pour l'encadrement.

Tout se règle dans Grist, sans toucher au code : en-tête et pied de page, listes de valeurs (phases, états, origines, thématiques…), couleurs des étiquettes, délai d'alerte. Le dépôt ne contient que le code : aucune donnée, aucun projet réel.

## À quoi ça sert

Un document Grist devient l'**espace commun d'une équipe** (un service, une direction, un réseau, un groupe de travail). On y crée des projets, on les partage, on y travaille à plusieurs. L'espace sert à la fois de base de projets (qui porte quoi, où en est chaque projet) et d'outil de travail au quotidien. Il répond à quatre besoins :

| Pour qui | Ce que l'outil permet |
| --- | --- |
| **Porteurs et équipes projet** | Créer un projet, le mettre à jour, tenir un plan d'action, un journal et une liste de documents, sans reporting imposé |
| **Chaque membre** | *Mon travail* : les actions qui lui sont confiées (en retard, dans les 7 jours, plus tard), ses projets, l'activité récente de ses projets |
| **Encadrement** | Une vue d'ensemble : chiffres clés, projets à relancer, jalons des 30 prochains jours, actions en retard ou en attente, kanban des phases, calendrier, répartition par structure |
| **Toutes les personnes de l'espace** | Une banque des projets consultable : qui porte quoi, où en est chaque projet. Elle sert aussi d'archive |

### Le plan d'action

- **Actions et sous-actions**, sur autant de niveaux que nécessaire. Une action parente affiche la progression de ses sous-actions (« 2/3 faites »).
- **Jalons** : des dates clés (une validation, un lancement, un comité), signalés par un losange.
- **Dépendances** : une action peut dépendre d'une ou plusieurs autres. Tant que celles-ci ne sont pas faites, elle est signalée « en attente de… ». Une action ne peut pas dépendre d'elle-même ni d'une action qui l'attend déjà.
- **Trois affichages** : *Liste* (arborescence, modification en place), *Kanban* (par état, glisser-déposer ou boutons) et *Chronologie* (barres et jalons dans le temps, repère du jour).
- **Décalage en chaîne** : quand on repousse ou avance la date d'une action, l'outil propose de décaler d'autant ses sous-actions et tout ce qui en dépend. Les actions faites ne bougent pas.
- **Rétroplanning** : depuis un jalon ou une action qui a des prérequis, l'outil remonte les dépendances et les sous-actions et calcule pour chacune la date au plus tard qui permet de tenir l'échéance, en gardant sa durée. Il signale ce qui finit trop tard, la marge des autres, et peut caler toutes les actions au plus tard en un clic. Les jalons intermédiaires gardent leur date. Le calcul se fait en jours calendaires.
- **Pour chaque action** : responsable, dates, état, notes. L'avancement du projet est calculé sur les actions sans sous-action, hors jalons.

### Les droits

- L'annuaire se construit à l'usage : une personne qui déclare un projet ou y est ajoutée rejoint l'annuaire.
- Les droits sont appliqués par les **règles d'accès de Grist**, pas par le widget.
- Chaque projet est **ouvert** (visible par tout l'espace : la transparence par défaut d'une équipe) ou **restreint** (visible seulement par ses porteurs, son équipe et la personne qui l'a confié).
- Les porteurs (et la personne qui a déclaré le projet) le modifient ; l'équipe projet tient le plan d'action, le journal et les documents.
- Le **rôle « Administration »**, attribué par personne dans *Réglages du suivi*, voit et gère tous les projets, y compris restreints. Seuls les propriétaires du document l'attribuent.
- Chaque personne est reconnue par l'adresse de son compte Grist : il suffit que sa fiche de l'annuaire porte cette adresse. Sinon, elle indique son nom une seule fois.

Contrairement aux widgets de mise en page [grist-catalogue](https://github.com/lab17bis/grist-catalogue), [grist-questionnaire](https://github.com/lab17bis/grist-questionnaire) et [grist-graphique](https://github.com/lab17bis/grist-graphique), cet outil ne produit pas de page publique : il s'utilise **dans Grist**, et chaque personne doit y être connectée. Le document Grist est l'espace : on y invite les membres de l'équipe.

Démonstration avec des données fictives (rien n'est enregistré) : <https://lab17bis.github.io/grist-projet/suivi-projets/>

## Le brancher en 3 minutes

1. **Ajouter le widget** : dans un document Grist, même vide, ajoutez une page *Personnalisé* sur n'importe quelle table, avec l'adresse `https://lab17bis.github.io/grist-projet/suivi-projets/` et l'**accès complet au document**.
2. **Installer** : le widget propose *Créer les tables*, ou *avec un exemple fictif*. Il crée les tables, leurs formules et les **règles d'accès** qui protègent les projets restreints (schéma : [`suivi-projets/schema.json`](suivi-projets/schema.json)). À faire par un propriétaire du document. Les tables existantes ne sont pas modifiées ; si le document a déjà des règles pour ces tables, elles ne sont pas remplacées.
3. **Régler** : en bas du widget, ouvrez *Réglages du suivi*, puis enregistrez.
4. **Inviter** les personnes dans le document (*Partager*), en éditeur pour les contributeurs, en lecteur pour la consultation.

Pour plus de clarté, rattachez ensuite la vue personnalisée à la table `Projets` et supprimez la table de départ. Le modèle [`modele/modele-grist-projet.grist`](modele/modele-grist-projet.grist) reste disponible, pages comprises.

## Mettre à jour un document existant

Un document installé avec une version précédente continue de fonctionner. Un bandeau propose alors *Mettre à jour le document* : à faire une fois, par un propriétaire. Le widget ajoute les colonnes nouvelles (sous-actions, jalons, dépendances, notes, rôle) et les règles d'accès du rôle « Administration », sans modifier les données ni les autres règles.

## Le régler

L'écran *Réglages du suivi* regroupe :

| Rubrique | Ce qu'on y règle |
| --- | --- |
| En-tête et pied de page | Logo, bloc-marque, titre, sous-titre, boutons, pied de page, mention d'accessibilité |
| Listes de valeurs | Phases, états, origines, thématiques, états des actions, types d'entrées du journal, types de documents. Les choix des colonnes Grist sont mis à jour en même temps |
| Couleurs des étiquettes | Une couleur par valeur |
| Rôle « Administration » | Les personnes qui voient et gèrent tous les projets |
| Autres réglages | Domaine des adresses électroniques (suggestion d'adresse et contrôle des profils), délai avant l'alerte « projet à relancer » |

Les réglages sont enregistrés en JSON dans la **description de la colonne `Config_suivi`** de la table `Projets`. Ne supprimez pas cette colonne.

## Le reprendre et l'adapter

- **L'utiliser tel quel** : importez le modèle. Aucune installation n'est nécessaire.
- **L'héberger chez vous** : copiez le dépôt (*Fork*), activez GitHub Pages ou déposez les fichiers sur n'importe quel serveur web statique, puis changez l'adresse du widget dans Grist. Aucune compilation n'est nécessaire.
- **Modifier le code** :

| Dossier ou fichier | Rôle |
| --- | --- |
| `suivi-projets/` | L'application : banque des projets, fiche projet, mon travail, déclaration, vue d'ensemble, réglages |
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
- Aucun audit RGAA n'a été mené.

## Espaces clés en main

Ce widget est déjà assemblé, avec d'autres, dans des **espaces** : des documents Grist complets à importer en une fois, vides ou avec un exemple fictif.

- [espace-pilotage](https://github.com/lab17bis/espace-pilotage) : piloter une équipe : management visuel, réunions, projets et indicateurs.
- [espace-collaboratif](https://github.com/lab17bis/espace-collaboratif) : travailler ensemble : réunions, projets partagés et ressources communes.

## Autres outils de la même famille

- [grist-catalogue](https://github.com/lab17bis/grist-catalogue) : widget de mise en page pour Grist, catalogue public de fiches au DSFR.
- [grist-questionnaire](https://github.com/lab17bis/grist-questionnaire) : widget de mise en page pour Grist, questionnaires au DSFR avec logique conditionnelle.
- [grist-graphique](https://github.com/lab17bis/grist-graphique) : widget de mise en page pour Grist, tableaux de bord et graphiques au DSFR.
- [grist-reunion](https://github.com/lab17bis/grist-reunion) : widget-outil pour Grist, ordre du jour, notes, décisions, actions et compte rendu de réunion.
- [grist-management](https://github.com/lab17bis/grist-management) : widget-outil pour Grist, écran de management visuel d'équipe (météo, signalements, escalade), qui affiche aussi les données des autres widgets.

Ils partagent les mêmes réglages d'en-tête et de pied de page.

## Écosystème

- **[Grist](https://grist.numerique.gouv.fr)** : tableur-base de données libre ([gristlabs/grist-core](https://github.com/gristlabs/grist-core)), proposé aux agents publics par la [DINUM](https://www.numerique.gouv.fr/) dans [La Suite numérique](https://lasuite.numerique.gouv.fr/).
- **[Système de design de l'État (DSFR)](https://www.systeme-de-design.gouv.fr/)** ([GouvernementFR/dsfr](https://github.com/GouvernementFR/dsfr)). Son usage est réservé aux sites des services de l'État.
- **[Communauté Grist francophone](https://forum.grist.libre.sh/)**.

## Mots-clés

Grist, widget Grist, widget-outil, gestion de projet en équipe, espace d'équipe, travail collaboratif, suivi de projets, gestion de projet, portefeuille de projets, pilotage, kanban, plan d'action, banque de projets, annuaire, DSFR, Système de design de l'État, La Suite numérique, DINUM, service public, administration, transformation publique, clé en main, logiciel libre.

## Licence

Code sous licence MIT (voir `LICENSE`). Le DSFR embarqué dans `vendor/dsfr/` conserve sa propre licence. Réutilisation, adaptation et contributions bienvenues.

Conçu par le Lab 17 bis, laboratoire d'innovation publique de l'académie de Reims. Contact : <lab17bis@ac-reims.fr>
