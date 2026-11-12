/* =====================================================================
   DAO — PIÈCES « SOLIDES » : réunion de prismes à profils quelconques
   (droites + arcs : cylindres, congés, bossages, nervures…) et de solides
   de révolution (arbres, chanfreins, gorges), moins des creux.
   ---------------------------------------------------------------------
   Pièce = { id, nom, cs: true, L, P, H,
             corps: [prim], creux: [prim],
             coupe?: y du plan A-A, ou plans parallèles [[x0, x1, y], …],
             section?: x du plan de la section sortie B-B,
             aux?: { n: [nx, 0, nz], d0, s }  vue auxiliaire partielle,
             persp?: 'cav' (perspective cavalière à calculer),
             filets?: [{ ax, c:[u,v], w:[w0,w1], d, D, int, fin }],
             cotes?, reperes? (perspective cotée de l'énoncé) }
   prim extrudé = { ax, a: [a0, a1], f: profil (u, v), nerv? }
   prim de révolution = { k: 'rev', ax, c: [u, v], prof: [[w, r], …] }
     ax : 'x' | 'y' | 'z' (u, v) = (y, z) | (x, z) | (x, y),
          ou { w: [dx, dy, dz], o: [x, y, z] } (axe quelconque, extrudé seulement).
   Calcul : toutes les faces sont planes (arcs découpés tous les 3°) ; les
   arêtes candidates sont les intersections de faces ; on garde celles
   qui sont de vraies arêtes (motif de matière autour du point, les
   raccordements tangents ne donnent pas de trait), plus les génératrices
   de contour apparent des surfaces courbes. Visibilité par rayons.
   Le résultat 2D (droites + arcs reconstitués) est mis en cache
   (cahier-solides.js) car le calcul prend quelques secondes.
   Toutes les pièces sont créées pour l'appli.
   ===================================================================== */

const r3 = (v) => Math.round(v * 1000) / 1000;
const DEB = 3;
const AXES = { y: [0, 2, 1], z: [0, 1, 2], x: [1, 2, 0] };   // indices monde de (u, v, w)
const NREV = 120;

/* ---------- profils ---------- */
export function arc(cu, cv, r, d0, d1) {
  const n = Math.max(2, Math.ceil(Math.abs(d1 - d0) / 3));
  return Array.from({ length: n + 1 }, (_, k) => { const a = ((d0 + ((d1 - d0) * k) / n) * Math.PI) / 180; return [cu + r * Math.cos(a), cv + r * Math.sin(a)]; });
}
export const disque = (cu, cv, r) => ({ pts: arc(cu, cv, r, 0, 360).slice(0, -1), cyl: { c: [cu, cv], r } });
export const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
export const E = (ax, a0, a1, f, opt = {}) => ({ ax, a: [a0, a1], ...(Array.isArray(f) ? { f } : { f: f.pts, cyl: f.cyl }), ...opt });
/** Solide de révolution : prof = [[w, r], …] (w croissant ; deux points de même w = épaulement). */
export const Rv = (ax, cu, cv, prof, opt = {}) => ({ k: 'rev', ax, c: [cu, cv], prof, ...opt });

const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ps = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const L = Math.hypot(...a); return a.map((v) => v / L); };
const add = (a, b, k = 1) => a.map((v, i) => v + k * b[i]);

function repere(ax) {
  if (typeof ax === 'string') {
    const I = AXES[ax], e = (i) => [0, 1, 2].map((k) => (k === i ? 1 : 0));
    return { I, U: e(I[0]), V: e(I[1]), W: e(I[2]), O: [0, 0, 0] };
  }
  const W = unit(ax.w), U = unit(Math.abs(W[1]) < 0.9 ? croix([0, 1, 0], W) : croix([1, 0, 0], W)), V = croix(W, U);
  return { I: null, U, V, W, O: ax.o || [0, 0, 0] };
}
function compiler(pr) {
  if (pr._k) return pr;
  const R = repere(pr.ax);
  const toW = ([u, v, w]) => [0, 1, 2].map((k) => R.O[k] + u * R.U[k] + v * R.V[k] + w * R.W[k]);
  const toL = (p) => { const d = [p[0] - R.O[0], p[1] - R.O[1], p[2] - R.O[2]]; return [ps(d, R.U), ps(d, R.V), ps(d, R.W)]; };
  if (pr.k === 'rev') {
    const prof = pr.prof, [cu, cv] = pr.c;
    pr.a = [prof[0][0], prof[prof.length - 1][0]];
    const rmax = Math.max(...prof.map((q) => q[1]));
    pr.cyl = { c: [cu, cv], r: rmax };
    const rAt = (w) => { let r = 0; for (let i = 0; i + 1 < prof.length; i++) { const [w1, r1] = prof[i], [w2, r2] = prof[i + 1]; if (w >= w1 - 1e-12 && w <= w2 + 1e-12) r = Math.max(r, w2 - w1 < 1e-12 ? Math.max(r1, r2) : r1 + ((r2 - r1) * (w - w1)) / (w2 - w1)); } return r; };
    const coins = [[cu - rmax, cv - rmax, pr.a[0]], [cu + rmax, cv + rmax, pr.a[1]]].map(toW);
    pr._k = { rev: true, I: R.I, toW, toL, prof, rAt, cu, cv, bmin: [0, 1, 2].map((k) => Math.min(coins[0][k], coins[1][k])), bmax: [0, 1, 2].map((k) => Math.max(coins[0][k], coins[1][k])) };
    return pr;
  }
  const pts = [];
  for (const p of pr.f) { const q = pts[pts.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) pts.push(p); }
  if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
  const n = pts.length;
  let aire = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; aire += p[0] * q[1] - q[0] * p[1]; }
  const sens = aire > 0 ? 1 : -1;
  const nrm = pts.map((p, i) => { const q = pts[(i + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(sens * (q[1] - p[1])) / L, (-sens * (q[0] - p[0])) / L]; });   // normale sortante du côté i
  const vif = pts.map((_, i) => { const a = nrm[(i - 1 + n) % n], b = nrm[i]; return a[0] * b[0] + a[1] * b[1] < Math.cos((12 * Math.PI) / 180); });
  const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
  const coins = [];
  for (const u of [Math.min(...us), Math.max(...us)]) for (const v of [Math.min(...vs), Math.max(...vs)]) for (const w of pr.a) coins.push(toW([u, v, w]));
  pr._k = { pts, n, nrm, vif, toW, toL, I: R.I, bmin: [0, 1, 2].map((k) => Math.min(...coins.map((c) => c[k]))), bmax: [0, 1, 2].map((k) => Math.max(...coins.map((c) => c[k]))) };
  return pr;
}

function dansPoly(poly, a, b) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, bi] = poly[i], [aj, bj] = poly[j];
    if ((bi > b) !== (bj > b) && a < ((aj - ai) * (b - bi)) / (bj - bi) + ai) c = !c;
  }
  return c;
}
const union = (iv) => { const s = [...iv].sort((a, b) => a[0] - b[0]), o = []; for (const [a, b] of s) { if (o.length && a <= o[o.length - 1][1] + 1e-9) o[o.length - 1][1] = Math.max(o[o.length - 1][1], b); else o.push([a, b]); } return o; };
const moins = (A, B) => { let r = A; for (const [c, d] of B) { const n = []; for (const [a, b] of r) { if (d <= a || c >= b) n.push([a, b]); else { if (c > a) n.push([a, c]); if (d < b) n.push([d, b]); } } r = n; } return r; };
const inter = (A, B) => { const out = []; for (const [a, b] of A) for (const [c, d] of B) { const lo = Math.max(a, c), hi = Math.min(b, d); if (hi > lo + 1e-9) out.push([lo, hi]); } return out; };
/** Intervalles du paramètre t où la droite 2D l0 + t·d est dans le(s) polygone(s). */
function dansPolys2D(loops, l0, d) {
  if (Math.hypot(d[0], d[1]) < 1e-12) return loops.reduce((c, lp) => c !== dansPoly(lp, l0[0], l0[1]), false) ? [[-1e6, 1e6]] : [];
  const ts = [];
  for (const lp of loops) for (let i = 0; i < lp.length; i++) {
    const A = lp[i], B = lp[(i + 1) % lp.length], ex = B[0] - A[0], ey = B[1] - A[1];
    const den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-12) continue;
    const t = ((A[0] - l0[0]) * ey - (A[1] - l0[1]) * ex) / den, s = ((A[0] - l0[0]) * d[1] - (A[1] - l0[1]) * d[0]) / den;
    if (s >= 0 && s < 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const out = []; for (let k = 0; k + 1 < ts.length; k += 2) out.push([ts[k], ts[k + 1]]);
  return out;
}

/* ---------- le solide ---------- */
function rPoly(K, l) {   // rayon du polygone inscrit (révolution découpée en NREV facettes) dans la direction du point
  const ph = Math.atan2(l[1] - K.cv, l[0] - K.cu), st = (2 * Math.PI) / NREV, m = ((ph % st) + st) % st;
  return Math.cos(st / 2) / Math.cos(m - st / 2);
}
function dansPrim(pr, p) {
  const K = pr._k, l = K.toL(p);
  if (l[2] < pr.a[0] || l[2] > pr.a[1]) return false;
  if (K.rev) return Math.hypot(l[0] - K.cu, l[1] - K.cv) <= K.rAt(l[2]) * rPoly(K, l);
  return dansPoly(K.pts, l[0], l[1]);
}
/** Fonction y du plan de coupe (nombre, ou plans parallèles [[x0, x1, y], …]). */
function planCoupe(clip) {
  if (clip == null) return null;
  if (typeof clip === 'number') return () => clip;
  return (x) => { for (const [x0, x1, y] of clip) if (x >= x0 && x < x1) return y; return clip[x < clip[0][0] ? 0 : clip.length - 1][2]; };
}
function outils(pc, clip) {
  const corps = pc.corps.map(compiler), creux = (pc.creux || []).map(compiler), cy = planCoupe(clip);
  const dedans = (p) => (!cy || p[1] >= cy(p[0])) && corps.some((q) => dansPrim(q, p)) && !creux.some((q) => dansPrim(q, p));
  /* intervalles de la coordonnée monde k le long de la droite parallèle à l'axe k passant par p */
  const ivPrim = (pr, p, k) => {
    const K = pr._k, q = [...p]; q[k] = 0;
    const l0 = K.toL(q), dk = [0, 0, 0]; dk[k] = 1; const d = K.toL(dk).map((v, i) => v - K.toL([0, 0, 0])[i]);
    if (K.rev) {   // axe parallèle (d = ±w) ou perpendiculaire
      if (Math.abs(d[2]) > 0.5) {
        const r = Math.hypot(l0[0] - K.cu, l0[1] - K.cv), out = [];
        for (let i = 0; i + 1 < K.prof.length; i++) {
          const [w1, r1] = K.prof[i], [w2, r2] = K.prof[i + 1]; if (w2 - w1 < 1e-12) continue;
          let a = w1, b = w2;
          if (Math.abs(r2 - r1) < 1e-12) { if (r1 < r) continue; } else { const wr = w1 + ((r - r1) * (w2 - w1)) / (r2 - r1); if (r2 > r1) a = Math.max(a, wr); else b = Math.min(b, wr); }
          if (b > a) out.push([a, b]);
        }
        const s = d[2]; const w0 = l0[2];
        return union(out).map(([a, b]) => { const ta = (a - w0) / s, tb = (b - w0) / s; return [Math.min(ta, tb), Math.max(ta, tb)]; });
      }
      const w = l0[2]; if (w < pr.a[0] || w > pr.a[1]) return [];
      const R = K.rAt(w), j = Math.abs(d[0]) > 0.5 ? 0 : 1, e = j === 0 ? l0[1] - K.cv : l0[0] - K.cu;
      if (Math.abs(e) >= R) return [];
      const h = Math.sqrt(R * R - e * e), c0 = (j === 0 ? K.cu : K.cv) - l0[j], s = d[j];
      const ta = (c0 - h) / s, tb = (c0 + h) / s; return [[Math.min(ta, tb), Math.max(ta, tb)]];
    }
    let slab;
    if (Math.abs(d[2]) < 1e-12) slab = l0[2] >= pr.a[0] && l0[2] <= pr.a[1] ? [[-1e6, 1e6]] : [];
    else { const ta = (pr.a[0] - l0[2]) / d[2], tb = (pr.a[1] - l0[2]) / d[2]; slab = [[Math.min(ta, tb), Math.max(ta, tb)]]; }
    if (!slab.length) return [];
    return inter(slab, dansPolys2D([K.pts], l0, d));
  };
  const borne = (iv, p, k) => {
    if (!cy) return iv;
    if (k === 1) return inter(iv, [[cy(p[0]), 1e9]]);
    return p[1] < cy(p[0]) ? [] : iv;
  };
  const selon = (p, k) => borne(moins(union(corps.flatMap((q) => ivPrim(q, p, k))), union(creux.flatMap((q) => ivPrim(q, p, k)))), p, k);
  const selonCorps = (p, k) => borne(union(corps.flatMap((q) => ivPrim(q, p, k))), p, k);
  return { corps, creux, dedans, selon, selonCorps, cy };
}

/** Arête au point p (direction u) : la matière autour n'est pas un demi-plan. */
function estArete(o, p, u) {
  const w = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = unit(croix(u, w)), e2 = croix(u, e1);
  const N = 48, eps = 0.02, m = [];
  for (let k = 0; k < N; k++) { const a = (2 * Math.PI * k) / N + 0.07, c = Math.cos(a) * eps, s = Math.sin(a) * eps; m.push(o.dedans([p[0] + c * e1[0] + s * e2[0], p[1] + c * e1[1] + s * e2[1], p[2] + c * e1[2] + s * e2[2]])); }
  const nb = m.filter(Boolean).length;
  if (nb === 0 || nb === N) return false;
  const tr = []; for (let k = 0; k < N; k++) if (m[k] !== m[(k + 1) % N]) tr.push(k);
  if (tr.length === 2 && Math.abs(nb - N / 2) <= 2) return false;   // plan (ou raccordement tangent)
  return true;
}

/* ---------- directions d'observation ---------- */
const C30 = Math.cos(Math.PI / 6), S30 = 0.5, C45 = Math.SQRT1_2, KCAV = 0.5;
const ISO = [-1, -1, 1].map((v) => v / Math.sqrt(3));
const CAV = unit([KCAV * C45, -1, KCAV * C45]);
function directions(pc) {
  const ds = [
    { nom: 'face', D: [0, -1, 0], k: 1, s: -1, P: (p) => [p[0], p[2]] },
    { nom: 'dessus', D: [0, 0, 1], k: 2, s: 1, P: (p) => [p[0], p[1]] },
    { nom: 'gauche', D: [-1, 0, 0], k: 0, s: -1, P: (p) => [p[1], p[2]] },
    { nom: 'iso', D: ISO, P: (p) => [(p[0] - p[1]) * C30, -((p[0] + p[1]) * S30 + p[2])] },
  ];
  if (pc.persp === 'cav') ds.push({ nom: 'cav', D: CAV, P: (p) => [p[0] + KCAV * C45 * p[1], p[2] + KCAV * C45 * p[1]] });
  if (pc.aux) { const n = unit(pc.aux.n), e1 = [n[2], 0, -n[0]]; ds.push({ nom: 'aux', D: n, P: (p) => [ps(e1, p), p[1]], garde: (p) => ps(n, p) >= pc.aux.d0 - 0.01 }); }
  return ds;
}
function visible(o, p, dir, tmax) {
  if (dir.k == null) { for (let t = 0.08; t < tmax; t += 0.35) if (o.dedans([p[0] + dir.D[0] * t, p[1] + dir.D[1] * t, p[2] + dir.D[2] * t])) return false; return true; }
  const { k, s } = dir, d = 0.03, a1 = (k + 1) % 3, a2 = (k + 2) % 3;
  return [[-d, -d], [-d, d], [d, -d], [d, d]].some(([da, db]) => {
    const q = [...p]; q[a1] += da; q[a2] += db;
    return !o.selon(q, k).some(([a, b]) => (s < 0 ? a < p[k] - 1e-4 : b > p[k] + 1e-4));
  });
}

/* ---------- faces planes et arêtes candidates ---------- */
function boiteFace(f) { const pts = f.q || f.pts3; f.min = [0, 1, 2].map((k) => Math.min(...pts.map((c) => c[k]))); f.max = [0, 1, 2].map((k) => Math.max(...pts.map((c) => c[k]))); return f; }
function faces(pr, idx) {
  const K = pr._k, out = [];
  if (K.rev) {
    const P = (w, r, k) => { const t = (2 * Math.PI * k) / NREV; return K.toW([K.cu + r * Math.cos(t), K.cv + r * Math.sin(t), w]); };
    for (let i = 0; i + 1 < K.prof.length; i++) {
      const [w1, r1] = K.prof[i], [w2, r2] = K.prof[i + 1];
      if (r1 < 1e-9 && r2 < 1e-9) continue;
      if (w2 - w1 < 1e-12) {   // épaulement : couronne plane
        const n = K.toW([0, 0, r2 > r1 ? -1 : 1]).map((v, k) => v - K.toW([0, 0, 0])[k]);
        const ext = Array.from({ length: NREV }, (_, k) => { const t = (2 * Math.PI * k) / NREV; return [K.cu + Math.max(r1, r2) * Math.cos(t), K.cv + Math.max(r1, r2) * Math.sin(t)]; });
        const int = Math.min(r1, r2) > 1e-9 ? Array.from({ length: NREV }, (_, k) => { const t = (2 * Math.PI * k) / NREV; return [K.cu + Math.min(r1, r2) * Math.cos(t), K.cv + Math.min(r1, r2) * Math.sin(t)]; }) : null;
        out.push(boiteFace({ cap: true, K, w: w1, loops: int ? [ext, int] : [ext], n, d: ps(n, K.toW([K.cu, K.cv, w1])), prim: idx, pts3: ext.map(([u, v]) => K.toW([u, v, w1])) }));
        continue;
      }
      for (let k = 0; k < NREV; k++) {
        const q = [P(w1, r1, k), P(w1, r1, k + 1), P(w2, r2, k + 1), P(w2, r2, k)];
        const g = [0, 1, 2].map((j) => (q[0][j] + q[1][j] + q[2][j] + q[3][j]) / 4);
        let n = [0, 0, 0]; for (let a = 0; a < 4; a++) { const A = q[a], B = q[(a + 1) % 4]; n = add(n, [(A[1] - B[1]) * (A[2] + B[2]), (A[2] - B[2]) * (A[0] + B[0]), (A[0] - B[0]) * (A[1] + B[1])]); }
        if (Math.hypot(...n) < 1e-12) continue;
        n = unit(n); const ax = K.toW([K.cu, K.cv, K.toL(g)[2]]); if (ps(n, add(g, ax, -1)) < 0) n = n.map((v) => -v);
        out.push(boiteFace({ q, n, d: ps(n, g), prim: idx }));
      }
    }
    for (const [w, r, sg] of [[K.prof[0][0], K.prof[0][1], -1], [K.prof[K.prof.length - 1][0], K.prof[K.prof.length - 1][1], 1]]) {
      if (r < 1e-9) continue;
      const lp = Array.from({ length: NREV }, (_, k) => { const t = (2 * Math.PI * k) / NREV; return [K.cu + r * Math.cos(t), K.cv + r * Math.sin(t)]; });
      const n = K.toW([0, 0, sg]).map((v, k) => v - K.toW([0, 0, 0])[k]);
      out.push(boiteFace({ cap: true, K, w, loops: [lp], n, d: ps(n, K.toW([K.cu, K.cv, w])), prim: idx, pts3: lp.map(([u, v]) => K.toW([u, v, w])) }));
    }
    return out;
  }
  for (let i = 0; i < K.n; i++) {
    const p = K.pts[i], q = K.pts[(i + 1) % K.n];
    const c = [K.toW([p[0], p[1], pr.a[0]]), K.toW([q[0], q[1], pr.a[0]]), K.toW([q[0], q[1], pr.a[1]]), K.toW([p[0], p[1], pr.a[1]])];
    const nl = K.nrm[i], n = add(K.toW([nl[0], nl[1], 0]), K.toW([0, 0, 0]), -1);
    out.push(boiteFace({ q: c, n, d: ps(n, c[0]), prim: idx }));
  }
  for (const w of pr.a) { const n = add(K.toW([0, 0, 1]), K.toW([0, 0, 0]), -1); out.push(boiteFace({ cap: true, K, w, loops: [K.pts], n, d: ps(n, K.toW([0, 0, w])), prim: idx, pts3: K.pts.map(([u, v]) => K.toW([u, v, w])) })); }
  return out;
}
/** Intervalle(s) du paramètre t de la droite P0 + tU contenu(s) dans la face. */
function dansFace(f, P0, U) {
  if (f.q) {
    let t0 = -1e9, t1 = 1e9;
    const g = [0, 1, 2].map((k) => (f.q[0][k] + f.q[1][k] + f.q[2][k] + f.q[3][k]) / 4);
    for (let i = 0; i < 4; i++) {
      const A = f.q[i], B = f.q[(i + 1) % 4], e = B.map((v, k) => v - A[k]);
      if (Math.hypot(...e) < 1e-12) continue;
      let m = croix(f.n, e); if (ps(m, g.map((v, k) => v - A[k])) < 0) m = m.map((v) => -v);
      const a = ps(m, P0.map((v, k) => v - A[k])), b = ps(m, U);
      if (Math.abs(b) < 1e-12) { if (a < -1e-9) return []; continue; }
      const t = -a / b; if (b > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    }
    return t1 > t0 + 1e-7 ? [[t0, t1]] : [];
  }
  const l0 = f.K.toL(P0), lu = add(f.K.toL(U), f.K.toL([0, 0, 0]), -1);
  return dansPolys2D(f.loops, l0, lu);
}
function candidats(prims) {
  const out = [];
  const seg = (a, b, sil) => { if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-5) out.push({ a, b, sil }); };
  const F = prims.flatMap((pr, i) => faces(pr, i));
  prims.forEach((pr) => {   // arêtes propres
    if (pr.pseudo) return;
    const K = pr._k;
    if (K.rev) {   // cercles aux changements de pente du profil et aux extrémités
      const pf = K.prof;
      for (let i = 0; i < pf.length; i++) {
        const r = pf[i][1]; if (r < 1e-9) continue;
        let vif = i === 0 || i === pf.length - 1;
        if (!vif) { const a = unit([pf[i][0] - pf[i - 1][0], pf[i][1] - pf[i - 1][1], 0]), b = unit([pf[i + 1][0] - pf[i][0], pf[i + 1][1] - pf[i][1], 0]); vif = ps(a, b) < Math.cos((12 * Math.PI) / 180); }
        if (!vif) continue;
        for (let k = 0; k < NREV; k++) { const t0 = (2 * Math.PI * k) / NREV, t1 = (2 * Math.PI * (k + 1)) / NREV; seg(K.toW([K.cu + r * Math.cos(t0), K.cv + r * Math.sin(t0), pf[i][0]]), K.toW([K.cu + r * Math.cos(t1), K.cv + r * Math.sin(t1), pf[i][0]])); }
      }
      return;
    }
    for (let i = 0; i < K.n; i++) {
      const p = K.pts[i], q = K.pts[(i + 1) % K.n];
      if (K.vif[i]) seg(K.toW([p[0], p[1], pr.a[0]]), K.toW([p[0], p[1], pr.a[1]]));
      for (const w of pr.a) seg(K.toW([p[0], p[1], w]), K.toW([q[0], q[1], w]));
    }
  });
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const f = F[i], g = F[j];
    if (f.prim === g.prim) continue;
    if (f.min[0] > g.max[0] + 1e-6 || g.min[0] > f.max[0] + 1e-6 || f.min[1] > g.max[1] + 1e-6 || g.min[1] > f.max[1] + 1e-6 || f.min[2] > g.max[2] + 1e-6 || g.min[2] > f.max[2] + 1e-6) continue;
    const u = croix(f.n, g.n), Lu = Math.hypot(...u); if (Lu < 1e-6) continue;
    const U = u.map((v) => v / Lu);
    const c1 = croix(g.n, U), c2 = croix(U, f.n);
    const P0 = [0, 1, 2].map((k) => (f.d * c1[k] + g.d * c2[k]) / Lu);
    for (const [t0, t1] of inter(dansFace(f, P0, U), dansFace(g, P0, U))) seg(P0.map((v, k) => v + t0 * U[k]), P0.map((v, k) => v + t1 * U[k]));
  }
  return out;
}
/** Génératrices de contour apparent (surfaces courbes), pour chaque direction d'observation. */
function silhouettes(prims, creux, dirs) {
  const out = [];
  prims.forEach((pr) => {
    const K = pr._k, sg = creux.includes(pr) ? -1 : 1, O = K.toW([0, 0, 0]);
    dirs.forEach((dir, v) => {
      const wl = add(K.toL(add(dir.D, O)), [0, 0, 0]);   // direction dans le repère local
      if (K.rev) {
        const A0 = Math.hypot(wl[0], wl[1]); if (A0 < 1e-6) return;
        const ph = Math.atan2(wl[1], wl[0]);
        for (let i = 0; i + 1 < K.prof.length; i++) {
          const [w1, r1] = K.prof[i], [w2, r2] = K.prof[i + 1], L = Math.hypot(w2 - w1, r2 - r1);
          if (w2 - w1 < 1e-9 || (r1 < 1e-9 && r2 < 1e-9)) continue;
          const nr = (w2 - w1) / L, na = -(r2 - r1) / L, c = (-na * wl[2]) / (nr * A0);
          if (Math.abs(c) > 1) continue;
          for (const t of [ph + Math.acos(c), ph - Math.acos(c)]) {
            const e = [Math.cos(t), Math.sin(t)], n = unit(add(add(K.toW([sg * nr * e[0], sg * nr * e[1], sg * na]), O, -1), [0, 0, 0]));
            out.push({ a: K.toW([K.cu + r1 * e[0], K.cv + r1 * e[1], w1]), b: K.toW([K.cu + r2 * e[0], K.cv + r2 * e[1], w2]), sil: v, n });
          }
        }
        return;
      }
      if (Math.hypot(wl[0], wl[1]) < 1e-6) return;
      for (let i = 0; i < K.n; i++) {
        if (K.vif[i]) continue;
        const a = K.nrm[(i - 1 + K.n) % K.n], b = K.nrm[i];
        const sa = a[0] * wl[0] + a[1] * wl[1], sb = b[0] * wl[0] + b[1] * wl[1];
        if (sa * sb > 0) continue;
        const p = K.pts[i], nn = unit(add(K.toW([sg * (a[0] + b[0]), sg * (a[1] + b[1]), 0]), O, -1));
        out.push({ a: K.toW([p[0], p[1], pr.a[0]]), b: K.toW([p[0], p[1], pr.a[1]]), sil: v, n: nn });
      }
    });
  });
  return out;
}

/* ---------- classement des candidats : morceaux 3D { a, b, vis[] } (1 vu, 0 caché, 2 sans objet) ---------- */
function pseudos(clip) {
  if (clip == null) return [];
  const segs = typeof clip === 'number' ? [[-1e3, 1e3, clip]] : clip.map(([x0, x1, y], i) => [i === 0 ? -1e3 : x0, i === clip.length - 1 ? 1e3 : x1, y]);
  return segs.map(([x0, x1, y]) => compiler({ ax: 'y', a: [y, y + 1e4], f: rect(x0, -1e3, x1, 1e3), pseudo: true }));
}
function aretes(pc, clip = null, extra = [], dirs = directions(pc)) {
  const o = outils(pc, clip), tmax = pc.L + pc.P + pc.H;
  const prims = [...o.corps, ...o.creux, ...pseudos(clip)];
  const cands = [...candidats(prims), ...silhouettes([...o.corps, ...o.creux], o.creux, dirs), ...extra];
  const out = [];
  for (const c of cands) {
    const U = unit(c.b.map((v, k) => v - c.a[k])), Lg = Math.hypot(...c.b.map((v, k) => v - c.a[k]));
    const P = (t) => c.a.map((v, k) => v + t * U[k]);
    const cl = (t) => {
      const q = P(t);
      if (c.force) return c.force(q) ? 'e1' + '2'.repeat(dirs.length - 1) : '';
      if (c.sil != null) {
        const e = 0.02, ext = o.dedans(q.map((v, k) => v + e * c.n[k])), int = o.dedans(q.map((v, k) => v - e * c.n[k]));
        if (ext || !int) return '';
        if (o.cy && q[1] < o.cy(q[0]) + 1e-6) return '';
        return 'e' + dirs.map((d, v) => (v === c.sil ? (visible(o, q, d, tmax) ? 1 : 0) : 2)).join('');
      }
      if (!estArete(o, q, U)) return '';
      return 'e' + dirs.map((d) => (visible(o, q, d, tmax) ? 1 : 0)).join('');
    };
    const n = Math.max(1, Math.ceil(Lg / 0.6));
    const affiner = (a, b, ca) => { for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (cl(m) === ca) a = m; else b = m; } return (a + b) / 2; };
    let tp = 0, cp = cl(Lg / (2 * n)), deb = 0;
    const fin = (t1) => { if (cp && t1 - deb > 0.02) out.push({ a: P(deb), b: P(t1), vis: [...cp.slice(1)].map(Number) }); };
    for (let i = 1; i < n; i++) {
      const t = (Lg * (i + 0.5)) / n, cc = cl(t);
      if (cc !== cp) { const tb = affiner(tp + Lg / (2 * n), t, cp); fin(tb); deb = tb; cp = cc; }
      tp = (Lg * i) / n;
    }
    fin(Lg);
  }
  return out;
}

/* ---------- 2D : déduplication, chaînage, droites et arcs ---------- */
function vers2D(morceaux) {   // morceaux : [{ p:[x,y], q:[x,y], s }]
  const fins = [];
  for (const m of morceaux) {
    const L = Math.hypot(m.q[0] - m.p[0], m.q[1] - m.p[1]); if (L < 1e-4) continue;
    const n = Math.max(1, Math.ceil(L / 0.5));
    for (let i = 0; i < n; i++) fins.push({ p: [m.p[0] + ((m.q[0] - m.p[0]) * i) / n, m.p[1] + ((m.q[1] - m.p[1]) * i) / n], q: [m.p[0] + ((m.q[0] - m.p[0]) * (i + 1)) / n, m.p[1] + ((m.q[1] - m.p[1]) * (i + 1)) / n], s: m.s });
  }
  const rang = { v: 0, n: 1, c: 2 };
  fins.sort((a, b) => rang[a.s] - rang[b.s]);
  const grille = new Map(), cle = (x, y) => `${Math.round(x / 0.5)},${Math.round(y / 0.5)}`;
  const gardes = [];
  for (const f of fins) {
    const m = [(f.p[0] + f.q[0]) / 2, (f.p[1] + f.q[1]) / 2], d = unit([f.q[0] - f.p[0], f.q[1] - f.p[1], 0]);
    let doublon = false;
    for (let a = -1; a <= 1 && !doublon; a++) for (let b = -1; b <= 1 && !doublon; b++) {
      for (const g of grille.get(`${Math.round(m[0] / 0.5) + a},${Math.round(m[1] / 0.5) + b}`) || []) {
        if (Math.abs(d[0] * g.d[1] - d[1] * g.d[0]) > 0.2) continue;
        const dist = Math.abs((m[0] - g.p[0]) * g.d[1] - (m[1] - g.p[1]) * g.d[0]), along = (m[0] - g.m[0]) * g.d[0] + (m[1] - g.m[1]) * g.d[1];
        if (dist < 0.06 && Math.abs(along) < g.L / 2 + 0.01) { doublon = true; break; }
      }
    }
    if (doublon) continue;
    const L = Math.hypot(f.q[0] - f.p[0], f.q[1] - f.p[1]);
    const k = cle(...m); if (!grille.has(k)) grille.set(k, []); grille.get(k).push({ p: f.p, m, d, L });
    gardes.push(f);
  }
  // chaînage par style
  const out = [];
  for (const s of ['v', 'c', 'n']) {
    const segs = gardes.filter((f) => f.s === s); if (!segs.length) continue;
    const K = (p) => `${Math.round(p[0] * 50)},${Math.round(p[1] * 50)}`;
    const adj = new Map();
    segs.forEach((g, i) => { for (const p of [g.p, g.q]) { const k = K(p); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
    const vu = new Array(segs.length).fill(false);
    const suivre = (i, depuis) => {   // renvoie la liste de points en partant de l'extrémité « depuis »
      const pts = [depuis]; let cur = i, bout = K(depuis);
      while (cur != null && !vu[cur]) {
        vu[cur] = true; const g = segs[cur]; const autre = K(g.p) === bout ? g.q : g.p; pts.push(autre); bout = K(autre);
        const vois = (adj.get(bout) || []).filter((j) => !vu[j]);
        cur = (adj.get(bout) || []).length === 2 && vois.length === 1 ? vois[0] : null;
      }
      return pts;
    };
    // d'abord les extrémités (degré ≠ 2), puis les boucles
    const deg = (p) => (adj.get(K(p)) || []).length;
    const ordre = segs.map((g, i) => i).sort((a, b) => (deg(segs[a].p) !== 2 || deg(segs[a].q) !== 2 ? 0 : 1) - (deg(segs[b].p) !== 2 || deg(segs[b].q) !== 2 ? 0 : 1));
    for (const i of ordre) {
      if (vu[i]) continue;
      const g = segs[i];
      const dep = deg(g.p) === 2 && deg(g.q) !== 2 ? g.q : g.p;
      let pts = suivre(i, dep);
      if (deg(dep) === 2) {   // prolonger dans l'autre sens
        const vois = (adj.get(K(dep)) || []).filter((j) => !vu[j]);
        if (vois.length === 1) { const avant = suivre(vois[0], dep); pts = [...avant.reverse().slice(0, -1), ...pts]; }
      }
      out.push(...ajuster(pts, s));
    }
  }
  return out;
}
function cercle3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-9) return null;
  const A = a[0] ** 2 + a[1] ** 2, B = b[0] ** 2 + b[1] ** 2, C = c[0] ** 2 + c[1] ** 2;
  const x = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d, y = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
  return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
}
function ajuster(pts, s) {
  const out = [], n = pts.length - 1, ferme = n > 3 && Math.hypot(pts[0][0] - pts[n][0], pts[0][1] - pts[n][1]) < 1e-3;
  const okLigne = (i, j) => { const a = pts[i], b = pts[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) return false; for (let k = i + 1; k < j; k++) if (Math.abs((pts[k][0] - a[0]) * (b[1] - a[1]) - (pts[k][1] - a[1]) * (b[0] - a[0])) / L > 0.03) return false; return true; };
  const arcDe = (i, j) => { if (j - i < 3) return null; const c = cercle3(pts[i], pts[(i + j) >> 1], pts[j]); if (!c || c.r > 150) return null; for (let k = i; k <= j; k++) if (Math.abs(Math.hypot(pts[k][0] - c.x, pts[k][1] - c.y) - c.r) > 0.05) return null; return c; };
  if (ferme && n >= 8) { const c = cercle3(pts[0], pts[Math.floor(n / 3)], pts[Math.floor((2 * n) / 3)]); if (c && pts.every((q) => Math.abs(Math.hypot(q[0] - c.x, q[1] - c.y) - c.r) < 0.05)) return [{ t: 'c', cx: r3(c.x), cy: r3(c.y), r: r3(c.r), s }]; }
  let i = 0;
  while (i < n) {
    let jl = i + 1; while (jl < n && okLigne(i, jl + 1)) jl++;
    let ja = i, ca = null; for (let j = i + 3; j <= n; j++) { const c = arcDe(i, j); if (c) { ja = j; ca = c; } else if (j - ja > 6) break; }
    if (ca && ja > jl + 1) {
      const m = pts[(i + ja) >> 1], a = pts[i], b = pts[ja];
      const ccw = (m[0] - a[0]) * (b[1] - m[1]) - (m[1] - a[1]) * (b[0] - m[0]) > 0;
      const ang = (p) => (Math.atan2(p[1] - ca.y, p[0] - ca.x) * 180) / Math.PI;
      let a0 = ang(ccw ? a : b), a1 = ang(ccw ? b : a); while (a1 <= a0) a1 += 360;
      out.push({ t: 'a', cx: r3(ca.x), cy: r3(ca.y), r: r3(ca.r), a0: r3(a0), a1: r3(a1), s });
      i = ja;
    } else {
      const a = pts[i], b = pts[jl];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05) out.push({ t: 'l', x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]), s });
      i = jl;
    }
  }
  return out;
}

/* ---------- axes des cylindres et des solides de révolution ---------- */
function axesCyl(pc, o, dir) {   // entités dans les coordonnées 2D de la direction d'observation
  const out = [];
  const L = (a, b) => out.push({ t: 'l', x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]), s: 'a' });
  for (const pr of [...o.corps, ...o.creux]) {
    if (!pr.cyl || pr.sansAxe) continue;
    const K = pr._k, O = K.toW([0, 0, 0]), W = add(K.toW([0, 0, 1]), O, -1);
    const c3 = K.toW([pr.cyl.c[0], pr.cyl.c[1], (pr.a[0] + pr.a[1]) / 2]);
    let lo = pr.a[0], hi = pr.a[1];
    if (K.I) {
      const ak = K.I[2], iv = inter(o.selonCorps(c3, ak), [[Math.min(pr.a[0], pr.a[1]) - 1e-6, Math.max(pr.a[0], pr.a[1]) + 1e-6]]);
      if (!iv.length) continue;
      lo = Math.min(...iv.map((q) => q[0])); hi = Math.max(...iv.map((q) => q[1]));
      const s = W[ak]; if (s < 0) { const t = -hi; hi = -lo; lo = t; }   // toujours en coordonnée w
    }
    if (dir.garde && !dir.garde(c3) && !dir.garde(K.toW([pr.cyl.c[0], pr.cyl.c[1], hi]))) continue;
    if (Math.abs(ps(W, dir.D)) > 0.999) {
      const c = dir.P(c3), r = pr.cyl.r + DEB;
      const eu = dir.P(add(c3, add(K.toW([1, 0, 0]), O, -1))), ev = dir.P(add(c3, add(K.toW([0, 1, 0]), O, -1)));
      const du = unit([eu[0] - c[0], eu[1] - c[1], 0]), dv = unit([ev[0] - c[0], ev[1] - c[1], 0]);
      L([c[0] - r * du[0], c[1] - r * du[1]], [c[0] + r * du[0], c[1] + r * du[1]]); L([c[0] - r * dv[0], c[1] - r * dv[1]], [c[0] + r * dv[0], c[1] + r * dv[1]]);
    } else {
      L(dir.P(K.toW([pr.cyl.c[0], pr.cyl.c[1], lo - DEB])), dir.P(K.toW([pr.cyl.c[0], pr.cyl.c[1], hi + DEB])));
    }
  }
  return out;
}

/* ---------- filetages (représentation normalisée) ---------- */
function filets(pc, dir, coupe = null) {
  const out = [];
  for (const f of pc.filets || []) {
    const R = repere(f.ax), O = R.O, toW = ([u, v, w]) => [0, 1, 2].map((k) => O[k] + u * R.U[k] + v * R.V[k] + w * R.W[k]);
    const [cu, cv] = f.c, ax = Math.abs(ps(R.W, dir.D)) > 0.999;
    if (ax) {   // vue de bout : 3/4 de cercle fin (fond de filet ext., nominal int.), seulement du côté où le filetage débouche
      if (Math.sign(ps(R.W, dir.D)) !== (f.bout ?? 1)) continue;
      const c = dir.P(toW([cu, cv, 0]));
      if (coupe != null && f.int && R.W[1] === 0) continue;
      out.push({ t: 'a', cx: r3(c[0]), cy: r3(c[1]), r: r3(f.d / 2), a0: 90, a1: 360, s: 'n' });
      continue;
    }
    // vue de côté : deux traits fins le long du filetage, limite en trait fort
    let s = f.int ? 'c' : 'n', sf = f.int ? 'c' : 'v';
    if (coupe != null) {
      const ey = Math.abs(ps(R.W, [0, 1, 0])) < 1e-6 ? toW([cu, cv, 0])[1] : null;
      if (ey == null || Math.abs(ey - coupe) > 1e-6) { if (f.int) continue; } else if (f.int) { s = 'n'; sf = 'v'; }
    }
    const perp = unit(croix(R.W, dir.D)), e = ps(perp, R.U), g = ps(perp, R.V);
    for (const sg of [-1, 1]) {
      const off = (sg * f.d) / 2;
      out.push({ p: dir.P(toW([cu + off * e, cv + off * g, f.w[0]])), q: dir.P(toW([cu + off * e, cv + off * g, f.w[1]])), s });
    }
    if (f.fin != null) { const D2 = f.D / 2; out.push({ p: dir.P(toW([cu - D2 * e, cv - D2 * g, f.fin])), q: dir.P(toW([cu + D2 * e, cv + D2 * g, f.fin])), s: sf }); }
  }
  const arcs = out.filter((e) => e.t), segs = out.filter((e) => !e.t);
  return { arcs, segs };
}

/* ---------- calcul complet (mis en cache) ---------- */
export function calculSolide(pc) {
  const dirs = directions(pc), ar = aretes(pc, null, [], dirs), o = outils(pc), res = {};
  dirs.forEach((dir, v) => {
    const persp = v >= 3, m = [];
    for (const { a, b, vis } of ar) {
      if (vis[v] === 2 || (persp && vis[v] !== 1)) continue;
      if (dir.garde && !(dir.garde(a) && dir.garde(b))) continue;
      m.push({ p: dir.P(a), q: dir.P(b), s: vis[v] ? 'v' : 'c' });
    }
    if (persp && dir.nom !== 'aux') { res[dir.nom] = vers2D(m); return; }
    const fl = dir.nom === 'aux' ? { arcs: [], segs: [] } : filets(pc, dir);
    res[dir.nom] = [...vers2D([...m, ...fl.segs]), ...fl.arcs, ...axesCyl(pc, o, dir)];
  });
  if (pc.coupe != null) Object.assign(res, calculCoupe(pc, dirs[0]));
  if (pc.section != null) res.sect = calculSection(pc);
  return res;
}
function calculCoupe(pc, dirFace) {
  const c = pc.coupe, o = outils(pc, c), o0 = outils(pc), cy = o.cy;
  const nerv = o.corps.filter((q) => q.nerv), pleins = o.corps.filter((q) => !q.nerv);
  // catégories dans le plan de coupe : 0 vide, 1 matière hachurée, 2 nervure (non hachurée)
  const cat = (x, z) => { const p = [x, cy(x) + 1e-3, z]; if (!o.dedans(p)) return 0; return nerv.length && nerv.some((q) => dansPrim(q, p)) && !pleins.some((q) => dansPrim(q, p)) ? 2 : 1; };
  const extra = [];
  for (const pr of nerv) {   // contour de la nervure dans le plan : trait fort là où les catégories changent
    for (const s of candidats([pr, ...pseudos(c)])) {
      if (Math.abs(s.a[1] - cy(s.a[0])) > 1e-6 || Math.abs(s.b[1] - cy(s.b[0])) > 1e-6) continue;
      extra.push({ ...s, force: (q) => { const d = unit([s.b[0] - s.a[0], 0, s.b[2] - s.a[2]]), nx = -d[2], nz = d[0], e = 0.05; return cat(q[0] + nx * e, q[2] + nz * e) !== cat(q[0] - nx * e, q[2] - nz * e); } });
    }
  }
  const ar = aretes(pc, c, extra, [dirFace]);
  const marches = typeof c === 'number' ? [] : c.slice(1).map((q) => q[0]);   // pas de trait aux changements de plan
  const m = [];
  for (const { a, b, vis } of ar) {
    if (vis[0] !== 1) continue;
    if (marches.some((x) => Math.abs(a[0] - x) < 1e-3 && Math.abs(b[0] - x) < 1e-3)) continue;
    m.push({ p: [a[0], a[2]], q: [b[0], b[2]], s: 'v' });
  }
  const yc = typeof c === 'number' ? c : null;
  const fl = filets(pc, dirFace, yc);
  const faceCoupe = [...vers2D([...m, ...fl.segs]), ...fl.arcs, ...axesCyl(pc, o, dirFace)];
  const res = { faceCoupe, hach: contours((x, z) => cat(x, z) === 1, pc) };
  if (yc != null) {   // vue extérieure sans traits cachés (pour la demi-coupe)
    const ext = [];
    for (const { a, b, vis } of aretes(pc, null, [], [dirFace])) if (vis[0] === 1) ext.push({ p: [a[0], a[2]], q: [b[0], b[2]], s: 'v' });
    const xm = pc.L / 2;
    const coupeX = (arr, garderDroite) => arr.flatMap((s) => {
      const ga = garderDroite ? s.p[0] >= xm - 1e-9 : s.p[0] <= xm + 1e-9, gb = garderDroite ? s.q[0] >= xm - 1e-9 : s.q[0] <= xm + 1e-9;
      if (ga && gb) return [s]; if (!ga && !gb) return [];
      const t = (xm - s.p[0]) / (s.q[0] - s.p[0]), P = [xm, s.p[1] + t * (s.q[1] - s.p[1])];
      return [ga ? { ...s, q: P } : { ...s, p: P }];
    });
    res.faceDemi = [...vers2D([...coupeX([...m, ...fl.segs], true), ...coupeX(ext, false)]), ...axesCyl(pc, o0, dirFace)];
    res.hachDemi = contours((x, z) => x >= xm && cat(x, z) === 1, pc);
  }
  return res;
}
/** Section sortie B-B (plan x = pc.section) : contour, axes et régions de matière, en coordonnées (y, z). */
function calculSection(pc) {
  const o = outils(pc), c = pc.section;
  const f = (y, z) => o.dedans([c, y, z]);
  const regions = contours(f, { L: pc.P, H: pc.H });
  const m = [];
  for (const g of regions) for (const b of [g.pts, ...g.trous]) b.forEach((p, i) => { const q = b[(i + 1) % b.length]; m.push({ p, q, s: 'v' }); });
  const axes = [];
  for (const pr of [...o.corps, ...o.creux]) {
    if (!pr.cyl || pr._k.I?.[2] !== 0 || c < Math.min(...pr.a) || c > Math.max(...pr.a)) continue;
    const [y, z] = pr.cyl.c, r = pr.cyl.r + DEB;
    axes.push({ t: 'l', x1: r3(y - r), y1: r3(z), x2: r3(y + r), y2: r3(z), s: 'a' }, { t: 'l', x1: r3(y), y1: r3(z - r), x2: r3(y), y2: r3(z + r), s: 'a' });
  }
  return { lignes: [...vers2D(m), ...axes], regions };
}
/** Contours (boucles) de la région { f(x, z) } : carrés marchants affinés par dichotomie. */
function contours(f, pc) {
  const h = 0.5, x0 = -1.013, z0 = -1.017, nx = Math.ceil((pc.L + 2) / h), nz = Math.ceil((pc.H + 2) / h);
  const g = []; for (let i = 0; i <= nx; i++) { g.push([]); for (let j = 0; j <= nz; j++) g[i].push(f(x0 + i * h, z0 + j * h)); }
  const pt = (i1, j1, i2, j2) => { let a = [x0 + i1 * h, z0 + j1 * h], b = [x0 + i2 * h, z0 + j2 * h]; const va = g[i1][j1]; for (let k = 0; k < 12; k++) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (f(...m) === va) a = m; else b = m; } return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const segs = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const c = [g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]];
    const E = [() => pt(i, j, i + 1, j), () => pt(i + 1, j, i + 1, j + 1), () => pt(i, j + 1, i + 1, j + 1), () => pt(i, j, i, j + 1)];
    const k = (c[0] ? 1 : 0) | (c[1] ? 2 : 0) | (c[2] ? 4 : 0) | (c[3] ? 8 : 0);
    const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]] }[k] || [];
    for (const [a, b] of T) segs.push([E[a](), E[b]()]);
  }
  // assemblage en boucles
  const K = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
  const suiv = new Map(); segs.forEach((s, i) => { const k = K(s[0]); if (!suiv.has(k)) suiv.set(k, []); suiv.get(k).push(i); });
  const vu = new Array(segs.length).fill(false), boucles = [];
  for (let i = 0; i < segs.length; i++) {
    if (vu[i]) continue;
    const b = []; let cur = i;
    while (cur != null && !vu[cur]) { vu[cur] = true; b.push(segs[cur][0]); const nxt = (suiv.get(K(segs[cur][1])) || []).find((j) => !vu[j]); cur = nxt ?? null; }
    if (b.length > 3) boucles.push(simplifier(b));
  }
  // régions : contours extérieurs (sens horaire : la matière est à droite) et leurs trous
  const aire = (b) => b.reduce((s, p, i) => { const q = b[(i + 1) % b.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const R = (b) => b.map(([x, z]) => [r3(x), r3(z)]);
  const ext = boucles.filter((b) => aire(b) < 0).sort((a, b) => aire(a) - aire(b)), trous = boucles.filter((b) => aire(b) > 0);
  const regions = ext.map((b) => ({ pts: R(b), trous: [] }));
  for (const tr of trous) { const r = regions.find((g) => dansPoly(g.pts, tr[0][0], tr[0][1])); if (r) r.trous.push(R(tr)); }
  return regions;
}
function simplifier(b) {   // Douglas-Peucker fermé
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    const a = pts[0], z = pts[pts.length - 1], L = Math.hypot(z[0] - a[0], z[1] - a[1]) || 1e-9;
    let im = 0, dm = 0; for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - a[0]) * (z[1] - a[1]) - (pts[i][1] - a[1]) * (z[0] - a[0])) / L; if (d > dm) { dm = d; im = i; } }
    return dm > tol ? [...dp(pts.slice(0, im + 1), tol).slice(0, -1), ...dp(pts.slice(im), tol)] : [a, z];
  };
  const m = b.length >> 1;
  return [...dp(b.slice(0, m + 1), 0.04).slice(0, -1), ...dp([...b.slice(m), b[0]], 0.04).slice(0, -1)];
}

/* ---------- utilisation : vues, coupe, perspective ---------- */
import { SOLIDES } from './cahier-solides.js';
function donnees(pc) { if (!pc._r) pc._r = SOLIDES[pc.id] || calculSolide(pc); return pc._r; }
export function solide(def) {
  const pc = { ...def, cs: true, creux: def.creux || [] };
  pc.prof = def.P; pc.profil = rect(0, 0, def.L, def.H); pc.trous = [];
  return pc;
}
function placer(es, f, miroir = false) {
  return es.map((e) => {
    if (e.t === 'l') { const a = f(e.x1, e.y1), b = f(e.x2, e.y2); return { ...e, x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]) }; }
    const c = f(e.cx, e.cy);
    if (e.t === 'c') return { ...e, cx: r3(c[0]), cy: r3(c[1]) };
    if (e.t === 'a') { if (!miroir) return { ...e, cx: r3(c[0]), cy: r3(c[1]) }; let a0 = 180 - e.a1, a1 = 180 - e.a0; while (a0 < 0) { a0 += 360; a1 += 360; } return { ...e, cx: r3(c[0]), cy: r3(c[1]), a0: r3(a0), a1: r3(a1) }; }
    return e;
  });
}
export function vuesSolide(pc, origine = [20, 90], ecart = 20) {
  const [ex, ey] = Array.isArray(ecart) ? ecart : [ecart, ecart];
  const W = pc.L, H = pc.H, P = pc.P, [ox, oy] = origine, r = donnees(pc);
  const face = placer(r.face, (x, z) => [ox + x, oy + z]);
  const dessus = placer(r.dessus, (x, y) => [ox + x, oy - ey - P + y]);
  const gauche = placer(r.gauche, (y, z) => [ox + W + ex + P - y, oy + z], true);
  const cadres = { face: { x: ox, y: oy, w: W, h: H }, dessus: { x: ox, y: oy - ey - P, w: W, h: P }, gauche: { x: ox + W + ex, y: oy, w: P, h: H } };
  return { face, dessus, gauche, cadres };
}
export function coupeSolide(pc, origine = [20, 90], ecart = 20, { demi = false } = {}) {
  const [, ey] = Array.isArray(ecart) ? ecart : [ecart, ecart];
  const v = vuesSolide(pc, origine, ecart), [ox, oy] = origine, P = pc.P, c = pc.coupe, r = donnees(pc);
  const F = (x, z) => [ox + x, oy + z], D = (x, y) => [ox + x, oy - ey - P + y];
  const face = placer(demi ? r.faceDemi : r.faceCoupe, F);
  if (demi) { const a = F(pc.L / 2, -DEB), b = F(pc.L / 2, pc.H + DEB); face.push({ t: 'l', x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]), s: 'a' }); }
  // trace du plan (ou des plans parallèles) sur la vue de dessus
  const trace = [];
  const Lt = (x1, y1, x2, y2, s) => trace.push({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
  const segs = typeof c === 'number' ? [[demi ? pc.L / 2 : -9, pc.L + 9, c]] : c.map(([x0, x1, y], i) => [i === 0 ? -9 : x0, i === c.length - 1 ? pc.L + 9 : x1, y]);
  segs.forEach(([x0, x1, y], i) => {
    const [a, ya] = D(x0, y), [b] = D(x1, y); Lt(a, ya, b, ya, 'a');
    if (i > 0) { const yp = D(0, segs[i - 1][2])[1]; Lt(a, yp, a, ya, 'v'); Lt(a - 3, yp, a, yp, 'v'); Lt(a, ya, a + 3, ya, 'v'); }
  });
  const [xa, ya] = D(segs[0][0], segs[0][2]), [xb, yb] = D(segs[segs.length - 1][1], segs[segs.length - 1][2]);
  if (!demi) Lt(xa, ya, xa + 5, ya, 'v'); Lt(xb - 5, yb, xb, yb, 'v');
  for (const [x, y] of demi ? [[xb - 1.5, yb]] : [[xa + 1.5, ya], [xb - 1.5, yb]]) {
    Lt(x, y, x, y + 8, 'n'); Lt(x, y + 8, x - 1.2, y + 4.5, 'n'); Lt(x, y + 8, x + 1.2, y + 4.5, 'n');
    trace.push({ t: 'x', x: r3(x + (x < ox ? -5 : 2)), y: r3(y + 3), txt: 'A', h: 5, s: 'n' });
  }
  if (demi) { Lt(xa, ya, xa, ya + 4, 'v'); }
  const o = outils(pc, c), xm = pc.L / 2;
  const nerv = o.corps.filter((q) => q.nerv), pleins = o.corps.filter((q) => !q.nerv);
  const matiere = (x, z) => { if (demi && x < xm) return false; const p = [x, o.cy(x) + 1e-3, z]; if (!o.dedans(p)) return false; return !(nerv.length && nerv.some((q) => dansPrim(q, p)) && !pleins.some((q) => dansPrim(q, p))); };
  const M = (b) => b.map(([x, z]) => F(x, z));
  const hachures = (demi ? r.hachDemi : r.hach).map((g) => ({ t: 'h', pts: M(g.pts), trous: g.trous.map(M), ang: 45, pas: 3, s: 'n' }));
  return { c: typeof c === 'number' ? c : c[0][2], face, dessus: [...v.dessus, ...trace], hachure: hachures[0] || { t: 'h', pts: [], trous: [], ang: 45, pas: 3, s: 'n' }, hachures, matiere, cadres: v.cadres };
}

/** Section sortie B-B : même format que sectionB() de pieces.js (placée à la place de la vue de gauche). */
export function sectionSolide(pc, origine = [20, 90], ecart = 20) {
  const [ex] = Array.isArray(ecart) ? ecart : [ecart, ecart];
  const v = vuesSolide(pc, origine, ecart), [ox, oy] = origine, P = pc.P, c = pc.section, r = donnees(pc).sect;
  const gx = ox + pc.L + ex, G = (y, z) => [gx + P - y, oy + z];
  const o = outils(pc), matiere = (y, z) => o.dedans([c, y, z]);
  const zs = r.regions.flatMap((g) => g.pts.map((q) => q[1])), zmin = Math.min(...zs), zmax = Math.max(...zs);
  const M = (b) => b.map(([y, z]) => G(y, z));
  const hachures = r.regions.map((g) => ({ t: 'h', pts: M(g.pts), trous: g.trous.map(M), ang: 45, pas: 3, s: 'n' }));
  const trace = [];
  const L = (x1, y1, x2, y2, s) => trace.push({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
  const xc = ox + c, ya = oy - 9, yb = oy + pc.H + 9;
  L(xc, ya, xc, yb, 'a'); L(xc, ya, xc, ya + 5, 'v'); L(xc, yb - 5, xc, yb, 'v');
  for (const y of [ya + 1.5, yb - 1.5]) {
    L(xc, y, xc + 8, y, 'n'); L(xc + 8, y, xc + 4.5, y + 1.2, 'n'); L(xc + 8, y, xc + 4.5, y - 1.2, 'n');
    trace.push({ t: 'x', x: r3(xc + 3), y: r3(y < oy ? y - 6 : y + 2), txt: 'B', h: 5, s: 'n' });
  }
  return { c, donnees: [...v.face, ...v.dessus, ...trace], section: placer(r.lignes, G, true), hachures, matiere, cadre: { x: gx, y: oy + zmin, w: P, h: zmax - zmin }, repere: [gx, oy + zmin] };
}

/** Vue auxiliaire partielle : origine de la vue de face (ox, oy) ; la vue est placée du côté de l'observateur, à la distance s. */
export function auxSolide(pc, origine = [20, 90]) {
  const [ox, oy] = origine, n = unit(pc.aux.n), e1 = [n[2], 0, -n[0]], s = pc.aux.s;
  const A = (t, y) => [ox + t * e1[0] + (s + y) * n[0], oy + t * e1[2] + (s + y) * n[2]];
  const th = (Math.atan2(e1[2], e1[0]) * 180) / Math.PI;   // rotation (repère direct : pas de symétrie)
  const traits = placer(donnees(pc).aux, A).map((e) => (e.t === 'a' ? { ...e, a0: r3(e.a0 + th), a1: r3(e.a1 + th) } : e));
  const xs = traits.flatMap((e) => (e.t === 'l' ? [e.x1, e.x2] : [e.cx - e.r, e.cx + e.r])), ys = traits.flatMap((e) => (e.t === 'l' ? [e.y1, e.y2] : [e.cy - e.r, e.cy + e.r]));
  const cadre = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  // ligne de référence (face avant y = 0), donnée à l'élève
  const ts = (donnees(pc).aux || []).flatMap((e) => (e.t === 'l' ? [e.x1, e.x2] : [e.cx - e.r, e.cx + e.r]));
  const t0 = Math.min(...ts) - 8, t1 = Math.max(...ts) + 8, p = A(t0, 0), q = A(t1, 0);
  const ref = { t: 'l', x1: r3(p[0]), y1: r3(p[1]), x2: r3(q[0]), y2: r3(q[1]), s: 'n' };
  const dans = (x, y) => { const d = [x - ox, y - oy], tt = d[0] * e1[0] + d[1] * e1[2], yy = d[0] * n[0] + d[1] * n[2] - s; return tt >= t0 + 5 && tt <= t1 - 5 && yy >= -4 && yy <= pc.P + 4; };
  return { traits, cadre, ref, dans };
}

/** Perspective (exercice) : entités en mm, repère = coin avant-bas-gauche (x = y = z = 0). */
export function perspSolide(pc, origine, type = 'iso') {
  const [Ox, Oy] = origine, r = donnees(pc);
  const traits = type === 'cav' ? placer(r.cav, (u, v) => [Ox + u, Oy + v]) : placer(r.iso, (u, v) => [Ox + u, Oy - v]).map((e) => { if (e.t !== 'a') return e; let a0 = -e.a1; while (a0 < 0) a0 += 360; return { ...e, a0: r3(a0), a1: r3(a0 + (e.a1 - e.a0)) }; });
  const xs = traits.flatMap((e) => (e.t === 'l' ? [e.x1, e.x2] : [e.cx - e.r, e.cx + e.r])), ys = traits.flatMap((e) => (e.t === 'l' ? [e.y1, e.y2] : [e.cy - e.r, e.cy + e.r]));
  return { traits, cadre: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
}

const f2 = (v) => Math.round(v * 100) / 100;
const nb = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
export function svgSolide(pc, { cotes = true, largeur = 420, fleche = null } = {}) {
  const pr = ([x, y, z]) => [(x - y) * C30, -((x + y) * S30 + z)];
  const trait = 'stroke="#111" stroke-width="1.5" stroke-linecap="round" fill="none"';
  let corps = '', cot = '';
  const tous = [];
  for (const e of donnees(pc).iso) {
    if (e.t === 'l') { corps += `<path d="M${f2(e.x1)} ${f2(e.y1)}L${f2(e.x2)} ${f2(e.y2)}" ${trait}/>`; tous.push([e.x1, e.y1], [e.x2, e.y2]); }
    else if (e.t === 'c') { corps += `<circle cx="${f2(e.cx)}" cy="${f2(e.cy)}" r="${f2(e.r)}" ${trait}/>`; tous.push([e.cx - e.r, e.cy - e.r], [e.cx + e.r, e.cy + e.r]); }
    else { const P = (a) => [e.cx + e.r * Math.cos((a * Math.PI) / 180), e.cy + e.r * Math.sin((a * Math.PI) / 180)], A = P(e.a0), B = P(e.a1); corps += `<path d="M${f2(A[0])} ${f2(A[1])}A${f2(e.r)} ${f2(e.r)} 0 ${e.a1 - e.a0 > 180 ? 1 : 0} 1 ${f2(B[0])} ${f2(B[1])}" ${trait}/>`; tous.push(A, B, P((e.a0 + e.a1) / 2)); }
  }
  if (cotes) {
    const fin = 'stroke="#1d5fd1" stroke-width="0.9"';
    const fl = (t, u) => { const n = [-u[1], u[0]], Lf = 5; return `<path d="M${f2(t[0])} ${f2(t[1])}L${f2(t[0] - u[0] * Lf + n[0] * 1.6)} ${f2(t[1] - u[1] * Lf + n[1] * 1.6)}L${f2(t[0] - u[0] * Lf - n[0] * 1.6)} ${f2(t[1] - u[1] * Lf - n[1] * 1.6)}Z" fill="#1d5fd1"/>`; };
    const cote = (A3, B3, off, txt) => {
      const A = pr(A3), B = pr(B3), Ao = pr(A3.map((v, i) => v + off[i])), Bo = pr(B3.map((v, i) => v + off[i]));
      cot += `<path d="M${f2(A[0])} ${f2(A[1])}L${f2(Ao[0])} ${f2(Ao[1])}M${f2(B[0])} ${f2(B[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} stroke-dasharray="2 2" fill="none"/>`;
      const Lg = Math.hypot(Bo[0] - Ao[0], Bo[1] - Ao[1]); if (Lg < 1) return;
      const u = [(Bo[0] - Ao[0]) / Lg, (Bo[1] - Ao[1]) / Lg];
      cot += `<path d="M${f2(Ao[0])} ${f2(Ao[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} fill="none"/>` + fl(Ao, [-u[0], -u[1]]) + fl(Bo, u);
      tous.push(Ao, Bo);
      if (Math.abs(u[0]) < 0.15) { const m = [Math.max(Ao[0], Bo[0]) + 3, (Ao[1] + Bo[1]) / 2 + 3]; cot += `<text x="${f2(m[0])}" y="${f2(m[1])}" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`; tous.push([m[0] + txt.length * 5.5, m[1]]); return; }
      let ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const nrm = [u[1], -u[0]], s = nrm[1] < 0 ? 1 : -1;
      const m = [(Ao[0] + Bo[0]) / 2 + s * nrm[0] * 3, (Ao[1] + Bo[1]) / 2 + s * nrm[1] * 3];
      cot += `<text x="${f2(m[0])}" y="${f2(m[1])}" transform="rotate(${f2(ang)} ${f2(m[0])} ${f2(m[1])})" text-anchor="middle" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`;
      tous.push([m[0] - 8, m[1] - 10], [m[0] + 8, m[1] + 10]);
    };
    cote([0, 0, 0], [pc.L, 0, 0], [0, 0, -14], nb(pc.L));
    cote([pc.L, 0, 0], [pc.L, 0, pc.H], [14, 0, 0], nb(pc.H));
    cote([0, 0, 0], [0, pc.P, 0], [-10, 0, -10], nb(pc.P));
    for (const c of pc.cotes || []) cote(c.a, c.b, c.off, c.txt || nb(Math.hypot(...c.b.map((v, k) => v - c.a[k]))));
    for (const rp of pc.reperes || []) {
      const c = pr(rp.p), q = [c[0] + (rp.dx ?? 20), c[1] - (rp.dy ?? 24)], g = (rp.dx ?? 20) < 0;
      cot += `<path d="M${f2(c[0])} ${f2(c[1])}L${f2(q[0])} ${f2(q[1])}h${g ? -16 : 16}" ${fin} fill="none"/><circle cx="${f2(c[0])}" cy="${f2(c[1])}" r="1.3" fill="#1d5fd1"/><text x="${f2(q[0] + (g ? -2 : 2))}" y="${f2(q[1] - 2)}" ${g ? 'text-anchor="end" ' : ''}font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${rp.txt}</text>`;
      const lg = rp.txt.length * 5.2 + 20; tous.push([q[0] + (g ? -lg : lg), q[1] - 12]);
    }
  }
  if (fleche) { const xm = pc.L / 2, zf = pc.H * 0.85; const r = fleche(pr([xm, -30, zf]), pr([xm, -3, zf])); cot += r.svg; tous.push(...r.pts); }
  const m = 10, us = tous.map((p) => p[0]), vs = tous.map((p) => p[1]);
  const x0 = Math.min(...us) - m, y0 = Math.min(...vs) - m, w = Math.max(...us) - Math.min(...us) + 2 * m, h = Math.max(...vs) - Math.min(...vs) + 2 * m;
  return `<svg viewBox="${f2(x0)} ${f2(y0)} ${f2(w)} ${f2(h)}" width="${largeur}" role="img" aria-label="Perspective isométrique de la pièce ${String(pc.nom || '').replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;background:#fff">${corps}${cot}</svg>`;
}
