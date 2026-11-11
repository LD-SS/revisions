/* =====================================================================
   DAO — HACHURES ET TEXTE
   ---------------------------------------------------------------------
   Hachure : { t: 'h', pts: [[x, y], …] (contour fermé, mm réels), trous: [[…]], ang: 45,
               pas: 3 (écart sur le papier, mm), s: 'n' }
     Le contour est trouvé en cliquant à l'intérieur d'une zone fermée par
     des traits (lignes, cercles, arcs ; les arcs sont découpés en petits
     segments) : on construit le graphe plan des traits et on prend la
     plus petite face qui contient le point.
   Texte : { t: 'x', x, y, txt, h: 3.5 (hauteur sur le papier, mm), s: 'n' }
   ===================================================================== */

import { versPapier, facteur } from './feuille.js';
import { surCercle, arrondi } from './geom.js';

const f2 = (v) => Math.round(v * 100) / 100;
const cle = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

/** Segments [a, b] des traits (arcs et cercles en petits segments). */
function segmentsDe(es) {
  const segs = [];
  for (const e of es) {
    if (e.t === 'l') segs.push([[e.x1, e.y1], [e.x2, e.y2]]);
    else if (e.t === 'c' || e.t === 'a') {
      const a0 = e.t === 'c' ? 0 : e.a0, a1 = e.t === 'c' ? 360 : e.a1;
      const n = Math.max(8, Math.ceil((a1 - a0) / 6));
      for (let k = 0; k < n; k++) segs.push([surCercle(e.cx, e.cy, e.r, a0 + ((a1 - a0) * k) / n), surCercle(e.cx, e.cy, e.r, a0 + ((a1 - a0) * (k + 1)) / n)]);
    }
  }
  return segs;
}

function interSeg(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t > -1e-9 && t < 1 + 1e-9 && u > -1e-9 && u < 1 + 1e-9 ? t : null;
}

const aire = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
export function dansPolygone(p, pts) {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Plus petite zone fermée contenant p : { pts, trous } (trous = contours fermés intérieurs), ou null. */
export function regionAutour(es, p) {
  const segs = segmentsDe(es.filter((e) => e.t === 'l' || e.t === 'c' || e.t === 'a'));
  if (segs.length > 4000) return null;
  // découpe chaque segment à ses intersections
  const coupes = segs.map(() => [0, 1]);
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const t = interSeg(segs[i][0], segs[i][1], segs[j][0], segs[j][1]);
      if (t == null) continue;
      const u = interSeg(segs[j][0], segs[j][1], segs[i][0], segs[i][1]);
      coupes[i].push(t); if (u != null) coupes[j].push(u);
    }
  }
  const noeuds = new Map(); const voisins = new Map();
  const noeud = (q) => { const k = cle(q); if (!noeuds.has(k)) { noeuds.set(k, q); voisins.set(k, new Set()); } return k; };
  segs.forEach(([a, b], i) => {
    const ts = [...new Set(coupes[i].map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
    for (let k = 0; k < ts.length - 1; k++) {
      const P = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const u = noeud(P(ts[k])), v = noeud(P(ts[k + 1]));
      if (u !== v) { voisins.get(u).add(v); voisins.get(v).add(u); }
    }
  });
  // faces : pour chaque arête orientée, tourner le plus à droite possible
  const vus = new Set(); let meilleure = null, aireMin = Infinity; const faces = [];
  const angle = (u, v) => { const a = noeuds.get(u), b = noeuds.get(v); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  for (const [u, vs] of voisins) {
    for (const v of vs) {
      if (vus.has(`${u}>${v}`)) continue;
      const face = []; let a = u, b = v, n = 0;
      while (n++ < 5000) {
        vus.add(`${a}>${b}`); face.push(noeuds.get(a));
        const arrivee = angle(b, a);
        let suivant = null, best = Infinity;
        for (const w of voisins.get(b)) {
          if (w === a && voisins.get(b).size > 1) continue;
          let d = angle(b, w) - arrivee; while (d <= 1e-12) d += 2 * Math.PI;
          if (d < best) { best = d; suivant = w; }
        }
        if (!suivant) break;
        a = b; b = suivant;
        if (a === u && b === v) break;
      }
      const A = aire(face);
      // avec cette règle de parcours, les faces intérieures tournent dans le sens horloger (aire < 0)
      if (face.length >= 3 && A < -1e-6) faces.push(face);
      if (face.length >= 3 && A < -1e-6 && -A < aireMin && dansPolygone(p, face)) { aireMin = -A; meilleure = face; }
    }
  }
  if (!meilleure) return null;
  const r = (f) => f.map((q) => [arrondi(q[0], 4), arrondi(q[1], 4)]);
  // trous : faces entièrement dans la zone, sans le point, et pas déjà dans un autre trou
  const dans = (f, g) => f.every((q) => dansPolygone(q, g) || g.some((s) => Math.abs(s[0] - q[0]) < 1e-6 && Math.abs(s[1] - q[1]) < 1e-6));
  const cand = faces.filter((f) => f !== meilleure && !dansPolygone(p, f) && dans(f, meilleure) && !f.every((q) => meilleure.some((s) => Math.abs(s[0] - q[0]) < 1e-6 && Math.abs(s[1] - q[1]) < 1e-6)));
  const trous = cand.filter((f) => !cand.some((g) => g !== f && Math.abs(aire(g)) > Math.abs(aire(f)) && dans(f, g)));
  return { pts: r(meilleure), trous: trous.map(r) };
}

/** SVG des hachures (mm papier). */
export function svgHachure(p, e, cls = '') {
  const P = e.pts.map((q) => versPapier(p, q[0], q[1]));
  const contours = [P, ...(e.trous || []).map((t) => t.map((q) => versPapier(p, q[0], q[1])))];
  const ang = ((e.ang ?? 45) * Math.PI) / 180;
  const u = [Math.cos(ang), -Math.sin(ang)], n = [-u[1], u[0]];
  const pas = e.pas || 3;
  const pr = (q) => q[0] * n[0] + q[1] * n[1];
  const proj = P.map(pr);
  const lo = Math.min(...proj), hi = Math.max(...proj);
  let d = '';
  for (let c = Math.ceil(lo / pas) * pas; c <= hi; c += pas) {
    const xs = [];
    for (const C of contours) {
      for (let i = 0; i < C.length; i++) {
        const a = C[i], b = C[(i + 1) % C.length];
        const pa = pr(a) - c, pb = pr(b) - c;
        if ((pa > 0) === (pb > 0) || pa === pb) continue;
        const t = pa / (pa - pb);
        const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        xs.push(q[0] * u[0] + q[1] * u[1]);
      }
    }
    xs.sort((x, y) => x - y);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const A = [n[0] * c + u[0] * xs[k], n[1] * c + u[1] * xs[k]], B = [n[0] * c + u[0] * xs[k + 1], n[1] * c + u[1] * xs[k + 1]];
      d += `M${f2(A[0])} ${f2(A[1])}L${f2(B[0])} ${f2(B[1])}`;
    }
  }
  const contour = contours.map((C) => `M${C.map((q) => `${f2(q[0])} ${f2(q[1])}`).join('L')}Z`).join('');
  return `<g class="dao-hach${cls ? ` ${cls}` : ''}"><path class="dao-hach-zone" d="${contour}"/><path class="dao-hach-l" d="${d}"/></g>`;
}

/** SVG d'un texte (mm papier). */
export function svgTexte(p, e, cls = '') {
  const [x, y] = versPapier(p, e.x, e.y);
  const t = String(e.txt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<text class="dao-texte${cls ? ` ${cls}` : ''}" x="${f2(x)}" y="${f2(y)}" style="font-size:${f2(e.h || 3.5)}px">${t}</text>`;
}

/** Boîte d'un texte en mm réels (largeur estimée). */
export function boiteTexte(p, e) {
  const k = facteur(p.echelle), h = (e.h || 3.5) / k;
  return [e.x, e.y, e.x + String(e.txt || '').length * h * 0.62, e.y + h];
}
