/* =====================================================================
   DAO — CORRECTION D'UN DESSIN (comparaison avec la solution, en mm réels)
   ---------------------------------------------------------------------
   Chaque trait de la solution est échantillonné tous les 0,5 mm ; un point
   est « couvert » si un trait de l'élève passe à moins de TOL (±0,5 mm).
     ok       : couvert à 90 % par un trait du bon type
     type     : couvert, mais par un trait d'un autre type (fort / caché / axe)
     manquant : pas (assez) couvert
   Les traits de l'élève loin de toute la solution sont « en trop ».
   Les axes sont jugés plus souplement (leur longueur peut varier).
   Les traits fins (construction) de l'élève ne sont jamais comptés.
   ===================================================================== */

import { distanceA } from './edition.js';
import { surCercle } from './geom.js';

export const TOL = 0.5;

function echantillons(e, pas = 0.5) {
  if (e.t === 'l') {
    const L = Math.hypot(e.x2 - e.x1, e.y2 - e.y1), n = Math.max(2, Math.ceil(L / pas));
    return Array.from({ length: n + 1 }, (_, k) => [e.x1 + ((e.x2 - e.x1) * k) / n, e.y1 + ((e.y2 - e.y1) * k) / n]);
  }
  const a0 = e.t === 'c' ? 0 : e.a0, a1 = e.t === 'c' ? 360 : e.a1;
  const n = Math.max(8, Math.ceil(((a1 - a0) * Math.PI * e.r) / 180 / pas));
  return Array.from({ length: n + 1 }, (_, k) => surCercle(e.cx, e.cy, e.r, a0 + ((a1 - a0) * k) / n));
}
export const longueur = (e) => (e.t === 'l' ? Math.hypot(e.x2 - e.x1, e.y2 - e.y1) : e.t === 'c' ? 2 * Math.PI * e.r : ((e.a1 - e.a0) * Math.PI * e.r) / 180);
const proche = (p, es, tol) => es.some((e) => distanceA(e, p) <= tol);

/**
 * @param {object[]} solution  entités attendues (l, c, a ; s = 'v' | 'c' | 'a')
 * @param {object[]} eleve     entités de l'élève
 * @returns {{ score: number, ok: object[], type: object[], manquants: object[], trop: object[] }}
 */
export function corriger(solution, eleve, tol = TOL) {
  const traits = eleve.filter((e) => (e.t === 'l' || e.t === 'c' || e.t === 'a') && e.s !== 'n');
  const parType = { v: traits.filter((e) => e.s === 'v'), c: traits.filter((e) => e.s === 'c'), a: traits.filter((e) => e.s === 'a') };
  const res = { ok: [], type: [], manquants: [], trop: [] };
  let total = 0, gagne = 0;
  for (const s of solution) {
    const axe = s.s === 'a';
    let pts = echantillons(s);
    if (axe) pts = pts.slice(Math.floor(pts.length * 0.15), Math.ceil(pts.length * 0.85));   // le milieu de l'axe suffit
    const t = axe ? tol * 2 : tol;
    const memeType = pts.filter((p) => proche(p, parType[s.s] || [], t)).length / pts.length;
    const nimporte = memeType >= 0.9 ? memeType : pts.filter((p) => proche(p, traits, t)).length / pts.length;
    const poids = longueur(s) * (axe ? 0.5 : 1);
    total += poids;
    const seuil = axe ? 0.8 : 0.9;
    if (memeType >= seuil) { res.ok.push(s); gagne += poids; }
    else if (nimporte >= seuil) { res.type.push(s); gagne += poids * 0.5; }
    else res.manquants.push(s);
  }
  for (const e of traits) {
    const pts = echantillons(e);
    const dedans = pts.filter((p) => proche(p, solution, e.s === 'a' ? tol * 2 + 3 : tol * 2)).length / pts.length;
    if (dedans < 0.8) res.trop.push(e);
  }
  // les traits en trop font perdre des points (sans descendre sous 0)
  const malus = res.trop.reduce((s, e) => s + longueur(e) * (e.s === 'a' ? 0.25 : 0.5), 0);
  res.score = total ? Math.max(0, Math.round(((gagne - malus) / total) * 100)) : 0;
  return res;
}
