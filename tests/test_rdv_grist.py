"""Dans Grist (API simulée avec métadonnées) : colonnes existantes de Projets, branchement de l'onglet Rendez-vous sur la table Reunions, suppression en cascade."""
import copy, datetime, json, os, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8766"
res, err = [], []


def ok(nom, cond, detail=""):
    res.append(("OK " if cond else "ÉCHEC ") + nom + (" — " + str(detail) if detail else ""))


STUB = """
window.grist = (function () {
  var tables = window.parent.__TABLES__, colonnes = window.parent.__COLS__;
  function cols(rows) {
    var c = { id: [] }, keys = {};
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { keys[k] = 1; }); });
    Object.keys(keys).forEach(function (k) { if (k !== 'id') c[k] = []; });
    rows.forEach(function (r) { c.id.push(r.id); Object.keys(c).forEach(function (k) { if (k === 'id') return; var v = r[k]; if (Array.isArray(v)) v = ['L'].concat(v); c[k].push(v === undefined ? null : v); }); });
    return c;
  }
  function meta(t) {
    if (t === '_grist_Tables') return cols(Object.keys(colonnes).map(function (n, i) { return { id: i + 1, tableId: n }; }));
    var l = [], n = 0;
    Object.keys(colonnes).forEach(function (t, i) { colonnes[t].forEach(function (c) { l.push(Object.assign({ id: ++n, parentId: i + 1, label: c.colId, isFormula: false, widgetOptions: '', description: '', visibleCol: 0 }, c)); }); });
    return cols(l);
  }
  return {
    ready: function (o) { window.parent.__READY__ = o; },
    onRecords: function (f) { setTimeout(function () { f([]); }, 50); },
    docApi: {
      fetchTable: function (t) {
        if (t === '_grist_Tables' || t === '_grist_Tables_column') return Promise.resolve(meta(t));
        return Promise.resolve(cols(tables[t] || []));
      },
      applyUserActions: function (actions) {
        window.parent.__ACTIONS__ = (window.parent.__ACTIONS__ || []).concat(actions);
        var ret = actions.map(function (a) {
          if (a[0] === 'AddColumn') { colonnes[a[1]].push({ colId: a[2], type: a[3].type, label: a[3].label || a[2] }); return null; }
          if (a[0] === 'ModifyColumn' || a[0] === 'SetDisplayFormula') return null;
          var t = tables[a[1]] = tables[a[1]] || [];
          if (a[0] === 'AddRecord') { var id = t.reduce(function (m, l) { return Math.max(m, l.id); }, 0) + 1; var ch = Object.assign({}, a[3], { id: id }); t.push(ch); return id; }
          if (a[0] === 'UpdateRecord') { Object.assign(t.find(function (l) { return l.id === a[2]; }), a[3]); }
          if (a[0] === 'RemoveRecord') { tables[a[1]] = t.filter(function (l) { return l.id !== a[2]; }); }
          if (a[0] === 'BulkRemoveRecord') { tables[a[1]] = t.filter(function (l) { return a[2].indexOf(l.id) === -1; }); }
          return null;
        });
        return Promise.resolve({ retValues: ret });
      }
    }
  };
})();
"""


def jours(donnees):
    for rows in donnees.values():
        if not isinstance(rows, list):
            continue
        for r in rows:
            for k in ("Echeance", "Debut", "Fin", "Date_debut", "Date"):
                if isinstance(r.get(k), str):
                    d = datetime.date.fromisoformat(r[k])
                    r[k] = int(datetime.datetime(d.year, d.month, d.day, tzinfo=datetime.timezone.utc).timestamp())
    return donnees


def cols_projets():
    c = ["Titre", "Resume", "Structure_porteuse", "Phase", "Etat", "Origine", "Mission", "Objectifs", "Thematiques", "Config_suivi", "Avancement"]
    l = [{"colId": x, "type": "Text"} for x in c]
    l.append({"colId": "objectifs_livrables", "type": "Text", "label": "Objectifs livrables"})
    l.append({"colId": "Budget_calcule", "type": "Numeric", "isFormula": True, "formula": "$Mission_id * 2"})
    l.append({"colId": "Colonne_vide", "type": "Text", "isFormula": True, "formula": ""})
    l.append({"colId": "Pilote", "type": "Ref:Personnes"})
    return l


with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"], executable_path=os.environ.get("CHROME") or None)
    donnees = jours(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "donnees-fictives", "exemple.json"), encoding="utf-8")))
    donnees.pop("_avertissement", None)

    def ouvrir(nom, tables, colonnes):
        page = b.new_page(viewport={"width": 1280, "height": 1000})
        page.on("pageerror", lambda e: err.append(nom + " pageerror: %s" % e))
        page.route("https://docs.getgrist.com/grist-plugin-api.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=STUB))
        h = ("<!DOCTYPE html><html><body style='margin:0'><script>window.__TABLES__=%s;window.__COLS__=%s;</script>"
             "<iframe id='w' src='/suivi-projets/' style='width:1260px;height:980px;border:0'></iframe></body></html>") % (json.dumps(tables), json.dumps(colonnes))
        page.route(BASE + "/hote-" + nom + ".html", lambda r: r.fulfill(status=200, content_type="text/html", body=h))
        page.goto(BASE + "/hote-" + nom + ".html")
        page.wait_for_timeout(1500)
        return page, page.frame_locator("#w")

    base_cols = {"Projets": cols_projets(), "Structures": [{"colId": "Nom", "type": "Text"}], "Personnes": [{"colId": "Nom", "type": "Text"}],
                 "Comptes": [{"colId": "Email", "type": "Text"}], "Actions": [{"colId": "Intitule", "type": "Text"}], "Journal": [{"colId": "Message", "type": "Text"}],
                 "Documents": [{"colId": "Titre", "type": "Text"}], "Parametres": [{"colId": "Cle", "type": "Text"}]}
    reunion_base = [{"colId": c, "type": "Text"} for c in ("Titre", "Date", "Heure", "Participants", "Objectif", "Statut")]

    # A. Reunions de l'outil Réunions, sans les colonnes du branchement
    t = copy.deepcopy(donnees); t["Reunions"] = []
    c = copy.deepcopy(base_cols); c["Reunions"] = copy.deepcopy(reunion_base)
    pg, fr = ouvrir("a", t, c)
    frame = pg.frame(url=lambda u: "/suivi-projets/" in u)
    frame.evaluate("location.hash = '#/projet/1'"); pg.wait_for_timeout(300)
    ok("A : pas d'onglet Rendez-vous avant branchement", fr.locator("label[for=o-rendezvous]").count() == 0)
    fr.locator("label.fr-label", has_text="Réglages").first.click()
    fr.locator("[data-action=activer-rdv]").wait_for()
    ok("A : colonne existante proposée, colonne calculée et colonne native exclues",
       "objectifs_livrables" in fr.locator("#nc-existante").inner_text() and "Colonne_vide" in fr.locator("#nc-existante").inner_text() and "Budget_calcule" not in fr.locator("#nc-existante").inner_text()
       and "Pilote" not in fr.locator("#nc-existante").inner_text() and "Mission" not in fr.locator("#nc-existante").inner_text())
    fr.locator("[data-action=utiliser-colonne]").click()
    fr.locator("code:has-text('objectifs_livrables')").wait_for()
    ok("A : colonne reprise sans AddColumn à l'enregistrement", True)
    fr.locator("[data-cl-enregistrer]").click(); pg.wait_for_timeout(600)
    acts = pg.evaluate("window.__ACTIONS__ || []")
    ok("A : enregistrer ne crée pas la colonne existante", not any(a[0] == "AddColumn" and a[2] == "objectifs_livrables" for a in acts), [a[:3] for a in acts if a[0] == "AddColumn"])
    ok("A : le champ repris est enregistré dans la configuration", any(a[0] == "ModifyColumn" and a[2] == "Config_suivi" and "objectifs_livrables" in a[3].get("description", "") for a in acts))
    fr.locator("[data-action=activer-rdv]").click(); pg.wait_for_timeout(800)
    acts = pg.evaluate("window.__ACTIONS__ || []")
    ajoutees = [a[2] for a in acts if a[0] == "AddColumn" and a[1] == "Reunions"]
    ok("A : activation = colonnes Projet et Notes ajoutées à Reunions, rien d'autre", sorted(ajoutees) == ["Notes", "Projet"] and not any(a[0] == "AddTable" for a in acts), ajoutees)
    ok("A : le libellé du projet s'affiche dans la colonne Projet", any(a[0] == "SetDisplayFormula" and a[1] == "Reunions" for a in acts))
    fr.locator("label.fr-label", has_text="Projets").first.click(); pg.wait_for_timeout(300)
    frame.evaluate("location.hash = '#/projet/1'"); pg.wait_for_timeout(400)
    ok("A : onglet Rendez-vous visible après branchement", fr.locator("label[for=o-rendezvous]").count() == 1)
    fr.locator("label[for=o-rendezvous]").click()
    fr.locator("#rdv-1-titre").fill("Point avec le référent"); fr.locator("#rdv-1-date").fill("2026-12-10"); fr.locator("#rdv-1-notes").fill("À suivre.")
    fr.locator("form[data-form=rdv] button[type=submit]").click(); pg.wait_for_timeout(600)
    ajout = [a for a in pg.evaluate("window.__ACTIONS__") if a[0] == "AddRecord" and a[1] == "Reunions"]
    ok("A : rendez-vous écrit dans Reunions avec le projet", bool(ajout) and ajout[-1][3].get("Projet") == 1 and ajout[-1][3].get("Titre") == "Point avec le référent" and ajout[-1][3].get("Notes") == "À suivre.", ajout)
    pg.close()

    # B. Pas de table Reunions : pas de création, consigne d'installer l'outil Réunions
    t = copy.deepcopy(donnees)
    pg, fr = ouvrir("b", t, copy.deepcopy(base_cols))
    fr.locator("label.fr-label", has_text="Réglages").first.click()
    fr.locator("#nc-existante").wait_for()
    ok("B : sans table Reunions, pas de bouton, consigne d'installer l'outil Réunions", fr.locator("[data-action=activer-rdv]").count() == 0 and "outil Réunions" in fr.locator("body").inner_text())
    pg.close()

    # C. Table déjà branchée, réunion enrichie : suppression en cascade
    t = copy.deepcopy(donnees)
    t["Reunions"] = [{"id": 7, "Projet": 1, "Titre": "Revue", "Date": 1795000000, "Notes": ""}, {"id": 8, "Projet": 2, "Titre": "Autre", "Date": 1795000000}]
    t["Points"] = [{"id": 1, "Reunion": 7, "Titre": "Point A"}, {"id": 2, "Reunion": 8, "Titre": "Point B"}]
    t["Decisions"] = [{"id": 1, "Reunion": 7, "Texte": "Décision"}]
    c = copy.deepcopy(base_cols)
    c["Reunions"] = copy.deepcopy(reunion_base) + [{"colId": "Projet", "type": "Ref:Projets"}, {"colId": "Notes", "type": "Text"}]
    c["Points"] = [{"colId": "Reunion", "type": "Ref:Reunions"}]; c["Decisions"] = [{"colId": "Reunion", "type": "Ref:Reunions"}]
    pg, fr = ouvrir("c", t, c)
    frame = pg.frame(url=lambda u: "/suivi-projets/" in u)
    frame.evaluate("location.hash = '#/projet/1'"); pg.wait_for_timeout(300)
    ok("C : onglet déjà actif, une réunion du projet", "Rendez-vous (1)" in fr.locator(".sp-onglets").inner_text())
    fr.locator("label[for=o-rendezvous]").click()
    fr.locator("[data-action=demander-suppression]").first.click()
    fr.locator("[data-action=supprimer]").click(); pg.wait_for_timeout(700)
    acts = pg.evaluate("window.__ACTIONS__ || []")
    ok("C : suppression en cascade (points, décisions de cette réunion seulement, puis la réunion)",
       any(a[0] == "BulkRemoveRecord" and a[1] == "Points" and a[2] == [1] for a in acts) and any(a[0] == "BulkRemoveRecord" and a[1] == "Decisions" and a[2] == [1] for a in acts)
       and any(a[0] == "RemoveRecord" and a[1] == "Reunions" and a[2] == 7 for a in acts), acts)
    ok("C : points d'une autre réunion conservés", pg.evaluate("window.__TABLES__.Points.map(function(x){return x.id})") == [2])
    pg.close()
    b.close()

print("\n".join(res))
print("ERREURS :", err if err else "aucune")
sys.exit(1 if any(r.startswith("ÉCHEC") for r in res) or err else 0)
