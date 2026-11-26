/*
 * grist-projet – espace d'équipe pour gérer des projets, widget-outil Grist au DSFR.
 *
 * Le widget lit et écrit dans le document Grist avec les droits de la personne
 * connectée. Il ne contourne aucune règle d'accès : si Grist refuse une écriture,
 * le widget affiche le refus.
 *
 * Hors de Grist (page ouverte directement), il charge des données fictives
 * et simule les écritures en mémoire.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Référentiels (identiques aux listes de choix du document Grist)
  // ---------------------------------------------------------------------------

  var PHASES = ['Idée', 'Cadrage', 'Construction', 'Expérimentation', 'Déploiement', 'Bilan', 'Clos'];
  var ETATS = ['En cours', 'En pause', 'Bloqué', 'Terminé', 'Abandonné'];
  var ORIGINES = ['Initiative de la structure', 'Commande de la hiérarchie', "Feuille de route de l'organisation",
    'Plan ou réforme nationale', 'Appel à projets', "Demande d'un partenaire", 'Autre'];
  var THEMATIQUES = ['Organisation', 'Ressources humaines', 'Formation', 'Qualité de vie au travail', 'Numérique',
    'Données', 'Communication', 'Pilotage', 'Moyens et finances', 'Immobilier', "Relation à l'usager", 'Inclusion',
    'Transformation', 'Partenariats', 'Sécurité', 'Transition écologique', 'Autre'];
  var ETATS_ACTION = ['À faire', 'En cours', 'Fait', 'Abandonné'];
  var TYPES_JOURNAL = ['Avancement', 'Décision', 'Difficulté', 'Information'];
  var TYPES_DOCUMENT = ['Note de cadrage', 'Lettre de mission', 'Compte rendu', 'Livrable', 'Présentation', 'Autre'];

  var COULEUR_PHASE = {
    'Idée': 'purple-glycine', 'Cadrage': 'blue-cumulus', 'Construction': 'blue-ecume',
    'Expérimentation': 'green-emeraude', 'Déploiement': 'green-bourgeon', 'Bilan': 'yellow-tournesol', 'Clos': ''
  };
  var COULEUR_ETAT = {
    'En cours': 'success', 'En pause': 'warning', 'Bloqué': 'error', 'Terminé': 'info', 'Abandonné': ''
  };
  var COULEUR_JOURNAL = {
    'Avancement': 'success', 'Décision': 'info', 'Difficulté': 'warning', 'Information': ''
  };

  var JOURS_ALERTE = 60;
  var DOMAINE_COURRIEL = '';
  var NOM_COLONNE_CONFIG = 'Config_suivi';
  var reglages = {};     // réglages lus dans la description de la colonne Projets.Config_suivi

  // Valeurs par défaut, reprises si les réglages ne les remplacent pas.
  var DEFAUTS = {
    phases: PHASES, etats: ETATS, origines: ORIGINES, thematiques: THEMATIQUES,
    etatsAction: ETATS_ACTION, typesJournal: TYPES_JOURNAL, typesDocument: TYPES_DOCUMENT,
    couleursPhase: COULEUR_PHASE, couleursEtat: COULEUR_ETAT, couleursJournal: COULEUR_JOURNAL
  };

  function appliquerReglages(r) {
    reglages = r || {};
    var l = reglages.listes || {};
    function liste(cle) { return Array.isArray(l[cle]) && l[cle].length ? l[cle] : DEFAUTS[cle]; }
    PHASES = liste('phases'); ETATS = liste('etats'); ORIGINES = liste('origines'); THEMATIQUES = liste('thematiques');
    ETATS_ACTION = liste('etatsAction'); TYPES_JOURNAL = liste('typesJournal'); TYPES_DOCUMENT = liste('typesDocument');
    var c = reglages.couleurs || {};
    COULEUR_PHASE = Object.assign({}, DEFAUTS.couleursPhase, c.phases || {});
    COULEUR_ETAT = Object.assign({}, DEFAUTS.couleursEtat, c.etats || {});
    COULEUR_JOURNAL = Object.assign({}, DEFAUTS.couleursJournal, c.typesJournal || {});
    JOURS_ALERTE = Number(reglages.joursAlerte) > 0 ? Number(reglages.joursAlerte) : 60;
    DOMAINE_COURRIEL = String(reglages.domaineCourriel || '').replace(/^@/, '').trim();
    var page = Object.assign({ marque: '', titre: 'Suivi des projets', pied: { accessibilite: '' } }, reglages.page || {});
    if (window.PageDSFR) {
      var cible = window.PageDSFR.appliquer(page, { entete: document.getElementById('entete'), pied: document.getElementById('pied'), accueil: '#/' });
      cible.entete.id = 'entete';
      cible.pied.id = 'pied';
    }
  }
  var TABLES = ['Structures', 'Personnes', 'Comptes', 'Parametres', 'Projets', 'Actions', 'Journal', 'Documents'];

  // ---------------------------------------------------------------------------
  // État de l'application
  // ---------------------------------------------------------------------------

  var PUBLIC = !!(window.GristPublic && window.GristPublic.actif);
  var DEMO = window.self === window.top && !PUBLIC;
  var meta = { colonnes: [], tables: [], colConfig: false };
  var data = {};      // table -> tableau de lignes
  var idx = {};       // table -> { id: ligne }
  var enfants = {};   // id de structure -> [ids enfants]
  var etat = {
    filtres: { q: '', structure: '', phase: '', etat: '', archives: false, tri: 'activite' },
    onglet: 'presentation',
    modePlan: 'liste',   // affichage du plan d'action : liste | kanban | chronologie
    editionAction: null, // action dont le formulaire de modification est ouvert
    pilotage: { structure: '', archives: false },
    form: null,          // valeurs du formulaire projet en cours d'édition
    formCle: null,       // route qui a initialisé le formulaire
    brouillons: {},      // saisies des petits formulaires (action, journal, document)
    alerte: null,        // { type: 'error'|'success', texte }
    suppression: null,   // 'Table:id' en attente de confirmation
    // Personne connectée. Grist ne donne pas son email au widget : on le lit dans
    // sa ligne de la table Comptes, la seule que les règles d'accès lui montrent.
    moi: { email: '', compte: null, profil: null, lecture: false },
    accueilVu: false,    // redirection vers « Mon profil » déjà faite
    profilForm: null,    // saisie du formulaire « Mon profil »
    ajout: null,         // { champ, Nom, Email, Structure } : ajout d'une personne depuis le formulaire projet
    pasMoi: null,        // projet pour lequel « Ce n'est pas moi » attend confirmation
    vus: null,           // projets attribués déjà signalés à la personne
    doublon: null        // nom déjà signalé comme proche d'un profil existant
  };

  var app = document.getElementById('sp-app');

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function liste(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v[0] === 'L' ? v.slice(1) : v;
    if (typeof v === 'string' && v.charAt(0) === '[') {
      try { return liste(JSON.parse(v)); } catch (e) { return []; }
    }
    return [];
  }

  function versListe(arr) { return ['L'].concat(arr || []); }

  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  // Les colonnes Date de Grist sont des secondes depuis 1970, à minuit UTC.
  function dateTexte(sec) {
    if (!sec) return '';
    return new Date(sec * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  }
  function dateHeureTexte(sec) {
    if (!sec) return '';
    var d = new Date(sec * 1000);
    return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  function dateVersSaisie(sec) {
    if (!sec) return '';
    return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  function saisieVersDate(txt) {
    if (!txt) return null;
    var p = txt.split('-');
    if (p.length !== 3) return null;
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 1000;
  }

  function lienSur(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
  }

  function badge(texte, couleur, petit) {
    if (!texte) return '';
    var hexa = /^#[0-9a-f]{6}$/i.test(couleur || '');
    var cls = 'fr-badge fr-badge--no-icon' + (petit === false ? '' : ' fr-badge--sm') + (couleur && !hexa ? ' fr-badge--' + couleur : '');
    var style = '';
    if (hexa) {
      // Texte clair ou foncé selon la luminosité du fond.
      var n = parseInt(couleur.slice(1), 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      style = ' style="background-color:' + couleur + ';color:' + (lum > 0.6 ? '#161616' : '#ffffff') + '"';
    }
    return '<p class="' + cls + '"' + style + '>' + esc(texte) + '</p>';
  }

  function resumeCourt(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    return t.length > 140 ? t.slice(0, 137).replace(/\s+\S*$/, '') + '…' : t;
  }

  function sansAccent(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Données
  // ---------------------------------------------------------------------------

  function lignesDepuisColonnes(cols) {
    var ids = cols.id || [];
    var cles = Object.keys(cols);
    var lignes = [];
    for (var i = 0; i < ids.length; i++) {
      var l = {};
      for (var k = 0; k < cles.length; k++) l[cles[k]] = cols[cles[k]][i];
      lignes.push(l);
    }
    return lignes;
  }

  function chargerDemo() {
    appliquerReglages({ domaineCourriel: 'exemple.fr', page: { titre: 'Suivi des projets', sousTitre: 'Démonstration' } });
    return fetch('../donnees-fictives/exemple.json')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var champsDate = ['Echeance', 'Debut', 'Fin', 'Date_debut'];
        TABLES.forEach(function (t) {
          data[t] = (json[t] || []).map(function (l) {
            var copie = Object.assign({}, l);
            champsDate.forEach(function (c) {
              if (typeof copie[c] === 'string') copie[c] = saisieVersDate(copie[c]);
            });
            return copie;
          });
        });
        var maintenant = Date.now() / 1000;
        data.Journal.forEach(function (j) { if (!j.Cree_le) j.Cree_le = maintenant - 86400 * 3; if (!j.Auteur) j.Auteur = 'Camille Exemple'; });
      });
  }

  function chargerGrist() {
    var config = Promise.all([grist.docApi.fetchTable('_grist_Tables'), grist.docApi.fetchTable('_grist_Tables_column')])
      .then(function (m) {
        var tables = lignesDepuisColonnes(m[0]), cols = lignesDepuisColonnes(m[1]);
        var projets = tables.filter(function (t) { return t.tableId === 'Projets'; })[0];
        meta.colonnes = cols;
        meta.tables = tables;
        meta.lu = tables.length > 0;
        var c = projets && cols.filter(function (x) { return x.parentId === projets.id && x.colId === NOM_COLONNE_CONFIG; })[0];
        meta.colConfig = !!c;
        var r = {};
        try { r = c && c.description ? JSON.parse(c.description) : {}; } catch (e) { r = {}; }
        appliquerReglages(r);
      }).catch(function () { appliquerReglages({}); });
    return Promise.all([config].concat(TABLES.map(function (t) {
      // Page publique : ni personnes, ni comptes, ni journal, ni documents, ni actions ne sont lus.
      if (PUBLIC && t !== 'Structures' && t !== 'Projets') { data[t] = []; return Promise.resolve(); }
      return grist.docApi.fetchTable(t)
        .then(function (cols) {
          data[t] = lignesDepuisColonnes(cols);
          if (PUBLIC && t === 'Projets') {
            var ph = String((reglages.publication && reglages.publication.phases) || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
            data[t] = data[t].filter(function (x) { return x.Visibilite !== 'Restreint' && (!ph.length || ph.indexOf(x.Phase) >= 0); });
          }
        })
        .catch(function () { data[t] = []; });
    })));
  }

  function charger() {
    return (DEMO ? chargerDemo() : chargerGrist()).then(indexer);
  }

  function indexer() {
    idx = {};
    TABLES.forEach(function (t) {
      idx[t] = {};
      (data[t] || []).forEach(function (l) { idx[t][l.id] = l; });
    });
    enfants = {};
    data.Structures.forEach(function (s) {
      var p = num(s.Parent);
      (enfants[p] = enfants[p] || []).push(s.id);
    });
    data.Structures.forEach(function (s) {
      if (!s.Chemin) s.Chemin = cheminStructure(s);
      if (s.Active === undefined || s.Active === null) s.Active = true;
    });
    data.Projets.forEach(completerProjet);
    if (DEMO) calculerEmailsDemo();
    identifierMoi();
  }

  // En mode démo, refait le calcul de la colonne Personnes.Email de Grist.
  function calculerEmailsDemo() {
    data.Personnes.forEach(function (p) {
      var emails = data.Comptes.filter(function (c) { return num(c.Profil) === p.id && c.Email; })
        .map(function (c) { return c.Email; });
      p.Email = p.Email_saisi || (emails.length && emails.every(function (e) { return e === emails[0]; }) ? emails[0] : '');
      p.Compte_lie = !!p.Email;
      p.Connecte = !!p.Email && data.Comptes.some(function (c) { return c.Email === p.Email; });
    });
  }

  // Grist renvoie ['C'] pour une cellule masquée par les règles d'accès.
  // Les règles d'accès de Grist comparent les emails en minuscules : on fait de même.
  function emailDe(ligne) { return ligne && typeof ligne.Email === 'string' ? ligne.Email.trim().toLowerCase() : ''; }

  function identifierMoi() {
    var m = etat.moi;
    var avant = m.email;
    var comptes = (data.Comptes || []).filter(function (c) { return emailDe(c); })
      .sort(function (a, b) { return a.id - b.id; });
    m.compte = comptes[0] || null;
    m.email = m.compte ? emailDe(m.compte) : '';
    if (m.email !== avant) etat.vus = null;
    m.profil = null;
    if (!m.email) return;
    var lie = idx.Personnes[num(m.compte.Profil)];
    if (lie && (!emailDe(lie) || emailDe(lie) === m.email)) { m.profil = lie.id; return; }
    var trouve = data.Personnes.filter(function (x) { return emailDe(x) === m.email; })[0];
    if (trouve) m.profil = trouve.id;
  }

  // Clé de comparaison des noms : sans accents, sans ponctuation, mots triés.
  function cleNom(nom) {
    return sansAccent(nom).replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  }

  function personneParEmail(email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) return null;
    return data.Personnes.filter(function (p) { return emailDe(p) === email; })[0] || null;
  }

  function emailValide(email) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(email || '').trim()); }

  // « MARTIN Claire » ou « Claire Martin » -> claire.martin@<domaine réglé> (simple suggestion, modifiable).
  function emailSuggere(nom) {
    if (!DOMAINE_COURRIEL) return '';
    var mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
    if (mots.length < 2) return '';
    var majuscules = mots.filter(function (m) { return m.length > 1 && m === m.toUpperCase(); });
    var famille = majuscules.length && majuscules.length < mots.length ? majuscules : [mots[mots.length - 1]];
    var prenoms = mots.filter(function (m) { return famille.indexOf(m) === -1; });
    function net(l) { return sansAccent(l.join('-')).replace(/[^a-z-]/g, ''); }
    return net(prenoms) + '.' + net(famille) + '@' + DOMAINE_COURRIEL;
  }

  function libellePersonne(x) {
    var e = emailDe(x);
    return x.Nom + (e ? ' — ' + e : ' — sans email');
  }

  function contactAdmin() {
    var l = (data.Parametres || []).filter(function (r) { return r.Cle === 'Contact_admin'; })[0];
    return l && emailValide(l.Valeur) ? String(l.Valeur).trim() : '';
  }

  function lienContact(sujet, texte) {
    var mail = contactAdmin();
    if (!mail) return '';
    return '<a href="mailto:' + esc(mail) + '?subject=' + encodeURIComponent(sujet) + '">' + esc(texte) + '</a>';
  }

  function personneProche(nom) {
    var cle = cleNom(nom);
    if (!cle) return null;
    return data.Personnes.filter(function (p) { return cleNom(p.Nom) === cle; })[0] || null;
  }

  function cheminStructure(s) {
    var parts = [];
    var n = s;
    var garde = 0;
    while (n && garde++ < 8) {
      parts.unshift(n.Sigle || n.Nom);
      n = idx.Structures[num(n.Parent)];
    }
    return parts.join(' › ');
  }

  // Calculs faits par Grist ; refaits ici seulement s'ils manquent (mode démo).
  function completerProjet(p) {
    var tous = actionsDu(p.id);
    var acts = tous.filter(function (a) {
      return a.Etat !== 'Abandonné' && a.Type !== 'Jalon' && !tous.some(function (x) { return num(x.Parent) === a.id; });
    });
    if (p.Avancement === undefined) {
      p.Avancement = acts.length ? Math.round(100 * acts.filter(function (a) { return a.Etat === 'Fait'; }).length / acts.length) : null;
    }
    if (p.Archive === undefined) {
      p.Archive = p.Phase === 'Clos' || p.Etat === 'Terminé' || p.Etat === 'Abandonné';
    }
    if (p.Derniere_activite === undefined) {
      var dates = [p.Maj_le].concat(journalDu(p.id).map(function (j) { return j.Cree_le; }))
        .concat(actionsDu(p.id).map(function (a) { return a.Maj_le; })).filter(Boolean);
      p.Derniere_activite = dates.length ? Math.max.apply(null, dates) : null;
    }
    if (p.Jours_sans_activite === undefined) {
      p.Jours_sans_activite = p.Derniere_activite ? Math.floor((Date.now() / 1000 - p.Derniere_activite) / 86400) : null;
    }
  }

  function actionsDu(id) { return (data.Actions || []).filter(function (a) { return num(a.Projet) === id; }); }
  function journalDu(id) { return (data.Journal || []).filter(function (j) { return num(j.Projet) === id; }); }
  function documentsDu(id) { return (data.Documents || []).filter(function (d) { return num(d.Projet) === id; }); }

  function nomPersonne(id) { var p = idx.Personnes[num(id)]; return p ? p.Nom : ''; }
  function nomsPersonnes(ids) { return liste(ids).map(nomPersonne).filter(Boolean).join(', '); }
  function libelleStructure(id) { var s = idx.Structures[num(id)]; return s ? (s.Sigle || s.Nom) : ''; }
  function cheminDe(id) { var s = idx.Structures[num(id)]; return s ? s.Chemin : ''; }

  function descendants(id) {
    var res = [id];
    var file = [id];
    while (file.length) {
      var e = enfants[file.shift()] || [];
      e.forEach(function (c) { res.push(c); file.push(c); });
    }
    return res;
  }

  function structuresTriees() {
    return data.Structures.filter(function (s) { return s.Active !== false; })
      .sort(function (a, b) { return String(a.Chemin).localeCompare(String(b.Chemin), 'fr'); });
  }

  function personnesTriees() {
    return data.Personnes.slice().sort(function (a, b) { return String(a.Nom).localeCompare(String(b.Nom), 'fr'); });
  }

  // ---------------------------------------------------------------------------
  // Écritures
  // ---------------------------------------------------------------------------

  function ecrire(actions) {
    if (DEMO) return Promise.resolve(ecrireDemo(actions));
    return grist.docApi.applyUserActions(actions);
  }

  function ecrireDemo(actions) {
    var retValues = [];
    actions.forEach(function (a) {
      var t = a[1];
      if (a[0] === 'AddRecord') {
        var id = (data[t].reduce(function (m, l) { return Math.max(m, l.id); }, 0)) + 1;
        var l = Object.assign({ id: id }, a[3]);
        var maintenant = Date.now() / 1000;
        if (t === 'Journal') { l.Cree_le = maintenant; l.Auteur = 'Vous (démonstration)'; }
        if (t === 'Actions') { l.Maj_le = maintenant; }
        if (t === 'Projets') { l.Maj_le = maintenant; }
        if (t === 'Comptes' && !l.Email) { l.Email = 'vous@exemple.fr'; }
        data[t].push(l);
        retValues.push(id);
      } else if (a[0] === 'UpdateRecord') {
        Object.assign(idx[t][a[2]], a[3], t === 'Projets' || t === 'Actions' ? { Maj_le: Date.now() / 1000 } : {});
        retValues.push(null);
      } else if (a[0] === 'BulkUpdateRecord') {
        a[2].forEach(function (rid, k) {
          var maj = {};
          Object.keys(a[3]).forEach(function (c) { maj[c] = a[3][c][k]; });
          if (idx[t][rid]) Object.assign(idx[t][rid], maj);
        });
        retValues.push(null);
      } else if (a[0] === 'RemoveRecord') {
        data[t] = data[t].filter(function (l) { return l.id !== a[2]; });
        retValues.push(null);
      }
    });
    data.Projets.forEach(function (p) {
      delete p.Avancement; delete p.Archive; delete p.Derniere_activite; delete p.Jours_sans_activite;
    });
    indexer();
    return { retValues: retValues };
  }

  function messageErreur(err, refus) {
    var m = String((err && err.message) || err || '');
    if (/access|denied|blocked|permission|refus/i.test(m)) {
      if (refus) return refus;
      return "Grist a refusé l'enregistrement : vous n'avez pas les droits pour modifier cet élément. Seuls les porteurs du projet, son équipe (pour le plan d'action, le journal et les documents) et les administrateurs peuvent écrire.";
    }
    return "L'enregistrement a échoué. Détail technique : " + m;
  }

  function executer(actions, succes, apres, refus) {
    etat.alerte = null;
    return ecrire(actions)
      .then(function (res) {
        return (DEMO ? Promise.resolve() : charger()).then(function () {
          if (succes) etat.alerte = { type: 'success', texte: succes };
          if (apres) apres(res);
          rendre();
        });
      })
      .catch(function (err) {
        etat.alerte = { type: 'error', texte: messageErreur(err, refus) };
        rendre();
      });
  }

  // Première ouverture : crée la ligne Comptes de la personne connectée.
  // Grist y inscrit lui-même son email. Un lecteur ne peut pas écrire : refus attendu.
  var compteDemande = false;
  function assurerCompte() {
    if (etat.moi.compte || compteDemande) return Promise.resolve();
    compteDemande = true;
    return ecrire([['AddRecord', 'Comptes', null, {}]])
      .then(function () { return DEMO ? null : charger(); })
      .catch(function () { etat.moi.lecture = true; });
  }

  var REFUS_PERSONNE = "Grist a refusé l'enregistrement. Une adresse email ne peut servir qu'à un seul profil, " +
    "et un profil ne peut plus être modifié que par son titulaire dès qu'il s'est connecté.";

  // « claire.martin@domaine » devient « MARTIN Claire ». Sans prénom.nom dans l'adresse : pas de profil automatique.
  function nomDepuisEmail(email) {
    var m = /^([a-zà-ÿ]+(?:[-'][a-zà-ÿ]+)*)\.([a-zà-ÿ]+(?:[-'][a-zà-ÿ]+)*)@/i.exec(email || '');
    if (!m) return '';
    var prenom = m[1].toLowerCase().replace(/(^|[-'])([a-zà-ÿ])/g, function (x, a, b) { return a + b.toUpperCase(); });
    return m[2].toUpperCase() + ' ' + prenom;
  }

  function creerProfilAuto() {
    var nom = nomDepuisEmail(etat.moi.email);
    if (!nom || personneProche(nom) || personneParEmail(etat.moi.email)) { rendre(); return; }
    ecrire([['AddRecord', 'Personnes', null, { Nom: nom }]])
      .then(function (res) { return ecrire([['UpdateRecord', 'Comptes', etat.moi.compte.id, { Profil: res.retValues[0] }]]); })
      .then(function () { return DEMO ? null : charger(); })
      .then(function () {
        etat.alerte = { type: 'success', texte: 'Votre profil a été créé à partir de votre adresse : « ' + nom + ' ». Corrigez-le si besoin dans « Mon profil ».' };
        rendre();
      })
      .catch(function () { rendre(); });
  }

  function creerMonProfil(nom, structure) {
    etat.alerte = null;
    ecrire([['AddRecord', 'Personnes', null, { Nom: nom, Structure: structure }]])
      .then(function (res) {
        return ecrire([['UpdateRecord', 'Comptes', etat.moi.compte.id, { Profil: res.retValues[0] }]]);
      })
      .then(function () { return DEMO ? null : charger(); })
      .then(function () {
        etat.profilForm = null; etat.doublon = null;
        etat.alerte = { type: 'success', texte: 'Profil créé. Vous pouvez être désigné porteur et déclarer vos projets.' };
        rendre();
      })
      .catch(function (err) {
        etat.alerte = { type: 'error', texte: messageErreur(err, REFUS_PERSONNE) };
        rendre();
      });
  }

  // ---------------------------------------------------------------------------
  // Routage (ancre de l'adresse)
  // ---------------------------------------------------------------------------

  function route() {
    var r = routeBrute();
    return PUBLIC && r.vue !== 'banque' && r.vue !== 'fiche' ? { vue: 'banque' } : r;
  }
  function routeBrute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var m;
    if (h === 'nouveau') return { vue: 'form', id: null };
    if (h === 'pilotage') return { vue: 'pilotage' };
    if (h === 'profil') return { vue: 'profil' };
    if (h === 'travail') return { vue: 'travail' };
    if (h === 'reglages') return { vue: 'reglages' };
    if ((m = h.match(/^projet\/(\d+)\/modifier$/))) return { vue: 'form', id: +m[1] };
    if ((m = h.match(/^projet\/(\d+)$/))) return { vue: 'fiche', id: +m[1] };
    return { vue: 'banque' };
  }

  function aller(h) {
    if (location.hash === h) rendre(); else location.hash = h;
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------


  // ---------------------------------------------------------------------------
  // Installation dans un document vide : tables, formules et règles d'accès
  // ---------------------------------------------------------------------------
  // Le schéma (suivi-projets/schema.json) est celui du modèle : tables, colonnes, formules,
  // et règles d'accès qui protègent les projets « Restreint ».

  // Sans métadonnées lisibles, on suppose l'outil installé (rien n'est proposé à tort).
  function aTable(t) { return !meta.lu || (meta.tables || []).some(function (x) { return x.tableId === t; }); }

  function vueInstallation() {
    return '<h1 class="fr-h3">Installer l\'espace projets dans ce document</h1>' + blocAlerte() +
      '<p>Le widget va créer ses tables (Projets, Actions, Journal, Documents, Personnes, Structures, Comptes, Parametres), leurs formules et les <strong>règles d\'accès</strong> qui protègent les projets restreints. Si le document contient déjà une table Personnes ou Structures (créée par un autre outil), le widget la reprend et lui ajoute seulement les colonnes qui lui manquent : rien n\'est supprimé ni renommé.</p>' +
      '<p class="fr-text--sm">À faire par un propriétaire du document. Le widget doit avoir l\'accès complet au document. Si ce document a déjà des règles d\'accès, vérifiez-les ensuite dans <em>Permissions avancées</em>.</p>' +
      '<ul class="fr-btns-group fr-btns-group--inline-md"><li><button type="button" class="fr-btn" data-installer="vide">Créer les tables</button></li>' +
      '<li><button type="button" class="fr-btn fr-btn--secondary" data-installer="exemple">Créer les tables avec un exemple fictif</button></li></ul>';
  }

  function installer(exemple) {
    var sch, ordre, complements = [];
    function metaFraiche() {
      return Promise.all([grist.docApi.fetchTable('_grist_Tables'), grist.docApi.fetchTable('_grist_Tables_column')]).then(function (m) {
        return { tables: lignesDepuisColonnes(m[0]), cols: lignesDepuisColonnes(m[1]) };
      });
    }
    function opts(c) { return c.widgetOptions ? JSON.stringify(c.widgetOptions) : ''; }
    function estRef(c) { return /^Ref(List)?:/.test(c.type); }
    return fetch('schema.json').then(function (r) { return r.json(); }).then(function (j) {
      sch = j; ordre = Object.keys(sch.tables).filter(function (t) { return !aTable(t); });
      // Tables partagées déjà présentes (Personnes, Structures… créées par un autre outil) :
      // on les garde telles quelles et on ajoute seulement les colonnes qui leur manquent.
      complements = colonnesManquantes(sch);
      // 1. Tables avec leurs colonnes simples (ni référence, ni formule).
      var a1 = ordre.map(function (t) {
        return ['AddTable', t, sch.tables[t].filter(function (c) { return !estRef(c) && !c.isFormula; }).map(function (c) {
          var o = { id: c.id, type: c.type, isFormula: false };
          if (c.label) o.label = c.label;
          if (c.formula) o.formula = c.formula;
          if (c.widgetOptions) o.widgetOptions = opts(c);
          return o;
        })];
      });
      complements.filter(function (m) { return !estRef(m.c) && !m.c.isFormula; }).forEach(function (m) {
        a1.push(['AddColumn', m.table, m.c.id, { type: m.c.type, isFormula: false, formula: m.c.formula || '', label: m.c.label || m.c.id, widgetOptions: opts(m.c) }]);
      });
      return a1.length ? grist.docApi.applyUserActions(a1) : null;
    }).then(function () {
      // 2. Références, puis formules : toutes les tables existent désormais.
      var a = [];
      ordre.forEach(function (t) { sch.tables[t].filter(estRef).forEach(function (c) {
        a.push(['AddColumn', t, c.id, { type: c.type, isFormula: !!c.isFormula, formula: c.formula || '', label: c.label || c.id, widgetOptions: opts(c) }]);
      }); });
      complements.filter(function (m) { return estRef(m.c); }).forEach(function (m) {
        a.push(['AddColumn', m.table, m.c.id, { type: m.c.type, isFormula: !!m.c.isFormula, formula: m.c.formula || '', label: m.c.label || m.c.id, widgetOptions: opts(m.c) }]);
      });
      ordre.forEach(function (t) { sch.tables[t].filter(function (c) { return !estRef(c) && c.isFormula; }).forEach(function (c) {
        a.push(['AddColumn', t, c.id, { type: c.type, isFormula: true, formula: c.formula || '', label: c.label || c.id, widgetOptions: opts(c) }]);
      }); });
      complements.filter(function (m) { return !estRef(m.c) && m.c.isFormula; }).forEach(function (m) {
        a.push(['AddColumn', m.table, m.c.id, { type: m.c.type, isFormula: true, formula: m.c.formula || '', label: m.c.label || m.c.id, widgetOptions: opts(m.c) }]);
      });
      return a.length ? grist.docApi.applyUserActions(a) : null;
    }).then(function () {
      // Colonnes ajoutées à une table existante : sa valeur par défaut (« Membre », vrai…)
      // ne vaut que pour les nouvelles lignes. On la donne aussi aux lignes déjà présentes.
      var parTable = {};
      complements.forEach(function (m) {
        if (m.c.isFormula || !m.c.formula) return;
        var f = String(m.c.formula).trim(), v;
        if (f === 'True') v = true; else if (f === 'False') v = false;
        else if (/^"[^"]*"$/.test(f)) v = f.slice(1, -1); else return;
        (parTable[m.table] = parTable[m.table] || {})[m.c.id] = v;
      });
      return Promise.all(Object.keys(parTable).map(function (t) {
        return grist.docApi.fetchTable(t).then(function (c) {
          var ids = c.id || [];
          if (!ids.length) return null;
          var champs = {};
          Object.keys(parTable[t]).forEach(function (k) { champs[k] = ids.map(function () { return parTable[t][k]; }); });
          return grist.docApi.applyUserActions([['BulkUpdateRecord', t, ids, champs]]);
        });
      }));
    }).then(metaFraiche).then(function (m) {
      // 3. Libellés affichés des références et dépendances des formules de déclenchement.
      function col(t, c) { var tb = m.tables.filter(function (x) { return x.tableId === t; })[0]; return tb && m.cols.filter(function (x) { return x.parentId === tb.id && x.colId === c; })[0]; }
      var a = [];
      var ajoutees = {};
      complements.forEach(function (m) { (ajoutees[m.table] = ajoutees[m.table] || {})[m.c.id] = 1; });
      Object.keys(sch.tables).forEach(function (t) { sch.tables[t].forEach(function (c) {
        if (ordre.indexOf(t) < 0 && !(ajoutees[t] && ajoutees[t][c.id])) return;
        var moi = col(t, c.id);
        if (!moi) return;
        if (c.visibleCol && estRef(c)) {
          var cible = c.type.split(':')[1], v = col(cible, c.visibleCol);
          if (v) { a.push(['ModifyColumn', t, c.id, { visibleCol: v.id }]); a.push(['SetDisplayFormula', t, null, moi.id, '$' + c.id + '.' + c.visibleCol]); }
        }
        if (c.recalcWhen || (c.recalcDeps && c.recalcDeps.length)) {
          var deps = (c.recalcDeps || []).map(function (d) { var x = col(t, d); return x && x.id; }).filter(Boolean);
          a.push(['ModifyColumn', t, c.id, { recalcWhen: c.recalcWhen || 0, recalcDeps: deps.length ? ['L'].concat(deps) : null }]);
        }
      }); });
      return a.length ? grist.docApi.applyUserActions(a) : null;
    }).then(function () {
      // 4. Exemple fictif (avant les règles d'accès, qui rechargent le document).
      if (!exemple) return null;
      return fetch('../donnees-fictives/exemple.json').then(function (r) { return r.json(); }).then(function (ex) {
        var a = [];
        Object.keys(sch.tables).forEach(function (t) {
          var lignes = ex[t]; if (!lignes || !lignes.length) return;
          var modifiables = sch.tables[t].filter(function (c) { return !c.isFormula; }).map(function (c) { return c.id; });
          var cles = []; lignes.forEach(function (l) { Object.keys(l).forEach(function (k) { if (k !== 'id' && modifiables.indexOf(k) >= 0 && cles.indexOf(k) < 0) cles.push(k); }); });
          var cols = {};
          cles.forEach(function (k) {
            var type = (sch.tables[t].filter(function (c) { return c.id === k; })[0] || {}).type || '';
            cols[k] = lignes.map(function (l) {
              var v = l[k] === undefined ? null : l[k];
              if (typeof v === 'string' && /^Date/.test(type)) v = saisieVersDate(v);
              if (Array.isArray(v) && v[0] !== 'L') v = ['L'].concat(v);
              return v;
            });
          });
          a.push(['BulkAddRecord', t, lignes.map(function (l) { return l.id; }), cols]);
        });
        return grist.docApi.applyUserActions(a);
      });
    }).then(function () {
      // 5. Règles d'accès du modèle, en dernier et en un seul lot : Grist recharge le document
      //    (et ce widget) dès que les règles changent. Les identifiants négatifs relient
      //    les règles aux ressources créées dans le même lot.
      return grist.docApi.fetchTable('_grist_ACLResources').then(function (x) {
        var existantes = lignesDepuisColonnes(x);
        if (existantes.some(function (r) { return ordre.indexOf(r.tableId) >= 0; })) return null;
        var res = sch.acl.resources.filter(function (r) { return r.tableId && r.tableId !== '*'; });
        var carte = { 1: 1 };
        res.forEach(function (r, i) { carte[r.id] = -(i + 1); });
        // Les règles par défaut du modèle (ressource « toutes les tables ») ne s'appliquent ici
        // qu'aux tables de l'outil : les autres outils du document gardent leurs propres droits.
        var globale = sch.acl.resources.filter(function (r) { return r.tableId === '*'; }).map(function (r) { return r.id; });
        var parTable = res.filter(function (r) { return r.colIds === '*'; });
        var regles = [];
        sch.acl.rules.filter(function (r) { return r.aclFormula || r.permissionsText || r.userAttributes; }).forEach(function (r) {
          if (globale.indexOf(r.resource) < 0) { regles.push(Object.assign({}, r, { resource: carte[r.resource] || 1 })); return; }
          parTable.forEach(function (t) { regles.push(Object.assign({}, r, { resource: carte[t.id], rulePos: 1000 + (r.rulePos || 0) })); });
        });
        return grist.docApi.applyUserActions([
          ['BulkAddRecord', '_grist_ACLResources', res.map(function (r, i) { return -(i + 1); }), { tableId: res.map(function (r) { return r.tableId; }), colIds: res.map(function (r) { return r.colIds; }) }],
          ['BulkAddRecord', '_grist_ACLRules', regles.map(function () { return null; }), {
            resource: regles.map(function (r) { return r.resource; }), aclFormula: regles.map(function (r) { return r.aclFormula || ''; }),
            aclFormulaParsed: regles.map(function (r) { return r.aclFormulaParsed || ''; }), permissionsText: regles.map(function (r) { return r.permissionsText || ''; }),
            rulePos: regles.map(function (r) { return r.rulePos; }), memo: regles.map(function (r) { return r.memo || ''; }), userAttributes: regles.map(function (r) { return r.userAttributes || ''; })
          }]
        ]).catch(function (err) {
          // Le rechargement du document coupe la connexion : ce n'est pas un échec.
          if (/disposed|closed|disconnect/i.test(String((err && err.message) || err))) return null;
          throw err;
        });
      });
    }).then(function () {
      etat.alerte = { type: 'success', texte: 'Espace projets installé, avec ses règles d\'accès.' + (exemple ? ' L\'exemple fictif est chargé.' : '') + ' Créez maintenant votre profil.' };
      return charger();
    }).then(assurerCompte).then(function () { location.hash = '#/profil'; rendre(); }).catch(function (err) {
      etat.alerte = { type: 'error', texte: 'Installation impossible ou incomplète : seuls les propriétaires du document peuvent créer des tables et des règles. (' + ((err && err.message) || err) + ')' };
      rendre();
    });
  }

  function rendre() {
    var r = route();
    var html;
    monterCoque();
    if (configLab && etat.alerte && configLab.ongletActif() !== 'vue') { configLab.message(etat.alerte.type, etat.alerte.texte); etat.alerte = null; }
    if (configLab) configLab.rafraichir('roles');
    if (!DEMO && !aTable('Projets')) { app.innerHTML = vueInstallation(); return; }
    if (r.vue === 'fiche') html = vueFiche(r.id);
    else if (r.vue === 'form') html = vueFormulaire(r.id);
    else if (r.vue === 'pilotage') html = vuePilotage();
    else if (r.vue === 'profil') html = vueProfil();
    else if (r.vue === 'travail') html = vueTravail();
    else html = vueBanque();
    app.innerHTML = bandeauMiseAJour() + html + piedContact(r);
  }

  // --- Champs de la fiche projet : masquer ceux d'origine, ajouter les siens ------

  var CHAMPS_MASQUABLES = [
    ['Resume', 'En bref'], ['Origine', 'Origine du projet'], ['Structures_associees', 'Structures associées'],
    ['Commanditaire', 'Mission confiée par'], ['Mission', 'Mission confiée'], ['Objectifs', 'Objectifs attendus'],
    ['Date_debut', 'Début'], ['Echeance', 'Échéance prévisionnelle'], ['Thematiques', 'Thématiques']
  ];
  var TYPES_CHAMP = [['court', 'Texte court', 'Text'], ['long', 'Texte long', 'Text'], ['choix', 'Choix dans une liste', 'Choice'],
    ['date', 'Date', 'Date'], ['nombre', 'Nombre', 'Numeric']];

  function masque(champ) { return (reglages.champsMasques || []).indexOf(champ) !== -1; }

  // Champs personnalisés dont la colonne existe dans la table Projets.
  function champsPerso() {
    return (Array.isArray(reglages.champsPerso) ? reglages.champsPerso : []).filter(function (c) {
      return c && /^[A-Za-z][A-Za-z0-9_]*$/.test(c.id || '') && c.label && aColonne('Projets', c.id);
    });
  }

  function valeurPerso(c, p) {
    var v = p[c.id];
    if (v === null || v === undefined || v === '') return '';
    return c.type === 'date' ? dateTexte(v) : String(v);
  }

  function identifiantChamp(libelle) {
    var id = sansAccent(libelle).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!id) return '';
    id = id.charAt(0).toUpperCase() + id.slice(1);
    return /^[0-9]/.test(id) ? 'C_' + id : id;
  }

  function colonneProjetsPrise(id) {
    if (DEMO) return Object.keys((data.Projets || [])[0] || {}).indexOf(id) !== -1;
    return aColonne('Projets', id);
  }

  var nouveauChamp = { label: '', type: 'court', choix: '', aide: '', requis: false, carte: false };

  function sectionBento(b) {
    var actif = Array.isArray(b.bento) && b.bento.length > 0;
    var h = '<section><h2 class="fr-h5">Agencement de la fiche projet</h2>' +
      '<p class="fr-text--sm">Par défaut, la fiche garde sa présentation d\'origine. Activez l\'agencement libre pour choisir l\'ordre, la largeur et la présence de chaque bloc. Les blocs vides ne s\'affichent pas. L\'onglet Aperçu montre le résultat.</p>' +
      '<div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="rg-bento-actif" data-bento="actif"' + (actif ? ' checked' : '') + '><label class="fr-label" for="rg-bento-actif">Agencement libre de la fiche</label></div>';
    if (actif) {
      var l = bentoComplet(b.bento);
      h += '<div class="sp-bento-reglage">';
      l.forEach(function (x, i) {
        var nom = BLOCS_FICHE.filter(function (d) { return d[0] === x.id; })[0][1];
        h += '<div class="sp-bento-ligne"><div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="rg-bl-' + x.id + '" data-bento="visible" data-id="' + x.id + '"' + (x.visible ? ' checked' : '') + '><label class="fr-label" for="rg-bl-' + x.id + '">' + esc(nom) + '</label></div>' +
          '<div class="fr-select-group"><label class="fr-label fr-sr-only" for="rg-bt-' + x.id + '">Largeur du bloc ' + esc(nom) + '</label><select class="fr-select" id="rg-bt-' + x.id + '" data-bento="taille" data-id="' + x.id + '">' +
          TAILLES_BLOC.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === x.taille ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>' +
          '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline" data-bento-deplacer="-1" data-id="' + x.id + '"' + (i === 0 ? ' disabled' : '') + ' title="Monter ' + esc(nom) + '">Monter</button>' +
          '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline" data-bento-deplacer="1" data-id="' + x.id + '"' + (i === l.length - 1 ? ' disabled' : '') + ' title="Descendre ' + esc(nom) + '">Descendre</button></div>';
      });
      h += '</div>';
    }
    return h + '</section>';
  }

  function sectionChamps(b) {
    b.champsMasques = b.champsMasques || [];
    b.champsPerso = b.champsPerso || [];
    var h = '<section><h2 class="fr-h5">Champs de la fiche projet</h2>' +
      '<p class="fr-text--sm">Décochez un champ d\'origine pour le masquer partout (formulaire, fiche, carte). Ses données restent dans Grist : rien n\'est supprimé.</p>' +
      '<fieldset class="fr-fieldset" aria-labelledby="rg-masques-leg"><legend class="fr-fieldset__legend fr-sr-only" id="rg-masques-leg">Champs d\'origine affichés</legend>';
    CHAMPS_MASQUABLES.forEach(function (c) {
      h += '<div class="fr-fieldset__element fr-fieldset__element--inline"><div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="rg-masque-' + c[0] + '" data-champ-masque="' + c[0] + '"' +
        (b.champsMasques.indexOf(c[0]) === -1 ? ' checked' : '') + '><label class="fr-label" for="rg-masque-' + c[0] + '">' + esc(c[1]) + '</label></div></div>';
    });
    h += '</fieldset><h3 class="fr-h6">Vos champs</h3>';
    if (!b.champsPerso.length) h += '<p class="sp-vide">Aucun champ personnalisé.</p>';
    b.champsPerso.forEach(function (c) {
      var type = TYPES_CHAMP.filter(function (t) { return t[0] === c.type; })[0];
      h += '<div class="sp-champ-perso"><p class="fr-mb-1v"><strong>' + esc(c.label) + '</strong> · ' + esc(type ? type[1] : c.type) +
        ' · colonne <code>' + esc(c.id) + '</code>' + (aColonne('Projets', c.id) && !DEMO ? '' : ' <span class="fr-badge fr-badge--sm fr-badge--info">Créée à l\'enregistrement</span>') + '</p>' +
        '<div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="rg-req-' + c.id + '" data-perso="' + esc(c.id) + '" data-drapeau="requis"' + (c.requis ? ' checked' : '') + '><label class="fr-label" for="rg-req-' + c.id + '">Obligatoire</label></div>' +
        '<div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="rg-car-' + c.id + '" data-perso="' + esc(c.id) + '" data-drapeau="carte"' + (c.carte ? ' checked' : '') + '><label class="fr-label" for="rg-car-' + c.id + '">Afficher sur la carte</label></div>' +
        '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary" data-action="retirer-champ-perso" data-id="' + esc(c.id) + '">Retirer des réglages</button></div>';
    });
    var n = nouveauChamp;
    h += '<h3 class="fr-h6 fr-mt-2w">Ajouter un champ</h3><div class="sp-champ-perso">' +
      '<div class="fr-input-group"><label class="fr-label" for="nc-label">Libellé</label><input class="fr-input" id="nc-label" data-nouveau="label" value="' + esc(n.label) + '"></div>' +
      '<div class="fr-select-group"><label class="fr-label" for="nc-type">Type</label><select class="fr-select" id="nc-type" data-nouveau="type">' +
      TYPES_CHAMP.map(function (t) { return '<option value="' + t[0] + '"' + (n.type === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fr-input-group"><label class="fr-label" for="nc-choix">Valeurs possibles<span class="fr-hint-text">Pour le type « Choix » : une valeur par ligne.</span></label><textarea class="fr-input" rows="3" id="nc-choix" data-nouveau="choix">' + esc(n.choix) + '</textarea></div>' +
      '<div class="fr-input-group"><label class="fr-label" for="nc-aide">Aide sous le champ (facultatif)</label><input class="fr-input" id="nc-aide" data-nouveau="aide" value="' + esc(n.aide) + '"></div>' +
      '<div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="nc-requis" data-nouveau="requis"' + (n.requis ? ' checked' : '') + '><label class="fr-label" for="nc-requis">Obligatoire à la saisie</label></div>' +
      '<div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="nc-carte" data-nouveau="carte"' + (n.carte ? ' checked' : '') + '><label class="fr-label" for="nc-carte">Afficher sur la carte</label></div>' +
      '<button type="button" class="fr-btn fr-btn--sm fr-mt-1w" data-action="ajouter-champ-perso">Ajouter le champ</button></div></section>';
    return h;
  }

  function ajouterChampPerso() {
    var n = nouveauChamp, b = brouillonReglages;
    var label = String(n.label || '').trim();
    function refus(t) { if (configLab) configLab.message('error', t); }
    if (!label) { refus('Indiquez le libellé du champ.'); return; }
    var id = identifiantChamp(label);
    if (!id) { refus('Le libellé doit contenir au moins une lettre ou un chiffre.'); return; }
    if (colonneProjetsPrise(id) || b.champsPerso.some(function (c) { return c.id === id; })) {
      refus('Le nom de colonne « ' + id + ' » est déjà pris : choisissez un autre libellé.'); return;
    }
    var choix = String(n.choix || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (n.type === 'choix' && !choix.length) { refus('Indiquez au moins une valeur possible pour un champ « Choix ».'); return; }
    b.champsPerso.push({ id: id, label: label, type: n.type, aide: String(n.aide || '').trim(), requis: !!n.requis, carte: !!n.carte, choix: n.type === 'choix' ? choix : [] });
    nouveauChamp = { label: '', type: 'court', choix: '', aide: '', requis: false, carte: false };
    if (configLab) { configLab.rafraichir('reglages'); configLab.modifie(true); configLab.message('info', 'Champ « ' + label + ' » ajouté. Enregistrez les réglages pour créer la colonne dans Grist.'); }
  }

  // --- Réglages (propriétaires du document) ---------------------------------

  var brouillonReglages = null;
  var LISTES_REGLABLES = [
    ['phases', 'Phases du projet (colonnes du kanban)', 'Projets', 'Phase'],
    ['etats', 'États du projet', 'Projets', 'Etat'],
    ['origines', 'Origines du projet', 'Projets', 'Origine'],
    ['thematiques', 'Thématiques', 'Projets', 'Thematiques'],
    ['etatsAction', 'États des actions du plan', 'Actions', 'Etat'],
    ['typesJournal', 'Types de messages du journal', 'Journal', 'Type'],
    ['typesDocument', 'Types de documents', 'Documents', 'Type']
  ];
  var COULEURS_REGLABLES = [['phases', 'phases', 'Couleur des phases'], ['etats', 'etats', 'Couleur des états'], ['typesJournal', 'typesJournal', 'Couleur des types de messages']];

  var configLab = null;
  function reglagesPropres() {
    var b = brouillonReglages;
    b.listes = b.listes || {}; b.couleurs = b.couleurs || {};
    var h = '<div class="cl-panneau"><p class="fr-text--sm">Réservé aux propriétaires du document. Les réglages sont enregistrés dans la description de la colonne <code>' + NOM_COLONNE_CONFIG + '</code> de la table Projets.</p><div class="sp-reglages">' +
      '<section><h2 class="fr-h5">Listes de valeurs</h2><p class="fr-text--sm">Une valeur par ligne. À l\'enregistrement, les listes de choix des colonnes Grist sont mises à jour. Renommer une valeur ne modifie pas les projets existants.</p>';
    LISTES_REGLABLES.forEach(function (l) {
      var val = (b.listes[l[0]] && b.listes[l[0]].length ? b.listes[l[0]] : DEFAUTS[l[0]]).join('\n');
      h += '<div class="fr-input-group"><label class="fr-label" for="rg-' + l[0] + '">' + esc(l[1]) + '<span class="fr-hint-text">Colonne ' + l[2] + '.' + l[3] + '</span></label>' +
        '<textarea class="fr-input" rows="4" id="rg-' + l[0] + '" data-reglage-liste="' + l[0] + '">' + esc(val) + '</textarea></div>';
    });
    h += '</section><section><h2 class="fr-h5">Couleurs des étiquettes</h2>';
    COULEURS_REGLABLES.forEach(function (cr) {
      var valeurs = (b.listes[cr[0]] && b.listes[cr[0]].length ? b.listes[cr[0]] : DEFAUTS[cr[0]]);
      var perso = b.couleurs[cr[1]] || {};
      h += '<h3 class="fr-h6">' + esc(cr[2]) + '</h3><div class="sp-reglages__couleurs">';
      valeurs.forEach(function (v, i) {
        var actuelle = perso[v] || '';
        h += '<div class="sp-reglages__couleur">' + badge(v, actuelle || (cr[1] === 'phases' ? COULEUR_PHASE[v] : cr[1] === 'etats' ? COULEUR_ETAT[v] : COULEUR_JOURNAL[v]), false) +
          '<label class="fr-sr-only" for="rgc-' + cr[1] + i + '">Couleur de ' + esc(v) + '</label>' +
          '<input type="color" id="rgc-' + cr[1] + i + '" data-reglage-couleur="' + cr[1] + '" data-valeur="' + esc(v) + '" value="' + esc(/^#/.test(actuelle) ? actuelle : '#000091') + '">' +
          (actuelle ? '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline" data-reglage-couleur-defaut="' + cr[1] + '" data-valeur="' + esc(v) + '">Par défaut</button>' : '') + '</div>';
      });
      h += '</div>';
    });
    h += '</section>' + sectionChamps(b) + sectionBento(b) + '<section><h2 class="fr-h5">Autres réglages</h2>' +
      '<div class="fr-input-group"><label class="fr-label" for="rg-domaine">Domaine des adresses électroniques<span class="fr-hint-text">Sert à suggérer l\'adresse d\'un collègue (prénom.nom@domaine). Exemple : mon-administration.fr. Vide : pas de suggestion.</span></label>' +
      '<input class="fr-input" id="rg-domaine" data-reglage="domaineCourriel" value="' + esc(b.domaineCourriel || '') + '"></div>' +
      '<div class="fr-input-group"><label class="fr-label" for="rg-jours">Alerte « projet à relancer » après (jours sans activité)</label>' +
      '<input class="fr-input" type="number" min="1" id="rg-jours" data-reglage="joursAlerte" value="' + esc(b.joursAlerte || 60) + '"></div>';
    return h + '</section></div></div>';
  }
  function reglagesRoles() { return '<div class="cl-panneau sp-reglages">' + sectionRoles() + '</div>'; }

  // Rôle « Administration » : voit et gère tous les projets, y compris restreints. Attribué par les propriétaires.
  var rolesBrouillon = {};
  function sectionRoles() {
    if (!aColonne('Personnes', 'Role')) {
      return '<section><h2 class="fr-h5">Rôle « Administration »</h2><p class="fr-text--sm">Mettez d\'abord le document à jour (bandeau en haut de page).</p></section>';
    }
    var personnes = personnesTriees();
    var h = '<section><h2 class="fr-h5">Rôle « Administration »</h2>' +
      '<p class="fr-text--sm">Les personnes cochées voient et gèrent tous les projets, y compris les projets restreints. Les autres voient les projets ouverts et ceux où elles sont désignées. ' +
      'La personne est reconnue par l\'adresse électronique de sa fiche, qui doit être celle de son compte Grist.</p>';
    if (!personnes.length) return h + '<p class="sp-vide">Aucune personne dans l\'annuaire.</p></section>';
    h += '<fieldset class="fr-fieldset" aria-labelledby="rg-roles-leg"><legend class="fr-fieldset__legend fr-sr-only" id="rg-roles-leg">Personnes en Administration</legend>';
    personnes.forEach(function (x) {
      var coche = (rolesBrouillon[x.id] || x.Role) === 'Administration';
      h += '<div class="fr-fieldset__element"><div class="fr-checkbox-group fr-checkbox-group--sm"><input type="checkbox" id="rg-role-' + x.id + '" data-role="' + x.id + '"' + (coche ? ' checked' : '') + '>' +
        '<label class="fr-label" for="rg-role-' + x.id + '">' + esc(x.Nom || 'Sans nom') + (emailDe(x) ? '<span class="fr-hint-text">' + esc(emailDe(x)) + '</span>' : '<span class="fr-hint-text">Sans adresse : ne peut pas être reconnue</span>') + '</label></div></div>';
    });
    return h + '</fieldset><button type="button" class="fr-btn fr-btn--secondary fr-btn--sm" data-action="enregistrer-roles">Enregistrer les rôles</button></section>';
  }
  function enregistrerRoles() {
    var ids = Object.keys(rolesBrouillon).map(num).filter(function (id) { return idx.Personnes[id] && (idx.Personnes[id].Role || 'Membre') !== rolesBrouillon[id]; });
    if (!ids.length) { etat.alerte = { type: 'info', texte: 'Aucun rôle modifié.' }; rendre(); return; }
    executer([['BulkUpdateRecord', 'Personnes', ids, { Role: ids.map(function (id) { return rolesBrouillon[id]; }) }]], 'Rôles enregistrés.', function () { rolesBrouillon = {}; },
      'Grist a refusé l\'enregistrement : seuls les propriétaires du document attribuent le rôle « Administration ».');
  }

  function monterCoque() {
    var z = document.getElementById('sp-coque');
    if (configLab || !z || !window.ConfigLab) return;
    brouillonReglages = JSON.parse(JSON.stringify(reglages || {}));
    brouillonReglages.page = brouillonReglages.page || { marque: '', titre: 'Suivi des projets', pied: { accessibilite: '' } };
    configLab = window.ConfigLab.monter(z, {
      nom: 'Suivi de projets',
      vue: { libelle: 'Projets', element: app },
      ongletInitial: route().vue === 'reglages' ? 'reglages' : 'vue',
      page: brouillonReglages.page,
      onglets: [
        { id: 'reglages', libelle: 'Réglages', rendre: function (zone) { zone.innerHTML = reglagesPropres(); } },
        { id: 'roles', libelle: 'Rôles', rendre: function (zone) { zone.innerHTML = reglagesRoles(); } }
      ],
      apercu: function (zone) { zone.innerHTML = apercuReel(); },
      publication: { mode: 'connecte', adresseWidget: location.href.split('#')[0].split('?')[0], texte: 'Les projets restreints ne sont visibles que des personnes désignées et du rôle Administration (onglet Rôles).',
        publier: {
          lienDoc: (brouillonReglages.publication && brouillonReglages.publication.lienDoc) || '',
          texte: 'La banque des projets s\'affiche en page complète, sans compte Grist, en lecture seule : liste, recherche et fiche de présentation. Les projets « Restreint » ne sont jamais publiés. Ni les personnes, ni le plan d\'action, ni le journal, ni les documents ne sont lus par la page publique.',
          champs: [{ libelle: 'Phases publiées (facultatif)', aide: 'Noms de phases séparés par des virgules. Vide : toutes les phases des projets non restreints.', exemple: 'Réalisation, Clôture', valeur: (brouillonReglages.publication && brouillonReglages.publication.phases) || '' }],
          construire: function (l) { return window.GristPublic ? window.GristPublic.lien(location.href.split('#')[0].split('?')[0], { doc: l, table: 'Projets' }) : null; },
          surChangement: function (l, champs) { brouillonReglages.publication = { lienDoc: l, phases: (champs && champs[0] && champs[0].valeur) || '' }; }
        } },
      surEnregistrer: enregistrerReglages
    });
  }

  // Aperçu : la vraie page (banque et fiche d'un projet) avec les réglages en cours, non interactive.
  function apercuReel() {
    var sauve = reglages;
    reglages = brouillonReglages || reglages;
    try {
      var projets = projetsFiltres();
      var html = '<div inert>' + vueBanque();
      if (projets.length) html += '<hr><h2 class="fr-h4">Fiche d\'un projet</h2><h3 class="fr-h5">' + esc(projets[0].Titre || '') + '</h3>' + ongletPresentation(projets[0]);
      return html + '</div>';
    } catch (e) {
      return '<p>Aperçu indisponible : ' + esc((e && e.message) || e) + '</p>';
    } finally { reglages = sauve; }
  }

  function enregistrerReglages() {
    var b = brouillonReglages;
    if (DEMO) {
      appliquerReglages(JSON.parse(JSON.stringify(b)));
      rendre();
      if (configLab) { configLab.enregistre(); configLab.message('info', 'Mode démonstration : appliqué à l\'écran, rien n\'est enregistré. Dans Grist, les réglages sont enregistrés dans le document.'); }
      return;
    }
    LISTES_REGLABLES.forEach(function (l) {
      var champ = document.getElementById('rg-' + l[0]);
      if (!champ) return;
      var valeurs = champ.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var defaut = DEFAUTS[l[0]];
      if (valeurs.join('|') === defaut.join('|')) delete b.listes[l[0]]; else b.listes[l[0]] = valeurs;
    });
    b.majLe = new Date().toISOString();
    var actions = [];
    if (!meta.colConfig) actions.push(['AddColumn', 'Projets', NOM_COLONNE_CONFIG, { type: 'Text', label: NOM_COLONNE_CONFIG }]);
    actions.push(['ModifyColumn', 'Projets', NOM_COLONNE_CONFIG, { description: JSON.stringify(b) }]);
    // Champs personnalisés : une colonne Grist par champ, créée si elle manque. Jamais supprimée.
    (b.champsPerso || []).forEach(function (c) {
      if (aColonne('Projets', c.id)) return;
      var type = TYPES_CHAMP.filter(function (t) { return t[0] === c.type; })[0];
      var def = { type: type ? type[2] : 'Text', isFormula: false, formula: '', label: c.label };
      if (c.type === 'choix') def.widgetOptions = JSON.stringify({ choices: c.choix || [] });
      if (c.type === 'long') def.widgetOptions = JSON.stringify({ widget: 'TextBox', wrap: true });
      actions.push(['AddColumn', 'Projets', c.id, def]);
    });
    // Listes de choix des colonnes Grist alignées sur les réglages.
    LISTES_REGLABLES.forEach(function (l) {
      if (!b.listes[l[0]]) return;
      var table = meta.tables.filter(function (t) { return t.tableId === l[2]; })[0];
      var col = table && meta.colonnes.filter(function (c) { return c.parentId === table.id && c.colId === l[3]; })[0];
      if (!col || !/^Choice/.test(col.type)) return;
      var opts = {};
      try { opts = JSON.parse(col.widgetOptions || '{}'); } catch (e) { opts = {}; }
      opts.choices = b.listes[l[0]];
      actions.push(['ModifyColumn', l[2], l[3], { widgetOptions: JSON.stringify(opts) }]);
    });
    // Le domaine est aussi recopié dans Parametres (Domaine_courriel), lu par la formule Personnes.A_verifier.
    var ligneDomaine = (data.Parametres || []).filter(function (r) { return r.Cle === 'Domaine_courriel'; })[0];
    var domaine = String(b.domaineCourriel || '').replace(/^@/, '').trim();
    if (data.Parametres) {
      if (ligneDomaine) actions.push(['UpdateRecord', 'Parametres', ligneDomaine.id, { Valeur: domaine }]);
      else actions.push(['AddRecord', 'Parametres', null, { Cle: 'Domaine_courriel', Valeur: domaine }]);
    }
    return grist.docApi.applyUserActions(actions).then(function () {
      meta.colConfig = true;
      return charger();
    }).then(function () {
      appliquerReglages(b);
      if (configLab) { configLab.enregistre(); configLab.message('success', 'Réglages enregistrés.'); }
      rendre();
    }).catch(function (err) {
      if (configLab) configLab.message('error', 'Enregistrement impossible : seuls les propriétaires du document peuvent modifier les réglages. (' + ((err && err.message) || err) + ')');
    });
  }

  function piedContact(r) {
    var p = r.vue === 'fiche' || (r.vue === 'form' && r.id) ? idx.Projets[r.id] : null;
    var lien = lienContact('Suivi des projets – signalement' + (p ? ' – ' + (p.Titre || 'projet ' + p.id) : ''),
      "Contacter l'administrateur du suivi");
    return lien ? '<p class="sp-contact fr-text--sm">Une erreur, une personne désignée par erreur, une question ? ' + lien + '</p>' : '';
  }

  function blocAlerte() {
    if (!etat.alerte) return '';
    return '<div class="fr-alert fr-alert--sm fr-alert--' + etat.alerte.type + ' sp-alerte">' +
      '<p>' + esc(etat.alerte.texte) + '</p></div>';
  }

  function champSelect(id, libelle, valeur, options, attrs, vide) {
    var html = '<div class="fr-select-group"><label class="fr-label" for="' + id + '">' + esc(libelle) + '</label>' +
      '<select class="fr-select" id="' + id + '" ' + (attrs || '') + '>';
    if (vide !== false) html += '<option value="">' + esc(vide || 'Tous') + '</option>';
    options.forEach(function (o) {
      var v = typeof o === 'object' ? o.v : o;
      var t = typeof o === 'object' ? o.t : o;
      html += '<option value="' + esc(v) + '"' + (String(v) === String(valeur) ? ' selected' : '') + '>' + esc(t) + '</option>';
    });
    return html + '</select></div>';
  }

  // --- Banque des projets ----------------------------------------------------

  function projetsFiltres() {
    var f = etat.filtres;
    var q = sansAccent(f.q.trim());
    var structs = f.structure ? descendants(num(f.structure)) : null;
    var liste_ = data.Projets.filter(function (p) {
      if (!f.archives && p.Archive) return false;
      if (f.phase && p.Phase !== f.phase) return false;
      if (f.etat && p.Etat !== f.etat) return false;
      if (structs && structs.indexOf(num(p.Structure_porteuse)) === -1) return false;
      if (q) {
        var texte = sansAccent([p.Titre, p.Resume, p.Mission, cheminDe(p.Structure_porteuse),
          nomsPersonnes(p.Porteurs), liste(p.Thematiques).join(' ')].join(' '));
        if (texte.indexOf(q) === -1) return false;
      }
      return true;
    });
    liste_.sort(function (a, b) {
      if (f.tri === 'echeance') return (a.Echeance || 9e12) - (b.Echeance || 9e12);
      if (f.tri === 'titre') return String(a.Titre).localeCompare(String(b.Titre), 'fr');
      return (b.Derniere_activite || 0) - (a.Derniere_activite || 0);
    });
    return liste_;
  }

  function vueBanque() {
    var f = etat.filtres;
    var projets = projetsFiltres();
    var html = navigation('banque') + blocAlerte();
    html += '<div class="sp-titre-ligne"><div><h1 class="fr-h3">Banque des projets</h1>' +
      '<p class="fr-mb-0">' + projets.length + ' projet' + (projets.length > 1 ? 's' : '') + ' affiché' + (projets.length > 1 ? 's' : '') + '</p></div>' +
      (PUBLIC ? '' : '<button class="fr-btn fr-icon-add-line fr-btn--icon-left" data-action="nouveau">Déclarer un projet</button>') + '</div>';

    html += '<div class="sp-filtres">' +
      '<div class="fr-input-group"><label class="fr-label" for="f-q">Rechercher</label>' +
      '<input class="fr-input" id="f-q" type="search" data-filtre="q" value="' + esc(f.q) + '" placeholder="Titre, structure, porteur…"></div>' +
      champSelect('f-structure', 'Structure (et ses services)', f.structure,
        structuresTriees().map(function (s) { return { v: s.id, t: s.Chemin }; }), 'data-filtre="structure"', 'Toutes') +
      champSelect('f-phase', 'Phase', f.phase, PHASES, 'data-filtre="phase"', 'Toutes') +
      champSelect('f-etat', 'État', f.etat, ETATS, 'data-filtre="etat"') +
      champSelect('f-tri', 'Trier par', f.tri, [
        { v: 'activite', t: 'Activité la plus récente' }, { v: 'echeance', t: 'Échéance la plus proche' }, { v: 'titre', t: 'Titre' }
      ], 'data-filtre="tri"', false) +
      '<div class="fr-checkbox-group"><input type="checkbox" id="f-archives" data-filtre="archives"' + (f.archives ? ' checked' : '') + '>' +
      '<label class="fr-label" for="f-archives">Inclure les projets terminés et archivés</label></div>' +
      '</div>';

    if (!projets.length) {
      html += data.Projets.length
        ? '<p class="sp-vide">Aucun projet ne correspond à ces critères.</p>'
        : '<div class="fr-callout"><h2 class="fr-callout__title fr-h5">Aucun projet déclaré pour l\'instant</h2>' +
          '<p class="fr-callout__text">' + (PUBLIC ? 'Aucun projet n\'est publié pour l\'instant.' : 'La banque se remplit au fil des déclarations. Commencez par « Déclarer un projet ».') + '</p></div>';
      return html;
    }

    html += '<div class="sp-cartes">' + projets.map(carteProjet).join('') + '</div>';
    return html;
  }

  function carteProjet(p) {
    var badges = '<li>' + badge(p.Phase, COULEUR_PHASE[p.Phase]) + '</li><li>' + badge(p.Etat, COULEUR_ETAT[p.Etat]) + '</li>';
    if (p.Visibilite === 'Restreint') badges += '<li>' + badge('Restreint', 'orange-terre-battue') + '</li>';
    if (!p.Archive && p.Jours_sans_activite !== null && p.Jours_sans_activite >= JOURS_ALERTE) {
      badges += '<li>' + badge('Sans activité depuis ' + p.Jours_sans_activite + ' j', 'error') + '</li>';
    }
    var details = [];
    if (p.Echeance && !masque('Echeance')) details.push('Échéance : ' + dateTexte(p.Echeance));
    champsPerso().forEach(function (c) { var v = c.carte ? valeurPerso(c, p) : ''; if (v) details.push(c.label + ' : ' + v); });
    if (p.Avancement !== null && p.Avancement !== undefined) details.push(p.Avancement + ' % des actions faites');

    return '<div class="fr-card fr-enlarge-link">' +
      '<div class="fr-card__body"><div class="fr-card__content">' +
      '<h2 class="fr-card__title"><a href="#/projet/' + p.id + '">' + esc(p.Titre || 'Projet sans titre') + '</a></h2>' +
      (p.Resume && !masque('Resume') ? '<p class="fr-card__desc">' + esc(resumeCourt(p.Resume)) + '</p>' : '') +
      '<div class="fr-card__start"><ul class="sp-badges">' + badges + '</ul>' +
      '<p class="fr-card__detail fr-icon-building-line">' + esc(libelleStructure(p.Structure_porteuse) || 'Structure non renseignée') + '</p></div>' +
      '<div class="fr-card__end">' +
      (nomsPersonnes(p.Porteurs) ? '<p class="fr-card__detail fr-icon-user-line">' + esc(nomsPersonnes(p.Porteurs)) + '</p>' : '') +
      (details.length ? '<p class="fr-card__detail">' + esc(details.join(' · ')) + '</p>' : '') +
      '</div></div></div></div>';
  }

  // --- Fiche projet ----------------------------------------------------------

  function vueFiche(id) {
    var p = idx.Projets[id];
    if (!p) {
      return '<p><a class="fr-link fr-icon-arrow-left-line fr-link--icon-left" href="#/">Banque des projets</a></p>' +
        '<p>Ce projet n\'existe pas, ou vous n\'avez pas le droit de le consulter.</p>';
    }
    var acts = actionsDu(id), jour = journalDu(id), docs = documentsDu(id);
    var html = '<p><a class="fr-link fr-icon-arrow-left-line fr-link--icon-left" href="#/">Banque des projets</a></p>' + blocAlerte();

    html += '<div class="sp-titre-ligne"><div>' +
      '<ul class="sp-badges"><li>' + badge(p.Phase, COULEUR_PHASE[p.Phase], false) + '</li><li>' + badge(p.Etat, COULEUR_ETAT[p.Etat], false) + '</li>' +
      (p.Visibilite === 'Restreint' ? '<li>' + badge('Restreint', 'orange-terre-battue', false) + '</li>' : '') + '</ul>' +
      '<h1 class="fr-h2">' + esc(p.Titre || 'Projet sans titre') + '</h1>' +
      '<p class="sp-fiche-meta fr-mb-0">' + esc(cheminDe(p.Structure_porteuse) || 'Structure non renseignée') + '</p></div>' +
      '<a class="fr-btn fr-btn--secondary fr-icon-edit-line fr-btn--icon-left" href="#/projet/' + id + '/modifier">Modifier la fiche</a></div>';

    if (PUBLIC) etat.onglet = 'presentation';
    var onglets = PUBLIC ? [['presentation', 'Présentation']] : [
      ['presentation', 'Présentation'],
      ['plan', "Plan d'action (" + acts.length + ')'],
      ['journal', 'Journal (' + jour.length + ')'],
      ['documents', 'Documents (' + docs.length + ')']
    ];
    html += '<fieldset class="fr-segmented fr-segmented--no-legend sp-onglets"><legend class="fr-segmented__legend">Sections de la fiche</legend>' +
      '<div class="fr-segmented__elements">' + onglets.map(function (o) {
        return '<div class="fr-segmented__element"><input type="radio" name="sp-onglet" id="o-' + o[0] + '" value="' + o[0] + '" data-onglet' +
          (etat.onglet === o[0] ? ' checked' : '') + '><label class="fr-label" for="o-' + o[0] + '">' + esc(o[1]) + '</label></div>';
      }).join('') + '</div></fieldset>';

    if (etat.onglet === 'plan') html += ongletPlan(p, acts);
    else if (etat.onglet === 'journal') html += ongletJournal(p, jour);
    else if (etat.onglet === 'documents') html += ongletDocuments(p, docs);
    else html += ongletPresentation(p);
    return html;
  }

  function info(titre, valeur) {
    return '<div><dt>' + esc(titre) + '</dt><dd>' + (valeur ? valeur : '<span class="sp-vide">Non renseigné</span>') + '</dd></div>';
  }

  // Agencement libre de la fiche (« bento ») : blocs ordonnés, de largeur choisie, sur une grille de 6 colonnes.
  // Sans réglage, la fiche garde sa présentation d'origine.
  var BLOCS_FICHE = [['resume', 'En bref'], ['mission', 'Mission confiée'], ['objectifs', 'Objectifs attendus'], ['equipe', 'Porteurs et équipe projet'],
    ['calendrier', 'Calendrier et avancement'], ['details', 'Structures, origine, thématiques'], ['perso', 'Champs personnalisés']];
  var TAILLES_BLOC = [['6', 'Pleine largeur'], ['4', 'Deux tiers'], ['3', 'Moitié'], ['2', 'Un tiers']];
  var BENTO_DEFAUT = [['resume', '6'], ['mission', '4'], ['equipe', '2'], ['objectifs', '3'], ['calendrier', '3'], ['details', '3'], ['perso', '3']];
  function bentoActif() { return Array.isArray(reglages.bento) && reglages.bento.length > 0; }
  function bentoComplet(l) {
    var vus = {}, res = [];
    (Array.isArray(l) ? l : []).forEach(function (x) {
      if (x && BLOCS_FICHE.some(function (d) { return d[0] === x.id; }) && !vus[x.id]) { vus[x.id] = 1; res.push({ id: x.id, taille: ['2', '3', '4', '6'].indexOf(String(x.taille)) !== -1 ? String(x.taille) : '6', visible: x.visible !== false }); }
    });
    BLOCS_FICHE.forEach(function (d) { if (!vus[d[0]]) res.push({ id: d[0], taille: '6', visible: true }); });
    return res;
  }
  function blocFiche(id, p) {
    var themes = liste(p.Thematiques).map(function (t) { return '<li><p class="fr-tag fr-tag--sm">' + esc(t) + '</p></li>'; }).join('');
    var associees = liste(p.Structures_associees).map(libelleStructure).filter(Boolean).join(', ');
    switch (id) {
      case 'resume': return p.Resume && !masque('Resume') ? '<div class="sp-section"><h3>En bref</h3><p class="sp-texte">' + esc(p.Resume) + '</p></div>' : '';
      case 'mission':
        return (p.Mission || p.Commanditaire) && !(masque('Mission') && masque('Commanditaire')) ?
          '<div class="fr-callout sp-section"><h3 class="fr-callout__title">Mission confiée' + (nomPersonne(p.Commanditaire) ? ' par ' + esc(nomPersonne(p.Commanditaire)) : '') + '</h3>' +
          '<p class="fr-callout__text sp-texte">' + esc(p.Mission || 'Consigne non renseignée.') + '</p></div>' : '';
      case 'objectifs': return p.Objectifs && !masque('Objectifs') ? '<div class="sp-section"><h3>Objectifs attendus</h3><p class="sp-texte">' + esc(p.Objectifs) + '</p></div>' : '';
      case 'equipe': return '<dl class="sp-infos">' + info('Porteurs', esc(nomsPersonnes(p.Porteurs))) + info('Équipe projet', esc(nomsPersonnes(p.Equipe))) + '</dl>';
      case 'calendrier':
        return '<dl class="sp-infos">' + (masque('Date_debut') ? '' : info('Début', esc(dateTexte(p.Date_debut)))) +
          (masque('Echeance') ? '' : info('Échéance prévisionnelle', esc(dateTexte(p.Echeance)))) +
          info('Avancement', p.Avancement !== null && p.Avancement !== undefined ? esc(p.Avancement + ' % des actions faites') : '') +
          info('Dernière activité', esc(dateHeureTexte(p.Derniere_activite))) + '</dl>';
      case 'details':
        return '<dl class="sp-infos">' + (masque('Structures_associees') ? '' : info('Structures associées', esc(associees))) + (masque('Origine') ? '' : info('Origine', esc(p.Origine))) +
          (masque('Thematiques') ? '' : info('Thématiques', themes ? '<ul class="fr-tags-group">' + themes + '</ul>' : '')) + '</dl>';
      case 'perso': return champsPerso().length ? '<dl class="sp-infos">' + champsPerso().map(function (c) { return info(c.label, esc(valeurPerso(c, p))); }).join('') + '</dl>' : '';
    }
    return '';
  }
  function ficheBento(p) {
    var h = '<div class="sp-bento">';
    bentoComplet(reglages.bento).forEach(function (x) {
      if (!x.visible) return;
      var c = blocFiche(x.id, p);
      if (c) h += '<div class="sp-bloc sp-bloc--' + x.taille + '">' + c + '</div>';
    });
    return h + '</div>' + blocPasMoi(p);
  }

  function ongletPresentation(p) {
    if (bentoActif()) return ficheBento(p);
    var html = '';
    if (p.Resume && !masque('Resume')) html += '<div class="sp-section"><h3>En bref</h3><p class="sp-texte">' + esc(p.Resume) + '</p></div>';

    if ((p.Mission || p.Commanditaire) && !(masque('Mission') && masque('Commanditaire'))) {
      html += '<div class="fr-callout sp-section"><h3 class="fr-callout__title">Mission confiée' +
        (nomPersonne(p.Commanditaire) ? ' par ' + esc(nomPersonne(p.Commanditaire)) : '') + '</h3>' +
        '<p class="fr-callout__text sp-texte">' + esc(p.Mission || 'Consigne non renseignée.') + '</p></div>';
    }
    if (p.Objectifs && !masque('Objectifs')) html += '<div class="sp-section"><h3>Objectifs attendus</h3><p class="sp-texte">' + esc(p.Objectifs) + '</p></div>';

    var themes = liste(p.Thematiques).map(function (t) { return '<li><p class="fr-tag fr-tag--sm">' + esc(t) + '</p></li>'; }).join('');
    var associees = liste(p.Structures_associees).map(libelleStructure).filter(Boolean).join(', ');

    html += '<dl class="sp-infos">' +
      info('Porteurs', esc(nomsPersonnes(p.Porteurs))) +
      info('Équipe projet', esc(nomsPersonnes(p.Equipe))) +
      (masque('Structures_associees') ? '' : info('Structures associées', esc(associees))) +
      (masque('Origine') ? '' : info('Origine', esc(p.Origine))) +
      (masque('Date_debut') ? '' : info('Début', esc(dateTexte(p.Date_debut)))) +
      (masque('Echeance') ? '' : info('Échéance prévisionnelle', esc(dateTexte(p.Echeance)))) +
      champsPerso().map(function (c) { return info(c.label, esc(valeurPerso(c, p))); }).join('') +
      info('Avancement', p.Avancement !== null && p.Avancement !== undefined ? esc(p.Avancement + ' % des actions faites') : '') +
      info('Dernière activité', esc(dateHeureTexte(p.Derniere_activite))) +
      (masque('Thematiques') ? '' : info('Thématiques', themes ? '<ul class="fr-tags-group">' + themes + '</ul>' : '')) +
      '</dl>' + blocPasMoi(p);
    return html;
  }

  // « Ce n'est pas moi » : pour une personne désignée par erreur (souvent une faute dans l'email).
  function blocPasMoi(p) {
    var moi = etat.moi.profil;
    if (!moi) return '';
    var porteurs = liste(p.Porteurs).map(num), equipe = liste(p.Equipe).map(num);
    var estPorteur = porteurs.indexOf(moi) !== -1;
    if (!estPorteur && equipe.indexOf(moi) === -1) return '';
    if (etat.pasMoi !== p.id) {
      return '<p class="fr-text--sm sp-pas-moi">Vous figurez dans ce projet (' + esc(monRole(p)) + '). Ce n\'est pas vous ? ' +
        '<button type="button" class="fr-link fr-text--sm" data-action="pas-moi" data-id="' + p.id + '">Ce n\'est pas moi</button></p>';
    }
    var seul = estPorteur && porteurs.length === 1;
    var texte = estPorteur && !seul
      ? 'Vous serez retiré(e) des porteurs et de l\'équipe. Un message sera laissé au journal du projet.'
      : 'Un message sera laissé au journal pour que ' + (seul ? 'l\'administrateur' : 'un porteur') + ' vous retire du projet.';
    return '<div class="fr-alert fr-alert--warning sp-alerte"><h3 class="fr-alert__title">Vous n\'êtes pas concerné(e) par ce projet ?</h3>' +
      '<p>' + texte + '</p><ul class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--sm fr-mt-1w">' +
      '<li><button class="fr-btn fr-btn--sm" data-action="confirmer-pas-moi" data-id="' + p.id + '">Confirmer</button></li>' +
      '<li><button class="fr-btn fr-btn--sm fr-btn--tertiary" data-action="annuler-pas-moi">Annuler</button></li></ul></div>';
  }

  function pasMoi(id) {
    var p = idx.Projets[id];
    var moi = etat.moi.profil;
    if (!p || !moi) return;
    var nom = nomPersonne(moi);
    var porteurs = liste(p.Porteurs).map(num);
    var retrait = porteurs.indexOf(moi) !== -1 && porteurs.length > 1;
    var message = retrait
      ? nom + ' s\'est retiré(e) du projet : désigné(e) par erreur.'
      : nom + ' signale avoir été désigné(e) par erreur dans ce projet. Merci de le/la retirer de la fiche.';
    etat.pasMoi = null;
    etat.alerte = null;
    // Le message d'abord : une fois retirée, la personne n'a plus le droit d'écrire au journal.
    ecrire([['AddRecord', 'Journal', null, { Projet: id, Type: 'Information', Message: message }]])
      .then(function () {
        if (!retrait) return null;
        var sans = function (ids) { return versListe(liste(ids).map(num).filter(function (x) { return x !== moi; })); };
        return ecrire([['UpdateRecord', 'Projets', id, { Porteurs: sans(p.Porteurs), Equipe: sans(p.Equipe) }]]);
      })
      .then(function () { return DEMO ? null : charger(); })
      .then(function () {
        etat.alerte = { type: 'success', texte: retrait ? 'Vous avez été retiré(e) du projet.' :
          'Votre signalement est inscrit au journal du projet.' + (contactAdmin() ? ' Vous pouvez aussi écrire à ' + contactAdmin() + '.' : '') };
        if (!idx.Projets[id]) location.hash = '#/'; else rendre();
      })
      .catch(function (err) { etat.alerte = { type: 'error', texte: messageErreur(err) }; rendre(); });
  }

  function optionsPersonnes(valeur, projet) {
    // Les membres du projet d'abord, puis le reste de l'annuaire.
    var membres = liste(projet.Porteurs).concat(liste(projet.Equipe)).map(num);
    var tri = personnesTriees();
    var dedans = tri.filter(function (x) { return membres.indexOf(x.id) !== -1; });
    var dehors = tri.filter(function (x) { return membres.indexOf(x.id) === -1; });
    return dedans.concat(dehors).map(function (x) { return { v: x.id, t: x.Nom }; });
  }

  function brouillon(cle) { return (etat.brouillons[cle] = etat.brouillons[cle] || {}); }

  function boutonSuppression(table, id) {
    var cle = table + ':' + id;
    if (etat.suppression === cle) {
      return '<span class="sp-actions-ligne">' +
        '<button class="fr-btn fr-btn--sm fr-btn--secondary" data-action="supprimer" data-table="' + table + '" data-id="' + id + '">Confirmer la suppression</button>' +
        '<button class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline" data-action="annuler-suppression">Annuler</button></span>';
    }
    return '<button class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-delete-line" title="Supprimer" ' +
      'data-action="demander-suppression" data-table="' + table + '" data-id="' + id + '">Supprimer</button>';
  }

  // --- Plan d'action : arborescence, jalons, dépendances ----------------------

  function actionFinie(a) { return ETATS_ACTION.slice(-2).indexOf(a.Etat) !== -1; }
  function estJalon(a) { return a.Type === 'Jalon'; }
  function dateJalon(a) { return a.Fin || a.Debut || null; }
  function dependances(a) {
    return liste(a.Depend_de).map(num).map(function (i) { return idx.Actions[i]; }).filter(Boolean);
  }
  function bloqueePar(a) {
    if (actionFinie(a)) return [];
    return dependances(a).filter(function (d) { return !actionFinie(d); });
  }
  function actionEnRetard(a) {
    var f = estJalon(a) ? dateJalon(a) : a.Fin;
    return !actionFinie(a) && !!f && f < aujourdhuiSec();
  }
  function sousActions(id) { return (data.Actions || []).filter(function (a) { return num(a.Parent) === id; }); }
  function descendantsAction(id, vus) {
    vus = vus || {};
    var r = [];
    sousActions(id).forEach(function (a) {
      if (vus[a.id]) return;
      vus[a.id] = true;
      r.push(a.id);
      r = r.concat(descendantsAction(a.id, vus));
    });
    return r;
  }
  // Actions qui attendent (directement ou en chaîne) celle-ci : elles ne peuvent pas devenir ses prérequis.
  function attendentAction(id) {
    var r = [], file = [id];
    while (file.length) {
      var x = file.shift();
      (data.Actions || []).forEach(function (a) {
        if (liste(a.Depend_de).map(num).indexOf(x) !== -1 && r.indexOf(a.id) === -1 && a.id !== id) { r.push(a.id); file.push(a.id); }
      });
    }
    return r;
  }
  function cleTriAction(a) { return a.Debut || a.Fin || 9e12; }
  // Ordre d'affichage : chaque action suivie de ses sous-actions, à tout niveau.
  function arbreActions(acts) {
    var ids = acts.map(function (a) { return a.id; });
    var parParent = {};
    acts.forEach(function (a) {
      var k = ids.indexOf(num(a.Parent)) !== -1 ? num(a.Parent) : 0;
      (parParent[k] = parParent[k] || []).push(a);
    });
    var sortie = [], vus = {};
    (function parcourir(k, niveau) {
      (parParent[k] || []).slice().sort(function (a, b) { return (cleTriAction(a) - cleTriAction(b)) || (a.id - b.id); })
        .forEach(function (a) {
          if (vus[a.id]) return;
          vus[a.id] = true;
          sortie.push({ a: a, niveau: niveau });
          parcourir(a.id, niveau + 1);
        });
    })(0, 0);
    acts.forEach(function (a) { if (!vus[a.id]) sortie.push({ a: a, niveau: 0 }); });
    return sortie;
  }
  function progresSousActions(a) {
    var s = sousActions(a.id).filter(function (x) { return x.Etat !== 'Abandonné'; });
    if (!s.length) return null;
    return { faites: s.filter(function (x) { return x.Etat === 'Fait'; }).length, total: s.length };
  }
  function badgesAction(a) {
    var b = [];
    if (estJalon(a)) b.push(badge('Jalon', 'purple-glycine', true));
    var bl = bloqueePar(a);
    if (bl.length) b.push(badge('En attente de : ' + bl.map(function (d) { return d.Intitule || 'sans titre'; }).join(', '), 'warning', true));
    if (actionEnRetard(a)) b.push(badge('En retard', 'error', true));
    var pr = progresSousActions(a);
    if (pr) b.push(badge(pr.faites + '/' + pr.total + ' sous-action' + (pr.total > 1 ? 's' : '') + ' faite' + (pr.faites > 1 ? 's' : ''), pr.faites === pr.total ? 'success' : 'info', true));
    return b.length ? '<span class="sp-badges-ligne">' + b.join(' ') + '</span>' : '';
  }
  function datesAction(a) { return estJalon(a) ? dateTexte(dateJalon(a)) : periodeTexte(a.Debut, a.Fin); }
  // Colonnes présentes dans le document (un document pas encore mis à jour n'a pas les nouvelles).
  function aColonne(table, col) {
    if (DEMO || !meta.lu) return true;
    var t = (meta.tables || []).filter(function (x) { return x.tableId === table; })[0];
    return !!t && (meta.colonnes || []).some(function (c) { return c.parentId === t.id && c.colId === col; });
  }
  function seulementColonnes(table, champs) {
    Object.keys(champs).forEach(function (k) { if (!aColonne(table, k)) delete champs[k]; });
    return champs;
  }
  function champDate(id, libelle, valeur, attrs) {
    return '<div class="fr-input-group"><label class="fr-label" for="' + id + '">' + esc(libelle) + '</label>' +
      '<input class="fr-input" type="date" id="' + id + '" value="' + esc(valeur || '') + '" ' + (attrs || '') + '></div>';
  }
  function optionsActions(lignes) {
    return lignes.map(function (x) { return { v: x.a.id, t: new Array(x.niveau + 1).join('— ') + (x.a.Intitule || 'Sans titre') }; });
  }
  var TYPES_ACTION = [{ v: 'Action', t: 'Action' }, { v: 'Jalon', t: 'Jalon (une date clé)' }];

  function ongletPlan(p, acts) {
    var cle = 'action-' + p.id, b = brouillon(cle);
    var jalon = b.Type === 'Jalon';
    var parents = arbreActions(acts).filter(function (x) { return !estJalon(x.a); });
    var attrs = function (c) { return 'data-brouillon="' + cle + '" data-champ="' + c + '"'; };
    var html = '<form class="sp-ajout sp-ajout--plan" data-form="action" data-projet="' + p.id + '" id="sp-ajout-action">' +
      '<div class="fr-input-group sp-ajout__titre"><label class="fr-label" for="a-intitule">' +
      (num(b.Parent) ? 'Nouvelle sous-action de « ' + esc((idx.Actions[num(b.Parent)] || {}).Intitule || '') + ' »' : 'Nouvelle action ou nouveau jalon') + '</label>' +
      '<input class="fr-input" id="a-intitule" ' + attrs('Intitule') + ' value="' + esc(b.Intitule || '') + '" required></div>' +
      champSelect('a-type', 'Type', b.Type || 'Action', TYPES_ACTION, attrs('Type') + ' data-rafraichir', false) +
      (parents.length ? champSelect('a-parent', 'Rattachée à', b.Parent || '', optionsActions(parents), attrs('Parent') + ' data-rafraichir', 'Aucune (action principale)') : '') +
      champSelect('a-resp', 'Responsable', b.Responsable || '', optionsPersonnes(b.Responsable, p), attrs('Responsable'), 'Non attribuée') +
      (jalon ? '' : champDate('a-debut', 'Début', b.Debut, attrs('Debut'))) +
      champDate('a-fin', jalon ? 'Date du jalon' : 'Fin', b.Fin, attrs('Fin')) +
      '<button class="fr-btn fr-icon-add-line fr-btn--icon-left" type="submit">Ajouter</button></form>';

    if (!acts.length) {
      return html + '<p class="sp-vide">Aucune action pour l\'instant. Découpez le projet en actions, puis en sous-actions, et posez des jalons pour les dates clés.</p>';
    }
    var faites = acts.filter(function (a) { return a.Etat === 'Fait'; }).length;
    var attente = acts.filter(function (a) { return bloqueePar(a).length; }).length;
    var retard = acts.filter(actionEnRetard).length;
    html += '<div class="sp-plan__entete"><p class="fr-text--sm fr-mb-0">' + acts.length + ' élément' + (acts.length > 1 ? 's' : '') + ' · ' + faites + ' fait' + (faites > 1 ? 's' : '') +
      (attente ? ' · <strong>' + attente + ' en attente</strong>' : '') + (retard ? ' · <strong>' + retard + ' en retard</strong>' : '') + '</p>' +
      selecteurMode('plan', etat.modePlan === 'calendrier' ? 'chronologie' : etat.modePlan, [['liste', 'Liste'], ['kanban', 'Kanban'], ['chronologie', 'Chronologie']], "Affichage du plan d'action") + '</div>';
    if (etat.retro && idx.Actions[etat.retro] && num(idx.Actions[etat.retro].Projet) === p.id) html += panneauRetro();
    if (etat.modePlan === 'kanban') return html + kanbanActions(acts);
    if (etat.modePlan === 'chronologie' || etat.modePlan === 'calendrier') return html + chronologieActions(acts);
    return html + listeActions(p, acts);
  }

  function listeActions(p, acts) {
    var html = '<div class="sp-defile"><table class="sp-table sp-plan"><thead><tr><th scope="col">Action</th><th scope="col">Responsable</th>' +
      '<th scope="col">Dates</th><th scope="col">État</th><th scope="col"><span class="fr-sr-only">Gérer</span></th></tr></thead><tbody>';
    arbreActions(acts).forEach(function (x) {
      var a = x.a;
      html += '<tr class="' + (actionFinie(a) ? 'sp-table--fait' : '') + (estJalon(a) ? ' sp-plan__ligne-jalon' : '') + '">' +
        '<td><div class="sp-plan__titre" style="--sp-niveau:' + x.niveau + '">' +
        (estJalon(a) ? '<span class="sp-losange" aria-hidden="true"></span>' : (x.niveau ? '<span class="sp-plan__branche" aria-hidden="true">↳</span>' : '')) +
        '<span><span class="sp-plan__intitule">' + esc(a.Intitule || 'Sans titre') + '</span>' + badgesAction(a) +
        (a.Notes ? '<span class="sp-plan__notes">' + esc(resumeCourt(a.Notes)) + '</span>' : '') + '</span></div></td>' +
        '<td>' + esc(nomPersonne(a.Responsable)) + '</td><td class="sp-plan__dates">' + esc(datesAction(a)) + '</td>' +
        '<td><label class="fr-sr-only" for="e-' + a.id + '">État de « ' + esc(a.Intitule) + ' »</label>' +
        '<select class="fr-select sp-plan__etat" id="e-' + a.id + '" data-etat-action="' + a.id + '">' +
        ETATS_ACTION.map(function (e) { return '<option' + ((a.Etat || ETATS_ACTION[0]) === e ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></td>' +
        '<td><span class="sp-actions-ligne">' +
        '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-edit-line" title="Modifier « ' + esc(a.Intitule) + ' »" data-action="editer-action" data-id="' + a.id + '"' + (etat.editionAction === a.id ? ' aria-expanded="true"' : '') + '>Modifier</button>' +
        (dependances(a).length ? '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-calendar-line" title="Rétroplanning depuis « ' + esc(a.Intitule) + ' »" data-action="retro" data-id="' + a.id + '">Rétroplanning</button>' : '') +
        (estJalon(a) ? '' : '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-add-line" title="Ajouter une sous-action à « ' + esc(a.Intitule) + ' »" data-action="sous-action" data-id="' + a.id + '" data-projet="' + p.id + '">Ajouter une sous-action</button>') +
        boutonSuppression('Actions', a.id) + '</span></td></tr>';
      if (etat.editionAction === a.id) html += '<tr class="sp-plan__edition"><td colspan="5">' + formulaireAction(p, a, acts) + '</td></tr>';
    });
    return html + '</tbody></table></div>';
  }

  function formulaireAction(p, a, acts) {
    var cle = 'edit-' + a.id;
    var b = etat.brouillons[cle] || (etat.brouillons[cle] = {
      Intitule: a.Intitule || '', Type: a.Type || 'Action', Parent: num(a.Parent) || '', Responsable: num(a.Responsable) || '',
      Debut: dateVersSaisie(a.Debut), Fin: dateVersSaisie(a.Fin), Etat: a.Etat || ETATS_ACTION[0], Notes: a.Notes || '',
      Depend_de: liste(a.Depend_de).map(num)
    });
    var exclus = [a.id].concat(descendantsAction(a.id));
    var autres = acts.filter(function (x) { return exclus.indexOf(x.id) === -1; });
    var nonPrerequis = attendentAction(a.id);
    var prerequis = arbreActions(autres).filter(function (x) { return nonPrerequis.indexOf(x.a.id) === -1; });
    var attrs = function (c) { return 'data-brouillon="' + cle + '" data-champ="' + c + '"'; };
    var jalon = b.Type === 'Jalon';
    var h = '<form class="sp-edition" data-form="edit-action" data-id="' + a.id + '" data-projet="' + p.id + '">' +
      '<h4 class="fr-h6 fr-mb-2w">Modifier « ' + esc(a.Intitule || 'Sans titre') + ' »</h4><div class="sp-edition__grille">' +
      '<div class="fr-input-group sp-edition__large"><label class="fr-label" for="ed-int-' + a.id + '">Intitulé</label>' +
      '<input class="fr-input" id="ed-int-' + a.id + '" ' + attrs('Intitule') + ' value="' + esc(b.Intitule) + '" required></div>' +
      champSelect('ed-type-' + a.id, 'Type', b.Type, TYPES_ACTION, attrs('Type') + ' data-rafraichir', false) +
      champSelect('ed-par-' + a.id, 'Rattachée à', b.Parent, optionsActions(arbreActions(autres).filter(function (x) { return !estJalon(x.a); })), attrs('Parent'), 'Aucune (action principale)') +
      champSelect('ed-resp-' + a.id, 'Responsable', b.Responsable, optionsPersonnes(b.Responsable, p), attrs('Responsable'), 'Non attribuée') +
      champSelect('ed-etat-' + a.id, 'État', b.Etat, ETATS_ACTION, attrs('Etat'), false) +
      (jalon ? '' : champDate('ed-deb-' + a.id, 'Début', b.Debut, attrs('Debut') + ' data-rafraichir')) +
      champDate('ed-fin-' + a.id, jalon ? 'Date du jalon' : 'Fin', b.Fin, attrs('Fin') + ' data-rafraichir') + blocDecalage(a, b, cle) + '</div>';
    if (prerequis.length) {
      h += '<fieldset class="fr-fieldset sp-edition__deps" id="ed-deps-' + a.id + '" aria-labelledby="ed-deps-leg-' + a.id + '">' +
        '<legend class="fr-fieldset__legend fr-text--regular" id="ed-deps-leg-' + a.id + '">Dépend de' +
        '<span class="fr-hint-text">Cochez ce qui doit être fait avant. Tant que ce n\'est pas fait, l\'action est signalée « en attente ».</span></legend>' +
        prerequis.map(function (x) {
          var id = 'ed-dep-' + a.id + '-' + x.a.id;
          return '<div class="fr-fieldset__element"><div class="fr-checkbox-group fr-checkbox-group--sm">' +
            '<input type="checkbox" id="' + id + '" data-dep="' + cle + '" value="' + x.a.id + '"' + (b.Depend_de.indexOf(x.a.id) !== -1 ? ' checked' : '') + '>' +
            '<label class="fr-label" for="' + id + '">' + esc(new Array(x.niveau + 1).join('— ') + (x.a.Intitule || 'Sans titre')) + (estJalon(x.a) ? ' (jalon)' : '') + '</label></div></div>';
        }).join('') + '</fieldset>';
    }
    h += '<div class="fr-input-group"><label class="fr-label" for="ed-notes-' + a.id + '">Notes<span class="fr-hint-text">Précisions, liens, critères de réussite…</span></label>' +
      '<textarea class="fr-input" rows="3" id="ed-notes-' + a.id + '" ' + attrs('Notes') + '>' + esc(b.Notes) + '</textarea></div>' +
      '<ul class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--sm"><li><button class="fr-btn" type="submit">Enregistrer</button></li>' +
      '<li><button type="button" class="fr-btn fr-btn--secondary" data-action="annuler-edition">Annuler</button></li></ul></form>';
    return h;
  }

  function enregistrerAction(aid) {
    var b = etat.brouillons['edit-' + aid] || {};
    if (!String(b.Intitule || '').trim()) {
      etat.alerte = { type: 'error', texte: 'Donnez un intitulé à l\'action.' };
      rendre();
      return;
    }
    var jalon = b.Type === 'Jalon';
    var deps = (b.Depend_de || []).filter(function (x) { return x !== aid; });
    var champs = seulementColonnes('Actions', {
      Intitule: String(b.Intitule).trim(), Type: b.Type || 'Action', Parent: num(b.Parent), Responsable: num(b.Responsable),
      Debut: jalon ? null : saisieVersDate(b.Debut), Fin: saisieVersDate(b.Fin), Etat: b.Etat || ETATS_ACTION[0],
      Notes: b.Notes || '', Depend_de: deps.length ? versListe(deps) : null
    });
    var a0 = idx.Actions[aid] || {};
    var ecart = b.Decaler === false ? 0 : ecartEdition(a0, b);
    var suite = ecart ? actionsDecalage(aid, ecart) : [];
    var nb = suite.length ? suite[0][2].length : 0;
    executer([['UpdateRecord', 'Actions', aid, champs]].concat(suite),
      nb ? 'Action enregistrée. ' + nb + ' action' + (nb > 1 ? 's' : '') + ' qui sui' + (nb > 1 ? 'vent' : 't') + ' ' + (nb > 1 ? 'ont' : 'a') + ' été ' + (ecart > 0 ? 'repoussée' : 'avancée') + (nb > 1 ? 's' : '') + ' de ' + joursTexte(ecart) + '.' : 'Action enregistrée.', function () {
      delete etat.brouillons['edit-' + aid];
      etat.editionAction = null;
    });
  }

  // Supprimer une action : ses sous-actions remontent d'un niveau, les dépendances vers elle sont retirées.
  function actionsSuppressionAction(id) {
    var a = idx.Actions[id];
    var res = [];
    if (a && aColonne('Actions', 'Parent')) {
      sousActions(id).forEach(function (s) { res.push(['UpdateRecord', 'Actions', s.id, { Parent: num(a.Parent) }]); });
    }
    if (aColonne('Actions', 'Depend_de')) {
      (data.Actions || []).forEach(function (x) {
        var d = liste(x.Depend_de).map(num);
        if (d.indexOf(id) !== -1) {
          var reste = d.filter(function (y) { return y !== id; });
          res.push(['UpdateRecord', 'Actions', x.id, { Depend_de: reste.length ? versListe(reste) : null }]);
        }
      });
    }
    res.push(['RemoveRecord', 'Actions', id]);
    return res;
  }

  // --- Décalage en chaîne et rétroplanning -----------------------------------

  var JOUR = 86400;
  function dependantsDirects(id) {
    return (data.Actions || []).filter(function (a) { return liste(a.Depend_de).map(num).indexOf(id) !== -1; });
  }
  // Ce qui suit une action : ses sous-actions et les actions qui l'attendent, en chaîne. Les actions finies ne bougent pas.
  function suiteAction(id) {
    var vus = {}, file = [id], r = [];
    vus[id] = true;
    while (file.length) {
      var x = file.shift();
      sousActions(x).concat(dependantsDirects(x)).forEach(function (a) {
        if (vus[a.id]) return;
        vus[a.id] = true;
        file.push(a.id);
        if (!actionFinie(a) && (a.Debut || a.Fin)) r.push(a);
      });
    }
    return r;
  }
  function ecartEdition(a, b) {
    var nf = saisieVersDate(b.Fin), nd = saisieVersDate(b.Debut);
    if (a.Fin && nf && nf !== a.Fin) return Math.round((nf - a.Fin) / JOUR);
    if (a.Debut && nd && nd !== a.Debut) return Math.round((nd - a.Debut) / JOUR);
    return 0;
  }
  function joursTexte(n) { var v = Math.abs(n); return v + ' jour' + (v > 1 ? 's' : ''); }
  function blocDecalage(a, b, cle) {
    var ecart = ecartEdition(a, b);
    if (!ecart) return '';
    var suite = suiteAction(a.id);
    if (!suite.length) return '';
    var noms = suite.slice(0, 5).map(function (x) { return x.Intitule || 'Sans titre'; }).join(', ') + (suite.length > 5 ? '…' : '');
    return '<div class="fr-checkbox-group sp-edition__large sp-decalage"><input type="checkbox" id="ed-dec-' + a.id + '" data-decaler="' + cle + '"' + (b.Decaler === false ? '' : ' checked') + '>' +
      '<label class="fr-label" for="ed-dec-' + a.id + '">' + (ecart > 0 ? 'Repousser' : 'Avancer') + ' aussi de ' + joursTexte(ecart) + ' ce qui suit (' + suite.length + ' action' + (suite.length > 1 ? 's' : '') + ')' +
      '<span class="fr-hint-text">' + esc(noms) + '. Les actions faites ou abandonnées ne bougent pas.</span></label></div>';
  }
  function actionsDecalage(aid, ecart) {
    var suite = suiteAction(aid);
    if (!ecart || !suite.length) return [];
    return [['BulkUpdateRecord', 'Actions', suite.map(function (x) { return x.id; }), {
      Debut: suite.map(function (x) { return x.Debut ? x.Debut + ecart * JOUR : null; }),
      Fin: suite.map(function (x) { return x.Fin ? x.Fin + ecart * JOUR : null; })
    }]];
  }

  // Rétroplanning : à partir d'une échéance (un jalon ou une action datée), dates au plus tard de tout ce qui y mène.
  function calculRetro(cibleId) {
    var cible = idx.Actions[cibleId];
    if (!cible) return null;
    var t = estJalon(cible) ? dateJalon(cible) : (cible.Debut || cible.Fin);
    if (!t) return { cible: cible, lignes: [], sansDate: true };
    var ens = {}, file = [cibleId];
    while (file.length) {
      var x = file.shift();
      dependances(idx.Actions[x]).concat(x !== cibleId ? sousActions(x) : []).forEach(function (d) {
        if (!ens[d.id] && d.id !== cibleId) { ens[d.id] = d; file.push(d.id); }
      });
    }
    var duree = function (a) { return a.Debut && a.Fin && !estJalon(a) ? a.Fin - a.Debut : 0; };
    var memo = {};
    function finAuPlusTard(id, pile) {
      if (memo[id] !== undefined) return memo[id];
      var bornes = [];
      dependantsDirects(id).forEach(function (d) {
        if (d.id === cibleId) bornes.push(t);
        else if (ens[d.id] && !pile[d.id]) {
          var p2 = Object.assign({}, pile); p2[d.id] = 1;
          var lfd = finAuPlusTard(d.id, p2);
          // Un jalon intermédiaire garde sa date : il borne ce qui le précède.
          bornes.push(estJalon(d) && dateJalon(d) ? Math.min(lfd, dateJalon(d)) : lfd - duree(d));
        }
      });
      // Une sous-action se termine au plus tard avec son action parente.
      var par = num(ens[id].Parent);
      if (ens[par] && !pile[par]) { var p3 = Object.assign({}, pile); p3[par] = 1; bornes.push(finAuPlusTard(par, p3)); }
      memo[id] = bornes.length ? Math.min.apply(null, bornes) : t;
      return memo[id];
    }
    var lignes = Object.keys(ens).map(num).map(function (id) {
      var a = ens[id], f = finAuPlusTard(id, {}), d = duree(a);
      return { a: a, fin: f, debut: a.Debut && a.Fin && !estJalon(a) ? f - d : null,
        ecart: (estJalon(a) ? dateJalon(a) : a.Fin) ? Math.round((f - (estJalon(a) ? dateJalon(a) : a.Fin)) / JOUR) : null };
    }).sort(function (u, v) { return (u.fin - v.fin) || (u.a.id - v.a.id); });
    return { cible: cible, date: t, lignes: lignes };
  }
  function panneauRetro() {
    var r = calculRetro(etat.retro);
    if (!r) return '';
    var titre = '<h3 class="fr-h6 fr-mb-1w">Rétroplanning depuis « ' + esc(r.cible.Intitule || 'Sans titre') + ' »' + (r.date ? ' (' + esc(dateTexte(r.date)) + ')' : '') + '</h3>';
    var fermer = '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary" data-action="fermer-retro">Fermer</button>';
    if (r.sansDate) return '<section class="sp-retro">' + titre + '<p class="fr-text--sm">Donnez d\'abord une date à cette échéance.</p>' + fermer + '</section>';
    if (!r.lignes.length) {
      return '<section class="sp-retro">' + titre + '<p class="fr-text--sm">Cette échéance ne dépend d\'aucune action. Ouvrez « Modifier », puis cochez dans « Dépend de » ce qui doit être fait avant.</p>' + fermer + '</section>';
    }
    var aChanger = r.lignes.filter(function (l) { return !actionFinie(l.a) && !estJalon(l.a) && (l.fin !== (estJalon(l.a) ? dateJalon(l.a) : l.a.Fin) || (l.debut && l.debut !== l.a.Debut)); }).length;
    var tard = r.lignes.filter(function (l) { return !actionFinie(l.a) && l.ecart !== null && l.ecart < 0; }).length;
    var h = '<section class="sp-retro">' + titre +
      '<p class="fr-text--sm">Dates au plus tard pour tenir l\'échéance, en remontant les dépendances et les sous-actions, en gardant la durée de chaque action (jours calendaires). Les jalons intermédiaires gardent leur date. ' +
      (tard ? '<strong>' + tard + ' action' + (tard > 1 ? 's' : '') + ' finissent trop tard.</strong>' : 'Le planning actuel tient l\'échéance.') + '</p>' +
      '<div class="sp-defile"><table class="sp-table"><thead><tr><th scope="col">Action</th><th scope="col">Dates actuelles</th><th scope="col">Au plus tard</th><th scope="col">Écart</th></tr></thead><tbody>';
    r.lignes.forEach(function (l) {
      var a = l.a, ecart = '';
      if (actionFinie(a)) ecart = badge(a.Etat, 'success', true);
      else if (l.ecart === null) ecart = badge('Sans date', 'info', true);
      else if (l.ecart < 0) ecart = badge('Trop tard de ' + joursTexte(l.ecart), 'error', true);
      else if (l.ecart > 0) ecart = badge('Marge de ' + joursTexte(l.ecart), 'success', true);
      else ecart = badge('Juste à temps', 'warning', true);
      h += '<tr><td>' + (estJalon(a) ? '<span class="sp-losange" aria-hidden="true"></span>' : '') + esc(a.Intitule || 'Sans titre') + '</td>' +
        '<td>' + esc(datesAction(a) || '—') + '</td><td>' + esc(l.debut ? periodeTexte(l.debut, l.fin) : dateTexte(l.fin)) + '</td><td>' + ecart + '</td></tr>';
    });
    return h + '</tbody></table></div><ul class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--sm fr-mt-2w">' +
      (aChanger ? '<li><button type="button" class="fr-btn" data-action="appliquer-retro">Caler les ' + aChanger + ' action' + (aChanger > 1 ? 's' : '') + ' au plus tard</button></li>' : '') +
      '<li>' + fermer + '</li></ul></section>';
  }
  function appliquerRetro() {
    var r = calculRetro(etat.retro);
    if (!r || !r.lignes.length) return;
    var l = r.lignes.filter(function (x) { return !actionFinie(x.a) && !estJalon(x.a); });
    executer([['BulkUpdateRecord', 'Actions', l.map(function (x) { return x.a.id; }), {
      Debut: l.map(function (x) { return estJalon(x.a) ? null : (x.debut || x.a.Debut || null); }),
      Fin: l.map(function (x) { return x.fin; })
    }]], 'Rétroplanning appliqué : ' + l.length + ' action' + (l.length > 1 ? 's' : '') + ' calée' + (l.length > 1 ? 's' : '') + ' au plus tard.', function () { etat.retro = null; });
  }

  function kanbanActions(acts) {
    var cartes = acts.map(function (a) { return Object.assign({ _colonne: a.Etat || ETATS_ACTION[0] }, a); });
    return kanban(ETATS_ACTION, cartes, 'Actions', 'Etat', function (a) {
      var parent = idx.Actions[num(a.Parent)];
      var meta = [nomPersonne(a.Responsable), datesAction(a)].filter(Boolean).join(' · ');
      return (parent ? '<p class="sp-ticket__parent">↳ ' + esc(parent.Intitule) + '</p>' : '') +
        '<p class="sp-ticket__titre">' + (estJalon(a) ? '<span class="sp-losange" aria-hidden="true"></span>' : '') + esc(a.Intitule) + '</p>' +
        (meta ? '<p class="sp-ticket__meta">' + esc(meta) + '</p>' : '') + badgesAction(a);
    });
  }

  function chronologieActions(acts) {
    return gantt(arbreActions(acts).map(function (x) {
      var a = x.a, deps = dependances(a);
      return {
        libelle: a.Intitule || 'Sans titre', niveau: x.niveau, jalon: estJalon(a),
        meta: [nomPersonne(a.Responsable), deps.length ? 'après : ' + deps.map(function (d) { return d.Intitule; }).join(', ') : ''].filter(Boolean).join(' · '),
        debut: estJalon(a) ? null : a.Debut, fin: estJalon(a) ? dateJalon(a) : a.Fin,
        classe: 'sp-barre--' + (bloqueePar(a).length ? 'attente' : classeEtat(a.Etat || ETATS_ACTION[0]))
      };
    }), "Chronologie du plan d'action", true);
  }

  function ongletJournal(p, jour) {
    var b = brouillon('journal-' + p.id);
    var html = '<form class="sp-ajout sp-ajout--large" data-form="journal" data-projet="' + p.id + '">' +
      champSelect('j-type', 'Type', b.Type || 'Avancement', TYPES_JOURNAL, 'data-brouillon="journal-' + p.id + '" data-champ="Type"', false) +
      '<div class="fr-input-group"><label class="fr-label" for="j-message">Où en est le projet ?' +
      '<span class="fr-hint-text">Quelques lignes suffisent : ce qui avance, ce qui bloque, ce qui a été décidé.</span></label>' +
      '<textarea class="fr-input" id="j-message" rows="3" data-brouillon="journal-' + p.id + '" data-champ="Message" required>' + esc(b.Message || '') + '</textarea></div>' +
      '<div><button class="fr-btn fr-icon-send-plane-line fr-btn--icon-left" type="submit">Publier dans le journal</button></div></form>';

    if (!jour.length) return html + '<p class="sp-vide">Le journal est vide.</p>';

    jour = jour.slice().sort(function (a, c) { return (c.Cree_le || 0) - (a.Cree_le || 0); });
    html += '<ol class="sp-journal">' + jour.map(function (j) {
      return '<li><p class="sp-journal__meta">' + badge(j.Type, COULEUR_JOURNAL[j.Type]) + ' ' +
        esc(dateHeureTexte(j.Cree_le)) + (j.Auteur ? ' · ' + esc(j.Auteur) : '') + '</p>' +
        '<p class="sp-texte fr-mb-1v">' + esc(j.Message) + '</p>' + boutonSuppression('Journal', j.id) + '</li>';
    }).join('') + '</ol>';
    return html;
  }

  function ongletDocuments(p, docs) {
    var b = brouillon('document-' + p.id);
    var html = '<form class="sp-ajout" data-form="document" data-projet="' + p.id + '">' +
      '<div class="fr-input-group"><label class="fr-label" for="d-titre">Titre du document</label>' +
      '<input class="fr-input" id="d-titre" data-brouillon="document-' + p.id + '" data-champ="Titre" value="' + esc(b.Titre || '') + '" required></div>' +
      champSelect('d-type', 'Type', b.Type || '', TYPES_DOCUMENT, 'data-brouillon="document-' + p.id + '" data-champ="Type"', 'Choisir') +
      '<div class="fr-input-group"><label class="fr-label" for="d-lien">Lien<span class="fr-hint-text">Adresse Nextcloud, Docs… commençant par https://</span></label>' +
      '<input class="fr-input" type="url" id="d-lien" data-brouillon="document-' + p.id + '" data-champ="Lien" value="' + esc(b.Lien || '') + '" required></div>' +
      '<button class="fr-btn fr-icon-add-line fr-btn--icon-left" type="submit">Ajouter</button></form>';

    if (!docs.length) return html + '<p class="sp-vide">Aucun document lié.</p>';

    html += '<div class="sp-defile"><table class="sp-table"><thead><tr><th>Document</th><th>Type</th><th><span class="fr-sr-only">Supprimer</span></th></tr></thead><tbody>';
    docs.forEach(function (d) {
      var titre = esc(d.Titre || d.Lien);
      var lien = lienSur(d.Lien)
        ? '<a class="fr-link" href="' + esc(d.Lien) + '" target="_blank" rel="noopener noreferrer">' + titre + '</a>'
        : titre;
      html += '<tr><td>' + lien + '</td><td>' + esc(d.Type) + '</td><td>' + boutonSuppression('Documents', d.id) + '</td></tr>';
    });
    return html + '</tbody></table></div>';
  }

  // --- Composants partagés : navigation, sélecteur de mode, kanban, calendrier --

  function navigation(active) {
    if (PUBLIC) return '';
    var liens = [['banque', '#/', 'Banque des projets']];
    if (etat.moi.profil) liens.push(['travail', '#/travail', 'Mon travail']);
    liens.push(['pilotage', '#/pilotage', "Vue d'ensemble"]);
    if (etat.moi.email && !etat.moi.lecture) {
      liens.push(['profil', '#/profil', etat.moi.profil ? 'Mon profil : ' + nomPersonne(etat.moi.profil) : 'Mon profil']);
    }
    return '<nav class="sp-nav" aria-label="Vues du suivi"><ul>' + liens.map(function (l) {
      return '<li' + (l[0] === 'profil' ? ' class="sp-nav__profil"' : '') + '><a href="' + l[1] + '"' +
        (l[0] === active ? ' aria-current="page"' : '') + '>' + esc(l[2]) + '</a></li>';
    }).join('') + '</ul></nav>' + (active === 'profil' ? '' : blocProfilManquant()) + (active === 'banque' ? blocAttributions() : '');
  }

  // Projets où la personne connectée a été désignée et qu'on ne lui a pas encore signalés.
  function cleVus() { return 'sp-vus:' + etat.moi.email; }
  function projetsVus() {
    if (etat.vus) return etat.vus;
    var v = [];
    try { v = JSON.parse(localStorage.getItem(cleVus()) || '[]'); } catch (e) { v = []; }
    etat.vus = Array.isArray(v) ? v : [];
    return etat.vus;
  }
  function mesProjets() {
    var moi = etat.moi.profil;
    if (!moi) return [];
    return data.Projets.filter(function (p) {
      return !p.Archive && (liste(p.Porteurs).map(num).indexOf(moi) !== -1 || liste(p.Equipe).map(num).indexOf(moi) !== -1); });
  }
  function blocAttributions() {
    if (!etat.moi.profil) return '';
    var vus = projetsVus();
    var nouveaux = mesProjets().filter(function (p) { return vus.indexOf(p.id) === -1; });
    if (!nouveaux.length) return '';
    return '<div class="fr-alert fr-alert--info sp-alerte"><h2 class="fr-alert__title">Vous avez été désigné(e) dans ' +
      (nouveaux.length > 1 ? nouveaux.length + ' projets' : 'un projet') + '</h2><ul>' +
      nouveaux.map(function (p) { return '<li><a href="#/projet/' + p.id + '">' + esc(p.Titre || 'Projet sans titre') + '</a> – ' + esc(monRole(p)) + '</li>'; }).join('') +
      '</ul><p>Si ce n\'est pas vous, ouvrez le projet et cliquez sur « Ce n\'est pas moi ».</p>' +
      '<button class="fr-btn fr-btn--sm fr-btn--secondary fr-mt-1w" data-action="vu-attributions">Compris</button></div>';
  }
  function marquerVu(id) {
    if (!etat.moi.email || !id) return;
    var vus = projetsVus();
    if (vus.indexOf(id) === -1) vus.push(id);
    try { localStorage.setItem(cleVus(), JSON.stringify(vus)); } catch (e) { /* stockage indisponible */ }
  }

  function monRole(p) {
    return liste(p.Porteurs).map(num).indexOf(etat.moi.profil) !== -1 ? 'porteur' : 'équipe projet';
  }

  function profilManquant() { return !!(etat.moi.email && !etat.moi.profil && !etat.moi.lecture); }

  function blocProfilManquant() {
    if (!profilManquant()) return '';
    return '<div class="fr-notice fr-notice--info sp-notice"><div class="fr-container"><div class="fr-notice__body">' +
      '<p class="fr-notice__title">Vous n\'avez pas encore de profil dans l\'annuaire. ' +
      '<a href="#/profil">Créer mon profil</a> pour être désigné porteur ou membre d\'une équipe.</p></div></div></div>';
  }

  // --- Mon profil -----------------------------------------------------------

  // --- Mon travail : actions confiées, projets suivis, activité récente -------

  function vueTravail() {
    var moi = etat.moi.profil;
    var html = navigation('travail') + blocAlerte() + '<h1 class="fr-h3">Mon travail</h1>';
    if (!moi) return html + '<p><a href="#/profil">Créez votre profil</a> pour retrouver ici les actions qui vous sont confiées.</p>';
    var fini = ETATS_ACTION.slice(-2);
    var auj = aujourdhuiSec(), semaine = auj + 7 * 86400;
    var actions = (data.Actions || []).filter(function (a) {
      var p = idx.Projets[num(a.Projet)];
      return num(a.Responsable) === moi && fini.indexOf(a.Etat) === -1 && p && !p.Archive;
    });
    var groupes = [
      ['En retard', function (a) { return a.Fin && a.Fin < auj; }, 'error'],
      ['Dans les 7 jours', function (a) { return a.Fin && a.Fin >= auj && a.Fin < semaine; }, 'warning'],
      ['Plus tard', function (a) { return a.Fin && a.Fin >= semaine; }, 'info'],
      ['Sans date de fin', function (a) { return !a.Fin; }, '']
    ];
    html += '<section class="sp-bloc"><h2 class="fr-h5">Actions qui me sont confiées (' + actions.length + ')</h2>';
    if (!actions.length) html += '<p class="sp-vide">Aucune action en cours ne vous est confiée.</p>';
    groupes.forEach(function (g) {
      var l = actions.filter(g[1]).sort(function (a, c) { return (a.Fin || 9e12) - (c.Fin || 9e12); });
      if (!l.length) return;
      html += '<h3 class="fr-h6 fr-mt-3w">' + badge(g[0] + ' (' + l.length + ')', g[2]) + '</h3>' +
        '<div class="sp-defile"><table class="sp-table"><thead><tr><th>Action</th><th>Projet</th><th>Période</th><th>État</th></tr></thead><tbody>' +
        l.map(function (a) {
          var p = idx.Projets[num(a.Projet)];
          var par = idx.Actions[num(a.Parent)];
          return '<tr><td>' + (par ? '<span class="sp-ticket__parent">↳ ' + esc(par.Intitule) + '</span> ' : '') + esc(a.Intitule) + badgesAction(a) + '</td><td><a href="#/projet/' + p.id + '">' + esc(p.Titre) + '</a></td>' +
            '<td>' + esc(periodeTexte(a.Debut, a.Fin)) + '</td>' +
            '<td><label class="fr-sr-only" for="mt-' + a.id + '">État de l\'action</label><select class="fr-select" id="mt-' + a.id + '" data-etat-action="' + a.id + '">' +
            ETATS_ACTION.map(function (e) { return '<option' + (e === (a.Etat || ETATS_ACTION[0]) ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    html += '</section>';

    var projets = mesProjets().sort(function (a, c) { return (c.Maj_le || 0) - (a.Maj_le || 0); });
    html += '<section class="sp-bloc"><h2 class="fr-h5">Mes projets (' + projets.length + ')</h2>';
    if (!projets.length) html += '<p class="sp-vide">Vous n\'êtes porteur ou membre d\'aucun projet en cours.</p>';
    else html += '<ul class="sp-liste-simple">' + projets.map(function (p) {
      var ouvertes = actionsDu(p.id).filter(function (a) { return fini.indexOf(a.Etat) === -1; }).length;
      return '<li><a href="#/projet/' + p.id + '">' + esc(p.Titre) + '</a> ' + badge(p.Phase, COULEUR_PHASE[p.Phase], true) + ' ' + badge(p.Etat, COULEUR_ETAT[p.Etat], true) +
        ' <span class="fr-text--xs">' + esc(monRole(p)) + ' · ' + ouvertes + ' action' + (ouvertes > 1 ? 's' : '') + ' ouverte' + (ouvertes > 1 ? 's' : '') + '</span></li>';
    }).join('') + '</ul>';
    html += '</section>';

    var ids = projets.map(function (p) { return p.id; });
    var recents = (data.Journal || []).filter(function (j) { return ids.indexOf(num(j.Projet)) !== -1 && (j.Cree_le || 0) > auj - 30 * 86400; })
      .sort(function (a, c) { return (c.Cree_le || 0) - (a.Cree_le || 0); }).slice(0, 15);
    html += '<section class="sp-bloc"><h2 class="fr-h5">Activité récente dans mes projets</h2>';
    if (!recents.length) html += '<p class="sp-vide">Aucun message au journal de vos projets depuis 30 jours.</p>';
    else html += '<ol class="sp-journal">' + recents.map(function (j) {
      var p = idx.Projets[num(j.Projet)];
      return '<li><p class="sp-journal__meta">' + badge(j.Type, COULEUR_JOURNAL[j.Type]) + ' ' + esc(dateHeureTexte(j.Cree_le)) +
        (j.Auteur ? ' · ' + esc(j.Auteur) : '') + ' · <a href="#/projet/' + p.id + '">' + esc(p.Titre) + '</a></p>' +
        '<p class="sp-texte fr-mb-1v">' + esc(j.Message) + '</p></li>';
    }).join('') + '</ol>';
    return html + '</section>';
  }

  function vueProfil() {
    var m = etat.moi;
    var structures = structuresTriees().map(function (s) { return { v: s.id, t: s.Chemin }; });
    var html = navigation('profil') + blocAlerte();
    if (!m.email) {
      return html + '<h1 class="fr-h3">Mon profil</h1><p>' + (m.lecture
        ? 'Vous consultez le suivi en lecture seule : vous ne pouvez pas créer de profil. Demandez un accès en écriture à un administrateur.'
        : 'Identification en cours…') + '</p>';
    }
    if (m.profil) {
      var moi = idx.Personnes[m.profil];
      var f = etat.profilForm || (etat.profilForm = { Nom: moi.Nom || '', Structure: num(moi.Structure) || '' });
      return html + '<h1 class="fr-h3">Mon profil</h1>' +
        (moi.Role === 'Administration' ? '<p>' + badge('Administration', 'purple-glycine') + ' Vous voyez et gérez tous les projets, y compris les projets restreints.</p>' : '') +
        '<p>Ce profil est lié à votre adresse <strong>' + esc(m.email) + '</strong>. Vos collègues le choisissent pour vous désigner porteur ou membre d\'une équipe : ' +
        'vous obtenez alors les droits correspondants sur le projet.</p>' +
        '<form novalidate data-form="mon-profil" class="sp-form-court">' +
        champProfil('pr-nom', 'Nom', 'Nom et prénom', 'Écrivez votre nom de famille en majuscules, par exemple : MARTIN Claire.', f.Nom) +
        champSelect('pr-structure', 'Structure de rattachement (facultatif)', f.Structure, structures, 'data-profil="Structure"', 'Choisir une structure') +
        '<button class="fr-btn" type="submit">Enregistrer</button></form>';
    }
    var g = etat.profilForm || (etat.profilForm = { Nom: '', Structure: '' });
    html += '<h1 class="fr-h3">Qui êtes-vous ?</h1>' +
      '<p>Indiquez votre nom une seule fois. Votre profil est lié à l\'adresse de votre compte Grist, <strong>' + esc(m.email) + '</strong> : ' +
      'c\'est elle qui vous donne vos droits sur les projets.</p>';
    html += '<section class="sp-bloc"><h2 class="fr-h5">Créez votre profil</h2>' +
      '<form novalidate data-form="mon-profil" class="sp-form-court">' +
      champProfil('pr-nom', 'Nom', 'Nom et prénom', 'Écrivez votre nom de famille en majuscules, par exemple : MARTIN Claire.', g.Nom) +
      champSelect('pr-structure', 'Structure de rattachement (facultatif)', g.Structure, structures, 'data-profil="Structure"', 'Choisir une structure') +
      '<ul class="fr-btns-group fr-btns-group--inline-md"><li><button class="fr-btn" type="submit">Créer mon profil</button></li>' +
      '<li><a class="fr-btn fr-btn--tertiary" href="#/">Plus tard</a></li></ul></form></section>';
    return html;
  }

  function lienContactTexte() {
    return contactAdmin() ? 'écrivez à ' + contactAdmin() : 'contactez un administrateur du suivi';
  }

  function champProfil(id, champ, libelle, aide, valeur) {
    return '<div class="fr-input-group"><label class="fr-label" for="' + id + '">' + esc(libelle) +
      '<span class="fr-hint-text">' + esc(aide) + '</span></label>' +
      '<input class="fr-input" id="' + id + '" data-profil="' + champ + '" value="' + esc(valeur) + '" autocomplete="name"></div>';
  }

  function enregistrerMonProfil() {
    var f = etat.profilForm || {};
    var nom = String(f.Nom || '').trim();
    var structure = num(f.Structure);
    if (!nom) {
      etat.alerte = { type: 'error', texte: 'Indiquez votre nom.' };
      rendre();
      return;
    }
    if (etat.moi.profil) {
      executer([['UpdateRecord', 'Personnes', etat.moi.profil, { Nom: nom, Structure: structure }]], 'Profil enregistré.', function () {
        etat.profilForm = null;
      }, REFUS_PERSONNE);
      return;
    }
    var proche = personneProche(nom);
    if (proche && etat.doublon !== cleNom(nom)) {
      etat.doublon = cleNom(nom);
      etat.alerte = { type: 'warning', texte: 'Un profil « ' + proche.Nom + ' » existe déjà' +
        (emailDe(proche) ? ' (' + emailDe(proche) + ')' : '') + '. Si c\'est vous avec une autre adresse, ' +
        lienContactTexte() + '. S\'il s\'agit d\'une autre personne, cliquez à nouveau sur « Créer mon profil ».' };
      rendre();
      return;
    }
    creerMonProfil(nom, structure);
  }

  function selecteurMode(nom, valeur, modes, legende) {
    return '<fieldset class="fr-segmented fr-segmented--sm sp-mode"><legend class="fr-segmented__legend fr-segmented__legend--inline">' +
      esc(legende) + '</legend><div class="fr-segmented__elements">' + modes.map(function (m) {
        return '<div class="fr-segmented__element"><input type="radio" name="sp-mode-' + nom + '" id="m-' + nom + '-' + m[0] +
          '" value="' + m[0] + '" data-mode="' + nom + '"' + (valeur === m[0] ? ' checked' : '') + '>' +
          '<label class="fr-label" for="m-' + nom + '-' + m[0] + '">' + esc(m[1]) + '</label></div>';
      }).join('') + '</div></fieldset>';
  }

  function classeEtat(e) {
    return ({ 'À faire': 'afaire', 'En cours': 'encours', 'Fait': 'fait', 'Abandonné': 'abandon',
      'En pause': 'pause', 'Bloqué': 'bloque', 'Terminé': 'fait' })[e] || 'afaire';
  }

  function periodeTexte(debut, fin) {
    if (debut && fin) return dateTexte(debut) + ' → ' + dateTexte(fin);
    if (fin) return "Jusqu'au " + dateTexte(fin);
    if (debut) return 'À partir du ' + dateTexte(debut);
    return '';
  }

  // Colonnes génériques : chaque carte se déplace par glisser-déposer
  // ou avec les boutons (accessibles au clavier).
  function kanban(colonnes, cartes, table, champ, rendreCarte) {
    return '<div class="sp-kanban" style="--sp-colonnes:' + colonnes.length + '">' + colonnes.map(function (col, i) {
      var items = cartes.filter(function (c) { return c._colonne === col; });
      return '<section class="sp-colonne" data-drop-table="' + table + '" data-drop-champ="' + champ + '" data-drop-valeur="' + esc(col) + '">' +
        '<h3 class="sp-colonne__titre">' + esc(col) + ' <span class="sp-colonne__nombre">' + items.length + '</span></h3>' +
        items.map(function (c) {
          var prec = i > 0 ? colonnes[i - 1] : null;
          var suiv = i < colonnes.length - 1 ? colonnes[i + 1] : null;
          return '<div class="sp-ticket" draggable="true" data-drag="' + table + ':' + c.id + '">' + rendreCarte(c) +
            '<div class="sp-ticket__boutons">' +
            (prec ? '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-arrow-left-s-line" ' +
              'title="Passer en « ' + esc(prec) + ' »" data-action="deplacer" data-table="' + table + '" data-champ="' + champ +
              '" data-id="' + c.id + '" data-valeur="' + esc(prec) + '">Vers « ' + esc(prec) + ' »</button>' : '<span></span>') +
            (suiv ? '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-arrow-right-s-line" ' +
              'title="Passer en « ' + esc(suiv) + ' »" data-action="deplacer" data-table="' + table + '" data-champ="' + champ +
              '" data-id="' + c.id + '" data-valeur="' + esc(suiv) + '">Vers « ' + esc(suiv) + ' »</button>' : '') +
            '</div></div>';
        }).join('') +
        (items.length ? '' : '<p class="sp-colonne__vide">Déposez une carte ici</p>') +
        '</section>';
    }).join('') + '</div>';
  }

  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // Calendrier (diagramme de Gantt) : items = { libelle, lien?, meta?, debut, fin, classe }
  function gantt(items, titre, garderOrdre) {
    var dates = [];
    items.forEach(function (it) { if (it.debut) dates.push(it.debut); if (it.fin) dates.push(it.fin); });
    var sansDate = items.filter(function (it) { return !it.debut && !it.fin; });
    if (!dates.length) {
      return '<p class="sp-vide">Aucune date renseignée : ajoutez un début ou une fin pour afficher le calendrier.</p>';
    }
    var aujourdHui = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 1000;
    var min = Math.min.apply(null, dates.concat([aujourdHui]));
    var max = Math.max.apply(null, dates.concat([aujourdHui]));
    var d0 = new Date(min * 1000);
    var d1 = new Date(max * 1000);
    var debut = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1) / 1000;
    var fin = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 1) / 1000;
    var duree = fin - debut;
    var pct = function (s) { return (100 * (s - debut) / duree).toFixed(3); };

    var mois = [];
    var y = d0.getUTCFullYear(), m = d0.getUTCMonth();
    while (Date.UTC(y, m, 1) / 1000 < fin) {
      mois.push({ s: Date.UTC(y, m, 1) / 1000, t: MOIS[m] + (m === 0 || !mois.length ? ' ' + y : '') });
      m++; if (m > 11) { m = 0; y++; }
    }
    var pas = mois.length > 18 ? 3 : (mois.length > 9 ? 2 : 1);
    var graduation = mois.map(function (mo, i) {
      return '<span class="sp-gantt__mois" style="left:' + pct(mo.s) + '%">' + (i % pas === 0 ? esc(mo.t) : '') + '</span>';
    }).join('');
    var repere = '<span class="sp-gantt__jour" style="left:' + pct(aujourdHui) + '%" title="Aujourd\'hui"></span>';

    var avecDate = items.filter(function (it) { return it.debut || it.fin; });
    if (!garderOrdre) avecDate.sort(function (a, b) { return (a.debut || a.fin) - (b.debut || b.fin); });
    var lignes = avecDate.map(function (it) {
      var a = it.debut || it.fin, b = it.fin || it.debut;
      if (b < a) { var t = a; a = b; b = t; }
      var jalon = it.jalon || !it.debut || !it.fin;
      var periode = it.jalon ? dateTexte(it.fin || it.debut) : periodeTexte(it.debut, it.fin);
      var forme = jalon
        ? '<span class="sp-gantt__jalon ' + (it.classe || '') + (it.jalon ? ' sp-gantt__jalon--cle' : '') + '" style="left:' + pct(a) + '%"></span>'
        : '<span class="sp-gantt__barre ' + (it.classe || '') + '" style="left:' + pct(a) + '%;width:' +
          Math.max(0.8, 100 * (b - a + 86400) / duree).toFixed(3) + '%"></span>';
      var lib = it.lien ? '<a href="' + esc(it.lien) + '">' + esc(it.libelle) + '</a>' : esc(it.libelle);
      return '<div class="sp-gantt__ligne" role="row">' +
        '<div class="sp-gantt__libelle" role="rowheader"' + (it.niveau ? ' style="--sp-niveau:' + it.niveau + '"' : '') + '>' + (it.jalon ? '<span class="sp-losange" aria-hidden="true"></span>' : '') + lib +
        '<span class="sp-gantt__meta">' + esc([it.meta, periode].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="sp-gantt__piste" role="cell" title="' + esc(periode) + '">' + repere + forme +
        '<span class="fr-sr-only">' + esc(periode) + '</span></div></div>';
    }).join('');

    return '<div class="sp-defile"><div class="sp-gantt" role="table" aria-label="' + esc(titre) + '">' +
      '<div class="sp-gantt__ligne sp-gantt__entete" role="row"><div role="columnheader"><span class="fr-sr-only">Élément</span></div>' +
      '<div class="sp-gantt__piste" role="columnheader">' + graduation + repere + '</div></div>' +
      lignes + '</div></div>' +
      '<p class="sp-gantt__legende"><span class="sp-gantt__jour-legende"></span> Aujourd\'hui' +
      (sansDate.length ? ' · ' + sansDate.length + ' élément' + (sansDate.length > 1 ? 's' : '') + ' sans date non affiché' + (sansDate.length > 1 ? 's' : '') : '') +
      '</p>';
  }

  // --- Vue d'ensemble (pilotage) ---------------------------------------------

  function aujourdhuiSec() {
    var n = new Date();
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 1000;
  }

  function enRetard(p) { return !p.Archive && p.Echeance && p.Echeance < aujourdhuiSec(); }
  function endormi(p) { return !p.Archive && p.Jours_sans_activite !== null && p.Jours_sans_activite !== undefined && p.Jours_sans_activite >= JOURS_ALERTE; }

  // Rattache une structure à son niveau « direction » (2e niveau de l'arborescence).
  function niveauDirection(id) {
    var chaine = [];
    var s = idx.Structures[num(id)];
    var garde = 0;
    while (s && garde++ < 8) { chaine.unshift(s); s = idx.Structures[num(s.Parent)]; }
    var cible = chaine[1] || chaine[0];
    return cible ? cible.id : 0;
  }

  function signaux(p) {
    var s = '';
    if (p.Etat === 'Bloqué') s += '<li>' + badge('Bloqué', 'error') + '</li>';
    if (endormi(p)) s += '<li>' + badge('Sans activité depuis ' + p.Jours_sans_activite + ' j', 'warning') + '</li>';
    if (enRetard(p)) s += '<li>' + badge('Échéance dépassée', 'orange-terre-battue') + '</li>';
    return s ? '<ul class="sp-badges">' + s + '</ul>' : '';
  }

  // Jalons proches et actions qui coincent, pour la vue d'ensemble.
  function blocJalonsEtAlertes(actifs) {
    var ids = actifs.map(function (p) { return p.id; });
    var acts = (data.Actions || []).filter(function (a) { return ids.indexOf(num(a.Projet)) !== -1 && !actionFinie(a); });
    var horizon = aujourdhuiSec() + 30 * 86400;
    var jalons = acts.filter(function (a) { return estJalon(a) && dateJalon(a) && dateJalon(a) <= horizon; })
      .sort(function (a, b) { return dateJalon(a) - dateJalon(b); });
    var alertes = acts.filter(function (a) { return !estJalon(a) && (actionEnRetard(a) || bloqueePar(a).length); })
      .sort(function (a, b) { return (a.Fin || 9e12) - (b.Fin || 9e12); });
    var lienProjet = function (a) { var p = idx.Projets[num(a.Projet)]; return p ? '<a class="fr-link" href="#/projet/' + p.id + '">' + esc(p.Titre || 'Projet sans titre') + '</a>' : ''; };
    var html = '<h2 class="fr-h5 fr-mt-4w">Jalons des 30 prochains jours (' + jalons.length + ')</h2>';
    if (!jalons.length) html += '<p class="sp-vide">Aucun jalon à venir ni dépassé.</p>';
    else html += '<div class="sp-defile"><table class="sp-table"><thead><tr><th>Date</th><th>Jalon</th><th>Projet</th><th>Responsable</th></tr></thead><tbody>' +
      jalons.map(function (a) {
        return '<tr><td>' + esc(dateTexte(dateJalon(a))) + (actionEnRetard(a) ? ' ' + badge('Dépassé', 'error', true) : '') + '</td>' +
          '<td><span class="sp-losange" aria-hidden="true"></span>' + esc(a.Intitule) + '</td><td>' + lienProjet(a) + '</td><td>' + esc(nomPersonne(a.Responsable)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    html += '<h2 class="fr-h5 fr-mt-4w">Actions en retard ou en attente (' + alertes.length + ')</h2>';
    if (!alertes.length) html += '<p class="sp-vide">Aucune action en retard ni en attente d\'une autre.</p>';
    else html += '<div class="sp-defile"><table class="sp-table"><thead><tr><th>Action</th><th>Projet</th><th>Responsable</th><th>Fin prévue</th></tr></thead><tbody>' +
      alertes.slice(0, 30).map(function (a) {
        return '<tr><td>' + esc(a.Intitule) + badgesAction(a) + '</td><td>' + lienProjet(a) + '</td><td>' + esc(nomPersonne(a.Responsable)) + '</td><td>' + esc(dateTexte(a.Fin)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (alertes.length > 30 ? '<p class="fr-text--xs">30 premières actions affichées.</p>' : '');
    return html;
  }

  // --- Mise à jour d'un document installé avec une version précédente --------

  function colonnesManquantes(sch) {
    var r = [];
    Object.keys(sch.tables).forEach(function (t) {
      if (!aTable(t)) return;
      sch.tables[t].forEach(function (c) { if (!aColonne(t, c.id)) r.push({ table: t, c: c }); });
    });
    return r;
  }
  var schemaCache = null;
  function chargerSchema() {
    if (schemaCache) return Promise.resolve(schemaCache);
    return fetch('schema.json').then(function (r) { return r.json(); }).then(function (j) { schemaCache = j; return j; });
  }
  function miseAJourNecessaire() {
    return !DEMO && !PUBLIC && meta.lu && aTable('Actions') && aTable('Personnes') && (!aColonne('Actions', 'Parent') || !aColonne('Personnes', 'Role') || !aColonne('Projets', 'Admins'));
  }
  function bandeauMiseAJour() {
    if (!miseAJourNecessaire()) return '';
    return '<div class="fr-notice fr-notice--info sp-notice"><div class="fr-container"><div class="fr-notice__body">' +
      '<p class="fr-notice__title">Nouvelle version : sous-actions, jalons, dépendances entre actions et rôle « Administration ». ' +
      'Un propriétaire du document doit la mettre à jour. ' +
      '<button type="button" class="fr-link" data-action="mettre-a-jour">Mettre à jour le document</button></p></div></div></div>';
  }
  function mettreAJour() {
    var sch;
    var opts = function (c) { return c.widgetOptions ? JSON.stringify(c.widgetOptions) : ''; };
    var estRef = function (c) { return /^Ref(List)?:/.test(c.type); };
    etat.alerte = { type: 'info', texte: 'Mise à jour en cours…' };
    rendre();
    return chargerSchema().then(function (j) {
      sch = j;
      var manque = colonnesManquantes(sch);
      var a = [];
      // Colonnes simples, puis références, puis formules.
      manque.filter(function (m) { return !estRef(m.c) && !m.c.isFormula; }).forEach(function (m) {
        a.push(['AddColumn', m.table, m.c.id, { type: m.c.type, isFormula: false, formula: m.c.formula || '', label: m.c.label || m.c.id, widgetOptions: opts(m.c) }]);
      });
      manque.filter(function (m) { return estRef(m.c); }).forEach(function (m) {
        a.push(['AddColumn', m.table, m.c.id, { type: m.c.type, isFormula: !!m.c.isFormula, formula: m.c.formula || '', label: m.c.label || m.c.id, widgetOptions: opts(m.c) }]);
      });
      manque.filter(function (m) { return !estRef(m.c) && m.c.isFormula; }).forEach(function (m) {
        a.push(['AddColumn', m.table, m.c.id, { type: m.c.type, isFormula: true, formula: m.c.formula || '', label: m.c.label || m.c.id, widgetOptions: opts(m.c) }]);
      });
      // Avancement : calculé désormais sur les actions sans sous-action, hors jalons.
      var av = (sch.tables.Projets || []).filter(function (c) { return c.id === 'Avancement'; })[0];
      if (av && aColonne('Projets', 'Avancement')) a.push(['ModifyColumn', 'Projets', 'Avancement', { formula: av.formula }]);
      // Rôle « Membre » pour les personnes existantes (la formule de déclenchement ne vaut que pour les nouvelles).
      return (a.length ? grist.docApi.applyUserActions(a) : Promise.resolve()).then(function () {
        if (!manque.some(function (m) { return m.table === 'Personnes' && m.c.id === 'Role'; })) return null;
        var ids = (data.Personnes || []).map(function (p) { return p.id; });
        return ids.length ? grist.docApi.applyUserActions([['BulkUpdateRecord', 'Personnes', ids, { Role: ids.map(function () { return 'Membre'; }) }]]) : null;
      }).then(function () {
        return Promise.all([grist.docApi.fetchTable('_grist_Tables'), grist.docApi.fetchTable('_grist_Tables_column')]);
      }).then(function (m) {
        var tables = lignesDepuisColonnes(m[0]), cols = lignesDepuisColonnes(m[1]);
        var col = function (t, c) { var tb = tables.filter(function (x) { return x.tableId === t; })[0]; return tb && cols.filter(function (x) { return x.parentId === tb.id && x.colId === c; })[0]; };
        var b = [];
        manque.filter(function (x) { return estRef(x.c) && x.c.visibleCol; }).forEach(function (x) {
          var moi = col(x.table, x.c.id), v = col(x.c.type.split(':')[1], x.c.visibleCol);
          if (moi && v) { b.push(['ModifyColumn', x.table, x.c.id, { visibleCol: v.id }]); b.push(['SetDisplayFormula', x.table, null, moi.id, '$' + x.c.id + '.' + x.c.visibleCol]); }
        });
        return b.length ? grist.docApi.applyUserActions(b) : null;
      });
    }).then(function () {
      return Promise.all([grist.docApi.fetchTable('_grist_ACLResources'), grist.docApi.fetchTable('_grist_ACLRules')]);
    }).then(function (x) {
      // Règles d'accès : en dernier et en un seul lot (Grist recharge le document quand elles changent).
      var ressources = lignesDepuisColonnes(x[0]), regles = lignesDepuisColonnes(x[1]);
      var resSchema = {};
      sch.acl.resources.forEach(function (r) { resSchema[r.id] = r; });
      var resDoc = function (r) { return ressources.filter(function (y) { return y.tableId === r.tableId && y.colIds === r.colIds; })[0]; };
      var a = [];
      // Colonnes techniques : la nouvelle colonne Admins est masquée comme les autres.
      ressources.forEach(function (r) {
        if (r.colIds === 'Acces,Lecteurs,Cree_par,Contributeurs') a.push(['UpdateRecord', '_grist_ACLResources', r.id, { colIds: r.colIds + ',Admins' }]);
      });
      sch.acl.rules.filter(function (r) { return r.apres || r.avant; }).forEach(function (r) {
        var rs = resSchema[r.resource], rd = rs && resDoc(rs);
        if (!rd) return;
        var dela = regles.filter(function (y) { return y.resource === rd.id; }).sort(function (u, v) { return u.rulePos - v.rulePos; });
        if (dela.some(function (y) { return y.memo === r.memo; })) return;
        var pos;
        if (r.avant) pos = (dela.length ? dela[0].rulePos : 1) - (r.rulePos % 1 === 0.5 ? 0.5 : 0.25);
        else {
          var i = -1;
          dela.forEach(function (y, k) { if (i < 0 && y.memo === r.apres) i = k; });
          if (i < 0) return;
          pos = dela[i + 1] ? (dela[i].rulePos + dela[i + 1].rulePos) / 2 : dela[i].rulePos + 0.5;
        }
        a.push(['AddRecord', '_grist_ACLRules', null, { resource: rd.id, aclFormula: r.aclFormula, aclFormulaParsed: r.aclFormulaParsed,
          permissionsText: r.permissionsText, rulePos: pos, memo: r.memo, userAttributes: '' }]);
      });
      if (!a.length) return null;
      return grist.docApi.applyUserActions(a).catch(function (err) {
        if (/disposed|closed|disconnect/i.test(String((err && err.message) || err))) return null;
        throw err;
      });
    }).then(function () {
      etat.alerte = { type: 'success', texte: 'Document mis à jour. Les propriétaires attribuent le rôle « Administration » dans les réglages.' };
      return charger().then(rendre);
    }).catch(function (err) {
      etat.alerte = { type: 'error', texte: 'Mise à jour impossible : seuls les propriétaires du document peuvent ajouter des colonnes et des règles. (' + ((err && err.message) || err) + ')' };
      rendre();
    });
  }

  function vuePilotage() {
    var f = etat.pilotage;
    var structs = f.structure ? descendants(num(f.structure)) : null;
    var projets = data.Projets.filter(function (p) {
      if (!f.archives && p.Archive) return false;
      if (structs && structs.indexOf(num(p.Structure_porteuse)) === -1) return false;
      return true;
    });
    var actifs = projets.filter(function (p) { return !p.Archive; });

    var html = navigation('pilotage') + blocAlerte() +
      '<div class="sp-titre-ligne"><div><h1 class="fr-h3">Vue d\'ensemble</h1>' +
      '<p class="fr-mb-0">Où en sont les projets, et lesquels demandent une relance.</p></div></div>' +
      '<div class="sp-filtres">' +
      champSelect('pf-structure', 'Structure (et ses services)', f.structure,
        structuresTriees().map(function (s) { return { v: s.id, t: s.Chemin }; }), 'data-pilotage="structure"', 'Toutes') +
      '<div class="fr-checkbox-group"><input type="checkbox" id="pf-archives" data-pilotage="archives"' + (f.archives ? ' checked' : '') + '>' +
      '<label class="fr-label" for="pf-archives">Inclure les projets terminés et archivés</label></div></div>';

    if (!data.Projets.length) {
      return html + '<div class="fr-callout"><h2 class="fr-callout__title fr-h5">Aucun projet déclaré pour l\'instant</h2>' +
        '<p class="fr-callout__text">La vue d\'ensemble s\'alimente à partir des projets déclarés dans la banque.</p></div>';
    }

    var chiffres = [
      [actifs.length, 'projets en cours de vie', ''],
      [actifs.filter(function (p) { return p.Etat === 'Bloqué'; }).length, 'projets bloqués', 'error'],
      [actifs.filter(endormi).length, 'sans activité depuis ' + JOURS_ALERTE + ' jours ou plus', 'warning'],
      [actifs.filter(enRetard).length, 'à échéance dépassée', 'warning']
    ];
    html += '<ul class="sp-chiffres">' + chiffres.map(function (c) {
      return '<li class="sp-chiffre' + (c[2] && c[0] ? ' sp-chiffre--' + c[2] : '') + '"><span class="sp-chiffre__valeur">' + c[0] +
        '</span><span class="sp-chiffre__libelle">' + esc(c[1]) + '</span></li>';
    }).join('') + '</ul>';

    // Projets à relancer
    var aRelancer = actifs.filter(function (p) { return p.Etat === 'Bloqué' || endormi(p) || enRetard(p); })
      .sort(function (a, b) { return (b.Jours_sans_activite || 0) - (a.Jours_sans_activite || 0); });
    html += '<h2 class="fr-h5 fr-mt-4w">Projets à relancer (' + aRelancer.length + ')</h2>';
    if (!aRelancer.length) {
      html += '<p class="sp-vide">Aucun projet bloqué, endormi ou en retard.</p>';
    } else {
      html += '<div class="sp-defile"><table class="sp-table"><thead><tr><th>Projet</th><th>Structure</th><th>Porteurs</th>' +
        '<th>Signaux</th><th>Dernière activité</th></tr></thead><tbody>' + aRelancer.map(function (p) {
          return '<tr><td><a class="fr-link" href="#/projet/' + p.id + '">' + esc(p.Titre || 'Projet sans titre') + '</a></td>' +
            '<td>' + esc(libelleStructure(p.Structure_porteuse)) + '</td>' +
            '<td>' + esc(nomsPersonnes(p.Porteurs)) + '</td>' +
            '<td>' + signaux(p) + '</td>' +
            '<td>' + esc(dateTexte(p.Derniere_activite)) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    html += blocJalonsEtAlertes(actifs);

    // Projets par phase
    var colonnes = f.archives ? PHASES : PHASES.filter(function (ph) { return ph !== 'Clos'; });
    html += '<h2 class="fr-h5 fr-mt-4w">Projets par phase</h2>' +
      '<p class="fr-hint-text">Déplacer une carte change la phase du projet. Seuls ses porteurs et les administrateurs peuvent le faire.</p>' +
      kanban(colonnes, projets.map(function (p) { return Object.assign({ _colonne: p.Phase || 'Idée' }, p); }), 'Projets', 'Phase', function (p) {
        return '<p class="sp-ticket__titre"><a href="#/projet/' + p.id + '">' + esc(p.Titre || 'Projet sans titre') + '</a></p>' +
          '<p class="sp-ticket__meta">' + esc(libelleStructure(p.Structure_porteuse)) + '</p>' +
          '<ul class="sp-badges">' + '<li>' + badge(p.Etat, COULEUR_ETAT[p.Etat]) + '</li>' +
          (p.Visibilite === 'Restreint' ? '<li>' + badge('Restreint', 'orange-terre-battue') + '</li>' : '') + '</ul>';
      });

    // Calendrier des projets
    html += '<h2 class="fr-h5 fr-mt-4w">Calendrier des projets</h2>' +
      gantt(projets.map(function (p) {
        return {
          libelle: p.Titre || 'Projet sans titre', lien: '#/projet/' + p.id, meta: libelleStructure(p.Structure_porteuse),
          debut: p.Date_debut, fin: p.Echeance, classe: 'sp-barre--' + classeEtat(p.Etat)
        };
      }), 'Calendrier des projets');

    // Répartition par structure
    var groupes = {};
    projets.forEach(function (p) {
      var k = niveauDirection(p.Structure_porteuse);
      var g = groupes[k] = groupes[k] || { total: 0, actifs: 0, bloques: 0, relance: 0 };
      g.total++;
      if (!p.Archive) g.actifs++;
      if (!p.Archive && p.Etat === 'Bloqué') g.bloques++;
      if (endormi(p) || enRetard(p)) g.relance++;
    });
    var cles = Object.keys(groupes).sort(function (a, b) { return groupes[b].total - groupes[a].total; });
    html += '<h2 class="fr-h5 fr-mt-4w">Répartition par structure</h2>' +
      '<div class="sp-defile"><table class="sp-table"><thead><tr><th>Structure</th><th>Projets</th><th>En cours de vie</th>' +
      '<th>Bloqués</th><th>À relancer</th></tr></thead><tbody>' + cles.map(function (k) {
        var g = groupes[k];
        var nom = num(k) ? cheminDe(k) : 'Structure non renseignée';
        var lien = num(k) ? '<button type="button" class="fr-link" data-action="filtrer-structure" data-id="' + k + '">' + esc(nom) + '</button>' : esc(nom);
        return '<tr><td>' + lien + '</td><td>' + g.total + '</td><td>' + g.actifs + '</td><td>' + g.bloques + '</td><td>' + g.relance + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    return html;
  }

  // --- Formulaire de déclaration / modification -------------------------------

  function initialiserFormulaire(id) {
    var cle = id ? 'm' + id : 'nouveau';
    if (etat.formCle === cle && etat.form) return;
    var p = id ? idx.Projets[id] : null;
    etat.formCle = cle;
    etat.form = p ? {
      Titre: p.Titre || '', Resume: p.Resume || '', Structure_porteuse: num(p.Structure_porteuse) || '',
      Porteurs: liste(p.Porteurs).map(num), Equipe: liste(p.Equipe).map(num),
      Structures_associees: liste(p.Structures_associees).map(num),
      Phase: p.Phase || 'Idée', Etat: p.Etat || 'En cours', Origine: p.Origine || '',
      Commanditaire: num(p.Commanditaire) || '', Mission: p.Mission || '', Objectifs: p.Objectifs || '',
      Thematiques: liste(p.Thematiques), Date_debut: dateVersSaisie(p.Date_debut), Echeance: dateVersSaisie(p.Echeance),
      Visibilite: p.Visibilite === 'Restreint' ? 'Restreint' : 'Ouvert'
    } : {
      Titre: '', Resume: '', Structure_porteuse: num(etat.moi.profil && idx.Personnes[etat.moi.profil].Structure) || '',
      Porteurs: etat.moi.profil ? [etat.moi.profil] : [], Equipe: [], Structures_associees: [],
      Phase: 'Idée', Etat: 'En cours', Origine: '', Commanditaire: '', Mission: '', Objectifs: '',
      Thematiques: [], Date_debut: '', Echeance: '', Visibilite: 'Ouvert'
    };
    champsPerso().forEach(function (c) {
      var v = p ? p[c.id] : '';
      etat.form[c.id] = v === null || v === undefined ? '' : (c.type === 'date' ? dateVersSaisie(v) : v);
    });
  }

  function champTexte(id, champ, libelle, aide, requis, multi) {
    var v = etat.form[champ];
    var lab = '<label class="fr-label" for="' + id + '">' + esc(libelle) + (requis ? ' <span aria-hidden="true">*</span>' : '') +
      (aide ? '<span class="fr-hint-text">' + esc(aide) + '</span>' : '') + '</label>';
    var input = multi
      ? '<textarea class="fr-input" id="' + id + '" rows="4" data-champ-form="' + champ + '">' + esc(v) + '</textarea>'
      : '<input class="fr-input" id="' + id + '" data-champ-form="' + champ + '" value="' + esc(v) + '"' + (requis ? ' required' : '') + '>';
    return '<div class="fr-input-group">' + lab + input + '</div>';
  }

  function selecteurMultiple(id, champ, libelle, aide, options, nomDe) {
    var choisis = etat.form[champ];
    var puces = choisis.map(function (v) {
      return '<li><button type="button" class="fr-tag fr-tag--dismiss" aria-label="Retirer ' + esc(nomDe(v)) + '" ' +
        'data-action="retirer" data-champ="' + champ + '" data-id="' + v + '">' + esc(nomDe(v)) + '</button></li>';
    }).join('');
    var restants = options.filter(function (o) { return choisis.indexOf(o.v) === -1; });
    return '<div class="fr-select-group"><label class="fr-label" for="' + id + '">' + esc(libelle) +
      (aide ? '<span class="fr-hint-text">' + esc(aide) + '</span>' : '') + '</label>' +
      (puces ? '<ul class="sp-puces">' + puces + '</ul>' : '') +
      '<select class="fr-select" id="' + id + '" data-ajout-multiple="' + champ + '"><option value="">Ajouter…</option>' +
      restants.map(function (o) { return '<option value="' + o.v + '">' + esc(o.t) + '</option>'; }).join('') +
      '</select>' + (nomDe === nomPuce ? blocAjoutPersonne(champ) : '') + '</div>';
  }

  function nomPuce(id) {
    var x = idx.Personnes[num(id)];
    if (!x) return '';
    return x.Nom + (!emailDe(x) ? ' (sans email)' : (x.Connecte === false ? ' (pas encore connecté)' : ''));
  }

  // Ajout d'une personne absente de l'annuaire, sans quitter le formulaire projet.
  function blocAjoutPersonne(champ) {
    if (etat.moi.lecture) return '';
    var a = etat.ajout;
    if (!a || a.champ !== champ) {
      return '<button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-user-add-line fr-btn--icon-left sp-ajout-personne" ' +
        'data-action="ouvrir-ajout" data-champ="' + champ + '">Ajouter une personne absente de la liste</button>';
    }
    var structures = structuresTriees().map(function (s) { return { v: s.id, t: s.Chemin }; });
    var proche = a.proche ? idx.Personnes[a.proche] : null;
    var memeEmail = a.memeEmail ? idx.Personnes[a.memeEmail] : null;
    return '<div class="sp-nouvelle-personne" role="group" aria-label="Nouvelle personne">' +
      '<p class="fr-text--sm fr-mb-1w">C\'est l\'adresse email qui donne les droits : la personne sera reconnue à sa première connexion avec cette adresse.</p>' +
      '<div class="fr-input-group"><label class="fr-label" for="aj-nom-' + champ + '">Nom et prénom' +
      '<span class="fr-hint-text">Par exemple : MARTIN Claire.</span></label>' +
      '<input class="fr-input" id="aj-nom-' + champ + '" data-ajout="Nom" value="' + esc(a.Nom) + '"></div>' +
      '<div class="fr-input-group"><label class="fr-label" for="aj-email-' + champ + '">Adresse email professionnelle' +
      '<span class="fr-hint-text">Proposée à partir du nom : vérifiez-la, surtout pour les homonymes et les partenaires.</span></label>' +
      '<input class="fr-input" type="email" id="aj-email-' + champ + '" data-ajout="Email" value="' + esc(a.Email) + '"></div>' +
      champSelect('aj-structure-' + champ, 'Structure', a.Structure, structures, 'data-ajout="Structure"', 'Je ne sais pas') +
      (memeEmail ? '<div class="fr-alert fr-alert--warning fr-alert--sm sp-alerte"><p>Cette adresse est déjà celle de « ' + esc(memeEmail.Nom) + ' ». ' +
        '<button type="button" class="fr-link" data-action="choisir-proche" data-champ="' + champ + '" data-id="' + memeEmail.id + '">Choisir cette personne</button></p></div>' : '') +
      (proche && !memeEmail ? '<div class="fr-alert fr-alert--warning fr-alert--sm sp-alerte"><p>« ' + esc(proche.Nom) + ' »' +
        (emailDe(proche) ? ' (' + esc(emailDe(proche)) + ')' : '') +
        ' est déjà dans l\'annuaire. <button type="button" class="fr-link" data-action="choisir-proche" data-champ="' + champ + '" data-id="' + proche.id + '">Choisir cette personne</button>' +
        ' ou cliquez à nouveau sur « Ajouter » s\'il s\'agit de quelqu\'un d\'autre.</p></div>' : '') +
      '<ul class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--sm">' +
      '<li><button type="button" class="fr-btn fr-btn--sm" data-action="creer-personne" data-champ="' + champ + '">Ajouter</button></li>' +
      '<li><button type="button" class="fr-btn fr-btn--sm fr-btn--tertiary" data-action="fermer-ajout">Annuler</button></li></ul></div>';
  }

  function creerPersonne(champ) {
    var a = etat.ajout;
    var nom = String(a.Nom || '').trim();
    var email = String(a.Email || '').trim().toLowerCase();
    if (!nom || !emailValide(email)) {
      etat.alerte = { type: 'error', texte: 'Indiquez le nom et une adresse email valide de la personne à ajouter.' };
      rendre(); return;
    }
    etat.alerte = null;
    var meme = personneParEmail(email);
    if (meme) { a.memeEmail = meme.id; rendre(); return; }
    var proche = personneProche(nom);
    if (proche && a.proche !== proche.id) { a.proche = proche.id; rendre(); return; }
    executer([['AddRecord', 'Personnes', null, { Nom: nom, Email_saisi: email, Structure: num(a.Structure) }]], '« ' + nom + ' » ajouté à l\'annuaire.', function (res) {
      var id = res && res.retValues && res.retValues[0];
      if (id && etat.form && etat.form[champ].indexOf(id) === -1) etat.form[champ].push(id);
      etat.ajout = null;
    }, REFUS_PERSONNE);
  }

  function champPersoForm(c, f) {
    var id = 'pp-' + c.id, v = f[c.id] === undefined || f[c.id] === null ? '' : f[c.id];
    var attr = 'data-champ-form="' + esc(c.id) + '"' + (c.requis ? ' required' : '');
    var lab = '<label class="fr-label" for="' + id + '">' + esc(c.label) + (c.requis ? ' <span aria-hidden="true">*</span>' : '') +
      (c.aide ? '<span class="fr-hint-text">' + esc(c.aide) + '</span>' : '') + '</label>';
    if (c.type === 'long') return '<div class="fr-input-group">' + lab + '<textarea class="fr-input" id="' + id + '" rows="4" ' + attr + '>' + esc(v) + '</textarea></div>';
    if (c.type === 'choix') {
      return '<div class="fr-select-group">' + lab + '<select class="fr-select" id="' + id + '" ' + attr + '><option value="">Choisir</option>' +
        (c.choix || []).map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
    }
    var type = c.type === 'date' ? 'date' : c.type === 'nombre' ? 'number" step="any' : 'text';
    return '<div class="fr-input-group">' + lab + '<input class="fr-input" type="' + type + '" id="' + id + '" ' + attr + ' value="' + esc(v) + '"></div>';
  }

  function vueFormulaire(id) {
    if (id && !idx.Projets[id]) {
      return '<p><a class="fr-link fr-icon-arrow-left-line fr-link--icon-left" href="#/">Banque des projets</a></p>' +
        '<p>Ce projet n\'existe pas, ou vous n\'avez pas le droit de le consulter.</p>';
    }
    initialiserFormulaire(id);
    var f = etat.form;
    var personnes = personnesTriees().map(function (x) { return { v: x.id, t: libellePersonne(x) }; });
    var structures = structuresTriees().map(function (s) { return { v: s.id, t: s.Chemin }; });
    var retour = id ? '#/projet/' + id : '#/';
    function si(c, h) { return masque(c) ? '' : h; }
    var perso = champsPerso();

    var html = '<p><a class="fr-link fr-icon-arrow-left-line fr-link--icon-left" href="' + retour + '">' +
      (id ? 'Retour à la fiche' : 'Banque des projets') + '</a></p>' + blocAlerte() + blocProfilManquant() +
      '<h1 class="fr-h3">' + (id ? 'Modifier la fiche projet' : 'Déclarer un projet') + '</h1>' +
      '<p class="fr-hint-text fr-mb-3w">Les champs marqués d\'un astérisque (*) sont obligatoires. ' +
      'Les porteurs pourront ensuite mettre à jour la fiche ; l\'équipe pourra compléter le plan d\'action, le journal et les documents.</p>' +
      '<form novalidate data-form="projet" data-projet="' + (id || '') + '">' +

      '<fieldset class="fr-fieldset"><legend class="fr-fieldset__legend fr-h5">Le projet</legend>' +
      '<div class="fr-fieldset__element">' + champTexte('p-titre', 'Titre', 'Titre du projet', '', true) + '</div>' +
      si('Resume', '<div class="fr-fieldset__element">' + champTexte('p-resume', 'Resume', 'En bref', 'Deux ou trois phrases pour comprendre le projet.', false, true) + '</div>') +
      '<div class="fr-fieldset__element">' + champSelect('p-structure', 'Structure porteuse *', f.Structure_porteuse, structures, 'data-champ-form="Structure_porteuse" required', 'Choisir une structure') + '</div>' +
      si('Origine', '<div class="fr-fieldset__element">' + champSelect('p-origine', 'Origine du projet', f.Origine, ORIGINES, 'data-champ-form="Origine"', 'Choisir') + '</div>') +
      '</fieldset>' +

      '<fieldset class="fr-fieldset"><legend class="fr-fieldset__legend fr-h5">Les personnes</legend>' +
      '<div class="fr-fieldset__element">' + selecteurMultiple('p-porteurs', 'Porteurs', 'Porteurs du projet *',
        'Les porteurs peuvent modifier toute la fiche.', personnes, nomPuce) + '</div>' +
      '<div class="fr-fieldset__element">' + selecteurMultiple('p-equipe', 'Equipe', 'Équipe projet',
        "L'équipe peut compléter le plan d'action, le journal et les documents.", personnes, nomPuce) + '</div>' +
      si('Structures_associees', '<div class="fr-fieldset__element">' + selecteurMultiple('p-associees', 'Structures_associees', 'Structures associées', '', structures,
        function (v) { return cheminDe(v); }) + '</div>') +
      '</fieldset>' +

      (['Commanditaire', 'Mission', 'Objectifs'].every(masque) ? '' : '<fieldset class="fr-fieldset"><legend class="fr-fieldset__legend fr-h5">La mission</legend>' +
      si('Commanditaire', '<div class="fr-fieldset__element">' + champSelect('p-commanditaire', 'Mission confiée par', f.Commanditaire, personnes, 'data-champ-form="Commanditaire"', 'Personne (initiative propre)') + '</div>') +
      si('Mission', '<div class="fr-fieldset__element">' + champTexte('p-mission', 'Mission', 'Mission confiée', 'La consigne ou la lettre de mission, telle qu\'elle a été donnée.', false, true) + '</div>') +
      si('Objectifs', '<div class="fr-fieldset__element">' + champTexte('p-objectifs', 'Objectifs', 'Objectifs attendus', '', false, true) + '</div>') +
      '</fieldset>') +

      (perso.length ? '<fieldset class="fr-fieldset"><legend class="fr-fieldset__legend fr-h5">Informations complémentaires</legend>' +
        perso.map(function (c) { return '<div class="fr-fieldset__element">' + champPersoForm(c, f) + '</div>'; }).join('') + '</fieldset>' : '') +

      '<fieldset class="fr-fieldset"><legend class="fr-fieldset__legend fr-h5">Avancement et calendrier</legend>' +
      '<div class="fr-fieldset__element fr-fieldset__element--inline">' + champSelect('p-phase', 'Phase', f.Phase, PHASES, 'data-champ-form="Phase"', false) + '</div>' +
      '<div class="fr-fieldset__element fr-fieldset__element--inline">' + champSelect('p-etat', 'État', f.Etat, ETATS, 'data-champ-form="Etat"', false) + '</div>' +
      si('Date_debut', '<div class="fr-fieldset__element fr-fieldset__element--inline"><div class="fr-input-group"><label class="fr-label" for="p-debut">Début</label>' +
      '<input class="fr-input" type="date" id="p-debut" data-champ-form="Date_debut" value="' + esc(f.Date_debut) + '"></div></div>') +
      si('Echeance', '<div class="fr-fieldset__element fr-fieldset__element--inline"><div class="fr-input-group"><label class="fr-label" for="p-echeance">Échéance prévisionnelle</label>' +
      '<input class="fr-input" type="date" id="p-echeance" data-champ-form="Echeance" value="' + esc(f.Echeance) + '"></div></div>') +
      '</fieldset>' +

      si('Thematiques', '<fieldset class="fr-fieldset" id="p-themes"><legend class="fr-fieldset__legend fr-h5">Thématiques</legend>' +
      THEMATIQUES.map(function (t, i) {
        return '<div class="fr-fieldset__element fr-fieldset__element--inline"><div class="fr-checkbox-group fr-checkbox-group--sm">' +
          '<input type="checkbox" id="t-' + i + '" data-theme="' + esc(t) + '"' + (f.Thematiques.indexOf(t) !== -1 ? ' checked' : '') + '>' +
          '<label class="fr-label" for="t-' + i + '">' + esc(t) + '</label></div></div>';
      }).join('') + '</fieldset>') +

      '<fieldset class="fr-fieldset"><legend class="fr-fieldset__legend fr-h5">Visibilité</legend>' +
      ['Ouvert', 'Restreint'].map(function (v) {
        var aide = v === 'Ouvert' ? "Visible par toutes les personnes qui ont accès à l'espace." : "Visible seulement par les porteurs, l'équipe, la personne qui a confié la mission et les administrateurs.";
        return '<div class="fr-fieldset__element"><div class="fr-radio-group"><input type="radio" id="v-' + v + '" name="p-visibilite" value="' + v + '" data-champ-form="Visibilite"' +
          (f.Visibilite === v ? ' checked' : '') + '><label class="fr-label" for="v-' + v + '">' + v + '<span class="fr-hint-text">' + aide + '</span></label></div></div>';
      }).join('') + '</fieldset>' +

      '<ul class="fr-btns-group fr-btns-group--inline-md">' +
      '<li><button class="fr-btn" type="submit">' + (id ? 'Enregistrer les modifications' : 'Déclarer le projet') + '</button></li>' +
      '<li><a class="fr-btn fr-btn--secondary" href="' + retour + '" data-action="annuler-form">Annuler</a></li></ul>' +
      '</form>';
    return html;
  }

  function enregistrerProjet(id) {
    var f = etat.form;
    var manques = [];
    if (!String(f.Titre).trim()) manques.push('le titre');
    if (!num(f.Structure_porteuse)) manques.push('la structure porteuse');
    if (!f.Porteurs.length) manques.push('au moins un porteur');
    champsPerso().forEach(function (c) { if (c.requis && !String(f[c.id] === undefined ? '' : f[c.id]).trim()) manques.push('« ' + c.label + ' »'); });
    if (manques.length) {
      etat.alerte = { type: 'error', texte: 'Il manque ' + manques.join(', ') + '.' };
      rendre();
      window.scrollTo(0, 0);
      return;
    }
    var champs = {
      Titre: String(f.Titre).trim(), Resume: f.Resume, Structure_porteuse: num(f.Structure_porteuse),
      Porteurs: versListe(f.Porteurs), Equipe: versListe(f.Equipe), Structures_associees: versListe(f.Structures_associees),
      Phase: f.Phase, Etat: f.Etat, Origine: f.Origine, Commanditaire: num(f.Commanditaire),
      Mission: f.Mission, Objectifs: f.Objectifs, Thematiques: versListe(f.Thematiques),
      Date_debut: saisieVersDate(f.Date_debut), Echeance: saisieVersDate(f.Echeance), Visibilite: f.Visibilite
    };
    // Un champ masqué n'est pas envoyé ; un champ perso est converti selon son type.
    CHAMPS_MASQUABLES.forEach(function (c) { if (masque(c[0])) delete champs[c[0]]; });
    champsPerso().forEach(function (c) {
      var v = f[c.id];
      champs[c.id] = c.type === 'date' ? saisieVersDate(v) : c.type === 'nombre' ? (String(v).trim() === '' ? null : Number(v)) : (v === undefined ? '' : String(v));
    });
    // Une colonne supprimée à la main dans Grist ne doit pas bloquer l'enregistrement.
    seulementColonnes('Projets', champs);
    var action = id ? ['UpdateRecord', 'Projets', id, champs] : ['AddRecord', 'Projets', null, champs];
    executer([action], id ? 'Fiche enregistrée.' : 'Projet déclaré.', function (res) {
      var nouvelId = id || (res && res.retValues && res.retValues[0]);
      marquerVu(nouvelId);
      etat.form = null; etat.formCle = null; etat.onglet = 'presentation';
      location.hash = nouvelId ? '#/projet/' + nouvelId : '#/';
    });
  }

  // ---------------------------------------------------------------------------
  // Événements
  // ---------------------------------------------------------------------------

  // Les réglages et les rôles sont dans la coque à onglets, hors de #sp-app : on écoute la coque entière.
  var ecoute = document.getElementById('sp-coque') || app;
  ecoute.addEventListener('click', function (e) {
    var inst = e.target.closest('[data-installer]');
    if (inst) { inst.disabled = true; installer(inst.getAttribute('data-installer') === 'exemple'); return; }
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    if (a === 'ajouter-champ-perso') { ajouterChampPerso(); return; }
    if (a === 'retirer-champ-perso' && brouillonReglages) {
      var rid = el.getAttribute('data-id');
      brouillonReglages.champsPerso = (brouillonReglages.champsPerso || []).filter(function (c) { return c.id !== rid; });
      if (configLab) { configLab.rafraichir('reglages'); configLab.modifie(true); configLab.message('info', 'Champ retiré des réglages. Sa colonne et ses données restent dans Grist.'); }
      return;
    }
    if (a === 'enregistrer-reglages') { enregistrerReglages(); return; }
    if (a === 'annuler-reglages') { brouillonReglages = null; etat.alerte = null; rendre(); return; }
    if (a === 'nouveau') { etat.form = null; etat.formCle = null; etat.alerte = null; aller('#/nouveau'); }
    else if (a === 'annuler-form') { etat.form = null; etat.formCle = null; etat.alerte = null; }
    else if (a === 'retirer') {
      var champ = el.getAttribute('data-champ');
      var vid = num(el.getAttribute('data-id'));
      etat.form[champ] = etat.form[champ].filter(function (x) { return x !== vid; });
      rendre();
    }
    else if (a === 'demander-suppression') {
      etat.suppression = el.getAttribute('data-table') + ':' + el.getAttribute('data-id'); rendre();
    }
    else if (a === 'annuler-suppression') { etat.suppression = null; rendre(); }
    else if (a === 'supprimer') {
      etat.suppression = null;
      var tSup = el.getAttribute('data-table'), idSup = num(el.getAttribute('data-id'));
      if (etat.editionAction === idSup) etat.editionAction = null;
      executer(tSup === 'Actions' ? actionsSuppressionAction(idSup) : [['RemoveRecord', tSup, idSup]], 'Élément supprimé.');
    }
    else if (a === 'editer-action') {
      var idEd = num(el.getAttribute('data-id'));
      etat.editionAction = etat.editionAction === idEd ? null : idEd;
      delete etat.brouillons['edit-' + idEd];
      etat.alerte = null; rendre();
      var champEd = document.getElementById('ed-int-' + idEd);
      if (champEd) champEd.focus();
    }
    else if (a === 'annuler-edition') { etat.editionAction = null; rendre(); }
    else if (a === 'sous-action') {
      var bs = brouillon('action-' + num(el.getAttribute('data-projet')));
      bs.Parent = num(el.getAttribute('data-id')); bs.Type = 'Action';
      etat.modePlan = 'liste'; etat.alerte = null; rendre();
      var champSa = document.getElementById('a-intitule');
      if (champSa) { champSa.scrollIntoView({ block: 'center' }); champSa.focus(); }
    }
    else if (a === 'mettre-a-jour') { mettreAJour(); }
    else if (a === 'retro') { var idr = num(el.getAttribute('data-id')); etat.retro = etat.retro === idr ? null : idr; etat.alerte = null; rendre(); var pr = document.querySelector('.sp-retro'); if (pr) pr.scrollIntoView({ block: 'nearest' }); }
    else if (a === 'fermer-retro') { etat.retro = null; rendre(); }
    else if (a === 'appliquer-retro') { appliquerRetro(); }
    else if (a === 'enregistrer-roles') { enregistrerRoles(); }
    else if (a === 'deplacer') {
      deplacer(el.getAttribute('data-table'), num(el.getAttribute('data-id')), el.getAttribute('data-champ'), el.getAttribute('data-valeur'));
    }
    else if (a === 'ouvrir-ajout') {
      etat.ajout = { champ: el.getAttribute('data-champ'), Nom: '', Email: '', Structure: '', proche: null, memeEmail: null, emailAuto: true };
      etat.alerte = null; rendre();
      var champNom = document.getElementById('aj-nom-' + etat.ajout.champ);
      if (champNom) champNom.focus();
    }
    else if (a === 'fermer-ajout') { etat.ajout = null; rendre(); }
    else if (a === 'creer-personne') { creerPersonne(el.getAttribute('data-champ')); }
    else if (a === 'choisir-proche') {
      var ch = el.getAttribute('data-champ');
      var pid = num(el.getAttribute('data-id'));
      if (etat.form && etat.form[ch].indexOf(pid) === -1) etat.form[ch].push(pid);
      etat.ajout = null; rendre();
    }
    else if (a === 'vu-attributions') {
      var vus = projetsVus().concat(mesProjets().map(function (p) { return p.id; }));
      etat.vus = vus.filter(function (v, i) { return vus.indexOf(v) === i; });
      try { localStorage.setItem(cleVus(), JSON.stringify(etat.vus)); } catch (err) { /* stockage indisponible */ }
      rendre();
    }
    else if (a === 'pas-moi') { etat.pasMoi = num(el.getAttribute('data-id')); rendre(); }
    else if (a === 'annuler-pas-moi') { etat.pasMoi = null; rendre(); }
    else if (a === 'confirmer-pas-moi') { pasMoi(num(el.getAttribute('data-id'))); }
    else if (a === 'filtrer-structure') {
      etat.pilotage.structure = el.getAttribute('data-id'); rendre(); window.scrollTo(0, 0);
    }
  });

  // Tables et champs qu'un déplacement de carte a le droit de modifier.
  var DEPLACEMENTS = { 'Actions': 'Etat', 'Projets': 'Phase' };

  function deplacer(table, id, champ, valeur) {
    if (DEPLACEMENTS[table] !== champ || !id) return;
    var ligne = idx[table] && idx[table][id];
    if (!ligne || ligne[champ] === valeur) return;
    var champs = {};
    champs[champ] = valeur;
    executer([['UpdateRecord', table, id, champs]], (table === 'Projets' ? 'Phase' : 'État') + ' mis à jour : ' + valeur + '.');
  }

  // Glisser-déposer des cartes de kanban
  // Réglages : champs simples et couleurs des étiquettes.
  ecoute.addEventListener('input', function (e) {
    var t = e.target;
    if (!brouillonReglages) return;
    if (t.hasAttribute('data-reglage')) {
      var k = t.getAttribute('data-reglage');
      brouillonReglages[k] = t.type === 'number' ? Number(t.value) : t.value;
    }
  });
  ecoute.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-nouveau') && t.type !== 'checkbox' && t.tagName !== 'SELECT') nouveauChamp[t.getAttribute('data-nouveau')] = t.value;
  });
  ecoute.addEventListener('change', function (e) {
    var t = e.target;
    if (!brouillonReglages) return;
    if (t.hasAttribute('data-nouveau')) { nouveauChamp[t.getAttribute('data-nouveau')] = t.type === 'checkbox' ? t.checked : t.value; return; }
    if (t.getAttribute('data-bento')) {
      var k = t.getAttribute('data-bento'), idb = t.getAttribute('data-id');
      if (k === 'actif') {
        brouillonReglages.bento = t.checked ? BENTO_DEFAUT.map(function (d) { return { id: d[0], taille: d[1], visible: true }; }) : [];
      } else {
        var lb = bentoComplet(brouillonReglages.bento), x = lb.filter(function (y) { return y.id === idb; })[0];
        if (x) { if (k === 'visible') x.visible = t.checked; else x.taille = t.value; }
        brouillonReglages.bento = lb;
      }
      if (configLab) { configLab.rafraichir('reglages'); configLab.modifie(true); }
      return;
    }
    if (t.hasAttribute('data-champ-masque')) {
      var cm = t.getAttribute('data-champ-masque');
      var l = (brouillonReglages.champsMasques || []).filter(function (x) { return x !== cm; });
      if (!t.checked) l.push(cm);
      brouillonReglages.champsMasques = l;
      if (configLab) configLab.modifie(true);
      return;
    }
    if (t.hasAttribute('data-perso')) {
      var cp = (brouillonReglages.champsPerso || []).filter(function (x) { return x.id === t.getAttribute('data-perso'); })[0];
      if (cp) cp[t.getAttribute('data-drapeau')] = t.checked;
      if (configLab) configLab.modifie(true);
      return;
    }
    if (!t.hasAttribute('data-reglage-couleur')) return;
    var g = t.getAttribute('data-reglage-couleur');
    brouillonReglages.couleurs[g] = brouillonReglages.couleurs[g] || {};
    brouillonReglages.couleurs[g][t.getAttribute('data-valeur')] = t.value;
    if (configLab) { configLab.rafraichir('reglages'); configLab.modifie(true); }
  });
  ecoute.addEventListener('click', function (e) {
    var d = e.target.closest('[data-bento-deplacer]');
    if (!d || !brouillonReglages || d.disabled) return;
    var lb = bentoComplet(brouillonReglages.bento), i = lb.map(function (y) { return y.id; }).indexOf(d.getAttribute('data-id')), j = i + Number(d.getAttribute('data-bento-deplacer'));
    if (i < 0 || j < 0 || j >= lb.length) return;
    var tmp = lb[i]; lb[i] = lb[j]; lb[j] = tmp;
    brouillonReglages.bento = lb;
    if (configLab) { configLab.rafraichir('reglages'); configLab.modifie(true); }
  });
  ecoute.addEventListener('click', function (e) {
    var b = e.target.closest('[data-reglage-couleur-defaut]');
    if (!b || !brouillonReglages) return;
    var g = b.getAttribute('data-reglage-couleur-defaut');
    if (brouillonReglages.couleurs[g]) delete brouillonReglages.couleurs[g][b.getAttribute('data-valeur')];
    if (configLab) { configLab.rafraichir('reglages'); configLab.modifie(true); }
  });

  app.addEventListener('dragstart', function (e) {
    var el = e.target.closest && e.target.closest('[data-drag]');
    if (!el) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.getAttribute('data-drag'));
    el.classList.add('sp-ticket--glisse');
  });
  app.addEventListener('dragend', function (e) {
    var el = e.target.closest && e.target.closest('[data-drag]');
    if (el) el.classList.remove('sp-ticket--glisse');
    Array.prototype.forEach.call(app.querySelectorAll('.sp-colonne--survol'), function (c) { c.classList.remove('sp-colonne--survol'); });
  });
  app.addEventListener('dragover', function (e) {
    var col = e.target.closest && e.target.closest('[data-drop-table]');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('sp-colonne--survol');
  });
  app.addEventListener('dragleave', function (e) {
    var col = e.target.closest && e.target.closest('[data-drop-table]');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('sp-colonne--survol');
  });
  app.addEventListener('drop', function (e) {
    var col = e.target.closest && e.target.closest('[data-drop-table]');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('sp-colonne--survol');
    var source = String(e.dataTransfer.getData('text/plain') || '').split(':');
    if (source[0] !== col.getAttribute('data-drop-table')) return;
    deplacer(source[0], num(source[1]), col.getAttribute('data-drop-champ'), col.getAttribute('data-drop-valeur'));
  });

  ecoute.addEventListener('input', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-filtre') && el.type === 'search') {
      etat.filtres.q = el.value;
      var pos = el.selectionStart;
      rendre();
      var nouveau = document.getElementById('f-q');
      if (nouveau) { nouveau.focus(); try { nouveau.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
      return;
    }
    if (el.hasAttribute('data-champ-form') && etat.form && el.type !== 'radio') {
      etat.form[el.getAttribute('data-champ-form')] = el.value;
    }
    if (el.hasAttribute('data-brouillon')) {
      brouillon(el.getAttribute('data-brouillon'))[el.getAttribute('data-champ')] = el.value;
    }
    if (el.hasAttribute('data-ajout') && etat.ajout) {
      var cleA = el.getAttribute('data-ajout');
      etat.ajout[cleA] = el.value;
      if (cleA === 'Nom') {
        etat.ajout.proche = null;
        if (etat.ajout.emailAuto) {
          etat.ajout.Email = emailSuggere(el.value);
          var champEmail = document.getElementById('aj-email-' + etat.ajout.champ);
          if (champEmail) champEmail.value = etat.ajout.Email;
        }
      }
      if (cleA === 'Email') { etat.ajout.emailAuto = false; etat.ajout.memeEmail = null; }
    }
    if (el.hasAttribute('data-profil') && etat.profilForm) etat.profilForm[el.getAttribute('data-profil')] = el.value;
  });

  ecoute.addEventListener('change', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-filtre') && el.type !== 'search') {
      var cle = el.getAttribute('data-filtre');
      etat.filtres[cle] = el.type === 'checkbox' ? el.checked : el.value;
      rendre();
    } else if (el.hasAttribute('data-pilotage')) {
      var cleP = el.getAttribute('data-pilotage');
      etat.pilotage[cleP] = el.type === 'checkbox' ? el.checked : el.value;
      rendre();
    } else if (el.hasAttribute('data-mode')) {
      etat.modePlan = el.value; etat.suppression = null; rendre();
    } else if (el.hasAttribute('data-onglet')) {
      etat.onglet = el.value; etat.alerte = null; etat.suppression = null; rendre();
    } else if (el.hasAttribute('data-ajout-multiple') && el.value) {
      etat.form[el.getAttribute('data-ajout-multiple')].push(num(el.value));
      rendre();
    } else if (el.hasAttribute('data-theme') && etat.form) {
      var t = el.getAttribute('data-theme');
      etat.form.Thematiques = etat.form.Thematiques.filter(function (x) { return x !== t; });
      if (el.checked) etat.form.Thematiques.push(t);
    } else if (el.hasAttribute('data-champ-form') && etat.form) {
      etat.form[el.getAttribute('data-champ-form')] = el.value;
    } else if (el.hasAttribute('data-brouillon')) {
      brouillon(el.getAttribute('data-brouillon'))[el.getAttribute('data-champ')] = el.value;
      if (el.hasAttribute('data-rafraichir')) rendre();
    } else if (el.hasAttribute('data-decaler')) {
      brouillon(el.getAttribute('data-decaler')).Decaler = el.checked;
    } else if (el.hasAttribute('data-dep')) {
      var bd = brouillon(el.getAttribute('data-dep'));
      var vd = num(el.value);
      bd.Depend_de = (bd.Depend_de || []).filter(function (x) { return x !== vd; });
      if (el.checked) bd.Depend_de.push(vd);
    } else if (el.hasAttribute('data-role')) {
      rolesBrouillon[num(el.getAttribute('data-role'))] = el.checked ? 'Administration' : 'Membre';
    } else if (el.hasAttribute('data-ajout') && etat.ajout) {
      etat.ajout[el.getAttribute('data-ajout')] = el.value;
    } else if (el.hasAttribute('data-profil') && etat.profilForm) {
      etat.profilForm[el.getAttribute('data-profil')] = el.value;
    } else if (el.hasAttribute('data-etat-action')) {
      executer([['UpdateRecord', 'Actions', num(el.getAttribute('data-etat-action')), { Etat: el.value }]]);
    }
  });

  app.addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var type = form.getAttribute('data-form');
    var pid = num(form.getAttribute('data-projet'));
    if (type === 'projet') { enregistrerProjet(pid || null); return; }
    if (type === 'mon-profil') { enregistrerMonProfil(); return; }
    if (type === 'edit-action') { enregistrerAction(num(form.getAttribute('data-id'))); return; }

    var cle = type + '-' + pid;
    var b = brouillon(cle);
    var champs;
    if (type === 'action') {
      if (!String(b.Intitule || '').trim()) return;
      var jalonAjout = b.Type === 'Jalon';
      champs = seulementColonnes('Actions', { Projet: pid, Intitule: String(b.Intitule).trim(), Type: b.Type || 'Action', Parent: num(b.Parent),
        Responsable: num(b.Responsable), Debut: jalonAjout ? null : saisieVersDate(b.Debut), Fin: saisieVersDate(b.Fin), Etat: ETATS_ACTION[0] });
      executer([['AddRecord', 'Actions', null, champs]], jalonAjout ? 'Jalon ajouté.' : (num(b.Parent) ? 'Sous-action ajoutée.' : 'Action ajoutée.'), function () {
        var garder = { Parent: b.Parent, Responsable: b.Responsable };
        etat.brouillons[cle] = num(b.Parent) ? garder : {};
      });
    } else if (type === 'journal') {
      if (!String(b.Message || '').trim()) return;
      champs = { Projet: pid, Type: b.Type || 'Avancement', Message: String(b.Message).trim() };
      executer([['AddRecord', 'Journal', null, champs]], 'Message publié.', function () { delete etat.brouillons[cle]; });
    } else if (type === 'document') {
      if (!String(b.Titre || '').trim() || !lienSur(b.Lien)) {
        etat.alerte = { type: 'error', texte: 'Indiquez un titre et un lien commençant par https://.' };
        rendre();
        return;
      }
      champs = { Projet: pid, Titre: String(b.Titre).trim(), Type: b.Type || '', Lien: String(b.Lien).trim() };
      executer([['AddRecord', 'Documents', null, champs]], 'Document ajouté.', function () { delete etat.brouillons[cle]; });
    }
  });

  var ficheCourante = null;
  window.addEventListener('hashchange', function () {
    etat.alerte = null; etat.suppression = null; etat.ajout = null; etat.doublon = null; etat.pasMoi = null; etat.editionAction = null; etat.retro = null;
    var r = route();
    if (r.vue !== 'profil') etat.profilForm = null;
    if (r.vue === 'fiche' && r.id !== ficheCourante) { etat.onglet = 'presentation'; ficheCourante = r.id; }
    if (configLab) configLab.onglet(r.vue === 'reglages' ? 'reglages' : 'vue');
    rendre();
    window.scrollTo(0, 0);
  });

  // ---------------------------------------------------------------------------
  // Thème clair / sombre
  // ---------------------------------------------------------------------------

  var choixTheme = 'auto';
  try { choixTheme = localStorage.getItem('sp-theme') || 'auto'; } catch (e) { /* stockage indisponible */ }

  function themeGrist() {
    // Grist transmet ses couleurs au widget sous forme de variables CSS.
    var st = getComputedStyle(document.documentElement);
    var fond = (st.getPropertyValue('--grist-theme-page-bg') || st.getPropertyValue('--grist-theme-bg') || '').trim();
    var m = fond.match(/^#([0-9a-f]{6})$/i);
    if (!m) return null;
    var n = parseInt(m[1], 16);
    var lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum < 0.5 ? 'dark' : 'light';
  }

  function appliquerTheme() {
    var t = choixTheme;
    if (t === 'auto') {
      t = themeGrist() || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    document.documentElement.setAttribute('data-fr-theme', t);
  }

  var selectTheme = document.getElementById('sp-theme');
  selectTheme.value = choixTheme;
  selectTheme.addEventListener('change', function () {
    choixTheme = selectTheme.value;
    try { localStorage.setItem('sp-theme', choixTheme); } catch (e) { /* stockage indisponible */ }
    appliquerTheme();
  });
  new MutationObserver(appliquerTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', appliquerTheme);
  }

  // ---------------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------------

  appliquerTheme();

  function erreurChargement(err) {
    app.innerHTML = '<div class="fr-alert fr-alert--error"><h2 class="fr-alert__title">Chargement impossible</h2>' +
      '<p>Vérifiez que le widget a l\'accès « Accès complet au document ». Détail : ' + esc((err && err.message) || err) + '</p></div>';
  }

  if (DEMO) {
    document.getElementById('sp-demo').hidden = false;
    charger().then(assurerCompte).then(rendre).catch(erreurChargement);
  } else {
    grist.ready({ requiredAccess: 'full', allowSelectBy: false });
    var attente = null;
    // Grist prévient quand la table liée change : on recharge tout, sans perdre la saisie en cours.
    grist.onRecords(function () {
      clearTimeout(attente);
      attente = setTimeout(function () {
        charger().then(function () { return aTable('Projets') && !PUBLIC ? assurerCompte() : null; }).then(function () {
          appliquerTheme();
          if (!aTable('Projets')) { rendre(); return; }
          // Première visite sans profil : il est créé à partir de l'adresse du compte (prénom.nom@…).
          if (!etat.accueilVu && profilManquant()) { etat.accueilVu = true; creerProfilAuto(); return; }
          etat.accueilVu = true;
          rendre();
        }).catch(erreurChargement);
      }, 150);
    });
  }
})();
