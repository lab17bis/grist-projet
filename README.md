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

### La fiche d'un projet

Quatre volets, visibles en tête de la fiche (cinq avec les rendez-vous) :

- **Synthèse** : où en est le projet en un coup d'œil (part des actions faites, retards et attentes, prochaine échéance, dernière nouvelle du journal, prochain rendez-vous ou nombre de documents), chacun avec un lien vers son volet ; puis la présentation du projet (en bref, mission, objectifs, équipe, dates, champs personnalisés).
- **Plan d'action** : le choix de l'affichage (*Liste*, *Kanban*, *Chronologie*) est en tête du volet, au-dessus du formulaire d'ajout.
- **Journal et notes** : les nouvelles datées du projet (avancement, décisions, difficultés) et les notes à garder (type « Information »).
- **Documents**, et **Rendez-vous** quand l'outil Réunions est branché.

La page publique n'affiche que la présentation, sans la synthèse.

La **vue d'ensemble** commence par les chiffres clés, puis un sommaire « Aller à » mène directement à chaque rubrique (projets à relancer, jalons, actions en retard, projets par phase, calendrier, répartition par structure).

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

L'outil s'utilise **dans Grist**, et chaque personne doit y être connectée : le document Grist est l'espace, on y invite les membres de l'équipe. Il peut en plus publier une **banque des projets en lecture seule** sur une page publique (voir « Page publique » plus bas) : seuls les projets non restreints y figurent.

Démonstration avec des données fictives (rien n'est enregistré) : <https://lab17bis.github.io/grist-projet/v1/suivi-projets/>

## Le brancher en 3 minutes

1. **Ajouter le widget** : dans un document Grist, même vide, ajoutez une page *Personnalisé* sur n'importe quelle table, avec l'adresse `https://lab17bis.github.io/grist-projet/v1/suivi-projets/` et l'**accès complet au document**.
2. **Installer** : le widget propose *Créer les tables*, ou *avec un exemple fictif*. Il crée les tables, leurs formules et les **règles d'accès** qui protègent les projets restreints (schéma : [`suivi-projets/schema.json`](suivi-projets/schema.json)). À faire par un propriétaire du document. Les tables existantes ne sont pas modifiées ; si le document a déjà des règles pour ces tables, elles ne sont pas remplacées.
3. **Régler** : dans la barre de l'éditeur, en haut du widget, ouvrez *Réglages*, puis enregistrez.
4. **Inviter** les personnes dans le document (*Partager*), en éditeur pour les contributeurs, en lecteur pour la consultation.

Pour plus de clarté, rattachez ensuite la vue personnalisée à la table `Projets` et supprimez la table de départ. Le modèle [`modele/modele-grist-projet.grist`](modele/modele-grist-projet.grist) reste disponible, pages comprises.

## Mettre à jour un document existant

Un document installé avec une version précédente continue de fonctionner. Un bandeau propose alors *Mettre à jour le document* : à faire une fois, par un propriétaire. Le widget ajoute les colonnes nouvelles (sous-actions, jalons, dépendances, notes, rôle) et les règles d'accès du rôle « Administration », sans modifier les données ni les autres règles.

## Le régler

La barre de l'éditeur est commune à tous les widgets : nom du widget et statut d'enregistrement à gauche, onglets *Réglages*, *En-tête et pied*, *Aperçu* et *Publication* au centre, bouton *Enregistrer* à droite. *Réglages* a deux sous-onglets, *Général* et *Rôles*. Le suivi s'utilise dans l'onglet *Aperçu*, ouvert par défaut : c'est la vraie page, banque et fiches, avec les réglages en cours, même non enregistrés.

**Éditeur du widget ou page d'usage, avec le même lien.** Chaque vue Grist choisit ce qu'elle affiche (onglet *Publication*, rubrique *Affichage de cette vue Grist*) : l'**éditeur du widget** (affichage par défaut) ou la **page d'usage** (l'outil avec son en-tête et son pied de page, sans barre de réglages ; un lien *Éditer le widget*, en bas de page, rouvre l'éditeur). Après *Appliquer à cette vue*, cliquez sur *Enregistrer* en haut à droite de la vue Grist pour garder le choix. Pour avoir les deux dans un document, ajoutez deux vues Personnalisées avec la même adresse. Ce choix n'est pas une protection : les droits restent ceux du document (Partager, Permissions avancées).

Le sous-onglet *Général* regroupe :

| Rubrique | Ce qu'on y règle |
| --- | --- |
| En-tête et pied de page | Logo, bloc-marque, titre, sous-titre, boutons, pied de page, mention d'accessibilité |
| Champs de la fiche projet | Masquer les champs d'origine (mission, objectifs, origine, dates, thématiques…) et ajouter ses propres champs : texte court ou long, choix dans une liste, date, nombre. Chaque champ ajouté devient une colonne de la table `Projets`, affichée dans le formulaire, la fiche et, au choix, sur la carte. Une colonne déjà créée dans Grist (texte, choix, date, nombre) se reprend telle quelle avec « Utiliser une colonne existante » : aucune colonne n'est créée ni modifiée. Un champ masqué n'est jamais supprimé : ses données restent dans Grist |
| Carte de projet | Champs d'origine à afficher sur les cartes de la banque (thématiques, origine, mission, objectifs, structures associées, début…), en plus de ceux que l'on coche sur ses propres champs |
| Filtres de la banque | Filtres proposés en plus de la recherche, du tri et de l'inclusion des projets terminés : structure, phase et état par défaut, thématiques, origine et chaque champ « Choix dans une liste » au choix |
| Rendez-vous | Active l'onglet « Rendez-vous » des fiches (voir ci-dessous) |
| Agencement de la fiche projet | Agencement libre façon « bento » : ordre, largeur (pleine, deux tiers, moitié, un tiers) et présence de chaque bloc de la fiche (en bref, mission, objectifs, porteurs et équipe, calendrier, structures et thématiques, champs personnalisés). Désactivé par défaut : la fiche garde alors sa présentation d'origine |
| Listes de valeurs | Phases, états, origines, thématiques, états des actions, types d'entrées du journal, types de documents. Les choix des colonnes Grist sont mis à jour en même temps |
| Couleurs des étiquettes | Une couleur par valeur |
| Rôle « Administration » | Les personnes qui voient et gèrent tous les projets |
| Autres réglages | Domaine des adresses électroniques (suggestion d'adresse et contrôle des profils), délai avant l'alerte « projet à relancer » |

**Profil.** La personne connectée est reconnue par l'adresse de son compte Grist, sans écran de connexion. Si son adresse est de la forme `prenom.nom@domaine`, son profil est créé automatiquement (« NOM Prénom »), modifiable ensuite dans *Mon profil*. Sinon, un bandeau l'invite à créer son profil, sans l'y forcer. Sur la page publique, aucun profil ni identification n'est demandé.

**Colonne supprimée à la main.** Le widget n'envoie que les champs dont la colonne existe : supprimer une colonne dans Grist ne bloque plus l'enregistrement d'un projet.

Les réglages sont enregistrés en JSON dans la **description de la colonne `Config_suivi`** de la table `Projets`. Ne supprimez pas cette colonne.

## Le reprendre et l'adapter

- **L'utiliser tel quel** : importez le modèle. Aucune installation n'est nécessaire.
- **L'héberger chez vous** : copiez le dépôt (*Fork*), activez GitHub Pages ou déposez les fichiers sur n'importe quel serveur web statique, puis changez l'adresse du widget dans Grist. Aucune compilation n'est nécessaire.
- **Modifier le code** :

| Dossier ou fichier | Rôle |
| --- | --- |
| `v1/` | Version stable figée, servie à l'adresse `…/v1/`. Ne pas modifier à la main. |
| `outils/figer-version.sh` | Copie la version en cours dans `vN/`. |
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

- L'outil de travail fonctionne uniquement dans Grist, avec des personnes connectées. Seule la banque des projets peut être publiée (lecture seule, sans plan d'action, journal ni documents).
- Aucun audit RGAA n'a été mené.

## Version stable et version en cours

Dans Grist, utilisez l'adresse de la **version stable** : `https://lab17bis.github.io/grist-projet/v1/suivi-projets/`. Elle ne change que pour corriger un défaut, sans toucher aux tables ni aux réglages. Une évolution qui les modifie paraît sous une nouvelle adresse (`v2/`) : les documents déjà en service restent sur `v1/` tant que vous ne changez pas l'adresse du widget.

L'adresse sans numéro (`https://lab17bis.github.io/grist-projet/suivi-projets/`) suit la version en cours de développement. Elle sert à essayer les nouveautés ; ne l'utilisez pas pour un document en service.

Pour figer une nouvelle version stable après des tests réussis : `sh outils/figer-version.sh 1` (ou `2` pour une version qui change les tables), puis publiez le dépôt.

## Données partagées avec les autres outils

Plusieurs outils de la même famille peuvent travailler dans un même document Grist. Ils suivent une règle commune pour ne pas dupliquer les données :

- **Une seule table `Personnes`** par document. Colonne commune : `Nom`. Colonnes facultatives reconnues par tous : `Email` et `Structure` (référence à `Structures`). Un outil lit cette table si elle existe et la crée seulement si elle manque. Il n'y ajoute que ses propres colonnes.
- **Une seule table `Structures`** pour les équipes, services ou établissements : `Nom`, `Sigle`, `Type`, `Parent` (structure de rattachement).
- **Une seule table `Reunions`**, celle de grist-reunion. Un outil de suivi de projets s'y branche en ajoutant deux colonnes facultatives : `Projet` (référence à `Projets`) et `Notes`. Les réunions rattachées à un projet sont alors les mêmes dans les deux outils.
- **Aucun outil ne supprime ni ne renomme** une table ou une colonne qu'il n'a pas créée.
- **Les autres tables portent des noms propres à chaque outil**, pour éviter les collisions (par exemple `Actions` pour grist-projet, `Actions_reunion` pour grist-reunion). Les réglages sont rangés dans la description d'une colonne technique propre à l'outil (`Config_…`).
- **Identifier la personne connectée** : un widget ne connaît pas l'adresse de la personne connectée. Les colonnes « créé par » utilisent une formule `user.Email` calculée à la création. Seul un outil qui doit relier la personne connectée à sa fiche crée la table `Comptes`.

Ce que fait cet outil : Il crée `Personnes`, `Structures` et `Comptes` si elles manquent. Si `Personnes` ou `Structures` existent déjà, il les reprend et leur ajoute seulement ses colonnes (`Role`, `Email_saisi`…). Si `Email` est une colonne saisie et non une formule, il la garde telle quelle. Une personne ajoutée depuis le formulaire projet reçoit alors son adresse dans `Email`, comme dans l'annuaire. Il ne crée jamais la table `Reunions` : s'il la trouve (créée par grist-reunion), Réglages > Rendez-vous propose d'y ajouter les colonnes `Projet` et `Notes`, puis la fiche d'un projet gagne un onglet « Rendez-vous » (objet, date, heure, participants, notes ; ajout, modification, suppression). Supprimer un rendez-vous supprime aussi, s'ils existent, l'ordre du jour, les décisions et les actions de cette réunion.

## Espaces clés en main

Ce widget est déjà assemblé, avec d'autres, dans des **espaces** : des documents Grist complets à importer en une fois, vides ou avec un exemple fictif.

- [espace-pilotage](https://github.com/lab17bis/espace-pilotage) : piloter une équipe : management visuel, réunions, projets et indicateurs.
- [espace-collaboratif](https://github.com/lab17bis/espace-collaboratif) : travailler ensemble : réunions, projets partagés et ressources communes.

## Autres outils de la même famille

- [grist-questionnaire](https://github.com/lab17bis/grist-questionnaire) : questionnaires au DSFR avec logique conditionnelle.
- [grist-catalogue](https://github.com/lab17bis/grist-catalogue) : catalogue public de fiches au DSFR.
- [grist-graphique](https://github.com/lab17bis/grist-graphique) : tableaux de bord et graphiques au DSFR.
- [grist-reunion](https://github.com/lab17bis/grist-reunion) : réunions : ordre du jour, séance, compte rendu et suivi des actions.
- [grist-management](https://github.com/lab17bis/grist-management) : écran de management visuel d'équipe.
- [grist-consultation](https://github.com/lab17bis/grist-consultation) : consultations : boîte à idées, valorisation des réalisations, votes et suites données.
- [grist-annuaire](https://github.com/lab17bis/grist-annuaire) : annuaire des personnes et des structures d'un document : recherche, fiches, doublons, import, protection des données.
- [grist-carte](https://github.com/lab17bis/grist-carte) : carte interactive des lignes d'une table, au fond de l'IGN.
- [grist-graphe](https://github.com/lab17bis/grist-graphe) : cartographie des acteurs et de leurs liens.

Les widgets qui ont un en-tête et un pied de page partagent les mêmes réglages.

## Écosystème

- **[Grist](https://grist.numerique.gouv.fr)** : tableur-base de données libre ([gristlabs/grist-core](https://github.com/gristlabs/grist-core)), proposé aux agents publics par la [DINUM](https://www.numerique.gouv.fr/) dans [La Suite numérique](https://lasuite.numerique.gouv.fr/).
- **[Système de design de l'État (DSFR)](https://www.systeme-de-design.gouv.fr/)** ([GouvernementFR/dsfr](https://github.com/GouvernementFR/dsfr)). Son usage est réservé aux sites des services de l'État.
- **[Communauté Grist francophone](https://forum.grist.libre.sh/)**.

## Mots-clés

Grist, widget Grist, widget-outil, gestion de projet en équipe, espace d'équipe, travail collaboratif, suivi de projets, gestion de projet, portefeuille de projets, pilotage, kanban, plan d'action, banque de projets, annuaire, DSFR, Système de design de l'État, La Suite numérique, DINUM, service public, administration, transformation publique, clé en main, logiciel libre.

## Page publique

Paramètres de l'adresse : `public=1&doc=<lien>` sur la page `suivi-projets/`. Seules les tables `Structures` et `Projets` sont lues. Les projets de visibilité « Restreint » sont exclus, et l'onglet Publication permet de ne publier que certaines phases ; la visibilité « Ouvert » ne veut pas dire public. Seule la présentation des fiches est affichée (ni synthèse, ni plan d'action, ni journal).

L'onglet **Publication** construit le lien d'une page publique : collez le lien du document Grist partagé en lecture publique (*Partager › Accès public : Lecteur*), puis copiez ou ouvrez le lien obtenu. La page est en lecture seule, sans compte, et n'écrit jamais dans le document. L'option `integre=1` retire l'en-tête et le pied de page pour intégrer la page dans un autre site ou dans le [portail](https://github.com/lab17bis/grist-portail).

Le partage en lecture publique rend lisibles **toutes** les tables du document, pas seulement celles que la page affiche. Pour masquer une table ou une colonne au public, utilisez les règles d'accès de Grist, par exemple avec la condition `not user.IsLoggedIn` (lecture refusée). La page tolère une table masquée. Testez en navigation privée avant de diffuser le lien.

## Licence

Code sous licence MIT (voir `LICENSE`). Le DSFR embarqué dans `vendor/dsfr/` conserve sa propre licence. Réutilisation, adaptation et contributions bienvenues.

Conçu par le Lab 17 bis, laboratoire d'innovation publique de l'académie de Reims. Contact : <lab17bis@ac-reims.fr>

Widget conçu par le Lab 17 bis, le laboratoire d'innovation publique de l'académie de Reims.
