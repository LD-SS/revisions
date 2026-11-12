/* =====================================================================
   DAO — PIÈCES PARAMÉTRIQUES (en mm) ET LEURS VUES (projection européenne)
   ---------------------------------------------------------------------
   Repère pièce : x vers la droite, y vers l'arrière (y = 0 : face avant),
   z vers le haut.
   Pièce = profil extrudé :
     { nom, profil: [[x, z], …] (contour de la face avant, sens quelconque),
       prof: profondeur selon y,
       trous: [{ axe: 'y', x, z, d }   trou débouchant de l'avant vers l'arrière
               | { axe: 'z', x, y, d }  trou débouchant vertical (du dessus) ] }
   vues(piece, origine, ecart) → entités DAO (mm réels, repère de la feuille) :
     vue de face en haut à gauche, vue de dessus EN DESSOUS, vue de gauche
     À DROITE (européen : le côté de chaque vue tourné vers la vue de face
     représente l'arrière de la pièce).
   Toutes les pièces ont été créées pour l'appli (aucune ne vient d'un cours).
   ===================================================================== */

import { vuesRevolution } from './revolution.js';
import { vuesPrisme, coupePrisme } from './prisme.js';
import { vuesSolide, coupeSolide, sectionSolide } from './solide.js';

const EPS = 1e-6;
const r3 = (v) => Math.round(v * 1000) / 1000;
const L = (x1, y1, x2, y2, s) => ({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
const DEB_AXE = 3;   // dépassement des axes (mm)

/** Intervalles [zmin, zmax] du profil sur la verticale x (règle pair-impair). */
export function intervallesZ(profil, x) {
  const zs = [];
  for (let i = 0; i < profil.length; i++) {
    const [x1, z1] = profil[i], [x2, z2] = profil[(i + 1) % profil.length];
    if ((x1 <= x && x < x2) || (x2 <= x && x < x1)) zs.push(z1 + ((x - x1) * (z2 - z1)) / (x2 - x1));
  }
  zs.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < zs.length; k += 2) out.push([zs[k], zs[k + 1]]);
  return out;
}
/** Intervalles [xmin, xmax] du profil sur l'horizontale z. */
export function intervallesX(profil, z) {
  return intervallesZ(profil.map(([x, zz]) => [zz, x]), z);
}
const matiereAuDessus = (profil, x, z) => intervallesZ(profil, x).some(([a, b]) => b > z + 1e-4 && a < b);
const matiereAGauche = (profil, x, z) => intervallesX(profil, z).some(([a]) => a < x - 1e-4);

export function boite(piece) {
  const xs = piece.profil.map((p) => p[0]), zs = piece.profil.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: 0, y1: piece.prof };
}

/** Lignes d'une vue « de côté » d'une extrusion : positions des arêtes, visibles ou cachées. */
function aretesVues(piece, sens) {
  // sens 'dessus' : positions x des sommets, vues d'en haut ; 'gauche' : positions z, vues de la gauche
  const res = new Map();   // position → 'v' | 'c'
  for (const [x, z] of piece.profil) {
    const pos = sens === 'dessus' ? x : z;
    let visible;
    if (sens === 'dessus') visible = !matiereAuDessus(piece.profil, x - 1e-3, z) || !matiereAuDessus(piece.profil, x + 1e-3, z);
    else visible = !matiereAGauche(piece.profil, x, z - 1e-3) || !matiereAGauche(piece.profil, x, z + 1e-3);
    const k = r3(pos);
    if (visible) res.set(k, 'v'); else if (!res.has(k)) res.set(k, 'c');
  }
  return res;
}

/**
 * Entités des 3 vues.
 * @param {object} piece
 * @param {number[]} origine  coin bas-gauche de la boîte de la vue de face, dans la feuille (mm réels)
 * @param {number} ecart      écart entre les vues (mm)
 * @returns {{ face: object[], dessus: object[], gauche: object[], cadres: object }}
 */
export function vues(piece, origine = [20, 90], ecart = 20) {
  if (piece.rev) return vuesRevolution(piece, origine, ecart);
  if (piece.p3) return vuesPrisme(piece, origine, ecart);
  if (piece.cs) return vuesSolide(piece, origine, ecart);
  const [ex, ey] = Array.isArray(ecart) ? ecart : [ecart, ecart];   // écart horizontal (face-gauche), vertical (face-dessus)
  const b = boite(piece);
  const W = b.x1 - b.x0, H = b.z1 - b.z0, P = piece.prof;
  const [ox, oy] = origine;
  // vue de face : (x, z) → (ox + x - x0, oy + z - z0)
  const F = (x, z) => [ox + x - b.x0, oy + z - b.z0];
  // vue de dessus (en dessous) : (x, y) → (ox + x - x0, oy - ey - P + y)  (arrière contre la vue de face)
  const D = (x, y) => [ox + x - b.x0, oy - ey - P + y];
  // vue de gauche (à droite) : (y, z) → (ox + W + ex + P - y, oy + z - z0)  (arrière contre la vue de face)
  const G = (y, z) => [ox + W + ex + P - y, oy + z - b.z0];
  const face = [], dessus = [], gauche = [];
  const seg = (arr, f, a, c, s) => { const p = f(...a), q = f(...c); arr.push(L(p[0], p[1], q[0], q[1], s)); };

  // --- vue de face : le contour du profil (face avant, tout est vu)
  piece.profil.forEach((p, i) => seg(face, F, p, piece.profil[(i + 1) % piece.profil.length], 'v'));
  // --- vue de dessus : rectangle extérieur + une ligne par arête (sommet du profil)
  for (const [x, s] of aretesVues(piece, 'dessus')) seg(dessus, D, [x, 0], [x, P], s);
  seg(dessus, D, [b.x0, 0], [b.x1, 0], 'v'); seg(dessus, D, [b.x0, P], [b.x1, P], 'v');
  // --- vue de gauche : rectangle + une ligne par niveau z
  for (const [z, s] of aretesVues(piece, 'gauche')) seg(gauche, G, [0, z], [P, z], s);
  seg(gauche, G, [0, b.z0], [0, b.z1], 'v'); seg(gauche, G, [P, b.z0], [P, b.z1], 'v');

  // --- trous
  for (const t of piece.trous || []) {
    const r = t.d / 2;
    if (t.axe === 'y') {
      const [cx, cz] = F(t.x, t.z);
      face.push({ t: 'c', cx: r3(cx), cy: r3(cz), r: r3(r), s: 'v' });
      face.push(L(cx - r - DEB_AXE, cz, cx + r + DEB_AXE, cz, 'a'), L(cx, cz - r - DEB_AXE, cx, cz + r + DEB_AXE, 'a'));
      for (const dx of [-r, r]) seg(dessus, D, [t.x + dx, 0], [t.x + dx, P], 'c');
      seg(dessus, D, [t.x, -DEB_AXE], [t.x, P + DEB_AXE], 'a');
      for (const dz of [-r, r]) seg(gauche, G, [0, t.z + dz], [P, t.z + dz], 'c');
      seg(gauche, G, [-DEB_AXE, t.z], [P + DEB_AXE, t.z], 'a');
    } else {
      const [cx, cy] = D(t.x, t.y);
      dessus.push({ t: 'c', cx: r3(cx), cy: r3(cy), r: r3(r), s: 'v' });
      dessus.push(L(cx - r - DEB_AXE, cy, cx + r + DEB_AXE, cy, 'a'), L(cx, cy - r - DEB_AXE, cx, cy + r + DEB_AXE, 'a'));
      const iv = intervallesZ(piece.profil, t.x);
      const zmin = Math.min(...iv.map((v) => v[0])), zmax = Math.max(...iv.map((v) => v[1]));
      for (const [a, c] of iv) {
        for (const dx of [-r, r]) seg(face, F, [t.x + dx, a], [t.x + dx, c], 'c');
        for (const dy of [-r, r]) seg(gauche, G, [t.y + dy, a], [t.y + dy, c], 'c');
      }
      seg(face, F, [t.x, zmin - DEB_AXE], [t.x, zmax + DEB_AXE], 'a');
      seg(gauche, G, [t.y, zmin - DEB_AXE], [t.y, zmax + DEB_AXE], 'a');
    }
  }
  const cadres = {
    face: { x: ox, y: oy, w: W, h: H },
    dessus: { x: ox, y: oy - ey - P, w: W, h: P },
    gauche: { x: ox + W + ex, y: oy, w: P, h: H },
  };
  return { face: nettoyer(face), dessus: nettoyer(dessus), gauche: nettoyer(gauche), cadres };
}

/** Retire les doublons (même segment) : le trait fort l'emporte sur le caché. */
function nettoyer(es) {
  const cle = (e) => (e.t === 'l' ? [Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.max(e.x1, e.x2), Math.max(e.y1, e.y2)].join(',') : `c${e.cx},${e.cy},${e.r}`);
  const rang = { v: 0, c: 1, a: 2, n: 3 };
  const m = new Map();
  for (const e of es) { const k = cle(e); if (!m.has(k) || rang[e.s] < rang[m.get(k).s]) m.set(k, e); }
  return [...m.values()];
}

/* ----- catalogue : pièces créées pour l'appli (mm) ----- */
export const PIECES = [
  { id: 'equerre', nom: 'Équerre percée', prof: 30, profil: [[0, 0], [60, 0], [60, 10], [12, 10], [12, 45], [0, 45]], trous: [{ axe: 'z', x: 38, y: 15, d: 8 }] },
  { id: 'marche', nom: 'Bloc à marche', prof: 35, profil: [[0, 0], [70, 0], [70, 20], [40, 20], [40, 40], [0, 40]], trous: [{ axe: 'y', x: 18, z: 22, d: 10 }] },
  { id: 'chape', nom: 'Chape en U', prof: 30, profil: [[0, 0], [60, 0], [60, 40], [45, 40], [45, 12], [15, 12], [15, 40], [0, 40]], trous: [{ axe: 'z', x: 30, y: 15, d: 10 }] },
  { id: 'chanfrein', nom: 'Support chanfreiné', prof: 40, profil: [[0, 0], [80, 0], [80, 25], [65, 40], [0, 40]], trous: [{ axe: 'y', x: 30, z: 20, d: 12 }] },
  { id: 'rainure', nom: 'Semelle à rainure', prof: 40, profil: [[0, 0], [80, 0], [80, 25], [50, 25], [50, 15], [30, 15], [30, 25], [0, 25]], trous: [{ axe: 'z', x: 12, y: 20, d: 8 }, { axe: 'z', x: 68, y: 20, d: 8 }] },
  { id: 'te', nom: 'Bloc en T', prof: 30, profil: [[0, 0], [70, 0], [70, 15], [45, 15], [45, 45], [25, 45], [25, 15], [0, 15]], trous: [{ axe: 'y', x: 35, z: 32, d: 10 }] },
];

/* ----- pièces au hasard (générées, reproductibles à partir de leur id « h<niveau>-<graine> ») ----- */
function aleatoire(graine) {   // mulberry32
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function dansProfil(p, prof) {
  let dedans = false;
  for (let i = 0, j = prof.length - 1; i < prof.length; j = i++) {
    const [xi, zi] = prof[i], [xj, zj] = prof[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) dedans = !dedans;
  }
  return dedans;
}
const FORMES = {
  equerre: (n) => { const W = n(50, 80), H = n(35, 55), e = n(10, 15), a = n(10, 15); return [[0, 0], [W, 0], [W, e], [a, e], [a, H], [0, H]]; },
  marche: (n) => { const W = n(55, 85), H = n(30, 45), h = n(10, H - 15), a = n(20, W - 20); return [[0, 0], [W, 0], [W, h], [a, h], [a, H], [0, H]]; },
  chanfrein: (n) => { const W = n(55, 85), H = n(30, 45), c = n(10, 20); return [[0, 0], [W, 0], [W, H - c], [W - c, H], [0, H]]; },
  pente: (n) => { const W = n(55, 85), H = n(30, 45), h = n(10, H - 15), a = n(20, W - 25); return [[0, 0], [W, 0], [W, h], [a, H], [0, H]]; },
  chape: (n) => { const W = n(55, 85), H = n(30, 45), a = n(10, 15), e = n(10, 15); return [[0, 0], [W, 0], [W, H], [W - a, H], [W - a, e], [a, e], [a, H], [0, H]]; },
  te: (n) => { const W = n(60, 85), H = n(35, 50), e = n(10, 15), l = n(15, 25), x1 = Math.round((W - l) / 10) * 5; return [[0, 0], [W, 0], [W, e], [x1 + l, e], [x1 + l, H], [x1, H], [x1, e], [0, e]]; },
  rainure: (n) => { const W = n(60, 85), H = n(25, 40), l = n(15, 25), d = n(8, 12), x1 = n(15, W - l - 15); return [[0, 0], [W, 0], [W, H], [x1 + l, H], [x1 + l, H - d], [x1, H - d], [x1, H], [0, H]]; },
  marches: (n) => { const W = n(65, 90), H = n(40, 50), h1 = n(10, 15), h2 = n(h1 + 10, H - 10), a1 = n(15, 25), a2 = n(a1 + 15, W - 15); return [[0, 0], [W, 0], [W, h1], [a2, h1], [a2, h2], [a1, h2], [a1, H], [0, H]]; },
};
const FORMES_NIVEAU = { 1: ['equerre', 'marche', 'chanfrein', 'pente'], 2: ['chape', 'te', 'rainure', 'marches', 'pente'], 3: ['chape', 'te', 'rainure', 'marches', 'marche', 'chanfrein'] };
const NOMS_FORMES = { equerre: 'Équerre', marche: 'Bloc à marche', chanfrein: 'Bloc chanfreiné', pente: 'Bloc à pente', chape: 'Chape en U', te: 'Bloc en T', rainure: 'Semelle à rainure', marches: 'Bloc à 2 marches' };

/** Pièce générée (mêmes niveau et graine → même pièce). Niveau 1 : 0–1 trou, 2 : 1 trou, 3 : 2 trous. */
export function pieceAuHasard(niveau = 1, graine = 1) {
  const niv = [1, 2, 3].includes(+niveau) ? +niveau : 1;
  const r = aleatoire(graine * 7919 + niv);
  const n = (a, b) => 5 * Math.floor(Math.ceil(a / 5) + r() * (Math.floor(b / 5) - Math.ceil(a / 5) + 1));   // multiple de 5 dans [a, b]
  const choix = (t) => t[Math.floor(r() * t.length)];
  const forme = choix(FORMES_NIVEAU[niv]);
  const profil = FORMES[forme](n);
  const prof = n(25, 45);
  const nbTrous = niv === 1 ? (r() < 0.5 ? 0 : 1) : niv === 2 ? 1 : 2;
  const trous = [];
  const xs = profil.map((p) => p[0]), zs = profil.map((p) => p[1]);
  const W = Math.max(...xs), H = Math.max(...zs);
  const loin = (t) => trous.every((u) => (u.axe === 'y' && t.axe === 'y' ? Math.hypot(u.x - t.x, u.z - t.z) : Math.abs(u.x - t.x)) > u.d / 2 + t.d / 2 + 4);
  const memes = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v[0] - b[i][0]) < 1e-6 && Math.abs(v[1] - b[i][1]) < 1e-6);
  for (let k = 0, essais = 0; k < nbTrous && essais < 200; essais++) {
    const d = choix([6, 8, 10, 12]), rr = d / 2;
    const axe = niv === 3 && trous.length && essais < 120 ? (trous[0].axe === 'y' ? 'z' : 'y') : r() < 0.5 ? 'y' : 'z';   // niveau 3 : un trou de chaque sens si possible
    const x = n(rr + 5, W - rr - 5);
    if (axe === 'y') {
      const z = n(rr + 5, H - rr - 5);
      let ok = true;
      for (let i = 0; i < 16 && ok; i++) { const a = (i / 16) * 2 * Math.PI; ok = dansProfil([x + (rr + 3) * Math.cos(a), z + (rr + 3) * Math.sin(a)], profil); }
      const t = { axe, x, z, d };
      if (ok && loin(t)) { trous.push(t); k++; }
    } else {
      if (prof < d + 10) continue;
      const y = n(rr + 5, prof - rr - 5);
      const iv = intervallesZ(profil, x);
      const ok = iv.length && iv.every(([a, b]) => b - a >= 8) && [x - rr - 3, x + rr + 3].every((xx) => memes(intervallesZ(profil, xx), iv));
      const t = { axe, x, y, d };
      if (ok && loin(t)) { trous.push(t); k++; }
    }
  }
  return { id: `h${niv}-${graine}`, nom: `${NOMS_FORMES[forme]} n° ${graine}`, prof, profil, trous, hasard: niv };
}

/** Ajoute des pièces au catalogue (ex. js/dao/catalogue.js). */
export function enregistrerPieces(liste) { for (const pc of liste) if (!PIECES.some((x) => x.id === pc.id)) PIECES.push(pc); }

/** Pièce du catalogue ou pièce générée d'après son id. */
export function trouverPiece(id) {
  const m = /^([hs])([123])-(\d{1,6})$/.exec(String(id || ''));
  if (m) return m[1] === 'h' ? pieceAuHasard(+m[2], +m[3]) : pieceSymetrique(+m[2], +m[3]);
  return PIECES.find((x) => x.id === id) || null;
}

/* ----- coupe A-A : plan parallèle à la face avant (y = c), vue de face coupée ----- */
/**
 * Plan par l'axe du 1er trou vertical (sinon au milieu de la profondeur).
 * @returns {{ c: number, face: object[] (vue de face coupée, sans hachures), dessus: object[] (vue de dessus + trace du plan A-A),
 *             hachure: object (entité t:'h' de la solution), matiere: (x, z) => boolean (coordonnées pièce), cadres: object }}
 */
export function coupeA(piece, origine = [20, 90], ecart = 20, { demi = false } = {}) {
  if (piece.p3) return coupePrisme(piece, origine, ecart);
  if (piece.cs) return coupeSolide(piece, origine, ecart, { demi });
  // demi = true : demi-coupe d'une pièce symétrique (moitié droite coupée, moitié gauche en vue extérieure sans traits cachés)
  const v = vues(piece, origine, ecart);
  const b = boite(piece), P = piece.prof, [ox, oy] = origine;
  const F = (x, z) => [ox + x - b.x0, oy + z - b.z0];
  const D = (x, y) => [ox + x - b.x0, oy - ecart - P + y];
  const tz = (piece.trous || []).filter((t) => t.axe === 'z');
  const c = tz.length ? tz[0].y : Math.round(P / 2);
  const coupes = tz.filter((t) => Math.abs(t.y - c) < t.d / 2 - 1e-6).map((t) => ({ ...t, w: Math.sqrt((t.d / 2) ** 2 - (t.y - c) ** 2) }));
  const ty = (piece.trous || []).filter((t) => t.axe === 'y');
  const face = [];
  const seg = (a, q, s) => { const p1 = F(...a), p2 = F(...q); face.push(L(p1[0], p1[1], p2[0], p2[1], s)); };
  piece.profil.forEach((p, i) => seg(p, piece.profil[(i + 1) % piece.profil.length], 'v'));
  for (const t of ty) {
    const [cx, cz] = F(t.x, t.z), r = t.d / 2;
    face.push({ t: 'c', cx: r3(cx), cy: r3(cz), r: r3(r), s: 'v' }, L(cx - r - DEB_AXE, cz, cx + r + DEB_AXE, cz, 'a'), L(cx, cz - r - DEB_AXE, cx, cz + r + DEB_AXE, 'a'));
  }
  const xm = (b.x0 + b.x1) / 2;
  const coupe = (x) => !demi || x >= xm - 1e-6;
  if (demi) seg([xm, b.z0 - DEB_AXE], [xm, b.z1 + DEB_AXE], 'a');
  for (const t of coupes) {
    const iv = intervallesZ(piece.profil, t.x);
    for (const [a, q] of iv) for (const dx of [-t.w, t.w]) if (coupe(t.x + dx)) seg([t.x + dx, a], [t.x + dx, q], 'v');
    seg([t.x, Math.min(...iv.map((u) => u[0])) - DEB_AXE], [t.x, Math.max(...iv.map((u) => u[1])) + DEB_AXE], 'a');
  }
  // trace du plan dans la vue de dessus : trait mixte fin, extrémités renforcées, flèches vers l'arrière (sens d'observation), lettres A
  const trace = [];
  const [xa, ya] = D(b.x0 - 9, c), [xb] = D(b.x1 + 9, c);
  trace.push(L(xa, ya, xb, ya, 'a'), L(xa, ya, xa + 5, ya, 'v'), L(xb - 5, ya, xb, ya, 'v'));
  for (const x of [xa + 1.5, xb - 1.5]) {
    trace.push(L(x, ya, x, ya + 8, 'n'), L(x, ya + 8, x - 1.2, ya + 4.5, 'n'), L(x, ya + 8, x + 1.2, ya + 4.5, 'n'));
    trace.push({ t: 'x', x: r3(x + (x < ox ? -5 : 2)), y: r3(ya + 3), txt: 'A', h: 5, s: 'n' });
  }
  // matière coupée (coordonnées pièce)
  const dansP = (x, z) => { let d = false; const pr = piece.profil; for (let i = 0, j = pr.length - 1; i < pr.length; j = i++) { const [xi, zi] = pr[i], [xj, zj] = pr[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; } return d; };
  const matiere = (x, z) => coupe(x) && dansP(x, z) && !ty.some((t) => Math.hypot(x - t.x, z - t.z) < t.d / 2) && !coupes.some((t) => Math.abs(x - t.x) < t.w);
  // hachure de la solution (contour du profil, trous = disques et bandes des trous coupés)
  const cercle = (t) => Array.from({ length: 48 }, (_, k) => F(t.x + (t.d / 2) * Math.cos((k / 48) * 2 * Math.PI), t.z + (t.d / 2) * Math.sin((k / 48) * 2 * Math.PI)));
  const bandes = coupes.flatMap((t) => intervallesZ(piece.profil, t.x).map(([a, q]) => [F(t.x - t.w, a), F(t.x + t.w, a), F(t.x + t.w, q), F(t.x - t.w, q)]));
  // demi-coupe : on garde la partie à droite de l'axe (découpage de Sutherland-Hodgman)
  const X = F(xm, 0)[0];
  const garder = (poly) => {
    if (!demi) return poly;
    const out = [];
    poly.forEach((A, i) => {
      const B = poly[(i + 1) % poly.length], ia = A[0] >= X - 1e-9, ib = B[0] >= X - 1e-9;
      if (ia) out.push(A);
      if (ia !== ib) { const t = (X - A[0]) / (B[0] - A[0]); out.push([X, A[1] + (B[1] - A[1]) * t]); }
    });
    return out;
  };
  const hachure = { t: 'h', pts: garder(piece.profil.map((p) => F(...p))), trous: [...ty.map(cercle), ...bandes].map(garder).filter((q) => q.length > 2), ang: 45, pas: 3, s: 'n' };
  return { c, face: nettoyer(face), dessus: [...v.dessus, ...trace], hachure, matiere, cadres: v.cadres };
}

/* ----- pièces symétriques (pour la demi-coupe) ----- */
/** Vrai si le profil et les trous sont symétriques par rapport à l'axe vertical du milieu. */
export function estSymetrique(pc) {
  const b = boite(pc), xm = (b.x0 + b.x1) / 2;
  const cle = (x, z) => `${Math.round((2 * xm - x) * 1000)},${Math.round(z * 1000)}`;
  const pts = new Set(pc.profil.map(([x, z]) => `${Math.round(x * 1000)},${Math.round(z * 1000)}`));
  if (!pc.profil.every(([x, z]) => pts.has(cle(x, z)))) return false;
  return (pc.trous || []).every((t) => (pc.trous || []).some((u) => u.axe === t.axe && u.d === t.d && Math.abs(u.x - (2 * xm - t.x)) < 1e-6 && (t.axe === 'y' ? u.z === t.z : u.y === t.y)));
}
const FORMES_SYM = {
  chape: (n) => { const a = n(10, 15), W = 2 * a + n(25, 45), H = n(30, 45), e = n(10, 15); return [[0, 0], [W, 0], [W, H], [W - a, H], [W - a, e], [a, e], [a, H], [0, H]]; },
  te: (n) => { const l = n(15, 25), W = l + 2 * n(20, 30), H = n(35, 50), e = n(10, 15), x1 = (W - l) / 2; return [[0, 0], [W, 0], [W, e], [x1 + l, e], [x1 + l, H], [x1, H], [x1, e], [0, e]]; },
  rainure: (n) => { const l = n(15, 25), W = l + 2 * n(20, 30), H = n(25, 40), d = n(8, 12), x1 = (W - l) / 2; return [[0, 0], [W, 0], [W, H], [x1 + l, H], [x1 + l, H - d], [x1, H - d], [x1, H], [0, H]]; },
  epaule: (n) => { const l = n(20, 35), W = l + 2 * n(15, 25), H = n(30, 45), h = n(10, H - 15), x1 = (W - l) / 2; return [[0, 0], [W, 0], [W, h], [x1 + l, h], [x1 + l, H], [x1, H], [x1, h], [0, h]]; },
};
const NOMS_SYM = { chape: 'Chape en U', te: 'Bloc en T', rainure: 'Semelle à rainure', epaule: 'Bloc épaulé' };

/** Pièce symétrique générée (id « s<niveau>-<graine> ») : niveau 1 un trou sur l'axe, 2 deux trous symétriques, 3 les deux. */
export function pieceSymetrique(niveau = 1, graine = 1) {
  const niv = [1, 2, 3].includes(+niveau) ? +niveau : 1;
  const r = aleatoire(graine * 104729 + niv);
  const n = (a, b) => 5 * Math.floor(Math.ceil(a / 5) + r() * (Math.floor(b / 5) - Math.ceil(a / 5) + 1));
  const formes = Object.keys(FORMES_SYM), forme = formes[Math.floor(r() * formes.length)];
  const profil = FORMES_SYM[forme](n), prof = n(25, 40);
  const W = Math.max(...profil.map((p) => p[0])), xm = W / 2;
  const d = [6, 8, 10][Math.floor(r() * 3)], y = Math.round(prof / 2);
  const trous = [];
  const zOk = (x) => { const iv = intervallesZ(profil, x); return iv.length && [x - d / 2 - 3, x + d / 2 + 3].every((xx) => JSON.stringify(intervallesZ(profil, xx)) === JSON.stringify(iv)); };
  if (niv !== 2 && zOk(xm)) trous.push({ axe: 'z', x: xm, y, d });
  if (niv >= 2 || !trous.length) {
    for (let k = 0; k < 30; k++) {
      const x = n(d / 2 + 5, xm - d / 2 - 6);
      if (zOk(x)) { trous.push({ axe: 'z', x, y, d }, { axe: 'z', x: W - x, y, d }); break; }
    }
  }
  if (!trous.length && zOk(xm)) trous.push({ axe: 'z', x: xm, y, d });   // pièce trop étroite pour 2 trous
  return { id: `s${niv}-${graine}`, nom: `${NOMS_SYM[forme]} n° ${graine}`, prof, profil, trous, hasard: niv, sym: true };
}

/* ----- section sortie B-B : plan perpendiculaire à x (x = c), dessinée à la place de la vue de gauche ----- */
/**
 * Plan par l'axe du 1er trou (sinon au milieu de la largeur). Flèches vers la droite : la section est vue
 * comme la vue de gauche (avant de la pièce à droite) et placée au même endroit.
 * @returns {{ c, donnees: object[] (vue de face avec la trace B-B + vue de dessus), section: object[] (traits solution),
 *             hachures: object[], matiere: (y, z) => boolean, cadre: { x, y, w, h }, repere: [x, y] }}
 */
export function sectionB(piece, origine = [20, 90], ecart = 20) {
  if (piece.cs) return sectionSolide(piece, origine, ecart);
  const v = vues(piece, origine, ecart);
  const b = boite(piece), P = piece.prof, [ox, oy] = origine, W = b.x1 - b.x0;
  const F = (x, z) => [ox + x - b.x0, oy + z - b.z0];
  const gx = ox + W + ecart;                                  // bord gauche de la section (y = P)
  const G = (y, z) => [gx + P - y, oy + z - b.z0];
  const tr = piece.trous || [];
  const c = tr.length ? tr[0].x : Math.round((b.x0 + b.x1) / 2);
  const ivz = intervallesZ(piece.profil, c + 1e-6);
  const coupe = (t) => Math.abs(c - t.x) < t.d / 2 - 1e-6;
  const bandesZ = tr.filter((t) => t.axe === 'y' && coupe(t)).map((t) => { const w = Math.sqrt((t.d / 2) ** 2 - (c - t.x) ** 2); return { t, a: t.z - w, b: t.z + w }; });
  const bandesY = tr.filter((t) => t.axe === 'z' && coupe(t)).map((t) => { const w = Math.sqrt((t.d / 2) ** 2 - (c - t.x) ** 2); return { t, a: t.y - w, b: t.y + w }; });
  const matiere = (y, z) => y > 0 && y < P && ivz.some(([a, q]) => z > a && z < q) && !bandesZ.some((u) => z > u.a && z < u.b) && !bandesY.some((u) => y > u.a && y < u.b);
  // traits : frontières entre cellules (matière / vide) de la grille des cassures
  const Ys = [...new Set([0, P, ...bandesY.flatMap((u) => [u.a, u.b])].map(r3))].sort((p, q) => p - q);
  const Zs = [...new Set([...ivz.flat(), ...bandesZ.flatMap((u) => [u.a, u.b])].map(r3))].sort((p, q) => p - q);
  const cel = (i, j) => i >= 0 && j >= 0 && i < Ys.length - 1 && j < Zs.length - 1 && matiere((Ys[i] + Ys[i + 1]) / 2, (Zs[j] + Zs[j + 1]) / 2);
  const section = [];
  const ajoute = (y1, z1, y2, z2) => { const p = G(y1, z1), q = G(y2, z2); section.push(L(p[0], p[1], q[0], q[1], 'v')); };
  for (let j = 0; j < Zs.length; j++) {          // bords horizontaux (z = Zs[j]), fusionnés le long de y
    let debut = null;
    for (let i = 0; i <= Ys.length - 1; i++) {
      const bord = i < Ys.length - 1 && cel(i, j - 1) !== cel(i, j);
      if (bord && debut === null) debut = Ys[i];
      if (!bord && debut !== null) { ajoute(debut, Zs[j], Ys[i], Zs[j]); debut = null; }
    }
  }
  for (let i = 0; i < Ys.length; i++) {          // bords verticaux (y = Ys[i]), fusionnés le long de z
    let debut = null;
    for (let j = 0; j <= Zs.length - 1; j++) {
      const bord = j < Zs.length - 1 && cel(i - 1, j) !== cel(i, j);
      if (bord && debut === null) debut = Zs[j];
      if (!bord && debut !== null) { ajoute(Ys[i], debut, Ys[i], Zs[j]); debut = null; }
    }
  }
  const zmin = Math.min(...ivz.map((u) => u[0])), zmax = Math.max(...ivz.map((u) => u[1]));
  for (const u of bandesZ) { const p = G(-DEB_AXE, u.t.z), q = G(P + DEB_AXE, u.t.z); section.push(L(p[0], p[1], q[0], q[1], 'a')); }
  for (const u of bandesY) { const p = G(u.t.y, zmin - DEB_AXE), q = G(u.t.y, zmax + DEB_AXE); section.push(L(p[0], p[1], q[0], q[1], 'a')); }
  // hachures de la solution : une par cellule de matière
  const hachures = [];
  for (let i = 0; i < Ys.length - 1; i++) for (let j = 0; j < Zs.length - 1; j++) {
    if (cel(i, j)) hachures.push({ t: 'h', pts: [G(Ys[i], Zs[j]), G(Ys[i + 1], Zs[j]), G(Ys[i + 1], Zs[j + 1]), G(Ys[i], Zs[j + 1])], trous: [], ang: 45, pas: 3, s: 'n' });
  }
  // trace B-B sur la vue de face : trait mixte, extrémités renforcées, flèches vers la droite
  const trace = [];
  const [xc] = F(c, 0), [, ya] = F(0, b.z0 - 9), [, yb] = F(0, b.z1 + 9);
  trace.push(L(xc, ya, xc, yb, 'a'), L(xc, ya, xc, ya + 5, 'v'), L(xc, yb - 5, xc, yb, 'v'));
  for (const y of [ya + 1.5, yb - 1.5]) {
    trace.push(L(xc, y, xc + 8, y, 'n'), L(xc + 8, y, xc + 4.5, y + 1.2, 'n'), L(xc + 8, y, xc + 4.5, y - 1.2, 'n'));
    trace.push({ t: 'x', x: r3(xc + 3), y: r3(y < oy ? y - 6 : y + 2), txt: 'B', h: 5, s: 'n' });
  }
  return { c, donnees: [...v.face, ...v.dessus, ...trace], section: nettoyer(section), hachures, matiere, cadre: { x: gx, y: oy + zmin - b.z0, w: P, h: zmax - zmin }, repere: [gx, oy + zmin - b.z0] };
}

/* ----- coupe locale : zone autour du 1er trou vertical, limitée par deux traits ondulés (fins) ----- */
/** Garde la partie d'un polygone comprise entre les verticales X0 et X1 (Sutherland-Hodgman, deux côtés). */
function decoupeX(poly, X0, X1) {
  const cote = (pts, X, garde) => {
    const out = [];
    pts.forEach((A, i) => {
      const B = pts[(i + 1) % pts.length], ia = garde(A[0]), ib = garde(B[0]);
      if (ia) out.push(A);
      if (ia !== ib) { const t = (X - A[0]) / (B[0] - A[0]); out.push([X, A[1] + (B[1] - A[1]) * t]); }
    });
    return out;
  };
  const a = cote(poly, X0, (x) => x >= X0 - 1e-9);
  return a.length ? cote(a, X1, (x) => x <= X1 + 1e-9) : [];
}
/** Vrai si la pièce a un trou vertical (axe z), nécessaire pour la coupe locale. */
export const aTrouVertical = (pc) => (pc.trous || []).some((t) => t.axe === 'z');
/** Graine d'une pièce au hasard de ce niveau qui a un trou vertical. */
export function graineTrouVertical(niveau, depart = 1 + Math.floor(Math.random() * 99999)) {
  for (let g = depart, k = 0; k < 200; k++, g = (g % 99999) + 1) if (aTrouVertical(pieceAuHasard(niveau, g))) return g;
  return depart;
}
/**
 * @returns {{ face, donnees (vues de dessus et de gauche + traits ondulés), hachure, matiere, cadres, zone: [X0, X1] }}
 */
export function coupeLocale(piece, origine = [20, 90], ecart = 20) {
  const v = vues(piece, origine, ecart);
  const b = boite(piece), [ox, oy] = origine;
  const F = (x, z) => [ox + x - b.x0, oy + z - b.z0];
  const t = (piece.trous || []).find((u) => u.axe === 'z');
  if (!t) return null;
  const r = t.d / 2, ty = (piece.trous || []).filter((u) => u.axe === 'y');
  const xa = Math.max(b.x0, t.x - r - 7), xb = Math.min(b.x1, t.x + r + 7);
  const [X0] = F(xa, 0), [X1] = F(xb, 0);
  const iv = intervallesZ(piece.profil, t.x);
  // face : traits cachés du trou devenus visibles dans la zone
  const face = v.face.map((e) => (e.t === 'l' && e.s === 'c' && Math.abs(e.x1 - e.x2) < 1e-6 && e.x1 > X0 && e.x1 < X1 ? { ...e, s: 'v' } : e));
  // traits ondulés (limites de la zone, dans la matière seulement)
  const ondes = [];
  for (const [X, x] of [[X0, xa], [X1, xb]]) {
    if (x <= b.x0 + 1e-6 || x >= b.x1 - 1e-6) continue;
    for (const [a, q] of intervallesZ(piece.profil, x)) {
      const n = Math.max(4, Math.round((q - a) / 3));
      const pts = Array.from({ length: n + 1 }, (_, k) => { const z = a + ((q - a) * k) / n; return [X + (k % 2 && k < n ? 1.2 : 0) * (k % 4 === 1 ? 1 : -1), F(0, z)[1]]; });
      for (let k = 0; k < n; k++) ondes.push(L(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 'n'));
    }
  }
  const dansP = (x, z) => { let d = false; const pr = piece.profil; for (let i = 0, j = pr.length - 1; i < pr.length; j = i++) { const [xi, zi] = pr[i], [xj, zj] = pr[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; } return d; };
  const matiere = (x, z) => x > xa && x < xb && dansP(x, z) && Math.abs(x - t.x) >= r && !ty.some((u) => Math.hypot(x - u.x, z - u.z) < u.d / 2);
  const pts = decoupeX(piece.profil.map((p) => F(...p)), X0, X1);
  const bandes = iv.map(([a, q]) => [F(t.x - r, a), F(t.x + r, a), F(t.x + r, q), F(t.x - r, q)]);
  const cercles = ty.map((u) => decoupeX(Array.from({ length: 48 }, (_, k) => F(u.x + (u.d / 2) * Math.cos((k / 48) * 2 * Math.PI), u.z + (u.d / 2) * Math.sin((k / 48) * 2 * Math.PI))), X0, X1));
  const hachure = { t: 'h', pts, trous: [...bandes, ...cercles].filter((q) => q.length > 2), ang: 45, pas: 3, s: 'n' };
  return { face: nettoyer(face), donnees: [...v.dessus, ...v.gauche, ...ondes], hachure, matiere, cadres: v.cadres, zone: [X0, X1] };
}
