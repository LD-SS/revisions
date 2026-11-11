/* =====================================================================
   SYNCHRO — partage la progression entre tes appareils (PC, téléphone…)
   ---------------------------------------------------------------------
   La progression (exercices notés, flashcards, annotations des schémas,
   « continuer ») est rangée dans le compte de l'élève (Firestore,
   document progression/{uid}, lisible par lui seul).
   À la première connexion, la progression déjà présente dans le navigateur
   est envoyée dans le compte : rien n'est perdu.

   Fusion entrée par entrée : chaque modification locale est horodatée ;
   à la synchro, pour chaque entrée, la version la plus récente gagne
   (une suppression est gardée comme « pierre tombale »).
   ===================================================================== */

import { stockage, surEcriture } from './utils.js';
import { utilisateur, lireProgression, ecrireProgression } from './compte.js';

const CLES = ['exos', 'fc', 'circuits', 'dernier', 'fiches', 'planches'];      // ce qui est synchronisé (planches : planche libre de dessin)
const UNIQUE = new Set(['dernier']);                      // valeur d'un seul bloc
let enFusion = false;   // écritures faites par la synchro elle-même : pas d'horodatage
export const synchroActive = () => !!utilisateur() && !!stockage.lire('sync.uid', '');

/** Ce navigateur appartient-il à ce compte ? Sinon (PC partagé) on repart de la progression du compte. */
export function adopterCompte(uid) {
  const proprio = stockage.lire('sync.uid', '');
  if (proprio && proprio !== uid) {
    enFusion = true;
    try { for (const c of CLES) stockage.supprimer(c); stockage.supprimer('sync.ts'); } finally { enFusion = false; }
  }
  stockage.ecrire('sync.uid', uid);
}

/* ---------- horodatage des modifications locales ---------- */
const morceaux = (cle, v) => (UNIQUE.has(cle) ? (v == null ? {} : { _: v }) : (v && typeof v === 'object' ? v : {}));

surEcriture((cle, ancien, nouveau) => {
  if (enFusion || !CLES.includes(cle)) return;
  const a = morceaux(cle, ancien), n = morceaux(cle, nouveau);
  const ts = stockage.lire('sync.ts', {}); const t = ts[cle] || (ts[cle] = {}); const now = Date.now();
  let change = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(n)])) {
    if (JSON.stringify(a[k]) !== JSON.stringify(n[k])) { t[k] = now; change = true; }
  }
  if (!change) return;
  enFusion = true; stockage.ecrire('sync.ts', ts); enFusion = false;
  if (synchroActive()) planifier();
});

/* ---------- état local / distant ---------- */
function etatLocal() {
  const data = {}; for (const c of CLES) data[c] = morceaux(c, stockage.lire(c, null));
  return { v: 1, data, ts: stockage.lire('sync.ts', {}) };
}

/** Fusion entrée par entrée : la plus récente gagne (égalité : on garde la locale). */
function fusionner(loc, dist) {
  const out = { v: 1, data: {}, ts: {} };
  for (const c of CLES) {
    const L = loc.data[c] || {}, D = dist?.data?.[c] || {}, tl = loc.ts[c] || {}, td = dist?.ts?.[c] || {};
    const d = (out.data[c] = {}), t = (out.ts[c] = {});
    for (const k of new Set([...Object.keys(L), ...Object.keys(D), ...Object.keys(tl), ...Object.keys(td)])) {
      const a = tl[k] || 0, b = td[k] || 0;
      const prendDist = b > a || (b === a && L[k] === undefined);   // égalité (ex. jamais horodaté) : on garde ce qui existe
      const v = prendDist ? D[k] : L[k]; const tv = prendDist ? td[k] : tl[k];
      if (v !== undefined) d[k] = v;
      if (tv) t[k] = tv;   // garde aussi les suppressions (pierres tombales)
    }
  }
  return out;
}

function appliquer(etat) {
  enFusion = true;
  try {
    for (const c of CLES) {
      const v = etat.data[c] || {};
      if (UNIQUE.has(c)) v._ === undefined ? stockage.supprimer(c) : stockage.ecrire(c, v._);
      else stockage.ecrire(c, v);
    }
    stockage.ecrire('sync.ts', etat.ts);
  } finally { enFusion = false; }
}

/* ---------- synchro ---------- */
let enCours = null, minuteur = null;
const signature = (e) => JSON.stringify(e.data) + JSON.stringify(e.ts);

/** Récupère, fusionne, enregistre ici et là-bas. Renvoie true si la progression locale a changé. */
export function synchroniser() {
  if (!synchroActive()) return Promise.resolve(false);
  if (enCours) return enCours;
  enCours = (async () => {
    try {
      const loc = etatLocal(); const dist = await lireProgression();
      const fus = fusionner(loc, dist);
      const changeIci = signature(fus) !== signature(loc);
      if (changeIci) appliquer(fus);
      if (!dist || signature(fus) !== signature({ data: dist.data || {}, ts: dist.ts || {} })) {
        await ecrireProgression(fus);
      }
      stockage.ecrire('sync.derniere', Date.now()); stockage.supprimer('sync.erreur');
      if (changeIci) window.dispatchEvent(new CustomEvent('revisions:synchro'));
      return changeIci;
    } catch (err) {
      stockage.ecrire('sync.erreur', err.message);
      console.warn('Synchro :', err);
      return false;
    } finally { enCours = null; }
  })();
  return enCours;
}

function planifier() { clearTimeout(minuteur); minuteur = setTimeout(synchroniser, 4000); }

/** Branche la synchro : au démarrage, au retour sur l'appli, et régulièrement. */
let branche = false;
export function demarrerSynchro() {
  if (!synchroActive()) return;
  synchroniser();
  if (branche) return; branche = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchroniser();
    else if (minuteur) { clearTimeout(minuteur); minuteur = null; synchroniser(); }   // on quitte : envoyer tout de suite
  });
  setInterval(() => { if (document.visibilityState === 'visible') synchroniser(); }, 2 * 60 * 1000);
}

export function oublierSynchro() { for (const k of ['sync.derniere', 'sync.erreur']) stockage.supprimer(k); }

export const infosSynchro = () => ({ active: synchroActive(), derniere: stockage.lire('sync.derniere', 0), erreur: stockage.lire('sync.erreur', '') });
