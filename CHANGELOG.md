# Journal des modifications

Les adresses `/v1/` ne changent pas : chaque version ajoute ou corrige, sans retirer ce qui existe.

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
