/* =====================================================================
   DAO — MISE EN PAGE DES 3 VUES (méthode des 3 intervalles égaux)
   ---------------------------------------------------------------------
   Horizontalement : bord | face (L) | e | gauche (P) | bord, les 3 espaces
   égaux : e = (A − L − P) / 3. Verticalement : bord | dessus (P) | e' |
   face (H) | bord : e' = (B − H − P) / 3. A × B : zone utile (cadre entier,
   ou cadre sans la bande du cartouche).
   Mode « libre » : la correction retrouve les vues de l'élève là où il
   les a dessinées (boîte englobante de ses traits forts).
   Coordonnées : mm réels, origine au coin bas-gauche du cadre (feuille.js).
   ===================================================================== */

import { zone, facteur, CARTOUCHE } from './feuille.js';
import { boite } from './pieces.js';

export const ZONES = { sans: 'cadre sans le cartouche', cadre: 'cadre entier' };
const r1 = (v) => Math.round(v * 10) / 10;

/** Zone utile en mm réels : { y0 (bas), w, h }. */
export function zoneUtile(p, z = 'sans') {
  const Z = zone(p), k = facteur(p.echelle);
  const bas = z === 'cadre' ? 0 : CARTOUCHE.h / k;
  return { y0: bas, w: Z.w / k, h: Z.h / k - bas };
}

/** Placement attendu des 3 vues. */
export function attendu(p, pc, z = 'sans') {
  const b = boite(pc), W = b.x1 - b.x0, H = b.z1 - b.z0, P = pc.prof;
  const zu = zoneUtile(p, z);
  const ex = (zu.w - W - P) / 3, ey = (zu.h - H - P) / 3;
  return { o: [ex, zu.y0 + ey + P + ey], ecart: [ex, ey], ex, ey, A: r1(zu.w), B: r1(zu.h), W, H, P, zu };
}

/** Retrouve le placement des vues dessinées par l'élève (null si rien de dessiné). */
export function detecter(pc, entites) {
  const b = boite(pc), W = b.x1 - b.x0, H = b.z1 - b.z0, P = pc.prof;
  const xs = [], ys = [];
  for (const e of entites || []) {
    if (e.s !== 'v') continue;
    if (e.t === 'l') { xs.push(e.x1, e.x2); ys.push(e.y1, e.y2); }
    else if (e.t === 'c') { xs.push(e.cx - e.r, e.cx + e.r); ys.push(e.cy - e.r, e.cy + e.r); }
    else if (e.t === 'a') {
      for (let k = 0; k <= 16; k++) { const a = ((e.a0 + ((e.a1 - e.a0) * k) / 16) * Math.PI) / 180; xs.push(e.cx + e.r * Math.cos(a)); ys.push(e.cy + e.r * Math.sin(a)); }
    }
  }
  if (xs.length < 4) return null;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { o: [x0, y1 - H], ecart: [x1 - x0 - W - P, y1 - y0 - H - P], bas: y0 };
}

/** Contrôles de la mise en page (tolérance 1 mm). */
export function controler(p, pc, entites, z = 'sans') {
  const a = attendu(p, pc, z), d = detecter(pc, entites);
  if (!d) return { a, d: null, ok: 0, items: [] };
  const items = [
    ['marge gauche', d.o[0], a.ex],
    ['écart face – gauche', d.ecart[0], a.ex],
    ['marge du bas', d.bas - a.zu.y0, a.ey],
    ['écart face – dessus', d.ecart[1], a.ey],
  ].map(([nom, v, att]) => ({ nom, v: r1(v), att: r1(att), ok: Math.abs(v - att) <= 1 }));
  return { a, d, ok: items.filter((i) => i.ok).length, items };
}

const nb = (v) => String(r1(v)).replace('.', ',');
/** Texte du calcul attendu. */
export function texteCalcul(a) {
  return `e = (${nb(a.A)} − ${nb(a.W)} − ${nb(a.P)}) / 3 = ${nb(a.ex)} mm ; e' = (${nb(a.B)} − ${nb(a.H)} − ${nb(a.P)}) / 3 = ${nb(a.ey)} mm`;
}
export { nb as nombreFr };
