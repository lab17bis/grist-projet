"""Personnes créée par l'annuaire (colonne Email = donnée) : une personne ajoutée depuis le formulaire projet
reçoit son adresse dans Email (et non dans Email_saisi), pour que l'annuaire et ses règles d'accès la voient.
Serveur attendu : la racine du dépôt sur PORT (par défaut 8766). Utilise l'API Grist simulée de /home/claude/test/grist-mock.js."""
import os, json
from playwright.sync_api import sync_playwright
PORT = os.environ.get('PORT', '8766')
ok = ko = 0
def verifier(nom, cond):
    global ok, ko
    print(('OK   ' if cond else 'ÉCHEC ') + nom); ok += bool(cond); ko += (not cond)
RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MOCK = open(os.environ.get('MOCK', '/home/claude/test/grist-mock.js')).read()
HOTE = '<!DOCTYPE html><html><body style="margin:0"><iframe id="w" style="width:100%;height:100vh;border:0"></iframe><script>window.charger=function(u){document.getElementById("w").src=u;};</script></body></html>'
sch = json.load(open(os.path.join(RACINE, 'suivi-projets', 'schema.json')))['tables']
def tables(email_donnee):
    t = {}
    for nom, cols in sch.items():
        t[nom] = {'colonnes': {c['id']: {'type': c['type'], 'isFormula': bool(c.get('isFormula')), 'formula': c.get('formula') or ''} for c in cols}, 'lignes': []}
    if email_donnee:
        t['Personnes']['colonnes']['Email'] = {'type': 'Text', 'isFormula': False, 'formula': ''}
    t['Personnes']['lignes'] = [{'id': 1, 'Nom': 'Test', 'Email': 'test@exemple.fr', 'Email_saisi': 'test@exemple.fr', 'Role': 'Administration'}]
    t['Comptes']['lignes'] = [{'id': 1, 'Email': 'test@exemple.fr', 'Profil': 1}]
    return t
def essai(b, email_donnee):
    pg = b.new_page(viewport={'width': 1280, 'height': 900}); err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.route('**/grist-plugin-api.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    pg.route(f'http://localhost:{PORT}/__hote.html', lambda r: r.fulfill(status=200, content_type='text/html', body=HOTE))
    pg.goto(f'http://localhost:{PORT}/__hote.html')
    pg.evaluate('([m,u]) => { window.MOCK = m; charger(u); }', [{'tables': tables(email_donnee), 'table': 'Projets', 'utilisateur': {'email': 'test@exemple.fr', 'nom': 'Test'}}, '/suivi-projets/index.html#/nouveau'])
    pg.wait_for_timeout(2500)
    f = pg.frame_locator('#w')
    f.locator('.sp-ajout-personne').first.click()
    f.locator('[data-ajout=Nom]').first.fill('MARTIN Claire')
    f.locator('[data-ajout=Email]').first.fill('claire.martin@exemple.fr')
    f.locator('[data-action=creer-personne]').first.click()
    pg.wait_for_timeout(1500)
    lignes = pg.evaluate('window.MOCK')['tables']['Personnes']['lignes']
    pg.close()
    return [l for l in lignes if l.get('Nom') == 'MARTIN Claire'], err
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    l, err = essai(b, True)
    verifier('Email donnée (annuaire) : adresse écrite dans Email', len(l) == 1 and l[0].get('Email') == 'claire.martin@exemple.fr')
    verifier('Email donnée : aucune erreur JavaScript', not err)
    l, err = essai(b, False)
    verifier('Email formule (schéma projet) : adresse écrite dans Email_saisi', len(l) == 1 and l[0].get('Email_saisi') == 'claire.martin@exemple.fr')
    verifier('Email formule : aucune erreur JavaScript', not err)
    b.close()
print(f'\n{ok} réussis, {ko} échoués')
