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
  // traits fins (s = 'n') : comptés seulement pour les solutions en trait fin (filetages, constructions) et jamais « en trop »
  const fins = eleve.filter((e) => (e.t === 'l' || e.t === 'c' || e.t === 'a') && e.s === 'n' && !e.mep && !e.don);
  const parType = { v: traits.filter((e) => e.s === 'v'), c: traits.filter((e) => e.s === 'c'), a: traits.filter((e) => e.s === 'a'), b: traits.filter((e) => e.s === 'b'), n: fins };
  const res = { ok: [], type: [], manquants: [], trop: [] };
  let total = 0, gagne = 0;
  for (const s of solution) {
    const axe = s.s === 'a';
    let pts = echantillons(s);
    if (axe) pts = pts.slice(Math.floor(pts.length * 0.15), Math.ceil(pts.length * 0.85));   // le milieu de l'axe suffit
    const t = axe ? tol * 2 : s.tol || tol;   // s.tol : tolérance propre (ex. ellipses par 4 arcs)
    const memeType = pts.filter((p) => proche(p, parType[s.s] || [], t)).length / pts.length;
    const nimporte = memeType >= 0.9 ? memeType : pts.filter((p) => proche(p, s.s === 'n' ? [...traits, ...fins] : traits, t)).length / pts.length;
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
   Règles de présentation (¼ de point par cote fautive) : ligne de cote
   hors de la vue et à 6 mm au moins, pas d'attache sur un trait caché,
   5 mm au moins entre deux lignes de cote parallèles du même côté.
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
      if (nom === 'face') return e.k === 'h' ? ['x', e.x1 - ox + b.x0, e.x2 - ox + b.x0, nom] : ['z', e.y1 - oy + b.z0, e.y2 - oy + b.z0, nom];
      if (nom === 'dessus') return e.k === 'h' ? ['x', e.x1 - ox + b.x0, e.x2 - ox + b.x0, nom] : ['y', e.y1 - (oy - exo.ecart - P), e.y2 - (oy - exo.ecart - P), nom];
      const g = ox + W + exo.ecart + P;
      return e.k === 'h' ? ['y', g - e.x1, g - e.x2, nom] : ['z', e.y1 - oy + b.z0, e.y2 - oy + b.z0, nom];
    }
    return null;
  };
  const pos = positionsPiece(pc);
  const parent = {}, liens = {};
  for (const a of Object.keys(pos)) { parent[a] = pos[a].map((_, i) => i); liens[a] = new Set(); }
  const racine = (a, i) => { while (parent[a][i] !== i) i = parent[a][i] = parent[a][parent[a][i]]; return i; };
  const res = { justes: [], double: [], surab: [], fausses: [], diam: { ok: [], manquants: [] }, axes: {}, regles: [] };
  // règles de présentation (cotes linéaires rattachées à une vue)
  const regle = (e, txt) => { let r = res.regles.find((x) => x.txt === txt); if (!r) res.regles.push(r = { txt, cotes: [] }); if (!r.cotes.includes(e)) r.cotes.push(e); };
  const placees = [];
  const verifier = (e, nom) => {
    const c = C[nom];
    const lo = e.k === 'h' ? c.y : c.x, hi = e.k === 'h' ? c.y + c.h : c.x + c.w;
    const ecartVue = e.d < lo ? lo - e.d : e.d > hi ? e.d - hi : -1;
    if (ecartVue < 0) regle(e, 'ligne de cote dans la vue (place-la à l\'extérieur)');
    else if (ecartVue < 6 - tol) regle(e, 'ligne de cote trop près de la vue (au moins 6 à 8 mm)');
    const traits = v[nom];
    for (const q of [[e.x1, e.y1], [e.x2, e.y2]]) {
      // l'arête cotée : trait perpendiculaire à la direction mesurée qui passe par le point d'attache
      const sur = traits.filter((t) => t.t === 'l' && (e.k === 'h' ? Math.abs(t.x1 - t.x2) < 1e-6 : Math.abs(t.y1 - t.y2) < 1e-6) && distanceA(t, q) <= tol);
      if (sur.length && sur.every((t) => t.s === 'c')) { regle(e, 'cote sur un trait caché (cote dans la vue où l\'arête est vue)'); break; }
    }
    for (const f of placees) {
      if (f.nom === nom && f.e.k === e.k && Math.abs(f.e.d - e.d) < 5 - tol && Math.sign(f.e.d - (lo + hi) / 2) === Math.sign(e.d - (lo + hi) / 2)) regle(e, 'lignes de cote trop serrées (au moins 5 à 7 mm entre elles)');
    }
    placees.push({ e, nom });
  };
  const encombre = { x: false, y: false, z: false };
  for (const e of es) {
    if (e.t !== 'q' || (e.k !== 'h' && e.k !== 'v')) continue;
    const l = lire(e);
    if (!l) { res.fausses.push(e); continue; }
    const [a, u, w, nom] = l;
    verifier(e, nom);
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
  const malus = 0.5 * (res.double.length + res.surab.length + res.fausses.length) + 0.25 * res.regles.reduce((s, r) => s + r.cotes.length, 0);
  res.score = total ? Math.max(0, Math.round(((gagne - malus) / total) * 100)) : 0;
  return res;
}

/* =====================================================================
   CORRECTION D'UNE COUPE A-A (vue de face coupée, js/dao/pieces.js coupeA)
   Traits : comme corriger() (seuls les traits de l'élève dans la zone de
   la vue de face comptent). Hachures : grille de points tous les 2 mm
   (à plus de 1 mm des bords) : la matière coupée doit être hachurée, les
   vides (trous) non ; un trou hachuré fait perdre la part de ce trou.
   Score = 70 % traits + 30 % hachures.
   ===================================================================== */
import { coupeA, coupeLocale } from './pieces.js';
import { dansPolygone } from './hachures.js';

export function corrigerCoupe(pc, exo, es, tol = TOL) {
  const sol = exo.mode === 'locale' ? coupeLocale(pc, exo.o, exo.ecart) : coupeA(pc, exo.o, exo.ecart, { demi: exo.mode === 'demi' }), cf = sol.cadres.face, M = 6;
  const b = boitePiece(pc), [ox, oy] = exo.o;
  const pres = (x, y) => x >= cf.x - M && x <= cf.x + cf.w + M && y >= cf.y - M && y <= cf.y + cf.h + M;
  const zoneFace = es.filter((e) => (e.t === 'l' && pres((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)) || ((e.t === 'c' || e.t === 'a') && pres(e.cx, e.cy)));
  const r = corriger(sol.face, zoneFace, tol);
  const hs = es.filter((e) => e.t === 'h' && e.pts?.length > 2 && pres(e.pts[0][0], e.pts[0][1]));
  const hachure = (x, y) => hs.some((h) => dansPolygone([x, y], h.pts) && !(h.trous || []).some((t) => dansPolygone([x, y], t)));
  const ok = [], manque = [], trop = [];
  let vides = 0, videsH = 0;   // points des trous (dans le contour) : un trou hachuré est une faute grave
  const loinBord = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]].every(([dx, dz]) => sol.matiere(x + dx, z + dz) === sol.matiere(x, z));
  for (let x = b.x0 + 1; x < b.x1; x += 2) {
    for (let z = b.z0 + 1; z < b.z1; z += 2) {
      if (!loinBord(x, z)) continue;
      const m = sol.matiere(x, z), X = ox + x - b.x0, Y = oy + z - b.z0, h = hachure(X, Y);
      const trou = !m && (sol.hachures || [sol.hachure]).some((g) => dansPolygone([X, Y], g.pts));
      if (trou) { vides++; if (h) videsH++; }
      if (m && h) ok.push([X, Y]); else if (m) manque.push([X, Y]); else if (h) trop.push([X, Y]);
    }
  }
  const nMat = ok.length + manque.length;
  const dehors = trop.length - videsH;
  const scoreH = nMat ? Math.max(0, (ok.length / nMat) * (vides ? 1 - 0.6 * (videsH / vides) : 1) - dehors / nMat) : 1;
  return { ...r, traits: r.score, hach: { score: Math.round(scoreH * 100), manque, trop }, score: Math.round(r.score * 0.7 + scoreH * 100 * 0.3) };
}

/* ----- correction d'une section sortie B-B (js/dao/pieces.js sectionB) : même principe que la coupe ----- */
import { sectionB } from './pieces.js';

export function corrigerSection(pc, exo, es, tol = TOL) {
  const sol = sectionB(pc, exo.o, exo.ecart), cf = sol.cadre, M = 6, P = pc.prof;
  const pres = (x, y) => x >= cf.x - M && x <= cf.x + cf.w + M && y >= cf.y - M && y <= cf.y + cf.h + M;
  const zone = es.filter((e) => (e.t === 'l' && pres((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)) || ((e.t === 'c' || e.t === 'a') && pres(e.cx, e.cy)));
  const r = corriger(sol.section, zone, tol);
  const hs = es.filter((e) => e.t === 'h' && e.pts?.length > 2 && pres(e.pts[0][0], e.pts[0][1]));
  const hachure = (x, y) => hs.some((h) => dansPolygone([x, y], h.pts) && !(h.trous || []).some((t) => dansPolygone([x, y], t)));
  const b = boitePiece(pc), [, oy] = exo.o;
  const ok = [], manque = [], trop = [];
  let vides = 0, videsH = 0;
  const zmin = (cf.y - oy) + b.z0, zmax = zmin + cf.h;
  const loinBord = (y, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dy, dz]) => sol.matiere(y + dy, z + dz) === sol.matiere(y, z));
  for (let y = 1; y < P; y += 2) {
    for (let z = zmin + 1; z < zmax; z += 2) {
      if (!loinBord(y, z)) continue;
      const m = sol.matiere(y, z), X = cf.x + P - y, Y = oy + z - b.z0, h = hachure(X, Y);
      if (!m) { vides++; if (h) videsH++; }
      if (m && h) ok.push([X, Y]); else if (m) manque.push([X, Y]); else if (h) trop.push([X, Y]);
    }
  }
  const nMat = ok.length + manque.length;
  const scoreH = nMat ? Math.max(0, (ok.length / nMat) * (vides ? 1 - 0.6 * (videsH / vides) : 1)) : 1;
  return { ...r, traits: r.score, hach: { score: Math.round(scoreH * 100), manque, trop }, score: Math.round(r.score * 0.7 + scoreH * 100 * 0.3) };
}

/* ----- correction d'un ancien exercice de l'Atelier repris sur la planche (exo.mode = 'ancien') -----
   exo.sol : traits attendus (mm) ; exo.hach : carrés de matière coupée [x, y bas, côté] ; exo.cible : zone à dessiner. */
export function corrigerAncien(exo, es, tol = TOL) {
  const c = exo.cible, M = 6;
  const pres = (x, y) => !c || (x >= c.x - M && x <= c.x + c.w + M && y >= c.y - M && y <= c.y + c.h + M);
  const zone = es.filter((e) => (e.t === 'l' && pres((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)) || ((e.t === 'c' || e.t === 'a') && pres(e.cx, e.cy)));
  const r = corriger(exo.sol || [], zone, tol);
  if (!exo.hach?.length || !c) return { ...r, traits: r.score };
  const mat = (x, y) => exo.hach.some(([x0, y0, d]) => x >= x0 - 1e-6 && x <= x0 + d + 1e-6 && y >= y0 - 1e-6 && y <= y0 + d + 1e-6);
  const hs = es.filter((e) => e.t === 'h' && e.pts?.length > 2 && pres(e.pts[0][0], e.pts[0][1]));
  const hachure = (x, y) => hs.some((h) => dansPolygone([x, y], h.pts) && !(h.trous || []).some((t) => dansPolygone([x, y], t)));
  const ok = [], manque = [], trop = [];
  for (let x = c.x + 1; x < c.x + c.w; x += 2) {
    for (let y = c.y + 1; y < c.y + c.h; y += 2) {
      const m = mat(x, y);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => mat(x + dx, y + dy) !== m)) continue;
      const h = hachure(x, y);
      if (m && h) ok.push([x, y]); else if (m) manque.push([x, y]); else if (h) trop.push([x, y]);
    }
  }
  const nMat = ok.length + manque.length;
  const scoreH = nMat ? Math.max(0, (ok.length - trop.length) / nMat) : 1;
  return { ...r, traits: r.score, hach: { score: Math.round(scoreH * 100), manque, trop }, score: Math.round(r.score * 0.7 + scoreH * 100 * 0.3) };
}
