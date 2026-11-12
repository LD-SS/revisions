/* =====================================================================
   DAO — PIÈCES « 3 PROFILS » : intersection de trois prismes orthogonaux
   ---------------------------------------------------------------------
   Pièce = { id, nom, p3: true, L, P, H,
             fxz: [[x, z], …]  profil vu de face (extrudé selon y),
             fxy: [[x, y], …]  profil vu de dessus (extrudé selon z ; y = 0 : avant),
             fyz: [[y, z], …]  profil vu de gauche (extrudé selon x),
             trous: [{ axe: 'y', x, z, d } | { axe: 'z', x, y, d } | { axe: 'x', y, z, d }],
             arete?: [[x, y, z], [x, y, z]]  arête repérée (énoncé) }
   Un profil absent = le rectangle plein. La matière est l'intersection des
   trois prismes (moins les trous) : entailles, rainures, plans inclinés dans
   les trois directions.
   Les arêtes sont trouvées sur les droites d'intersection des plans des
   faces (test de voisinage), puis leur visibilité est calculée pour chaque
   vue (face, dessus, gauche) et pour la perspective isométrique.
   Toutes les pièces sont créées pour l'appli (aucune ne vient d'un livre).
   ===================================================================== */

const r3 = (v) => Math.round(v * 1000) / 1000;
const DEB = 3;

export function prisme(def) {
  const rect = (a, b) => [[0, 0], [a, 0], [a, b], [0, b]];
  const pc = { ...def, p3: true, trous: def.trous || [] };
  pc.fxz = def.fxz || rect(def.L, def.H);
  pc.fxy = def.fxy || rect(def.L, def.P);
  pc.fyz = def.fyz || rect(def.P, def.H);
  pc.prof = def.P;
  pc.profil = rect(def.L, def.H);     // boîte englobante (pour le reste du logiciel)
  return pc;
}

/* ---------- polygones ---------- */
function dansPoly(poly, a, b) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, bi] = poly[i], [aj, bj] = poly[j];
    if ((bi > b) !== (bj > b) && a < ((aj - ai) * (b - bi)) / (bj - bi) + ai) c = !c;
  }
  return c;
}
/** Intervalles de la 2e coordonnée du polygone sur la droite « 1re coordonnée = a ». */
function intervalles(poly, a) {
  const vs = [];
  for (let i = 0; i < poly.length; i++) {
    const [a1, b1] = poly[i], [a2, b2] = poly[(i + 1) % poly.length];
    if ((a1 <= a && a < a2) || (a2 <= a && a < a1)) vs.push(b1 + ((a - a1) * (b2 - b1)) / (a2 - a1));
  }
  vs.sort((p, q) => p - q);
  const out = [];
  for (let k = 0; k + 1 < vs.length; k += 2) out.push([vs[k], vs[k + 1]]);
  return out;
}
const inter = (A, B) => { const out = []; for (const [a, b] of A) for (const [c, d] of B) { const lo = Math.max(a, c), hi = Math.min(b, d); if (hi > lo + 1e-9) out.push([lo, hi]); } return out; };
const swap = (poly) => poly.map(([a, b]) => [b, a]);

function outils(pc) {
  if (pc._o) return pc._o;
  const sxz = swap(pc.fxz), sxy = swap(pc.fxy), syz = swap(pc.fyz);
  const dedans = (x, y, z) => dansPoly(pc.fxz, x, z) && dansPoly(pc.fxy, x, y) && dansPoly(pc.fyz, y, z);
  // intervalles de matière le long d'une droite parallèle à un axe
  const selonY = (x, z) => (dansPoly(pc.fxz, x, z) ? inter(intervalles(pc.fxy, x), intervalles(syz, z)) : []);
  const selonZ = (x, y) => (dansPoly(pc.fxy, x, y) ? inter(intervalles(pc.fxz, x), intervalles(pc.fyz, y)) : []);
  const selonX = (y, z) => (dansPoly(pc.fyz, y, z) ? inter(intervalles(sxz, z), intervalles(sxy, y)) : []);
  pc._o = { dedans, selonY, selonZ, selonX };
  return pc._o;
}
// NB : selonY utilise les intervalles de y dans fyz à la hauteur z : fyz est [y, z] → swap = [z, y]

/* ---------- arêtes 3D ---------- */
function plans(pc) {
  const ps = [], vu = new Set();
  const ajout = (n, p) => {
    const L = Math.hypot(...n); const u = n.map((v) => v / L); const d = u[0] * p[0] + u[1] * p[1] + u[2] * p[2];
    const s = u[0] < -1e-9 || (Math.abs(u[0]) < 1e-9 && (u[1] < -1e-9 || (Math.abs(u[1]) < 1e-9 && u[2] < 0))) ? -1 : 1;
    const k = [u[0] * s, u[1] * s, u[2] * s, d * s].map((v) => Math.round(v * 1e5)).join(',');
    if (!vu.has(k)) { vu.add(k); ps.push({ n: u, d }); }
  };
  const bord = (poly, f) => poly.forEach(([a1, b1], i) => { const [a2, b2] = poly[(i + 1) % poly.length]; f(a1, b1, a2, b2); });
  bord(pc.fxz, (x1, z1, x2, z2) => ajout([z2 - z1, 0, -(x2 - x1)], [x1, 0, z1]));
  bord(pc.fxy, (x1, y1, x2, y2) => ajout([y2 - y1, -(x2 - x1), 0], [x1, y1, 0]));
  bord(pc.fyz, (y1, z1, y2, z2) => ajout([0, z2 - z1, -(y2 - y1)], [0, y1, z1]));
  return ps;
}
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pscal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Droites candidates (intersections de 2 plans), coupées à la boîte. */
function droites(pc) {
  const ps = plans(pc), out = [], vu = new Set();
  const B = [[-0.5, pc.L + 0.5], [-0.5, pc.P + 0.5], [-0.5, pc.H + 0.5]];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    let u = croix(a.n, b.n); const Lu = Math.hypot(...u); if (Lu < 1e-6) continue;
    u = u.map((v) => v / Lu);
    // point de la droite : p = (d1 (n2×u) + d2 (u×n1)) / |n1×n2|²   (n1×n2 = u·Lu)
    const c1 = croix(b.n, u), c2 = croix(u, a.n);
    const p = [0, 1, 2].map((k) => (a.d * c1[k] + b.d * c2[k]) / Lu);
    // découpage par la boîte
    let t0 = -1e9, t1 = 1e9;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(u[k]) < 1e-12) { if (p[k] < B[k][0] || p[k] > B[k][1]) { t0 = 1; t1 = 0; } continue; }
      let ta = (B[k][0] - p[k]) / u[k], tb = (B[k][1] - p[k]) / u[k]; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t1 - t0 < 1e-6) continue;
    const s = u[0] < -1e-9 || (Math.abs(u[0]) < 1e-9 && (u[1] < -1e-9 || (Math.abs(u[1]) < 1e-9 && u[2] < 0))) ? -1 : 1;
    const us = u.map((v) => v * s); const tp = pscal(p, us); const q = p.map((v, k) => v - tp * us[k]);
    const key = [...us, ...q].map((v) => Math.round(v * 1e4)).join(',');
    if (vu.has(key)) continue; vu.add(key);
    out.push({ p, u, t0, t1, n1: a.n, n2: b.n });
  }
  return out;
}

/** Le point p est-il sur une arête ? (motif de matière sur un petit cercle autour de la droite) */
function estArete(o, p, u) {
  // base orthonormée du plan perpendiculaire à u
  const w = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let e1 = croix(u, w); const L1 = Math.hypot(...e1); e1 = e1.map((v) => v / L1); const e2 = croix(u, e1);
  const N = 24, eps = 0.02, m = [];
  // test rapide sur 8 directions : tout dedans ou tout dehors → pas sur le bord
  let n8 = 0;
  for (let k = 0; k < 8; k++) { const a = (2 * Math.PI * k) / 8 + 0.13, c = Math.cos(a) * eps, s = Math.sin(a) * eps; if (o.dedans(p[0] + c * e1[0] + s * e2[0], p[1] + c * e1[1] + s * e2[1], p[2] + c * e1[2] + s * e2[2])) n8++; }
  if (n8 === 0 || n8 === 8) return false;
  for (let k = 0; k < N; k++) {
    const a = (2 * Math.PI * k) / N + 0.13, c = Math.cos(a) * eps, s = Math.sin(a) * eps;
    m.push(o.dedans(p[0] + c * e1[0] + s * e2[0], p[1] + c * e1[1] + s * e2[1], p[2] + c * e1[2] + s * e2[2]));
  }
  const nb = m.filter(Boolean).length;
  if (nb === 0 || nb === N) return false;
  const tr = []; for (let k = 0; k < N; k++) if (m[k] !== m[(k + 1) % N]) tr.push(k);
  if (tr.length === 2 && Math.abs(tr[1] - tr[0] - N / 2) <= 1 && Math.abs(nb - N / 2) <= 1) return false;   // plan simple
  return true;
}

const ISO = [-1, -1, 1].map((v) => v / Math.sqrt(3));   // vers l'observateur (perspective isométrique)
/** Visibilité d'un point de surface pour chaque vue : [face, dessus, gauche, iso]. */
function visibilites(pc, o, p) {
  const d = 0.03, e = 1e-4;
  const avant = (ivs, v, sens) => ivs.some(([a, b]) => (sens < 0 ? a < v - e : b > v + e));
  const vu = (f) => [[-d, -d], [-d, d], [d, -d], [d, d]].some(([a, b]) => f(a, b));
  const face = vu((a, b) => !avant(o.selonY(p[0] + a, p[2] + b), p[1], -1));
  const dessus = vu((a, b) => !avant(o.selonZ(p[0] + a, p[1] + b), p[2], 1));
  const gauche = vu((a, b) => !avant(o.selonX(p[1] + a, p[2] + b), p[0], -1));
  // iso : on remonte le rayon vers l'observateur
  let iso = true;
  const tmax = pc.L + pc.P + pc.H;
  for (let t = 0.08; t < tmax; t += 0.4) { if (o.dedans(p[0] + ISO[0] * t, p[1] + ISO[1] * t, p[2] + ISO[2] * t)) { iso = false; break; } }
  return [face, dessus, gauche, iso];
}

/** Arêtes 3D : [{ a, b, vis: [face, dessus, gauche, iso] }] (mémorisées par pièce). */
export function aretes3D(pc) {
  if (pc._a) return pc._a;
  const o = outils(pc), out = [];
  for (const dr of droites(pc)) {
    const P = (t) => dr.p.map((v, k) => v + t * dr.u[k]);
    const cl = (t) => { const q = P(t); if (!estArete(o, q, dr.u)) return ''; return 'e' + visibilites(pc, o, q).map((b) => (b ? 1 : 0)).join(''); };
    const n = Math.max(8, Math.ceil((dr.t1 - dr.t0) / 0.5));
    const affiner = (a, b, ca) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (cl(m) === ca) a = m; else b = m; } return (a + b) / 2; };
    let tp = dr.t0, cp = cl(tp), deb = tp;
    const fin = (t1) => { if (cp && t1 - deb > 0.05) out.push({ a: P(deb).map(r3), b: P(t1).map(r3), vis: [...cp.slice(1)].map((c) => c === '1') }); };
    for (let i = 1; i <= n; i++) {
      const t = dr.t0 + ((dr.t1 - dr.t0) * i) / n, c = cl(t);
      if (c !== cp) { const tb = affiner(tp, t, cp); fin(tb); deb = tb; cp = c; }
      tp = t;
    }
    fin(dr.t1);
  }
  pc._a = out;
  return out;
}

/* ---------- fusion 2D des segments colinéaires (le fort l'emporte sur le caché) ---------- */
function fusionner(es) {
  const lignes = es.filter((e) => e.t === 'l'), autres = es.filter((e) => e.t !== 'l');
  const groupes = new Map();
  for (const e of lignes) {
    let dx = e.x2 - e.x1, dy = e.y2 - e.y1; const L = Math.hypot(dx, dy); if (L < 1e-6) continue;
    dx /= L; dy /= L; if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
    const off = -dy * e.x1 + dx * e.y1;
    const k = `${Math.round(dx * 1e4)},${Math.round(dy * 1e4)},${Math.round(off * 1e3)},${e.s}`;
    const t1 = dx * e.x1 + dy * e.y1, t2 = dx * e.x2 + dy * e.y2;
    if (!groupes.has(k)) groupes.set(k, { dx, dy, off, s: e.s, iv: [] });
    groupes.get(k).iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
  }
  const union = (iv) => { const s = [...iv].sort((a, b) => a[0] - b[0]), o = []; for (const [a, b] of s) { if (o.length && a <= o[o.length - 1][1] + 1e-6) o[o.length - 1][1] = Math.max(o[o.length - 1][1], b); else o.push([a, b]); } return o; };
  const moins = (A, B) => { let r = A; for (const [c, d] of B) { const n = []; for (const [a, b] of r) { if (d <= a || c >= b) n.push([a, b]); else { if (c > a) n.push([a, c]); if (d < b) n.push([d, b]); } } r = n; } return r; };
  const out = [];
  const cle = (g) => `${Math.round(g.dx * 1e4)},${Math.round(g.dy * 1e4)},${Math.round(g.off * 1e3)}`;
  const forts = new Map();
  for (const g of groupes.values()) if (g.s === 'v') forts.set(cle(g), union(g.iv));
  for (const g of groupes.values()) {
    let iv = union(g.iv);
    if (g.s !== 'v') iv = moins(iv, forts.get(cle(g)) || []);
    for (const [a, b] of iv) if (b - a > 0.05) {
      const P = (t) => [g.dx * t - g.dy * g.off, g.dy * t + g.dx * g.off];
      const [p, q] = [P(a), P(b)];
      out.push({ t: 'l', x1: r3(p[0]), y1: r3(p[1]), x2: r3(q[0]), y2: r3(q[1]), s: g.s });
    }
  }
  return [...out, ...autres];
}

/** Les 3 vues (même format que vues() de pieces.js). */
export function vuesPrisme(pc, origine = [20, 90], ecart = 20) {
  const [ex, ey] = Array.isArray(ecart) ? ecart : [ecart, ecart];
  const W = pc.L, H = pc.H, P = pc.P, [ox, oy] = origine;
  const F = (x, z) => [ox + x, oy + z], D = (x, y) => [ox + x, oy - ey - P + y], G = (y, z) => [ox + W + ex + P - y, oy + z];
  const face = [], dessus = [], gauche = [];
  const L2 = (arr, a, b, s) => arr.push({ t: 'l', x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]), s });
  for (const { a, b, vis } of aretes3D(pc)) {
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 1e-4) L2(face, F(a[0], a[2]), F(b[0], b[2]), vis[0] ? 'v' : 'c');
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-4) L2(dessus, D(a[0], a[1]), D(b[0], b[1]), vis[1] ? 'v' : 'c');
    if (Math.hypot(a[1] - b[1], a[2] - b[2]) > 1e-4) L2(gauche, G(a[1], a[2]), G(b[1], b[2]), vis[2] ? 'v' : 'c');
  }
  // trous
  const o = outils(pc);
  for (const t of pc.trous) {
    const r = t.d / 2;
    const cercle = (arr, c) => { arr.push({ t: 'c', cx: r3(c[0]), cy: r3(c[1]), r: r3(r), s: 'v' }); L2(arr, [c[0] - r - DEB, c[1]], [c[0] + r + DEB, c[1]], 'a'); L2(arr, [c[0], c[1] - r - DEB], [c[0], c[1] + r + DEB], 'a'); };
    if (t.axe === 'y') {
      cercle(face, F(t.x, t.z));
      for (const [a, b] of o.selonY(t.x, t.z)) { for (const dx of [-r, r]) L2(dessus, D(t.x + dx, a), D(t.x + dx, b), 'c'); for (const dz of [-r, r]) L2(gauche, G(a, t.z + dz), G(b, t.z + dz), 'c'); }
      const iv = o.selonY(t.x, t.z); if (iv.length) { const a = iv[0][0], b = iv[iv.length - 1][1]; L2(dessus, D(t.x, a - DEB), D(t.x, b + DEB), 'a'); L2(gauche, G(a - DEB, t.z), G(b + DEB, t.z), 'a'); }
    } else if (t.axe === 'z') {
      cercle(dessus, D(t.x, t.y));
      const iv = o.selonZ(t.x, t.y);
      for (const [a, b] of iv) { for (const dx of [-r, r]) L2(face, F(t.x + dx, a), F(t.x + dx, b), 'c'); for (const dy of [-r, r]) L2(gauche, G(t.y + dy, a), G(t.y + dy, b), 'c'); }
      if (iv.length) { const a = iv[0][0], b = iv[iv.length - 1][1]; L2(face, F(t.x, a - DEB), F(t.x, b + DEB), 'a'); L2(gauche, G(t.y, a - DEB), G(t.y, b + DEB), 'a'); }
    } else {
      cercle(gauche, G(t.y, t.z));
      const iv = o.selonX(t.y, t.z);
      for (const [a, b] of iv) { for (const dz of [-r, r]) L2(face, F(a, t.z + dz), F(b, t.z + dz), 'c'); for (const dy of [-r, r]) L2(dessus, D(a, t.y + dy), D(b, t.y + dy), 'c'); }
      if (iv.length) { const a = iv[0][0], b = iv[iv.length - 1][1]; L2(face, F(a - DEB, t.z), F(b + DEB, t.z), 'a'); L2(dessus, D(a - DEB, t.y), D(b + DEB, t.y), 'a'); }
    }
  }
  // trous taraudés (t.M = diamètre nominal) : 3/4 de cercle fin dans la vue de bout, traits cachés du nominal ailleurs
  for (const t of pc.trous) {
    if (!t.M) continue;
    const R = t.M / 2;
    const arc = (arr, c) => arr.push({ t: 'a', cx: r3(c[0]), cy: r3(c[1]), r: r3(R), a0: 90, a1: 360, s: 'n' });
    if (t.axe === 'y') { arc(face, F(t.x, t.z)); for (const [a, b] of o.selonY(t.x, t.z)) { for (const dx of [-R, R]) L2(dessus, D(t.x + dx, a), D(t.x + dx, b), 'c'); for (const dz of [-R, R]) L2(gauche, G(a, t.z + dz), G(b, t.z + dz), 'c'); } }
    else if (t.axe === 'z') { arc(dessus, D(t.x, t.y)); for (const [a, b] of o.selonZ(t.x, t.y)) { for (const dx of [-R, R]) L2(face, F(t.x + dx, a), F(t.x + dx, b), 'c'); for (const dy of [-R, R]) L2(gauche, G(t.y + dy, a), G(t.y + dy, b), 'c'); } }
    else { arc(gauche, G(t.y, t.z)); for (const [a, b] of o.selonX(t.y, t.z)) { for (const dz of [-R, R]) L2(face, F(a, t.z + dz), F(b, t.z + dz), 'c'); for (const dy of [-R, R]) L2(dessus, D(a, t.y + dy), D(b, t.y + dy), 'c'); } }
  }
  const cadres = { face: { x: ox, y: oy, w: W, h: H }, dessus: { x: ox, y: oy - ey - P, w: W, h: P }, gauche: { x: ox + W + ex, y: oy, w: P, h: H } };
  return { face: fusionner(face), dessus: fusionner(dessus), gauche: fusionner(gauche), cadres };
}

/* =====================================================================
   PERSPECTIVE ISOMÉTRIQUE COTÉE (énoncé) : arêtes vues, trous, cotes,
   arête repérée, flèche « Vue de face ».
   ===================================================================== */
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const f2 = (v) => Math.round(v * 100) / 100;
const nb = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

export function svgPrisme(pc, { cotes = true, largeur = 420, arete = true, fleche = null } = {}) {
  const pr = ([x, y, z]) => [(x - y) * C30, -((x + y) * S30 + z)];
  const trait = 'stroke="#111" stroke-width="1.5" stroke-linecap="round"';
  let corps = '', cot = '';
  const tous = [];
  for (const { a, b, vis } of aretes3D(pc)) {
    if (!vis[3]) continue;
    const p = pr(a), q = pr(b); tous.push(p, q);
    corps += `<path d="M${f2(p[0])} ${f2(p[1])}L${f2(q[0])} ${f2(q[1])}" ${trait}/>`;
  }
  const o = outils(pc);
  // trous : ellipse d'entrée si elle est vue
  for (const t of pc.trous) {
    const r = t.d / 2, pts = [];
    let c;
    if (t.axe === 'y') { const iv = o.selonY(t.x, t.z); if (!iv.length) continue; c = [t.x, iv[0][0], t.z]; for (let k = 0; k < 48; k++) { const a = (k / 48) * 2 * Math.PI; pts.push(pr([t.x + r * Math.cos(a), c[1], t.z + r * Math.sin(a)])); } }
    else if (t.axe === 'z') { const iv = o.selonZ(t.x, t.y); if (!iv.length) continue; c = [t.x, t.y, iv[iv.length - 1][1]]; for (let k = 0; k < 48; k++) { const a = (k / 48) * 2 * Math.PI; pts.push(pr([t.x + r * Math.cos(a), t.y + r * Math.sin(a), c[2]])); } }
    else { const iv = o.selonX(t.y, t.z); if (!iv.length) continue; c = [iv[0][0], t.y, t.z]; for (let k = 0; k < 48; k++) { const a = (k / 48) * 2 * Math.PI; pts.push(pr([c[0], t.y + r * Math.cos(a), t.z + r * Math.sin(a)])); } }
    corps += `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="#e9eef5" ${trait}/>`;
    t._c = c;
  }
  // arête repérée
  if (arete && pc.arete) {
    const [a, b] = pc.arete.map(pr);
    corps += `<path d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}" stroke="#d11" stroke-width="3" stroke-linecap="round"/>`;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], q = [m[0] - 30, m[1] - 34];
    cot += `<path d="M${f2(m[0])} ${f2(m[1])}L${f2(q[0])} ${f2(q[1])}h-14" stroke="#d11" stroke-width="0.9" fill="none"/><text x="${f2(q[0] - 16)}" y="${f2(q[1] - 2)}" text-anchor="end" font-size="8.5" font-weight="700" font-family="Segoe UI,Arial,sans-serif" fill="#d11">ROUGE</text>`;
    tous.push([q[0] - 52, q[1] - 10]);
  }
  if (cotes) {
    const fin = 'stroke="#1d5fd1" stroke-width="0.9"';
    const fl = (t, u) => { const n = [-u[1], u[0]], Lf = 5; return `<path d="M${f2(t[0])} ${f2(t[1])}L${f2(t[0] - u[0] * Lf + n[0] * 1.6)} ${f2(t[1] - u[1] * Lf + n[1] * 1.6)}L${f2(t[0] - u[0] * Lf - n[0] * 1.6)} ${f2(t[1] - u[1] * Lf - n[1] * 1.6)}Z" fill="#1d5fd1"/>`; };
    const chaine = (vals, pt3, off) => {
      const vs = [...new Set(vals.map(r3))].sort((p, q) => p - q);
      for (let k = 0; k + 1 < vs.length; k++) {
        const A3 = pt3(vs[k]), B3 = pt3(vs[k + 1]), A = pr(A3), B = pr(B3);
        const Ao = pr(A3.map((v, i) => v + off[i])), Bo = pr(B3.map((v, i) => v + off[i]));
        cot += `<path d="M${f2(A[0])} ${f2(A[1])}L${f2(Ao[0])} ${f2(Ao[1])}M${f2(B[0])} ${f2(B[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} stroke-dasharray="2 2" fill="none"/>`;
        const Lg = Math.hypot(Bo[0] - Ao[0], Bo[1] - Ao[1]); if (Lg < 1) continue;
        const u = [(Bo[0] - Ao[0]) / Lg, (Bo[1] - Ao[1]) / Lg];
        cot += `<path d="M${f2(Ao[0])} ${f2(Ao[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} fill="none"/>` + fl(Ao, [-u[0], -u[1]]) + fl(Bo, u);
        tous.push(Ao, Bo);
        const txt = nb(vs[k + 1] - vs[k]);
        if (Math.abs(u[0]) < 0.15) { const m = [Math.max(Ao[0], Bo[0]) + 3, (Ao[1] + Bo[1]) / 2 + 3]; cot += `<text x="${f2(m[0])}" y="${f2(m[1])}" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`; tous.push([m[0] + txt.length * 5.5, m[1]]); continue; }
        let ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const nrm = [u[1], -u[0]], s = nrm[1] < 0 ? 1 : -1;
        const m = [(Ao[0] + Bo[0]) / 2 + s * nrm[0] * 3, (Ao[1] + Bo[1]) / 2 + s * nrm[1] * 3];
        cot += `<text x="${f2(m[0])}" y="${f2(m[1])}" transform="rotate(${f2(ang)} ${f2(m[0])} ${f2(m[1])})" text-anchor="middle" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`;
        tous.push([m[0] - 8, m[1] - 10], [m[0] + 8, m[1] + 10]);
      }
    };
    const xs = [...pc.fxz.map((p) => p[0]), ...pc.fxy.map((p) => p[0]), ...pc.trous.filter((t) => t.axe !== 'x').map((t) => t.x)];
    const zs = [...pc.fxz.map((p) => p[1]), ...pc.fyz.map((p) => p[1]), ...pc.trous.filter((t) => t.axe !== 'z').map((t) => t.z)];
    const ys = [...pc.fxy.map((p) => p[1]), ...pc.fyz.map((p) => p[0]), ...pc.trous.filter((t) => t.axe !== 'y').map((t) => t.y)];
    chaine(xs, (x) => [x, 0, 0], [0, 0, -14]);
    chaine(zs, (z) => [pc.L, 0, z], [14, 0, 0]);
    chaine(ys, (y) => [0, y, 0], [-10, 0, -10]);
    for (const t of pc.trous) {
      if (!t._c) continue;
      const c = pr(t._c), q = [c[0] + 20, c[1] - 24];
      cot += `<path d="M${f2(c[0])} ${f2(c[1])}L${f2(q[0])} ${f2(q[1])}h16" ${fin} fill="none"/><text x="${f2(q[0] + 2)}" y="${f2(q[1] - 2)}" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">Ø${nb(t.d)}</text>`;
      tous.push([q[0] + 22, q[1] - 12]);
    }
  }
  if (fleche) {
    const xm = pc.L / 2, zf = pc.H * 0.85;
    const r = fleche(pr([xm, -30, zf]), pr([xm, -3, zf])); cot += r.svg; tous.push(...r.pts);
  }
  const m = 10, us = tous.map((p) => p[0]), vs = tous.map((p) => p[1]);
  const x0 = Math.min(...us) - m, y0 = Math.min(...vs) - m, w = Math.max(...us) - Math.min(...us) + 2 * m, h = Math.max(...vs) - Math.min(...vs) + 2 * m;
  return `<svg viewBox="${f2(x0)} ${f2(y0)} ${f2(w)} ${f2(h)}" width="${largeur}" role="img" aria-label="Perspective isométrique de la pièce ${String(pc.nom || '').replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;background:#fff">${corps}${cot}</svg>`;
}

/* =====================================================================
   COUPE A-A d'une pièce « 3 profils » : plan vertical y = c (tracé sur la
   vue de dessus), on enlève l'avant, vue de face sans traits cachés,
   matière coupée hachurée. Même format que coupeA() de pieces.js.
   ===================================================================== */
function couperDemiPlan(poly, k, v, garderSup) {   // garde coord[k] >= v (ou <=)
  const out = [], dedans = (p) => (garderSup ? p[k] >= v - 1e-9 : p[k] <= v + 1e-9);
  poly.forEach((A, i) => {
    const B = poly[(i + 1) % poly.length], ia = dedans(A), ib = dedans(B);
    if (ia) out.push(A);
    if (ia !== ib) { const t = (v - A[k]) / (B[k] - A[k]); const P = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]; P[k] = v; out.push(P); }
  });
  return out;
}
export function coupePrisme(pc, origine = [20, 90], ecart = 20) {
  const [ex, ey] = Array.isArray(ecart) ? ecart : [ecart, ecart];
  const v = vuesPrisme(pc, origine, ecart), [ox, oy] = origine, P = pc.P;
  const c = pc.coupe ?? (pc.trous.find((t) => t.axe === 'z')?.y ?? P / 2);
  const F = (x, z) => [ox + x, oy + z], D = (x, y) => [ox + x, oy - ey - P + y];
  const L2 = (arr, a, b, s) => arr.push({ t: 'l', x1: r3(a[0]), y1: r3(a[1]), x2: r3(b[0]), y2: r3(b[1]), s });
  if (!pc._coupe) {
    const arr = prisme({ ...pc, id: `${pc.id}-coupe`, fxy: couperDemiPlan(pc.fxy, 1, c, true), fyz: couperDemiPlan(pc.fyz, 0, c, true), trous: [] });
    pc._coupe = aretes3D(arr);
  }
  const face = [];
  for (const { a, b, vis } of pc._coupe) if (vis[0] && Math.hypot(a[0] - b[0], a[2] - b[2]) > 1e-4) L2(face, F(a[0], a[2]), F(b[0], b[2]), 'v');
  const o = outils(pc);
  const coupes = [];
  for (const t of pc.trous) {
    const r = t.d / 2;
    if (t.axe === 'y') {
      if (!o.selonY(t.x, t.z).some(([a, b]) => b > c)) continue;
      const [cx, cz] = F(t.x, t.z);
      face.push({ t: 'c', cx: r3(cx), cy: r3(cz), r: r3(r), s: 'v' }); L2(face, [cx - r - DEB, cz], [cx + r + DEB, cz], 'a'); L2(face, [cx, cz - r - DEB], [cx, cz + r + DEB], 'a');
    } else if (Math.abs((t.axe === 'z' ? t.y : t.y) - c) < r - 1e-6) {
      const w = Math.sqrt(r * r - (t.y - c) ** 2); coupes.push({ ...t, w });
      if (t.axe === 'z') { const iv = o.selonZ(t.x, c); for (const [a, b] of iv) for (const dx of [-w, w]) L2(face, F(t.x + dx, a), F(t.x + dx, b), 'v'); if (iv.length) L2(face, F(t.x, iv[0][0] - DEB), F(t.x, iv[iv.length - 1][1] + DEB), 'a'); }
      else { const iv = o.selonX(c, t.z); for (const [a, b] of iv) for (const dz of [-w, w]) L2(face, F(a, t.z + dz), F(b, t.z + dz), 'v'); if (iv.length) L2(face, F(iv[0][0] - DEB, t.z), F(iv[iv.length - 1][1] + DEB, t.z), 'a'); }
    }
  }
  // trace du plan A-A sur la vue de dessus
  const trace = [];
  const [xa, ya] = D(-9, c), [xb] = D(pc.L + 9, c);
  trace.push({ t: 'l', x1: r3(xa), y1: r3(ya), x2: r3(xb), y2: r3(ya), s: 'a' }, { t: 'l', x1: r3(xa), y1: r3(ya), x2: r3(xa + 5), y2: r3(ya), s: 'v' }, { t: 'l', x1: r3(xb - 5), y1: r3(ya), x2: r3(xb), y2: r3(ya), s: 'v' });
  for (const x of [xa + 1.5, xb - 1.5]) {
    trace.push({ t: 'l', x1: r3(x), y1: r3(ya), x2: r3(x), y2: r3(ya + 8), s: 'n' }, { t: 'l', x1: r3(x), y1: r3(ya + 8), x2: r3(x - 1.2), y2: r3(ya + 4.5), s: 'n' }, { t: 'l', x1: r3(x), y1: r3(ya + 8), x2: r3(x + 1.2), y2: r3(ya + 4.5), s: 'n' });
    trace.push({ t: 'x', x: r3(x + (x < ox ? -5 : 2)), y: r3(ya + 3), txt: 'A', h: 5, s: 'n' });
  }
  // matière coupée et hachure de la solution
  const matiere = (x, z) => o.dedans(x, c, z) && !pc.trous.some((t) => (t.axe === 'y' ? Math.hypot(x - t.x, z - t.z) < t.d / 2 : false)) && !coupes.some((t) => (t.axe === 'z' ? Math.abs(x - t.x) < t.w : Math.abs(z - t.z) < t.w));
  const ivx = (() => { const sxy = swap(pc.fxy); return intervalles(sxy, c); })(), ivz = intervalles(pc.fyz, c);
  const x0 = Math.min(...ivx.map((q) => q[0])), x1 = Math.max(...ivx.map((q) => q[1])), z0 = Math.min(...ivz.map((q) => q[0])), z1 = Math.max(...ivz.map((q) => q[1]));
  let poly = pc.fxz;
  poly = couperDemiPlan(poly, 0, x0, true); poly = couperDemiPlan(poly, 0, x1, false); poly = couperDemiPlan(poly, 1, z0, true); poly = couperDemiPlan(poly, 1, z1, false);
  const rect = (a, b, c2, d) => [F(a, c2), F(b, c2), F(b, d), F(a, d)];
  const trous = [];
  for (let i = 0; i + 1 < ivx.length; i++) trous.push(rect(ivx[i][1], ivx[i + 1][0], z0, z1));
  for (let i = 0; i + 1 < ivz.length; i++) trous.push(rect(x0, x1, ivz[i][1], ivz[i + 1][0]));
  for (const t of pc.trous) if (t.axe === 'y' && o.selonY(t.x, t.z).some(([a, b]) => b > c)) trous.push(Array.from({ length: 48 }, (_, k) => F(t.x + (t.d / 2) * Math.cos((k / 48) * 2 * Math.PI), t.z + (t.d / 2) * Math.sin((k / 48) * 2 * Math.PI))));
  for (const t of coupes) {   // bandes vides des trous coupés, seulement là où il y a de la matière
    if (t.axe === 'z') for (const [a, b] of o.selonZ(t.x, c)) trous.push(rect(t.x - t.w, t.x + t.w, a, b));
    else for (const [a, b] of o.selonX(c, t.z)) trous.push(rect(a, b, t.z - t.w, t.z + t.w));
  }
  const hachure = { t: 'h', pts: poly.map(([x, z]) => F(x, z)), trous, ang: 45, pas: 3, s: 'n' };
  return { c, face: fusionner(face), dessus: [...v.dessus, ...trace], hachure, matiere, cadres: v.cadres };
}
