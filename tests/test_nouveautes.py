"""Colonnes existantes, champs de carte, filtres de la banque, onglet Rendez-vous (mode démonstration)."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8766"
res, err = [], []


def ok(nom, cond, detail=""):
    res.append(("OK " if cond else "ÉCHEC ") + nom + (" — " + str(detail) if detail else ""))


def reglages(pg):
    pg.goto(BASE + "/suivi-projets/#/")
    pg.wait_for_selector(".sp-cartes")
    pg.locator("label.fr-label", has_text="Réglages").first.click()
    pg.wait_for_selector("#nc-existante")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1300, "height": 1000})
    # Régression 2026-11-26 : le style commun masquait tout élément dont l'id finit par « -etat » (filtre État de la banque).
    pg.goto(BASE + "/suivi-projets/#/"); pg.wait_for_selector(".sp-cartes")
    ok("filtre État visible dans la banque", pg.locator("#f-etat").is_visible())
    pg.on("pageerror", lambda e: err.append("pageerror: %s" % e))
    pg.on("console", lambda m: err.append("console: %s" % m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "favicon" not in m.text and "404" not in m.text else None)
    pg.goto(BASE + "/suivi-projets/")
    pg.wait_for_selector(".sp-cartes")

    # état d'origine : trois filtres, pas de thématique sur la carte
    ok("filtres par défaut : structure, phase, état", pg.locator("#f-structure, #f-phase, #f-etat").count() == 3 and pg.locator("#f-Thematiques").count() == 0)
    ok("carte sans thématiques par défaut", "Thématiques :" not in pg.inner_text(".sp-cartes"))

    # (c) colonne existante de Projets reprise dans la fiche
    reglages(pg)
    ok("colonne existante proposée", "Livrables attendus" in pg.locator("#nc-existante").inner_text())
    ok("colonnes natives non proposées", "Mission" not in pg.locator("#nc-existante").inner_text() and "Config_suivi" not in pg.locator("#nc-existante").inner_text())
    pg.click("[data-action=utiliser-colonne]")
    pg.wait_for_selector("code:has-text('Livrables_attendus')")
    ok("colonne reprise comme champ", True)
    ok("colonne déjà reprise n'est plus proposée", pg.locator("#nc-existante").count() == 0)
    pg.click("label[for=rg-car-Livrables_attendus]")

    # (a) champ d'origine sur la carte ; (b) filtres
    pg.click("label[for=rg-carte-Thematiques]")
    pg.click("label[for=rg-filtre-Thematiques]")
    pg.click("label[for=rg-filtre-etat]")
    pg.click("[data-cl-enregistrer]")
    pg.wait_for_timeout(500)
    pg.locator(".cl-barre .cl-onglets label", has_text="Aperçu").click()
    pg.wait_for_selector(".sp-cartes")
    txt = pg.inner_text(".sp-cartes")
    ok("carte : thématiques affichées", "Thématiques : Ressources humaines" in txt)
    ok("carte : colonne existante affichée", "Livrables attendus : Tableau de bord mensuel." in txt)
    ok("filtre Thématiques présent, filtre État retiré", pg.locator("#f-Thematiques").count() == 1 and pg.locator("#f-etat").count() == 0)
    avant = pg.locator(".sp-cartes .fr-card").count()
    pg.select_option("#f-Thematiques", "Ressources humaines")
    apres = pg.locator(".sp-cartes .fr-card").count()
    ok("filtre Thématiques filtre la banque", 0 < apres < avant, "%d -> %d" % (avant, apres))

    # (d) onglet Rendez-vous
    pg.goto(BASE + "/suivi-projets/#/projet/1")
    pg.wait_for_selector("label[for=o-rendezvous]")
    ok("onglet Rendez-vous avec compteur", "Rendez-vous (2)" in pg.inner_text(".sp-onglets"))
    pg.click("label[for=o-rendezvous]")
    pg.wait_for_selector("form[data-form=rdv]")
    t = pg.inner_text("#sp-app")
    ok("rendez-vous du projet listés", "Point d'étape avec la direction" in t and "Rencontre avec un service accueillant" in t and "Recueil des besoins" not in t)
    ok("rendez-vous à venir signalé", "à venir" in t.lower())
    pg.fill("#rdv-1-titre", "Atelier avec les référents")
    pg.fill("#rdv-1-date", "2026-12-03")
    pg.fill("#rdv-1-notes", "Premiers retours positifs.")
    pg.click("form[data-form=rdv] button[type=submit]")
    pg.wait_for_selector("text=Rendez-vous (3)")
    ok("rendez-vous ajouté", "Atelier avec les référents" in pg.inner_text("#sp-app") and "Premiers retours positifs." in pg.inner_text("#sp-app"))
    # modifier les notes
    pg.locator("[data-action=editer-rdv]").first.click()
    pg.wait_for_selector("form[data-form=edit-rdv]")
    pg.fill("form[data-form=edit-rdv] textarea", "Notes corrigées.")
    pg.click("form[data-form=edit-rdv] button[type=submit]")
    pg.wait_for_selector("text=Rendez-vous enregistré")
    ok("notes modifiées", "Notes corrigées." in pg.inner_text("#sp-app"))
    # supprimer
    pg.locator("[data-action=demander-suppression]").first.click()
    pg.click("[data-action=supprimer]")
    pg.wait_for_selector("text=Rendez-vous (2)")
    ok("rendez-vous supprimé", "Notes corrigées." not in pg.inner_text("#sp-app"))
    pg.goto(BASE + "/suivi-projets/#/projet/2")
    pg.wait_for_selector("label[for=o-rendezvous]")
    pg.click("label[for=o-rendezvous]")
    ok("rendez-vous d'un autre projet séparés", "Recueil des besoins" in pg.inner_text("#sp-app") and "Point d'étape" not in pg.inner_text("#sp-app"))
    b.close()

print("\n".join(res))
print("ERREURS CONSOLE :", err if err else "aucune")
sys.exit(1 if any(r.startswith("ÉCHEC") for r in res) or err else 0)
