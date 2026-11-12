/* =====================================================================
   DAO — PIÈCES « SOLIDES » : réunion de prismes à profils quelconques
   (droites + arcs : cylindres, congés, bossages, nervures…) moins des
   creux (perçages, rainures, alésages).
   ---------------------------------------------------------------------
   Pièce = { id, nom, cs: true, L, P, H,
             corps: [prim], creux: [prim], coupe?: y du plan A-A,
             cotes?: [{ a:[x,y,z], b:[x,y,z], off:[dx,dy,dz], txt? }],
             reperes?: [{ p:[x,y,z], txt }]  (Ø, R… sur la perspective) }
   prim = { ax: 'x' | 'y' | 'z', a: [a0, a1], f: profil, nerv?: true }
     profil dans le plan perpendiculaire à l'axe, coordonnées (u, v) :
       ax 'y' → (x, z) ; ax 'z' → (x, y) ; ax 'x' → (y, z)
     les arcs sont donnés par des suites de points (arc(), disque()).
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

/* ---------- profils ---------- */
export function arc(cu, cv, r, d0, d1) {
  const n = Math.max(2, Math.ceil(Math.abs(d1 - d0) / 3));
  return Array.from({ length: n + 1 }, (_, k) => { const a = ((d0 + ((d1 - d0) * k) / n) * Math.PI) / 180; return [cu + r * Math.cos(a), cv + r * Math.sin(a)]; });
}
export const disque = (cu, cv, r) => ({ pts: arc(cu, cv, r, 0, 360).slice(0, -1), cyl: { c: [cu, cv], r } });
export const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
export const E = (ax, a0, a1, f, opt = {}) => ({ ax, a: [a0, a1], ...(Array.isArray(f) ? { f } : { f: f.pts, cyl: f.cyl }), ...opt });

function compiler(pr) {
  if (pr._k) return pr;
  const pts = [];
  for (const p of pr.f) { const q = pts[pts.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) pts.push(p); }
  if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
  const n = pts.length, I = AXES[pr.ax];
  let aire = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; aire += p[0] * q[1] - q[0] * p[1]; }
  const sens = aire > 0 ? 1 : -1;
  const nrm = pts.map((p, i) => { const q = pts[(i + 1) % n], L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(sens * (q[1] - p[1])) / L, (-sens * (q[0] - p[0])) / L]; });   // normale sortante du côté i
  const vif = pts.map((_, i) => { const a = nrm[(i - 1 + n) % n], b = nrm[i]; return a[0] * b[0] + a[1] * b[1] < Math.cos((12 * Math.PI) / 180); });
  const toW = ([u, v, w]) => { const r = [0, 0, 0]; r[I[0]] = u; r[I[1]] = v; r[I[2]] = w; return r; };
  const toL = (p) => [p[I[0]], p[I[1]], p[I[2]]];
  const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
  const bl = [Math.min(...us), Math.min(...vs), pr.a[0]], bh = [Math.max(...us), Math.max(...vs), pr.a[1]];
  pr._k = { pts, n, nrm, vif, toW, toL, I, bmin: toW(bl), bmax: toW(bh), sw: pts.map(([a, b]) => [b, a]) };
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
function intervalles(poly, a) {
  const vs = [];
  for (let i = 0; i < poly.length; i++) {
    const [a1, b1] = poly[i], [a2, b2] = poly[(i + 1) % poly.length];
    if ((a1 <= a && a < a2) || (a2 <= a && a < a1)) vs.push(b1 + ((a - a1) * (b2 - b1)) / (a2 - a1));
  }
  vs.sort((p, q) => p - q);
  const out = []; for (let k = 0; k + 1 < vs.length; k += 2) out.push([vs[k], vs[k + 1]]);
  return out;
}
const union = (iv) => { const s = [...iv].sort((a, b) => a[0] - b[0]), o = []; for (const [a, b] of s) { if (o.length && a <= o[o.length - 1][1] + 1e-9) o[o.length - 1][1] = Math.max(o[o.length - 1][1], b); else o.push([a, b]); } return o; };
const moins = (A, B) => { let r = A; for (const [c, d] of B) { const n = []; for (const [a, b] of r) { if (d <= a || c >= b) n.push([a, b]); else { if (c > a) n.push([a, c]); if (d < b) n.push([d, b]); } } r = n; } return r; };
const inter = (A, B) => { const out = []; for (const [a, b] of A) for (const [c, d] of B) { const lo = Math.max(a, c), hi = Math.min(b, d); if (hi > lo + 1e-9) out.push([lo, hi]); } return out; };
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ps = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const L = Math.hypot(...a); return a.map((v) => v / L); };

/* ---------- le solide ---------- */
function dansPrim(pr, p) { const k = pr._k, l = k.toL(p); return l[2] >= pr.a[0] && l[2] <= pr.a[1] && dansPoly(k.pts, l[0], l[1]); }
function outils(pc, clip) {
  const corps = pc.corps.map(compiler), creux = (pc.creux || []).map(compiler);
  const dedans = (p) => (clip == null || p[1] >= clip) && corps.some((q) => dansPrim(q, p)) && !creux.some((q) => dansPrim(q, p));
  /* intervalles de matière le long de l'axe monde k (autres coordonnées fixées par p) */
  const ivPrim = (pr, p, k) => {
    const K = pr._k, l = K.toL(p), j = K.I.indexOf(k);
    if (j === 2) return dansPoly(K.pts, l[0], l[1]) ? [[pr.a[0], pr.a[1]]] : [];
    if (l[2] <= pr.a[0] || l[2] >= pr.a[1]) return [];
    return j === 0 ? intervalles(K.sw, l[1]) : intervalles(K.pts, l[0]);
  };
  const selon = (p, k) => {
    let iv = moins(union(corps.flatMap((q) => ivPrim(q, p, k))), union(creux.flatMap((q) => ivPrim(q, p, k))));
    if (clip != null && k === 1) iv = inter(iv, [[clip, 1e9]]);
    else if (clip != null && p[1] < clip) iv = [];
    return iv;
  };
  const selonCorps = (p, k) => {
    let iv = union(corps.flatMap((q) => ivPrim(q, p, k)));
    if (clip != null && k === 1) iv = inter(iv, [[clip, 1e9]]);
    else if (clip != null && p[1] < clip) iv = [];
    return iv;
  };
  return { corps, creux, dedans, selon, selonCorps };
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

const VUES = [{ k: 1, s: -1 }, { k: 2, s: 1 }, { k: 0, s: -1 }];   // face (vers −y), dessus (+z), gauche (−x)
const ISO = [-1, -1, 1].map((v) => v / Math.sqrt(3));
const DIRS = [[0, -1, 0], [0, 0, 1], [-1, 0, 0], ISO];   // vers l'observateur
function visible(o, p, v, tmax) {
  if (v === 3) { for (let t = 0.08; t < tmax; t += 0.4) if (o.dedans([p[0] + ISO[0] * t, p[1] + ISO[1] * t, p[2] + ISO[2] * t])) return false; return true; }
  const { k, s } = VUES[v], d = 0.03, a1 = (k + 1) % 3, a2 = (k + 2) % 3;
  return [[-d, -d], [-d, d], [d, -d], [d, d]].some(([da, db]) => {
    const q = [...p]; q[a1] += da; q[a2] += db;
    return !o.selon(q, k).some(([a, b]) => (s < 0 ? a < p[k] - 1e-4 : b > p[k] + 1e-4));
  });
}

/* ---------- faces planes et arêtes candidates ---------- */
function faces(pr, idx) {
  const K = pr._k, out = [];
  for (let i = 0; i < K.n; i++) {
    const p = K.pts[i], q = K.pts[(i + 1) % K.n];
    const c = [K.toW([p[0], p[1], pr.a[0]]), K.toW([q[0], q[1], pr.a[0]]), K.toW([q[0], q[1], pr.a[1]]), K.toW([p[0], p[1], pr.a[1]])];
    const nl = K.nrm[i], n = K.toW([nl[0], nl[1], 0]);
    out.push({ q: c, n, d: ps(n, c[0]), prim: idx });
  }
  for (const w of pr.a) { const n = K.toW([0, 0, 1]); out.push({ cap: true, pr, w, n, d: w, prim: idx }); }
  for (const f of out) {
    if (f.q) { f.min = [0, 1, 2].map((k) => Math.min(...f.q.map((c) => c[k]))); f.max = [0, 1, 2].map((k) => Math.max(...f.q.map((c) => c[k]))); }
    else { f.min = K.bmin.map((v, k) => (K.I[2] === k ? f.w : v)); f.max = K.bmax.map((v, k) => (K.I[2] === k ? f.w : v)); }
  }
  return out;
}
/** Intervalle(s) du paramètre t de la droite P0 + tU contenu(s) dans la face. */
function dansFace(f, P0, U) {
  if (f.q) {
    let t0 = -1e9, t1 = 1e9;
    const g = [0, 1, 2].map((k) => (f.q[0][k] + f.q[2][k]) / 2);
    for (let i = 0; i < 4; i++) {
      const A = f.q[i], B = f.q[(i + 1) % 4], e = B.map((v, k) => v - A[k]);
      let m = croix(f.n, e); if (ps(m, g.map((v, k) => v - A[k])) < 0) m = m.map((v) => -v);
      const a = ps(m, P0.map((v, k) => v - A[k])), b = ps(m, U);
      if (Math.abs(b) < 1e-12) { if (a < -1e-9) return []; continue; }
      const t = -a / b; if (b > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    }
    return t1 > t0 + 1e-7 ? [[t0, t1]] : [];
  }
  const K = f.pr._k, l0 = K.toL(P0), lu = K.toL(U), ts = [];
  for (let i = 0; i < K.n; i++) {
    const A = K.pts[i], B = K.pts[(i + 1) % K.n], ex = B[0] - A[0], ey = B[1] - A[1];
    const den = lu[0] * ey - lu[1] * ex; if (Math.abs(den) < 1e-12) continue;
    const t = ((A[0] - l0[0]) * ey - (A[1] - l0[1]) * ex) / den, s = ((A[0] - l0[0]) * lu[1] - (A[1] - l0[1]) * lu[0]) / den;
    if (s >= 0 && s < 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const out = []; for (let k = 0; k + 1 < ts.length; k += 2) out.push([ts[k], ts[k + 1]]);
  return out;
}
function candidats(prims) {
  const out = [];
  const seg = (a, b, sil) => { if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-5) out.push({ a, b, sil }); };
  const F = prims.flatMap((pr, i) => faces(pr, i));
  prims.forEach((pr) => {   // arêtes propres
    if (pr.pseudo) return;   // génératrices vives, contours des bases
    const K = pr._k;
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
function silhouettes(prims, creux = []) {
  const out = [];
  prims.forEach((pr) => {
    const K = pr._k;
    DIRS.forEach((D, v) => {
      const wl = K.toL(D); if (Math.hypot(wl[0], wl[1]) < 1e-6) return;
      for (let i = 0; i < K.n; i++) {
        if (K.vif[i]) continue;
        const a = K.nrm[(i - 1 + K.n) % K.n], b = K.nrm[i];
        const sa = a[0] * wl[0] + a[1] * wl[1], sb = b[0] * wl[0] + b[1] * wl[1];
        if (sa * sb > 0) continue;
        const p = K.pts[i], sg = creux.includes(pr) ? -1 : 1, nn = unit(K.toW([sg * (a[0] + b[0]), sg * (a[1] + b[1]), 0]));
        out.push({ a: K.toW([p[0], p[1], pr.a[0]]), b: K.toW([p[0], p[1], pr.a[1]]), sil: v, n: nn });
      }
    });
  });
  return out;
}

/* ---------- classement des candidats : morceaux 3D { a, b, vis[4] } ---------- */
function aretes(pc, clip = null, extra = []) {
  const o = outils(pc, clip), tmax = pc.L + pc.P + pc.H;
  const prims = [...o.corps, ...o.creux];
  if (clip != null) prims.push(compiler({ ax: 'y', a: [clip, clip + 1e4], f: rect(-1e3, -1e3, 1e3, 1e3), pseudo: true }));
  const cands = [...candidats(prims), ...silhouettes([...o.corps, ...o.creux], o.creux), ...extra];
  const out = [];
  for (const c of cands) {
    const U = unit(c.b.map((v, k) => v - c.a[k])), Lg = Math.hypot(...c.b.map((v, k) => v - c.a[k]));
    const P = (t) => c.a.map((v, k) => v + t * U[k]);
    const cl = (t) => {
      const q = P(t);
      if (c.force) return c.force(q) ? 'e1000' : '';
      if (c.sil != null) {
        const e = 0.02, ext = o.dedans(q.map((v, k) => v + e * c.n[k])), int = o.dedans(q.map((v, k) => v - e * c.n[k]));
        if (ext || !int) return '';
        if (clip != null && q[1] < clip + 1e-6) return '';
        return 'e' + [0, 1, 2, 3].map((v) => (v === c.sil ? (visible(o, q, v, tmax) ? 1 : 0) : 2)).join('');
      }
      if (!estArete(o, q, U)) return '';
      return 'e' + [0, 1, 2, 3].map((v) => (visible(o, q, v, tmax) ? 1 : 0)).join('');
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

/* ---------- axes des cylindres ---------- */
function axesCyl(pc, o, v) {   // v : 0 face, 1 dessus, 2 gauche → entités dans les coordonnées de la vue (u, v)
  const out = [], vk = VUES[v].k, plan = [[0, 2], [0, 1], [1, 2]][v];
  const L = (a, b) => out.push({ t: 'l', x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]), s: 'a' });
  for (const pr of [...o.corps, ...o.creux]) {
    if (!pr.cyl) continue;
    const K = pr._k, ak = K.I[2], c3 = K.toW([pr.cyl.c[0], pr.cyl.c[1], (pr.a[0] + pr.a[1]) / 2]);
    const iv = inter(o.selonCorps(c3, ak), [[pr.a[0] - 1e-6, pr.a[1] + 1e-6]]);
    if (!iv.length) continue;
    const lo = Math.min(...iv.map((q) => q[0])), hi = Math.max(...iv.map((q) => q[1]));
    const P2 = (p) => [p[plan[0]], p[plan[1]]];
    if (ak === vk) { const c = P2(c3), r = pr.cyl.r + DEB; L([c[0] - r, c[1]], [c[0] + r, c[1]]); L([c[0], c[1] - r], [c[0], c[1] + r]); }
    else { const A = [...c3], B = [...c3]; A[ak] = lo - DEB; B[ak] = hi + DEB; L(P2(A), P2(B)); }
  }
  return out;
}

/* ---------- calcul complet (mis en cache) ---------- */
const PLANS = [[0, 2], [0, 1], [1, 2]];
export function calculSolide(pc) {
  const ar = aretes(pc);
  const o = outils(pc);
  const res = {};
  ['face', 'dessus', 'gauche'].forEach((nom, v) => {
    const m = [];
    for (const { a, b, vis } of ar) { if (vis[v] === 2) continue; const [i, j] = PLANS[v]; m.push({ p: [a[i], a[j]], q: [b[i], b[j]], s: vis[v] ? 'v' : 'c' }); }
    res[nom] = [...vers2D(m), ...axesCyl(pc, o, v)];
  });
  const pr = ([x, y, z]) => [(x - y) * C30, -((x + y) * S30 + z)];
  res.iso = vers2D(ar.filter((s) => s.vis[3] === 1).map(({ a, b }) => ({ p: pr(a), q: pr(b), s: 'v' })));
  if (pc.coupe != null) Object.assign(res, calculCoupe(pc));
  return res;
}
function calculCoupe(pc) {
  const c = pc.coupe, o = outils(pc, c), o0 = outils(pc);
  const nerv = o.corps.filter((q) => q.nerv), pleins = o.corps.filter((q) => !q.nerv);
  // catégories dans le plan de coupe : 0 vide, 1 matière hachurée, 2 nervure (non hachurée)
  const cat = (x, z) => { const p = [x, c + 1e-3, z]; if (!o.dedans(p)) return 0; return nerv.length && nerv.some((q) => dansPrim(q, p)) && !pleins.some((q) => dansPrim(q, p)) ? 2 : 1; };
  const extra = [];
  for (const pr of nerv) {   // contour de la nervure dans le plan : trait fort là où les catégories changent
    const K = pr._k;
    for (const s of candidats([pr, compiler({ ax: 'y', a: [c, c + 1e4], f: rect(-1e3, -1e3, 1e3, 1e3), pseudo: true })])) {
      if (Math.abs(s.a[1] - c) > 1e-6 || Math.abs(s.b[1] - c) > 1e-6) continue;
      extra.push({ ...s, force: (q) => { const d = unit([s.b[0] - s.a[0], 0, s.b[2] - s.a[2]]), nx = -d[2], nz = d[0], e = 0.05; return cat(q[0] + nx * e, q[2] + nz * e) !== cat(q[0] - nx * e, q[2] - nz * e); } });
    }
    void K;
  }
  const ar = aretes(pc, c, extra);
  const m = [];
  for (const { a, b, vis } of ar) if (vis[0] === 1) m.push({ p: [a[0], a[2]], q: [b[0], b[2]], s: 'v' });
  const faceCoupe = [...vers2D(m), ...axesCyl(pc, o, 0)];
  // vue extérieure sans traits cachés (pour la demi-coupe)
  const ext = [];
  for (const { a, b, vis } of aretes(pc)) if (vis[0] === 1) ext.push({ p: [a[0], a[2]], q: [b[0], b[2]], s: 'v' });
  const xm = pc.L / 2;
  const coupeX = (arr, garderDroite) => arr.flatMap((s) => {
    const ga = garderDroite ? s.p[0] >= xm - 1e-9 : s.p[0] <= xm + 1e-9, gb = garderDroite ? s.q[0] >= xm - 1e-9 : s.q[0] <= xm + 1e-9;
    if (ga && gb) return [s]; if (!ga && !gb) return [];
    const t = (xm - s.p[0]) / (s.q[0] - s.p[0]), P = [xm, s.p[1] + t * (s.q[1] - s.p[1])];
    return [ga ? { ...s, q: P } : { ...s, p: P }];
  });
  const faceDemi = [...vers2D([...coupeX(m, true), ...coupeX(ext, false)]), ...axesCyl(pc, o0, 0)];
  return { faceCoupe, faceDemi, hach: contours((x, z) => cat(x, z) === 1, pc), hachDemi: contours((x, z) => x >= xm && cat(x, z) === 1, pc) };
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
  const trace = [];
  const [xa, ya] = D(demi ? pc.L / 2 : -9, c), [xb] = D(pc.L + 9, c);
  const Lt = (x1, y1, x2, y2, s) => trace.push({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
  Lt(xa, ya, xb, ya, 'a'); if (!demi) Lt(xa, ya, xa + 5, ya, 'v'); Lt(xb - 5, ya, xb, ya, 'v');
  for (const x of demi ? [xb - 1.5] : [xa + 1.5, xb - 1.5]) {
    Lt(x, ya, x, ya + 8, 'n'); Lt(x, ya + 8, x - 1.2, ya + 4.5, 'n'); Lt(x, ya + 8, x + 1.2, ya + 4.5, 'n');
    trace.push({ t: 'x', x: r3(x + (x < ox ? -5 : 2)), y: r3(ya + 3), txt: 'A', h: 5, s: 'n' });
  }
  if (demi) { Lt(xa, ya, xa, ya + 4, 'v'); }
  const o = outils(pc, c), xm = pc.L / 2;
  const nerv = o.corps.filter((q) => q.nerv), pleins = o.corps.filter((q) => !q.nerv);
  const matiere = (x, z) => { if (demi && x < xm) return false; const p = [x, c + 1e-3, z]; if (!o.dedans(p)) return false; return !(nerv.length && nerv.some((q) => dansPrim(q, p)) && !pleins.some((q) => dansPrim(q, p))); };
  const M = (b) => b.map(([x, z]) => F(x, z));
  const hachures = (demi ? r.hachDemi : r.hach).map((g) => ({ t: 'h', pts: M(g.pts), trous: g.trous.map(M), ang: 45, pas: 3, s: 'n' }));
  return { c, face, dessus: [...v.dessus, ...trace], hachure: hachures[0] || { t: 'h', pts: [], trous: [], ang: 45, pas: 3, s: 'n' }, hachures, matiere, cadres: v.cadres };
}

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
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
