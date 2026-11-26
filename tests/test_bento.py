"""Agencement libre de la fiche projet (bento), mode démo. Serveur : python3 -m http.server 8766 à la racine du dépôt."""
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
    pg.goto(BASE + "/suivi-projets/")
    pg.wait_for_selector(".sp-cartes")
    pg.locator(".fr-card a, .fr-card__link").first.click()
    pg.wait_for_selector(".sp-infos")
    ok("sans réglage, la fiche garde sa présentation d'origine", pg.locator(".sp-bento").count() == 0)
    pg.goto(BASE + "/suivi-projets/#/")
    pg.wait_for_selector(".sp-cartes")
    pg.locator("label.fr-label", has_text="Réglages").first.click()
    pg.wait_for_selector("#rg-bento-actif")
    ok("aucune ligne de bloc tant que l'agencement n'est pas activé", pg.locator(".sp-bento-ligne").count() == 0)
    pg.click("label[for=rg-bento-actif]")
    pg.wait_for_selector(".sp-bento-ligne")
    ok("7 blocs réglables", pg.locator(".sp-bento-ligne").count() == 7)
    pg.select_option("#rg-bt-resume", "3")
    pg.select_option("#rg-bt-equipe", "4")
    pg.click("[data-bento-deplacer='1'][data-id=resume]")
    pg.wait_for_timeout(200)
    ordre = pg.eval_on_selector_all(".sp-bento-ligne select", "e => e.map(x => x.getAttribute('data-id'))")
    ok("« En bref » est descendu d'un rang", ordre[:2] == ["mission", "resume"], ordre)
    pg.click("label[for=rg-bl-details]")
    pg.locator("label.fr-label", has_text="Aperçu").first.click()
    pg.wait_for_selector("[inert] .sp-bento")
    classes = pg.eval_on_selector_all("[inert] .sp-bloc", "e => e.map(x => x.className)")
    ok("aperçu : blocs sur la grille, « Structures, origine… » masqué", len(classes) >= 3 and not any("details" in c for c in classes), classes)
    ok("aperçu : largeur Deux tiers pour le bloc équipe", any("sp-bloc--4" in c for c in classes), classes)
    pg.locator("label.fr-label", has_text="Réglages").first.click()
    pg.click("label[for=rg-bento-actif]")
    pg.wait_for_timeout(200)
    ok("désactiver l'agencement revient à la présentation d'origine", pg.locator(".sp-bento-ligne").count() == 0)
    b.close()

print("\n".join(res))
if err:
    print("\n".join(err))
bad = [r for r in res if r.startswith("ÉCHEC")]
print("%d réussis, %d échoués, %d erreurs" % (len(res) - len(bad), len(bad), len(err)))
sys.exit(1 if bad or err else 0)
