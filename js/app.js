/* =====================================================================
   APP — démarrage, navigation, barre du haut, thème
   ---------------------------------------------------------------------
   Navigation par l'adresse après « # » (fonctionne sur GitHub Pages sans configuration) :
     #/                              accueil (tuiles des matières)
     #/m/<matière>                   chapitres d'une matière
     #/m/<matière>/<chapitre>[/<onglet>]   synthese | flashcards | exercices
     #/m/<matière>/schemas[/<ex>]   exercices sur schéma
     #/dessin…                       atelier de dessin
     #/plus  #/recherche  #/examen   menu « Plus », recherche, examen blanc
     #/parametres                    paramètres
   Pour ajouter une page : une entrée dans ROUTES + un module dans js/vues/.
   ===================================================================== */

import { esc, toast, stockage } from './utils.js';
import { icone } from './icones.js';
import { nomCourt, styleMatiere } from './matieres.js';
import { chargerIndex, matieres, chargerChapitre, chargerSchemas, chargerEvaluations } from './store.js';
import { vueAccueil } from './vues/accueil.js';
import { vueMatiere } from './vues/matiere.js';
import { vueChapitre } from './vues/chapitre.js';
import { vueParametres } from './vues/parametres.js';
import { vueAtelier } from './vues/atelier.js';
import { vueSchemas } from './vues/schemas.js';
import { vuePlus, vueRecherche } from './vues/outils.js';
import { vueExamen } from './vues/examen.js';
import { majBoutonProposer, viderAttente } from './proposer.js';
import { demarrerSynchro, adopterCompte } from './synchro.js';
import { exigerAcces, ecranPerte } from './vues/acces.js';

const VERSION = '1.36.7 (accroche à la grille tous les 1 mm, sous-grille de 1 mm)';
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

/* ---------- Barre d'onglets (haut, ordinateur) et barre du bas (téléphone) ---------- */
let routeAffichee = [''];
const pastille = () => (window.__nbDemandes ? `<span class="pastille" title="Demandes en attente">${window.__nbDemandes}</span>` : '');
function rendreOnglets(route) {
  routeAffichee = route;
  const actif = (cond) => (cond ? 'active' : '');
  const enPlus = ['plus', 'recherche', 'examen', 'parametres', 'membres'].includes(route[0]);
  const surMatiere = (m) => (route[0] === 'm' && route[1] === m.id) || (route[0] === 'dessin' && m.id === 'dessin');
  const tabs = [
    `<a class="tab ${actif(route[0] === '')}" href="#/">${icone('accueil')}<span class="txt">Accueil</span></a>`,
    ...matieres().map((m) => `<a class="tab mc ${actif(surMatiere(m))}" ${styleMatiere(m)} href="#/m/${esc(m.id)}" title="${esc(m.nom)}">
      ${icone(m.icone)}<span class="txt">${esc(nomCourt(m))}</span></a>`),
    `<a class="tab ${actif(route[0] === 'examen')}" href="#/examen">${icone('examen')}<span class="txt">Examen blanc</span></a>`,
    ...(window.__admin ? [`<a class="tab ${actif(route[0] === 'membres')}" href="#/membres">${icone('cadenas')}<span class="txt">Membres</span>${pastille()}</a>`] : []),
    `<a class="tab ${actif(route[0] === 'parametres')}" href="#/parametres">${icone('reglages')}<span class="txt">Paramètres</span></a>`,
  ];
  document.getElementById('tabs').innerHTML = tabs.join('');
  const bas = [
    `<a class="${actif(route[0] === '')}" href="#/">${icone('accueil')}<span>Accueil</span></a>`,
    ...matieres().map((m) => `<a class="mc ${actif(surMatiere(m))}" ${styleMatiere(m)} href="#/m/${esc(m.id)}">${icone(m.icone)}<span>${esc(m.mini || nomCourt(m).split(' ')[0])}</span></a>`),
    `<a class="${actif(enPlus)}" href="#/plus">${icone('plus')}<span>Plus</span>${window.__admin ? pastille() : ''}</a>`,
  ];
  document.getElementById('botnav').innerHTML = bas.join('');
}

/* ---------- Routeur ---------- */
const ROUTES = {
  '': (el) => vueAccueil(el),
  m: (el, [mid, cid, onglet, extra]) => (cid === 'schemas' ? vueSchemas(el, mid, onglet)
    : cid === 'generateur' ? import('./vues/generateur.js').then((x) => x.vueGenerateur(el, mid))
    : cid ? vueChapitre(el, mid, cid, onglet, extra) : vueMatiere(el, mid)),
  parametres: (el) => vueParametres(el, { version: VERSION, theme, changerTheme }),
  dessin: (el, params) => vueAtelier(el, params),
  plus: (el) => vuePlus(el),
  recherche: (el, [q]) => vueRecherche(el, q),
  examen: (el, params) => vueExamen(el, params),
  membres: async (el) => (await import('./vues/membres.js')).vueMembres(el),
  progression: () => { location.replace('#/'); },
  planning: () => { location.replace('#/'); },
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
  document.getElementById('btn-chercher').innerHTML = icone('loupe');
  majBoutonProposer();
  setTimeout(viderAttente, 3000);
  majBoutonTheme();
  // Accès réservé : connexion, compte accepté, appareil autorisé (voir js/compte.js).
  document.body.classList.add('verrou');
  let compte;
  try {
    compte = await import('./compte.js');
    await exigerAcces(vue);
  } catch (err) {
    vue.innerHTML = `<div class="error-box"><b>Connexion impossible.</b><br>${esc(err.message)}</div>
      <p class="muted">La première connexion demande Internet.</p><p><button class="btn" onclick="location.reload()">Réessayer</button></p>`;
    return;
  }
  document.body.classList.remove('verrou');
  window.__admin = compte.estAdmin();
  adopterCompte(compte.utilisateur().uid);
  vue.innerHTML = '<div class="loading">Chargement…</div>';
  try {
    await chargerIndex();
  } catch (err) {
    vue.innerHTML = `<div class="error-box"><b>Le contenu n'a pas pu être chargé.</b><br>${esc(err.message)}</div>
      <p class="muted">Sur ton PC, lance l'appli avec <code>lancer-local.bat</code> plutôt qu'en double-cliquant sur index.html.</p>`;
    return;
  }
  window.addEventListener('hashchange', router);
  router();
  // Progression reçue d'un autre appareil : on réaffiche les pages de vue d'ensemble
  // (jamais en plein exercice, pour ne rien perdre de ce que tu tapes).
  window.addEventListener('revisions:synchro', () => {
    const h = location.hash;
    const sur = h === '' || h === '#/' || /^#\/m\/[^/]+(\/schemas)?$/.test(h) || /^#\/parametres$/.test(h);
    if (sur && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) router();
  });
  demarrerSynchro();
  // Administrateur : pastille du nombre de demandes (inscriptions, appareils) sur l'onglet Membres.
  if (window.__admin) compte.surveillerDemandes((n) => { window.__nbDemandes = n; rendreOnglets(routeAffichee); });
  // Hors ligne : une fois par jour, tout le contenu est copié sur l'appareil (en arrière-plan).
  setTimeout(() => prechargerTout().catch(() => {}), 6000);
  compte.surveiller((raison) => {
    compte.arreterSurveillance();
    if (typeof nettoyer === 'function') nettoyer();
    window.removeEventListener('hashchange', router);
    ecranPerte(vue, raison);
  });
}

/* Copie de tout le contenu sur l'appareil (cache Firestore), au plus une fois par jour. */
async function prechargerTout() {
  const jour = new Date().toISOString().slice(0, 10);
  if (!navigator.onLine || stockage.lire('horsligne.jour', '') === jour) return;
  for (const m of matieres()) {
    for (const c of m.chapitres) await chargerChapitre(m.id, c.id).catch(() => {});
    if (m.schemas) await chargerSchemas(m.id).catch(() => {});
    await chargerEvaluations(m.id).catch(() => {});
  }
  stockage.ecrire('horsligne.jour', jour);
}

/* Copie hors ligne (service worker) + bandeau « nouvelle version » (sans fermer/rouvrir deux fois). */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const avaitControleur = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('Service worker non enregistré :', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!avaitControleur || document.getElementById('maj-dispo')) return;
    const b = document.createElement('div');
    b.id = 'maj-dispo'; b.className = 'maj-dispo';
    b.innerHTML = '<span>Une nouvelle version de l\'appli est disponible.</span><button class="btn primary" type="button">Mettre à jour</button>';
    b.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(b);
  });
}

demarrer();
