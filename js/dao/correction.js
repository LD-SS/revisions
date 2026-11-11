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

/* =====================================================================
   CORRECTION DE LA COTATION des 3 vues d'une pièce (js/dao/pieces.js)
   ---------------------------------------------------------------------
   Sur chaque axe de la pièce (x : largeur, z : hauteur, y : profondeur),
   les « positions » à situer sont les abscisses des arêtes du profil et
   des axes des trous. Chaque cote linéaire de l'élève (h ou v) est
   rattachée à la vue où se trouvent ses 2 points d'attache, puis
   traduite en un lien entre 2 positions de cet axe.
     situé        : position reliée (par une chaîne de cotes) à l'arête
                    de départ (la plus petite) ; cotation complète si
                    toutes les positions sont situées
     encombrement : la cote d'ensemble (min → max) est exigée
     en double    : même lien coté deux fois (même dans 2 vues)
     surabondante : lien qui ferme une chaîne déjà déterminée
     fausse       : point d'attache qui n'est pas une arête ou un axe
     Ø            : chaque trou porte une cote de diamètre (vue où il est
                    un cercle)
   Les cotes alignées, de rayon et d'angle ne sont pas comptées.
   ===================================================================== */
import { vues as vuesPiece, boite as boitePiece } from './pieces.js';

const AXES = { x: 'largeur', z: 'hauteur', y: 'profondeur' };

/** Positions à situer, par axe. */
export function positionsPiece(pc) {
  const r = (v) => Math.round(v * 1000) / 1000;
  const uniq = (t) => [...new Set(t.map(r))].sort((a, b) => a - b);
  const tr = pc.trous || [];
  return {
    x: uniq([...pc.profil.map((p) => p[0]), ...tr.map((t) => t.x)]),
    z: uniq([...pc.profil.map((p) => p[1]), ...tr.filter((t) => t.axe === 'y').map((t) => t.z)]),
    y: uniq([0, pc.prof, ...tr.filter((t) => t.axe === 'z').map((t) => t.y)]),
  };
}

/**
 * @param {object} pc     pièce
 * @param {object} exo    { o, ecart } (placement des vues)
 * @param {object[]} es   entités de l'élève
 * @returns {{ score, axes: { x|y|z: { pos, situees: boolean[], encombrement: boolean } }, diam: { ok: object[], manquants: object[] },
 *             justes: object[], double: object[], surab: object[], fausses: object[] }}
 */
export function corrigerCotes(pc, exo, es, tol = TOL) {
  const v = vuesPiece(pc, exo.o, exo.ecart), b = boitePiece(pc), P = pc.prof;
  const W = b.x1 - b.x0, [ox, oy] = exo.o;
  const C = v.cadres;
  const dans = (c, x, y) => x >= c.x - tol && x <= c.x + c.w + tol && y >= c.y - tol && y <= c.y + c.h + tol;
  // vue → (axe, conversion vers la coordonnée pièce) pour une cote h ou v
  const lire = (e) => {
    for (const [nom, c] of Object.entries(C)) {
      if (!dans(c, e.x1, e.y1) || !dans(c, e.x2, e.y2)) continue;
      if (nom === 'face') return e.k === 'h' ? ['x', e.x1 - ox + b.x0, e.x2 - ox + b.x0] : ['z', e.y1 - oy + b.z0, e.y2 - oy + b.z0];
      if (nom === 'dessus') return e.k === 'h' ? ['x', e.x1 - ox + b.x0, e.x2 - ox + b.x0] : ['y', e.y1 - (oy - exo.ecart - P), e.y2 - (oy - exo.ecart - P)];
      const g = ox + W + exo.ecart + P;
      return e.k === 'h' ? ['y', g - e.x1, g - e.x2] : ['z', e.y1 - oy + b.z0, e.y2 - oy + b.z0];
    }
    return null;
  };
  const pos = positionsPiece(pc);
  const parent = {}, liens = {};
  for (const a of Object.keys(pos)) { parent[a] = pos[a].map((_, i) => i); liens[a] = new Set(); }
  const racine = (a, i) => { while (parent[a][i] !== i) i = parent[a][i] = parent[a][parent[a][i]]; return i; };
  const res = { justes: [], double: [], surab: [], fausses: [], diam: { ok: [], manquants: [] }, axes: {} };
  const encombre = { x: false, y: false, z: false };
  for (const e of es) {
    if (e.t !== 'q' || (e.k !== 'h' && e.k !== 'v')) continue;
    const l = lire(e);
    if (!l) { res.fausses.push(e); continue; }
    const [a, u, w] = l;
    const i = pos[a].findIndex((p) => Math.abs(p - u) <= tol), j = pos[a].findIndex((p) => Math.abs(p - w) <= tol);
    if (i < 0 || j < 0 || i === j) { res.fausses.push(e); continue; }
    const cle = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (liens[a].has(cle)) { res.double.push(e); continue; }
    liens[a].add(cle);
    if (Math.min(i, j) === 0 && Math.max(i, j) === pos[a].length - 1) encombre[a] = true;
    const ri = racine(a, i), rj = racine(a, j);
    if (ri === rj) { res.surab.push(e); continue; }
    parent[a][ri] = rj; res.justes.push(e);
  }
  let total = 0, gagne = 0;
  for (const a of Object.keys(pos)) {
    const r0 = racine(a, 0);
    const situees = pos[a].map((_, i) => racine(a, i) === r0);
    res.axes[a] = { nom: AXES[a], pos: pos[a], situees, encombrement: encombre[a] };
    total += pos[a].length - 1 + 1;
    gagne += situees.filter(Boolean).length - 1 + (encombre[a] ? 1 : 0);
  }
  // diamètres des trous (cote Ø sur le cercle)
  const ds = es.filter((e) => e.t === 'q' && e.k === 'd');
  for (const t of pc.trous || []) {
    const c = t.axe === 'y' ? [ox + t.x - b.x0, oy + t.z - b.z0] : [ox + t.x - b.x0, oy - exo.ecart - P + t.y];
    const ok = ds.some((d) => Math.hypot(d.cx - c[0], d.cy - c[1]) <= tol && Math.abs(2 * d.r - t.d) <= 0.1);
    (ok ? res.diam.ok : res.diam.manquants).push({ ...t, c });
    total += 1; if (ok) gagne += 1;
  }
  const malus = 0.5 * (res.double.length + res.surab.length + res.fausses.length);
  res.score = total ? Math.max(0, Math.round(((gagne - malus) / total) * 100)) : 0;
  return res;
}
