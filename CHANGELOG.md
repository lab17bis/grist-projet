# Journal des modifications

Les adresses `/v1/` ne changent pas : chaque version ajoute ou corrige, sans retirer ce qui existe.

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
