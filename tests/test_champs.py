"""Champs personnalisés, champs masqués, aperçu réel (mode démo)."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8766"
res, err = [], []


def ok(nom, cond, detail=""):
    res.append(("OK " if cond else "ÉCHEC ") + nom + (" — " + str(detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1300, "height": 1000})
    pg.on("pageerror", lambda e: err.append("pageerror: %s" % e))
    pg.on("console", lambda m: err.append("console: %s" % m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "favicon" not in m.text and "404" not in m.text else None)
    pg.goto(BASE + "/suivi-projets/")
    pg.wait_for_selector(".sp-cartes")

    # 1. formulaire d'origine : Mission présente
    pg.goto(BASE + "/suivi-projets/#/nouveau")
    pg.wait_for_selector("form[data-form=projet]")
    ok("Mission visible par défaut", pg.locator("#p-mission").count() == 1)

    # 2. Réglages : masquer Mission et Objectifs, ajouter « Livrable final » et un choix
    pg.goto(BASE + "/suivi-projets/#/")
    pg.wait_for_selector(".sp-cartes")
    pg.locator("label.fr-label", has_text="Réglages").first.click()
    pg.wait_for_selector("[data-champ-masque=Mission]")
    pg.click("label[for=rg-masque-Mission]")
    pg.click("label[for=rg-masque-Objectifs]")
    pg.fill("#nc-label", "Livrable final")
    pg.click("label[for=nc-requis]")
    pg.click("label[for=nc-carte]")
    pg.click("[data-action=ajouter-champ-perso]")
    pg.wait_for_selector("code:has-text('Livrable_final')")
    ok("champ ajouté aux réglages", True)
    pg.fill("#nc-label", "Indicateur")
    pg.select_option("#nc-type", "choix")
    pg.fill("#nc-choix", "Atteint\nPartiel\nNon atteint")
    pg.click("[data-action=ajouter-champ-perso]")
    pg.wait_for_selector("code:has-text('Indicateur')")
    pg.fill("#nc-label", "Livrable final")
    pg.click("[data-action=ajouter-champ-perso]")
    ok("doublon de colonne refusé", pg.locator("code:has-text('Livrable_final')").count() == 1)
    pg.click("[data-cl-enregistrer]")
    pg.wait_for_timeout(500)

    # 3. aperçu réel
    pg.locator("label.fr-label", has_text="Aperçu").first.click()
    pg.wait_for_selector(".cl-apercu .sp-cartes")
    ok("aperçu = vraies cartes", pg.locator(".cl-apercu .fr-card").count() >= 2)
    ok("aperçu sans faux exemple", pg.get_by_text("Exemple de projet").count() == 0)
    pg.locator(".cl-barre .cl-onglets label", has_text="Aperçu").click()

    # 4. formulaire : Mission absente, champs perso présents
    pg.goto(BASE + "/suivi-projets/#/nouveau")
    pg.wait_for_selector("form[data-form=projet]")
    ok("Mission masquée", pg.locator("#p-mission").count() == 0 and pg.locator("#p-objectifs").count() == 0)
    ok("Livrable final présent", pg.locator("#pp-Livrable_final").count() == 1)
    ok("Indicateur (choix) présent", pg.locator("#pp-Indicateur option").count() == 4)

    # 5. obligatoire
    pg.fill("#p-titre", "Projet de test champs")
    pg.select_option("#p-structure", index=1)
    pg.select_option("[data-ajout-multiple=Porteurs]", index=1)
    pg.click("button[type=submit]")
    pg.wait_for_selector(".fr-alert--error")
    ok("champ obligatoire vérifié", "Livrable final" in pg.locator(".fr-alert--error").inner_text())
    pg.fill("#pp-Livrable_final", "Guide d'usage")
    pg.select_option("#pp-Indicateur", "Partiel")
    pg.click("button[type=submit]")
    pg.wait_for_selector("text=Modifier la fiche")
    ok("projet enregistré", True)

    # 6. fiche et carte
    ok("fiche : livrable affiché", "Guide d'usage" in pg.inner_text("#sp-app"))
    ok("fiche : indicateur affiché", "Partiel" in pg.inner_text("#sp-app"))
    pg.goto(BASE + "/suivi-projets/#/")
    pg.wait_for_selector(".sp-cartes")
    ok("carte : livrable affiché", "Livrable final : Guide d'usage" in pg.inner_text(".sp-cartes"))
    b.close()

for l in res:
    print(l)
for e in err:
    print("ERREUR", e)
sys.exit(1 if any(l.startswith("ÉCHEC") for l in res) or err else 0)
