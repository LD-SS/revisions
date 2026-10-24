/* =====================================================================
   APP — démarrage, navigation, barre du haut, thème
   ---------------------------------------------------------------------
   Navigation par l'adresse après « # » (fonctionne sur GitHub Pages sans configuration) :
     #/                              accueil (tuiles des matières)
     #/m/<matière>                   chapitres d'une matière
     #/m/<matière>/<chapitre>[/<onglet>]   synthese | flashcards | exercices
     #/progression  #/planning       étape 4
     #/parametres                    paramètres
   Pour ajouter une page : une entrée dans ROUTES + un module dans js/vues/.
   ===================================================================== */

import { esc, toast } from './utils.js';
import { icone } from './icones.js';
import { nomCourt, styleMatiere } from './matieres.js';
import { chargerIndex, matieres } from './store.js';
import { vueAccueil } from './vues/accueil.js';
import { vueMatiere } from './vues/matiere.js';
import { vueChapitre } from './vues/chapitre.js';
import { vueParametres } from './vues/parametres.js';
import { vueAtelier } from './vues/atelier.js';
import { majBoutonProposer, viderAttente } from './proposer.js';

const VERSION = '0.8.1 (arrêt du tracé facilité)';
const vue = document.getElementById('vue');
let nettoyer = null; // fonction fournie par la page affichée, appelée avant d'en changer

/* ---------- Thème : 'auto' | 'light' | 'dark' (stocké tel quel, lu aussi dans index.html) ---------- */
const CLE_THEME = 'revisions.theme';
function theme() {
  try { return localStorage.getItem(CLE_THEME) || 'auto'; } catch { return 'auto'; }
}
function changerTheme(t) {
  try { t === 'auto' ? localStorage.removeItem(CLE_THEME) : localStorage.setItem(CLE_THEME, t); } catch { /* rien */ }
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  majBoutonTheme();
}
function majBoutonTheme() {
  const t = theme();
  const libelles = { auto: 'Thème automatique', light: 'Thème clair', dark: 'Thème sombre' };
  const btn = document.getElementById('btn-theme');
  btn.innerHTML = icone({ auto: 'auto', light: 'soleil', dark: 'lune' }[t]);
  btn.title = `${libelles[t]} (cliquer pour changer)`;
}
document.getElementById('btn-theme').addEventListener('click', () => {
  const suivant = { auto: 'light', light: 'dark', dark: 'auto' }[theme()];
  changerTheme(suivant);
  toast({ auto: 'Thème automatique', light: 'Thème clair', dark: 'Thème sombre' }[suivant]);
  // La page Paramètres affiche aussi le choix : on la redessine si elle est ouverte.
  if (location.hash.startsWith('#/parametres')) router();
});

/* ---------- Barre d'onglets ---------- */
function rendreOnglets(route) {
  const actif = (cond) => (cond ? 'active' : '');
  const tabs = [
    `<a class="tab ${actif(route[0] === '')}" href="#/">${icone('accueil')}<span class="txt">Accueil</span></a>`,
    ...matieres().map((m) => `<a class="tab mc ${actif(route[0] === 'm' && route[1] === m.id)}" ${styleMatiere(m)} href="#/m/${esc(m.id)}" title="${esc(m.nom)}">
      ${icone(m.icone)}<span class="txt">${esc(nomCourt(m))}</span></a>`),
    ...(matieres().some((m) => m.id === 'dessin') ? [`<a class="tab mc ${actif(route[0] === 'dessin')}" ${styleMatiere(matieres().find((m) => m.id === 'dessin'))} href="#/dessin" title="Atelier de dessin : exercices à dessiner dans l'appli">
      ${icone('crayon')}<span class="txt">Atelier dessin</span></a>`] : []),
    `<a class="tab future ${actif(route[0] === 'progression')}" href="#/progression">${icone('progression')}<span class="txt">Progression</span></a>`,
    `<a class="tab future ${actif(route[0] === 'planning')}" href="#/planning">${icone('calendrier')}<span class="txt">Planning</span></a>`,
    `<a class="tab ${actif(route[0] === 'parametres')}" href="#/parametres">${icone('reglages')}<span class="txt">Paramètres</span></a>`,
  ];
  document.getElementById('tabs').innerHTML = tabs.join('');
}

/* ---------- Pages pas encore construites ---------- */
function vueBientot(el, titre, ic, texte) {
  el.innerHTML = `<div class="panel empty"><div class="m-ic" style="--mw:var(--accent-weak);--mt:var(--accent)">${icone(ic)}</div>
    <h3>${titre}</h3><p class="muted">${texte}</p></div>`;
}

/* ---------- Routeur ---------- */
const ROUTES = {
  '': (el) => vueAccueil(el),
  m: (el, [mid, cid, onglet]) => (cid ? vueChapitre(el, mid, cid, onglet) : vueMatiere(el, mid)),
  parametres: (el) => vueParametres(el, { version: VERSION, theme, changerTheme }),
  dessin: (el, params) => vueAtelier(el, params),
  progression: (el) => vueBientot(el, 'Progression : arrive à l\'étape 4', 'progression',
    'Scores par matière et par chapitre, points faibles, historique et examens blancs.'),
  planning: (el) => vueBientot(el, 'Planning : arrive à l\'étape 4', 'calendrier',
    'Saisis tes dates d\'examen : l\'appli te proposera un programme de révision jour par jour.'),
};

async function router() {
  const route = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const [page, ...params] = route;
  const afficher = ROUTES[page] || null;

  if (typeof nettoyer === 'function') nettoyer();
  nettoyer = null;
  rendreOnglets(route);

  // Chaque page reçoit un conteneur neuf : ses écouteurs disparaissent avec elle.
  const zone = document.createElement('div');
  vue.replaceChildren(zone);
  try {
    if (!afficher) throw new Error(`Page inconnue : « ${location.hash} ».`);
    nettoyer = await afficher(zone, params);
  } catch (err) {
    console.error(err);
    zone.innerHTML = `<div class="error-box"><b>Oups.</b> ${esc(err.message)}</div>
      <p><a class="btn" href="#/">${icone('accueil')} Retour à l'accueil</a></p>`;
  }
  window.scrollTo(0, 0);
  vue.focus({ preventScroll: true });
}

/* ---------- Pastilles de source : toucher = ouvrir le PDF à la bonne page ---------- */
function detailSource(e) {
  const pg = e.target.closest?.('.pg');
  if (!pg || (e.type === 'keydown' && e.key !== 'Enter')) return;
  e.stopPropagation();
  e.preventDefault();
  if (!pg.dataset.cle) { toast(pg.title, 4500); return; } // contenu d'exemple : pas de PDF
  import('./visionneuse.js').then(({ ouvrirVisionneuse }) => ouvrirVisionneuse({
    cle: pg.dataset.cle, nom: pg.dataset.nom, court: pg.dataset.court,
    fichier: pg.dataset.fichier, pages: Number(pg.dataset.total) || null,
  }, Number(pg.dataset.page) || 1));
}
document.addEventListener('click', detailSource, true);
document.addEventListener('keydown', detailSource, true);

/* ---------- Démarrage ---------- */
async function demarrer() {
  document.getElementById('brand-logo').innerHTML = icone('logo');
  majBoutonProposer();
  setTimeout(viderAttente, 3000);
  majBoutonTheme();
  try {
    await chargerIndex();
  } catch (err) {
    vue.innerHTML = `<div class="error-box"><b>Le contenu n'a pas pu être chargé.</b><br>${esc(err.message)}</div>
      <p class="muted">Sur ton PC, lance l'appli avec <code>lancer-local.bat</code> plutôt qu'en double-cliquant sur index.html.</p>`;
    return;
  }
  window.addEventListener('hashchange', router);
  router();
}

/* Copie hors ligne (service worker) : seulement si la page est servie par un site web. */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non enregistré :', e));
}

demarrer();
