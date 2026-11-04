/* =====================================================================
   SUIVI — progression gardée dans ce navigateur
   ---------------------------------------------------------------------
   exos   : { "<matière>/<chapitre>/<exercice>": { r: ok|mid|ko, n, d, t?: titre } }  (exercices.js)
   fc     : { "<matière>/<chapitre>/<carte>": { r: ok|ko, d } }      (flashcards)
   dernier: { h: '#/…', t: titre, s: sous-titre, d: date }          (bouton « Continuer »)
   ===================================================================== */

import { stockage } from './utils.js';

export const notesExos = () => stockage.lire('exos', {});
export const notesCartes = () => stockage.lire('fc', {});

export function noterCarte(cle, r) {
  const t = notesCartes();
  t[cle] = { r, d: new Date().toISOString().slice(0, 10) };
  stockage.ecrire('fc', t);
}

/** Cartes d'un préfixe (matière/chapitre) marquées « À revoir » à la dernière séance. */
export function cartesARevoir(prefixe) {
  const t = notesCartes(); const p = `${prefixe}/`;
  return Object.keys(t).filter((k) => k.startsWith(p) && t[k].r === 'ko').map((k) => k.slice(p.length));
}

export function memoriserVisite(h, t, s = '') {
  stockage.ecrire('dernier', { h, t, s, d: Date.now() });
}
export const derniereVisite = () => stockage.lire('dernier', null);

/** Résumé par préfixe : exercices réussis / à refaire, cartes à revoir. */
export function bilan(prefixe) {
  const p = `${prefixe}/`; const e = notesExos(); const c = notesCartes();
  const ex = Object.entries(e).filter(([k]) => k.startsWith(p));
  return {
    reussis: ex.filter(([, n]) => n.r === 'ok').length,
    aRefaire: ex.filter(([, n]) => n.r !== 'ok').length,
    faits: ex.length,
    cartesKo: Object.entries(c).filter(([k, n]) => k.startsWith(p) && n.r === 'ko').length,
  };
}
