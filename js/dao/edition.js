/* =====================================================================
   DAO — ÉDITION : toucher une entité, boîte englobante, déplacer, miroir
   (mm réels ; voir js/dao/geom.js pour le format des entités)
   ===================================================================== */

import { angleDe, angleSurArc, surCercle, arcNormal, dist, arrondi } from './geom.js';
import { pointsCote, translaterCote, symetrieCote } from './cotes.js';
import { dansPolygone } from './hachures.js';

const boiteX = (e) => { const h = e.hr || e.h || 3.5; return [e.x, e.y, e.x + String(e.txt || '').length * h * 0.62, e.y + h]; };
/** Points d'appui des hachures et textes (sélection au cadre). */
const pointsDe = (e) => (e.t === 'h' ? e.pts : (() => { const b = boiteX(e); return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]; })());

const distSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

/** Distance d'un point p à une entité. */
export function distanceA(e, p) {
  if (e.t === 'q') {   // cote : distance à sa ligne de cote
    const q = pointsCote(e);
    if (e.k === 'd' || e.k === 'r') return distSeg(p, q[0], q[1]);
    if (e.k === 'ang') return Math.min(distSeg(p, q[1], q[2]), distSeg(p, q[2], q[3]));
    return distSeg(p, q[2], q[3]);
  }
  if (e.t === 'h' || e.t === 'x') {
    const q = pointsDe(e);
    if (e.t === 'h' ? dansPolygone(p, q) : (p[0] >= q[0][0] && p[0] <= q[2][0] && p[1] >= q[0][1] && p[1] <= q[2][1])) return 0;
    return Math.min(...q.map((a, i) => distSeg(p, a, q[(i + 1) % q.length])));
  }
  if (e.t === 'l') {
    const dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - e.x1) * dx + (p[1] - e.y1) * dy) / L2)) : 0;
    return Math.hypot(p[0] - (e.x1 + t * dx), p[1] - (e.y1 + t * dy));
  }
  const d = Math.abs(dist([e.cx, e.cy], p) - e.r);
  if (e.t === 'c' || angleSurArc(e, angleDe([e.cx, e.cy], p))) return d;
  return Math.min(dist(p, surCercle(e.cx, e.cy, e.r, e.a0)), dist(p, surCercle(e.cx, e.cy, e.r, e.a1)));
}

/** Indice de l'entité la plus proche de p (à moins de tol), ou -1. */
export function toucher(entites, p, tol) {
  let best = -1, bd = tol;
  entites.forEach((e, i) => { const d = distanceA(e, p); if (d <= bd) { bd = d; best = i; } });
  return best;
}

/** Boîte englobante [xmin, ymin, xmax, ymax]. */
export function boite(e) {
  if (e.t === 'h' || e.t === 'x') { const q = pointsDe(e); const xs = q.map((v) => v[0]), ys = q.map((v) => v[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (e.t === 'q') { const q = pointsCote(e); const xs = q.map((v) => v[0]), ys = q.map((v) => v[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (e.t === 'l') return [Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.max(e.x1, e.x2), Math.max(e.y1, e.y2)];
  if (e.t === 'c') return [e.cx - e.r, e.cy - e.r, e.cx + e.r, e.cy + e.r];
  const pts = [surCercle(e.cx, e.cy, e.r, e.a0), surCercle(e.cx, e.cy, e.r, e.a1)];
  for (const a of [0, 90, 180, 270, 360, 450, 540, 630]) if (a > e.a0 && a < e.a1) pts.push(surCercle(e.cx, e.cy, e.r, a));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Entités dans le rectangle (a, b). fenetre = true : entièrement dedans (glisser vers la droite) ;
 * false : qui touchent le rectangle (glisser vers la gauche).
 */
export function dansRectangle(entites, a, b, fenetre) {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const res = [];
  entites.forEach((e, i) => {
    const [bx0, by0, bx1, by1] = boite(e);
    const dedans = bx0 >= x0 && bx1 <= x1 && by0 >= y0 && by1 <= y1;
    let touche = dedans;
    if (!fenetre && !dedans && bx1 >= x0 && bx0 <= x1 && by1 >= y0 && by0 <= y1) {
      // échantillonne l'entité : un point dans le rectangle suffit
      const n = 48;
      for (let k = 0; k <= n && !touche; k++) {
        const t = k / n; let q;
        if (e.t === 'h' || e.t === 'x') { const c = pointsDe(e); q = c[Math.min(c.length - 1, Math.floor(t * c.length))]; } else if (e.t === 'q') { const c = pointsCote(e); q = c[Math.min(c.length - 1, Math.floor(t * c.length))]; } else if (e.t === 'l') q = [e.x1 + t * (e.x2 - e.x1), e.y1 + t * (e.y2 - e.y1)];
        else if (e.t === 'c') q = surCercle(e.cx, e.cy, e.r, t * 360);
        else q = surCercle(e.cx, e.cy, e.r, e.a0 + t * (e.a1 - e.a0));
        touche = q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
      }
    }
    if (touche) res.push(i);
  });
  return res;
}

const r4 = (v) => arrondi(v, 4);

/** Translation. */
export function translater(e, dx, dy) {
  if (e.t === 'q') return translaterCote(e, dx, dy);
  if (e.t === 'h') return { ...e, pts: e.pts.map((q) => [r4(q[0] + dx), r4(q[1] + dy)]), ...(e.trous ? { trous: e.trous.map((t) => t.map((q) => [r4(q[0] + dx), r4(q[1] + dy)])) } : {}) };
  if (e.t === 'x') return { ...e, x: r4(e.x + dx), y: r4(e.y + dy) };
  if (e.t === 'l') return { ...e, x1: r4(e.x1 + dx), y1: r4(e.y1 + dy), x2: r4(e.x2 + dx), y2: r4(e.y2 + dy) };
  return { ...e, cx: r4(e.cx + dx), cy: r4(e.cy + dy) };
}

/** Symétrie par rapport à la droite (a, b). */
export function symetrie(e, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const refl = (p) => {
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
    const hx = a[0] + t * dx, hy = a[1] + t * dy;
    return [r4(2 * hx - p[0]), r4(2 * hy - p[1])];
  };
  if (e.t === 'q') return symetrieCote(e, refl, (Math.atan2(dy, dx) * 180) / Math.PI);
  if (e.t === 'h') return { ...e, pts: e.pts.map(refl).reverse(), ...(e.trous ? { trous: e.trous.map((t) => t.map(refl).reverse()) } : {}), ang: r4(2 * ((Math.atan2(dy, dx) * 180) / Math.PI) - (e.ang ?? 45)) };
  if (e.t === 'x') { const [x, y] = refl([e.x, e.y]); return { ...e, x, y }; }
  if (e.t === 'l') { const [x1, y1] = refl([e.x1, e.y1]); const [x2, y2] = refl([e.x2, e.y2]); return { ...e, x1, y1, x2, y2 }; }
  const [cx, cy] = refl([e.cx, e.cy]);
  if (e.t === 'c') return { ...e, cx, cy };
  const phi = (Math.atan2(dy, dx) * 180) / Math.PI;
  return arcNormal({ ...e, cx, cy, a0: 2 * phi - e.a1, a1: 2 * phi - e.a0 });
}
