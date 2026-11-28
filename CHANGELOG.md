# Journal des modifications

Les adresses `/v1/` ne changent pas : chaque version ajoute ou corrige, sans retirer ce qui existe.

## 2026-11-27 (accès au document)
- Barre de l'éditeur : le nom du widget et son statut restent sur une ligne ; la barre ne change plus de hauteur quand le statut passe à « non enregistré ».
- Dans Grist, quand le widget ne peut pas lire le document (accès complet non accordé, ou compte sans droit de lecture), un message le dit et indique quoi faire, au lieu d'un outil vide ou d'un écran d'installation. Contrôle commun, dans `commun/barre.js`.

## 2026-11-27 (fiche en volets)
- Vue d'ensemble aérée : sommaire « Aller à » sous les chiffres clés (projets à relancer, jalons, actions en retard, par phase, calendrier, par structure) et rubriques séparées par un filet.
- Le premier volet de la fiche devient **Synthèse** : quatre cartes en tête (plan d'action, prochaine échéance, dernière nouvelle, prochain rendez-vous ou documents), chacune avec un lien vers son volet, puis la présentation habituelle. Rien de nouveau n'est saisi ni calculé dans Grist.
- **Plan d'action** : le choix *Liste*, *Kanban*, *Chronologie* passe en tête du volet, au-dessus du formulaire d'ajout.
- Le volet *Journal* s'appelle **Journal et notes** ; l'aide du formulaire mentionne les notes à garder.
- Page publique inchangée : présentation seule.

## 2026-11-27 (courriel d'une personne ajoutée)
- Correction : dans un document où l'annuaire a créé la table `Personnes` (colonne `Email` saisie, et non calculée), une personne ajoutée depuis le formulaire projet reçoit son adresse dans `Email`. Auparavant elle allait dans `Email_saisi`, invisible pour l'annuaire et pour ses règles d'accès. Dans un document installé par cet outil (`Email` calculée), rien ne change.

## 2026-11-27 (barre commune de l'éditeur)
- Barre commune à tous les widgets (fichier partagé `commun/barre.js` et `commun/barre.css`) : nom du widget et statut à gauche, onglets Réglages, En-tête et pied, Aperçu, Publication au centre, Enregistrer à droite ; barre collante en haut de l'écran.
- L'outil n'a plus d'onglet à son nom : il s'utilise dans l'Aperçu, ouvert par défaut, avec l'en-tête et le pied de page (affichés une seule fois). Les rubriques propres à l'outil sont des sous-onglets de Réglages quand il y en a plusieurs.
- Liens et boutons « Réglages » ou « Configurer » de l'outil masqués : la barre suffit.
- Même lien, deux affichages : chaque vue Grist choisit, dans Publication, l'éditeur du widget ou la page d'usage (l'outil avec son en-tête et son pied, sans barre, avec un lien « Éditer le widget »). Le choix est une option de la vue Grist ; par défaut, l'éditeur s'affiche comme avant.
- Aperçu réel : la vraie banque des projets et les vraies fiches, avec les réglages en cours, au lieu d'un échantillon figé.
- Affichage de la vue : après « Appliquer à cette vue », un texte rappelle de cliquer sur Enregistrer en haut de la vue Grist pour garder le choix (vérifié dans Grist).

## 2026-11-27 (adresse refusée)
- Publication : une adresse de page contenant l'identifiant long du document est refusée avec un message qui explique quoi copier (Grist ignore la page dans ce cas).

## 2026-11-27 (barre stable)
- Barre de réglages : la place du bouton Enregistrer est réservée sur l'onglet de la vue, la barre ne saute plus d'un onglet à l'autre.

## 2026-11-27 (publication réservée)

### Ajouté

- Onglet Publication : section « Lien réservé aux personnes invitées » (collez l'adresse de la page Grist, le lien plein écran se construit, au choix en consultation seule ou avec saisie) et rappel de la différence entre page publique et lien réservé.

## 2026-11-27 (cohérence de la barre de réglages)

### Corrigé

- Le bouton Enregistrer est aligné sur la barre d'onglets, les onglets sont centrés et la pastille « Enregistré / Non enregistré » reste visible sur toutes les pages.

## 2026-11-26 (tables déjà présentes dans le document)

### Corrigé
- Si le document contenait déjà une table `Projets` (créée à la main), le widget n'installait rien et ne disait rien : les autres tables manquaient, les colonnes attendues aussi (« Projet sans titre »). Il affiche maintenant ce qui manque et propose « Compléter le document » : les tables absentes sont créées, les tables présentes reçoivent seulement leurs colonnes manquantes. Rien n'est renommé ni supprimé.

### Ajouté
- Conseil affiché : si une de vos colonnes contient déjà l'information sous un autre nom (par exemple `Nom` au lieu de `Titre`), renommez-la dans Grist avec le nom attendu, ses données seront reprises.

## 2026-11-26 (style commun de configuration)

### Corrigé
- Configuration : sur l'onglet de l'outil, le style commun masquait par erreur tout champ dont l'identifiant finit par « -etat » (dans grist-projet : le filtre « État » de la banque et la liste « État » du formulaire de projet). Seul le badge « Enregistré » de la barre est maintenant masqué. Rien à refaire : rechargez la page.

## 2026-11-26 (adresse courte)

### Ajouté
- Les adresses `lab17bis.github.io/grist-projet/` et `lab17bis.github.io/grist-projet/v1/` renvoient vers l'outil (`…/suivi-projets/`) au lieu d'une erreur 404. L'adresse à mettre dans Grist reste `https://lab17bis.github.io/grist-projet/v1/suivi-projets/`.

## 2026-11-26 (carte, filtres, colonnes existantes, rendez-vous)

### Corrigé
- « Utiliser une colonne existante » ne proposait pas une colonne tout juste créée et encore vide (Grist la compte comme une colonne de formule sans formule). Elle est maintenant proposée ; elle devient une colonne de données à la première saisie.

### Ajouté
- Réglages > « Utiliser une colonne existante » : les colonnes de données de la table `Projets` ajoutées dans Grist (texte, choix, date, nombre) se reprennent comme champ de la fiche, sans création de colonne. Avant, une colonne qui existait déjà était refusée.
- Réglages > « Carte de projet » : choix des champs d'origine affichés sur les cartes de la banque (thématiques, origine, mission confiée par, mission, objectifs, structures associées, début).
- Réglages > « Filtres de la banque » : choix des filtres proposés (structure, phase, état par défaut ; thématiques, origine et champs « Choix dans une liste » en option).
- Onglet « Rendez-vous » dans la fiche d'un projet, branché sur la table `Reunions` de grist-reunion (colonnes `Projet` et `Notes`, ajoutées par Réglages > Rendez-vous). Objet, date, heure, participants, notes ; ajout, modification, suppression en cascade de l'ordre du jour s'il existe. L'outil ne crée jamais la table `Reunions`.

### Inchangé
- Sans réglage, la banque garde ses trois filtres et ses cartes d'origine ; sans table `Reunions` branchée, la fiche n'a pas d'onglet Rendez-vous.

## 2026-11-26 (agencement libre de la fiche)

### Ajouté
- Réglages > « Agencement de la fiche projet » : agencement libre façon bento. On choisit l'ordre, la largeur (pleine, deux tiers, moitié, un tiers) et la présence de chaque bloc de la fiche ; les blocs vides ne s'affichent pas ; l'onglet Aperçu montre le résultat. Valable aussi sur la page publique.
- Désactivé par défaut : une fiche sans réglage garde exactement sa présentation d'origine.

### Corrigé
- Page publique : le bandeau « Nouvelle version… Mettre à jour le document » et le bouton « Déclarer un projet » ne s'affichent plus aux visiteurs.
- README : la page publique de la banque des projets est désormais indiquée (elle existe depuis le 24/11) ; la mention « pas de page publique » était périmée.

## 2026-11-25 (mention de conception)

### Ajouté
- Mention discrète en pied de page, sur l'outil comme sur ses pages publiques : « Widget conçu par le Lab 17 bis, le laboratoire d'innovation publique de l'académie de Reims ».

## 2026-11-25 (page de configuration commune)

### Amélioré
- Mise à jour de la coque de configuration commune aux widgets du Lab (nouvelle option d'aperçu réel, sans effet ici : l'aperçu de ce widget garde son rendu propre).

## 2026-11-25 (champs personnalisables)

### Ajouts
- Réglages > « Champs de la fiche projet » : masquer les champs d'origine (mission, objectifs, origine, structures associées, dates, thématiques) et ajouter ses propres champs (texte court ou long, choix, date, nombre, obligatoire ou non, affiché ou non sur la carte). Chaque champ ajouté crée une colonne de la table `Projets` et apparaît dans le formulaire, la fiche et la carte.
- L'onglet Aperçu montre la vraie page (banque des projets et fiche d'un projet) avec les réglages en cours, au lieu d'un exemple fixe.

### Changements
- Le profil de la personne connectée est créé automatiquement quand son adresse est de la forme prénom.nom@domaine. Plus de redirection forcée vers « Qui êtes-vous ? » : un simple bandeau invite à créer son profil si l'adresse ne le permet pas.

### Corrections
- Enregistrer un projet n'échoue plus quand une colonne a été supprimée à la main dans Grist (erreur « KeyError 'Mission' ») : le widget n'envoie que les colonnes qui existent.

## 2026-11-25 (audit de sécurité)

### Sécurité
- Les liens venant des données ou des réglages sont vérifiés par le navigateur lui-même : une adresse déguisée (« java⇥script: » avec tabulation, retour à la ligne ou caractère de contrôle) n'est plus acceptée. Elle permettait, sur le portail, d'exécuter du script au clic depuis une adresse fabriquée.
- Politique de sécurité de contenu stricte : seuls les scripts du site, l'API Grist et les scripts de la page connus par leur empreinte peuvent s'exécuter. L'évaluation de texte (« unsafe-eval ») reste permise : l'API officielle de Grist en a besoin (sans elle, les widgets restaient bloqués sur « Chargement… » dans Grist le 25/11 au matin). Un script injecté (lien javascript:, attribut onerror…) est bloqué même si un filtre le laissait passer.
- Page publique : message clair si le document Grist est injoignable (au lieu de « Failed to fetch »).

## 2026-11-24 (durcissement)

### Sécurité
- Les pages ajoutent une politique de sécurité de contenu minimale (pas d'objets embarqués, pas de balise base).
- Les pages publiques n'acceptent plus qu'un lien de document Grist en https (http seulement pour localhost, en développement).

## 2026-11-24 (message de lecture publique)

### Corrigé
- Page publique : quand une table est masquée par les règles d'accès du document, le message nomme la table et explique la cause (erreur 403), au lieu de demander si le document est partagé. Comportement vérifié sur un vrai document Grist : une table refusée au public répond 403, une colonne refusée disparaît des lignes, les personnes connectées gardent leurs droits.

## 2026-11-24 (règles d'accès)

### Corrigé
- Page publique : une table ou une colonne masquée par les règles d'accès du document (par exemple les adresses de courriel) n'empêche plus d'afficher le reste de la page.

### Ajouté
- Documentation de la page publique (README) : réglages, ce qui est lu, ce qui reste caché, règles d'accès à poser.

## 2026-11-24 (page publique)

### Ajouté
- Page publique en lecture seule : banque des projets (liste, recherche, fiche de présentation). Les projets « Restreint » ne sont jamais publiés ; un réglage facultatif limite la publication à certaines phases.
- La page publique ne lit ni les personnes, ni les comptes, ni le plan d'action, ni le journal, ni les documents : l'écran « Qui êtes-vous ? », le profil et la création de compte n'existent pas en public.
- Module commun `commun/grist-public.js` (et `.css`) : lit le document par l'API REST de Grist, en lecture seule, sans compte.
- Onglet Publication : saisissez le lien du document Grist partagé en lecture publique, l'outil construit le lien de la page publique, à copier ou à ouvrir ; le lien est enregistré avec les réglages.
- Option `integre=1` : page sans en-tête ni pied propres, pour l'intégrer dans un autre site.

## 2026-11-24 (documentation)

### Modifié
- Documentation : l'outil de consultation s'appelle désormais `grist-consultation` (ancien nom `grist-decision`).

## 2026-11-24 (barre d'onglets permanente)

### Modifié
- Le widget s'ouvre désormais sur une barre d'onglets, comme le catalogue et le questionnaire : *Projets*, puis les onglets de réglages, En-tête et pied, Aperçu, Publication. L'outil lui-même est le premier onglet.
- Le bouton « Configurer » laisse la place à la barre d'onglets ; les anciens liens et boutons « Réglages » restent actifs et ouvrent l'onglet Réglages.
- L'enregistrement des réglages reste dans la colonne de configuration existante : rien à migrer.

## 2026-11-24

### Ajouté
- Bouton « Configurer » en haut de l'outil : ouvre une page de configuration unique en cinq onglets (Réglages, Rôles, En-tête et pied, Aperçu, Publication). L'ancien lien « Réglages du suivi » en bas de page reste actif.
- Onglet Aperçu : l'en-tête et le pied de page tels qu'ils seront affichés, avec les réglages en cours, même non enregistrés.
- Onglet Publication : explique que l'outil est réservé aux personnes connectées, comment inviter l'équipe, et donne l'adresse du widget à copier.
- Module commun `commun/configuration.js` et `commun/configuration.css`, partagé avec les autres widgets de la famille.

### Modifié
- Les réglages existants (listes de valeurs, couleurs, rôle Administration, domaine des adresses, alerte de relance, en-tête et pied) sont conservés tels quels, dans la colonne `Config_suivi`.
- Le rôle Administration a son propre onglet ; il garde son bouton « Enregistrer les rôles ».
- En mode démonstration, la page de configuration est visible mais n'enregistre rien.

## Versions antérieures

Voir l'historique des commits.
