/* =====================================================================
   DAO — CONSTRUCTION : ajuster, prolonger, chanfrein, congé
   (mm réels ; entités : voir js/dao/geom.js). Fonctions pures : elles
   renvoient la nouvelle liste d'entités, ou un message d'erreur (texte).
   ===================================================================== */

import { intersections, interLC, angleDe, angleSurArc, arcNormal, arrondi, EPS } from './geom.js';

const r4 = (v) => arrondi(v, 4);
const norm = (v) => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const ligne = (a, b, s) => ({ t: 'l', x1: r4(a[0]), y1: r4(a[1]), x2: r4(b[0]), y2: r4(b[1]), s });
const tracables = (es, sauf) => es.filter((e, k) => k !== sauf && e.t !== 'q');

/** Ajuster : enlève le morceau de l'entité i (ligne, cercle, arc) qui contient p, entre deux intersections. */
export function ajuster(es, i, p) {
  const e = es[i];
  const autres = tracables(es, i);
  const pts = autres.flatMap((f) => intersections(e, f));
  let morceaux;
  if (e.t === 'l') {
    const d = [e.x2 - e.x1, e.y2 - e.y1], L2 = dot(d, d) || 1;
    const tp = (q) => ((q[0] - e.x1) * d[0] + (q[1] - e.y1) * d[1]) / L2;
    const ts = [...new Set(pts.map((q) => r4(tp(q))).filter((t) => t > EPS && t < 1 - EPS))].sort((a, b) => a - b);
    if (!ts.length) return 'Aucune intersection sur ce trait : utilise plutôt la gomme.';
    const tc = tp(p);
    const bornes = [0, ...ts, 1];
    let k = bornes.findIndex((t, j) => j < bornes.length - 1 && tc >= t && tc <= bornes[j + 1]);
    if (k < 0) k = tc < 0 ? 0 : bornes.length - 2;
    const P = (t) => [e.x1 + t * d[0], e.y1 + t * d[1]];
    morceaux = [];
    if (k > 0) morceaux.push(ligne(P(0), P(bornes[k]), e.s));
    if (k + 1 < bornes.length - 1) morceaux.push(ligne(P(bornes[k + 1]), P(1), e.s));
  } else {
    const c = [e.cx, e.cy];
    const angs = [...new Set(pts.map((q) => r4(angleDe(c, q))))];
    const ac = angleDe(c, p);
    if (e.t === 'c') {
      if (angs.length < 2) return 'Il faut au moins deux intersections sur le cercle pour en enlever un morceau.';
      angs.sort((a, b) => a - b);
      let k = angs.findIndex((a, j) => ac >= a && ac <= (angs[j + 1] ?? angs[0] + 360));
      if (k < 0) k = angs.length - 1;                  // entre le dernier et le premier (passe par 0°)
      const deb = angs[(k + 1) % angs.length], fin = angs[k];
      morceaux = [arcNormal({ t: 'a', cx: e.cx, cy: e.cy, r: e.r, a0: deb, a1: fin, s: e.s })];
    } else {
      const rel = (a) => ((a - e.a0) % 360 + 360) % 360;
      const span = e.a1 - e.a0;
      const rs = [...new Set(angs.map(rel).filter((x) => x > EPS && x < span - EPS))].sort((a, b) => a - b);
      if (!rs.length) return 'Aucune intersection sur cet arc : utilise plutôt la gomme.';
      const rc = rel(ac);
      const bornes = [0, ...rs, span];
      let k = bornes.findIndex((x, j) => j < bornes.length - 1 && rc >= x && rc <= bornes[j + 1]);
      if (k < 0) k = rc > span ? (rc - span < 360 - rc ? bornes.length - 2 : 0) : 0;
      morceaux = [];
      const arc = (u, v) => arcNormal({ t: 'a', cx: e.cx, cy: e.cy, r: e.r, a0: e.a0 + u, a1: e.a0 + v, s: e.s });
      if (k > 0) morceaux.push(arc(0, bornes[k]));
      if (k + 1 < bornes.length - 1) morceaux.push(arc(bornes[k + 1], span));
    }
  }
  return [...es.slice(0, i), ...morceaux, ...es.slice(i + 1)];
}

/** Prolonger : allonge la ligne i, du côté de p, jusqu'au premier trait rencontré. */
export function prolonger(es, i, p) {
  const e = es[i];
  if (e.t !== 'l') return 'Seules les lignes peuvent être prolongées.';
  const A = [e.x1, e.y1], B = [e.x2, e.y2];
  const finB = Math.hypot(p[0] - B[0], p[1] - B[1]) <= Math.hypot(p[0] - A[0], p[1] - A[1]);
  const O = finB ? B : A, u = norm(finB ? [B[0] - A[0], B[1] - A[1]] : [A[0] - B[0], A[1] - B[1]]);
  const loin = { t: 'l', x1: O[0], y1: O[1], x2: O[0] + u[0] * 1e4, y2: O[1] + u[1] * 1e4 };
  let best = Infinity;
  for (const f of tracables(es, i)) {
    const pts = f.t === 'l' ? intersections(loin, f)
      : interLC(loin, f.cx, f.cy, f.r).filter((q) => f.t === 'c' || angleSurArc(f, angleDe([f.cx, f.cy], q)));
    for (const q of pts) { const s = dot([q[0] - O[0], q[1] - O[1]], u); if (s > 1e-4 && s < best) best = s; }
  }
  if (!Number.isFinite(best)) return 'Aucun trait à atteindre dans cette direction.';
  const N = [O[0] + u[0] * best, O[1] + u[1] * best];
  const n = finB ? ligne(A, N, e.s) : ligne(N, B, e.s);
  return es.map((x, k) => (k === i ? n : x));
}

/** Intersection des droites portant deux segments, et côtés gardés (là où on a cliqué). */
function coin(l1, c1, l2, c2) {
  const d1 = [l1.x2 - l1.x1, l1.y2 - l1.y1], d2 = [l2.x2 - l2.x1, l2.y2 - l2.y1];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < EPS) return null;
  const t = ((l2.x1 - l1.x1) * d2[1] - (l2.y1 - l1.y1) * d2[0]) / den;
  const I = [l1.x1 + t * d1[0], l1.y1 + t * d1[1]];
  const cote = (l, d, c) => {
    let u = norm(d); if (dot([c[0] - I[0], c[1] - I[1]], u) < 0) u = [-u[0], -u[1]];
    const ends = [[l.x1, l.y1], [l.x2, l.y2]];
    const loin = ends.reduce((a, b) => (dot([b[0] - I[0], b[1] - I[1]], u) > dot([a[0] - I[0], a[1] - I[1]], u) ? b : a));
    return { u, loin, long: dot([loin[0] - I[0], loin[1] - I[1]], u) };
  };
  return { I, a: cote(l1, d1, c1), b: cote(l2, d2, c2) };
}

/** Chanfrein de d mm (égal sur les deux côtés) entre les lignes i et j. */
export function chanfrein(es, i, ci, j, cj, d) {
  const l1 = es[i], l2 = es[j];
  if (l1?.t !== 'l' || l2?.t !== 'l' || i === j) return 'Le chanfrein se fait entre deux lignes.';
  const k = coin(l1, ci, l2, cj);
  if (!k) return 'Ces deux lignes sont parallèles.';
  if (d <= 0 || d >= k.a.long || d >= k.b.long) return 'Distance trop grande pour ces lignes.';
  const P1 = [k.I[0] + k.a.u[0] * d, k.I[1] + k.a.u[1] * d], P2 = [k.I[0] + k.b.u[0] * d, k.I[1] + k.b.u[1] * d];
  const out = es.map((x, n) => (n === i ? ligne(P1, k.a.loin, l1.s) : n === j ? ligne(P2, k.b.loin, l2.s) : x));
  return [...out, ligne(P1, P2, l1.s)];
}

/** Congé de rayon r entre les lignes i et j. */
export function conge(es, i, ci, j, cj, r) {
  const l1 = es[i], l2 = es[j];
  if (l1?.t !== 'l' || l2?.t !== 'l' || i === j) return 'Le congé se fait entre deux lignes.';
  const k = coin(l1, ci, l2, cj);
  if (!k) return 'Ces deux lignes sont parallèles.';
  const cos = Math.max(-1, Math.min(1, dot(k.a.u, k.b.u)));
  const th = Math.acos(cos);
  if (th < 1e-3 || th > Math.PI - 1e-3) return 'Angle impossible pour un congé.';
  const t = r / Math.tan(th / 2);
  if (r <= 0 || t >= k.a.long || t >= k.b.long) return 'Rayon trop grand pour ces lignes.';
  const T1 = [k.I[0] + k.a.u[0] * t, k.I[1] + k.a.u[1] * t], T2 = [k.I[0] + k.b.u[0] * t, k.I[1] + k.b.u[1] * t];
  const bis = norm([k.a.u[0] + k.b.u[0], k.a.u[1] + k.b.u[1]]);
  const h = r / Math.sin(th / 2);
  const C = [k.I[0] + bis[0] * h, k.I[1] + bis[1] * h];
  let a1 = angleDe(C, T1), a2 = angleDe(C, T2);
  const arc = ((a2 - a1 + 360) % 360) < 180 ? { a0: a1, a1: a2 } : { a0: a2, a1: a1 };
  const out = es.map((x, n) => (n === i ? ligne(T1, k.a.loin, l1.s) : n === j ? ligne(T2, k.b.loin, l2.s) : x));
  return [...out, arcNormal({ t: 'a', cx: r4(C[0]), cy: r4(C[1]), r: r4(r), ...arc, s: l1.s })];
}

