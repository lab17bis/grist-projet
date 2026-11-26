"""Table déjà présente aux colonnes différentes : le widget le signale et propose de compléter.
Serveur attendu : la racine du dépôt sur PORT (par défaut 8766). Utilise l'API Grist simulée de test/grist-mock.js."""
import os, sys
from playwright.sync_api import sync_playwright
PORT = os.environ.get('PORT', '8766')
ok = ko = 0
def verifier(nom, cond):
    global ok, ko
    print(('OK   ' if cond else 'ÉCHEC ') + nom); ok += bool(cond); ko += (not cond)
MOCK = open(os.environ.get('MOCK', '/home/claude/test/grist-mock.js')).read()
HOTE = '<!DOCTYPE html><html><body style="margin:0"><iframe id="w" style="width:100%;height:100vh;border:0"></iframe><script>window.charger=function(u){document.getElementById("w").src=u;};</script></body></html>'
def ouvrir(b, tables, table):
    pg = b.new_page(viewport={'width': 1280, 'height': 900}); err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.route('**/grist-plugin-api.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    pg.route('https://data.geopf.fr/**', lambda r: r.fulfill(status=204))
    pg.route(f'http://localhost:{PORT}/__hote.html', lambda r: r.fulfill(status=200, content_type='text/html', body=HOTE))
    pg.goto(f'http://localhost:{PORT}/__hote.html')
    pg.evaluate('([m,u]) => { window.MOCK = m; charger(u); }', [{'tables': tables, 'table': table, 'utilisateur': {'email': 'test@exemple.fr', 'nom': 'Test'}}, '/suivi-projets/index.html'])
    pg.wait_for_timeout(1500)
    return pg, pg.frame_locator('#w'), err
def texte(f): return f.locator('body').inner_text()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    pg, f, err = ouvrir(b, {'Projets': {'colonnes': {'Nom': {'type': 'Text'}}, 'lignes': [{'id': 1, 'Nom': 'Intranet'}]}}, 'Projets')
    x = texte(f)
    verifier('Projets présente mais incomplète : alerte', 'ne contient pas tout' in x and 'Projets.Titre' in x and 'renommez-la' in x)
    f.get_by_role('button', name='Compléter le document').click(); pg.wait_for_timeout(3000)
    d = pg.evaluate('window.MOCK')['tables']
    verifier('document complété : tables créées, Projets complétée, données gardées', all(t in d for t in ['Actions', 'Personnes', 'Structures']) and 'Titre' in d['Projets']['colonnes'] and d['Projets']['lignes'][0]['Nom'] == 'Intranet')
    verifier('aucune erreur', not err); pg.close()
    b.close()
print(f'{ok} OK, {ko} échec(s)'); sys.exit(1 if ko else 0)
