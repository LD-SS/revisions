/* =====================================================================
   DAO — PIÈCES DE RÉVOLUTION (arbres, axes) : cylindres, méplats, perçages
   ---------------------------------------------------------------------
   Axe de la pièce parallèle à x, à y = R et z = R (R = plus grand rayon) :
   la boîte englobante va de 0 à L en x, de 0 à 2R en y et en z.
   Pièce : { id, nom, rev: true, etages: [{ l, d, plat?, plats?, platsY? }],
             trous: [{ axe: 'y' | 'z', x, d }] }   (trous passant par l'axe)
     plat   : méplat sur le dessus, à la hauteur « plat » mesurée depuis le
              dessous de l'étage (intersection cylindre / plan horizontal)
     plats  : deux méplats dessus-dessous, distance « sur plats »
     platsY : deux méplats avant-arrière, distance « sur plats »
   Section d'un étage (repère local Y vers l'arrière, Z vers le haut,
   origine sur l'axe) : disque de rayon r ∩ (zb ≤ Z ≤ zt) ∩ (yb ≤ Y ≤ yt).
   Toutes les pièces ont été créées pour l'appli (aucune ne vient d'un cours).
   ===================================================================== */

const r3 = (v) => Math.round(v * 1000) / 1000;
const DEB = 3;   // dépassement des axes (mm)
const INF = 1e9;
const L = (x1, y1, x2, y2, s) => ({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });

/** Construit une pièce de révolution (prof et profil = boîte englobante, pour le reste du logiciel). */
export function revolution(def) {
  const R = Math.max(...def.etages.map((e) => e.d)) / 2;
  const Lt = def.etages.reduce((s, e) => s + e.l, 0);
  return { ...def, rev: true, prof: 2 * R, profil: [[0, 0], [Lt, 0], [Lt, 2 * R], [0, 2 * R]], trous: def.trous || [] };
}

/** Étages avec leurs abscisses et leur section. */
export function etagesDe(pc) {
  let x = 0;
  return pc.etages.map((e) => {
    const r = e.d / 2;
    const s = { r, zt: INF, zb: -INF, yt: INF, yb: -INF };
    if (e.plat != null) s.zt = e.plat - r;
    if (e.plats != null) { s.zt = e.plats / 2; s.zb = -e.plats / 2; }
    if (e.platsY != null) { s.yt = e.platsY / 2; s.yb = -e.platsY / 2; }
    const o = { ...e, xa: x, xb: x + e.l, sec: s };
    x += e.l;
    return o;
  });
}

/** Corde en Y de la section à la hauteur Z (ou null). */
function cordeY(s, Z) {
  if (Z < Math.max(-s.r, s.zb) - 1e-12 || Z > Math.min(s.r, s.zt) + 1e-12) return null;
  const w = Math.sqrt(Math.max(0, s.r * s.r - Z * Z));
  const a = Math.max(-w, s.yb), b = Math.min(w, s.yt);
  return a <= b ? [a, b] : null;
}
/** Corde en Z de la section à la position Y (ou null). */
function cordeZ(s, Y) {
  const t = { r: s.r, zt: s.yt, zb: s.yb, yt: s.zt, yb: s.zb };
  return cordeY(t, Y);
}
/** Sommets de la section (rencontre méplat / cylindre). */
function sommets(s) {
  const out = [];
  for (const Z of [s.zt, s.zb]) if (Math.abs(Z) < s.r) { const w = Math.sqrt(s.r * s.r - Z * Z); for (const Y of [-w, w]) if (Y >= s.yb - 1e-9 && Y <= s.yt + 1e-9) out.push([Y, Z]); }
  for (const Y of [s.yt, s.yb]) if (Math.abs(Y) < s.r) { const w = Math.sqrt(s.r * s.r - Y * Y); for (const Z of [-w, w]) if (Z >= s.zb - 1e-9 && Z <= s.zt + 1e-9) out.push([Y, Z]); }
  return out;
}
const etendueZ = (s) => [Math.max(-s.r, s.zb), Math.min(s.r, s.zt)];
const etendueY = (s) => [Math.max(-s.r, s.yb), Math.min(s.r, s.yt)];

/**
 * Lignes d'épaulement entre deux sections (A à gauche, B à droite ; null = pas de matière),
 * vues selon une direction : corde(s, v) donne l'intervalle de profondeur, l'observateur est
 * du côté « bas » (avant) si devant = 0, « haut » (dessus) si devant = 1.
 * Renvoie des intervalles [v0, v1, 'v' | 'c'].
 */
function epaulement(A, B, corde, devant, candidatsDe) {
  const cs = [...new Set([...(A ? candidatsDe(A) : []), ...(B ? candidatsDe(B) : [])].map((v) => r3(v)))].sort((p, q) => p - q);
  const out = [];
  for (let k = 0; k + 1 < cs.length; k++) {
    const m = (cs[k] + cs[k + 1]) / 2;
    const ca = A ? corde(A, m) : null, cb = B ? corde(B, m) : null;
    if (!ca && !cb) continue;
    const egal = ca && cb && Math.abs(ca[0] - cb[0]) < 1e-9 && Math.abs(ca[1] - cb[1]) < 1e-9;
    if (egal) continue;
    const vu = !ca || !cb || Math.abs(ca[devant] - cb[devant]) > 1e-9;
    const s = vu ? 'v' : 'c';
    const der = out[out.length - 1];
    if (der && der[2] === s && Math.abs(der[1] - cs[k]) < 1e-9) der[1] = cs[k + 1]; else out.push([cs[k], cs[k + 1], s]);
  }
  return out;
}
const candZ = (s) => [-s.r, s.r, s.zt, s.zb, ...sommets(s).map((p) => p[1])].filter((v) => Math.abs(v) <= s.r + 1e-9);
const candY = (s) => [-s.r, s.r, s.yt, s.yb, ...sommets(s).map((p) => p[0])].filter((v) => Math.abs(v) <= s.r + 1e-9);

/* ----- vue de gauche : contours des sections, cachés par les étages plus à gauche ----- */
const dedansStrict = (s, Y, Z, e = 1e-7) => Y * Y + Z * Z < (s.r - e) * (s.r - e) && Z < s.zt - e && Z > s.zb + e && Y < s.yt - e && Y > s.yb + e;
const dedansLarge = (s, Y, Z, e = 1e-7) => Y * Y + Z * Z <= (s.r + e) * (s.r + e) && Z <= s.zt + e && Z >= s.zb - e && Y <= s.yt + e && Y >= s.yb - e;
function classe(secs, Y, Z) {
  const k = secs.findIndex((s) => dedansLarge(s, Y, Z) && !dedansStrict(s, Y, Z));
  if (k < 0) return null;
  for (let j = 0; j < k; j++) if (dedansStrict(secs[j], Y, Z)) return 'c';
  return 'v';
}
/** Parcourt une courbe paramétrée et renvoie les morceaux [t0, t1, s] (bornes affinées par dichotomie). */
function morceaux(f, t0, t1, n, secs) {
  const cl = (t) => classe(secs, ...f(t));
  const affiner = (a, b, ca) => { for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (cl(m) === ca) a = m; else b = m; } return (a + b) / 2; };
  const out = [];
  let tp = t0, cp = cl(t0), debut = t0;
  for (let i = 1; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n, c = cl(t);
    if (c !== cp) { const tb = affiner(tp, t, cp); if (cp) out.push([debut, tb, cp]); debut = tb; cp = c; }
    tp = t;
  }
  if (cp) out.push([debut, t1, cp]);
  return out.filter(([a, b]) => b - a > 1e-6);
}

/**
 * Les 3 vues d'une pièce de révolution (même format que vues() de pieces.js).
 */
export function vuesRevolution(pc, origine = [20, 90], ecart = 20) {
  const [ex, ey] = Array.isArray(ecart) ? ecart : [ecart, ecart];
  const ets = etagesDe(pc);
  const R = pc.prof / 2, P = pc.prof, W = ets[ets.length - 1].xb;
  const [ox, oy] = origine;
  const F = (x, Z) => [ox + x, oy + R + Z];
  const D = (x, Y) => [ox + x, oy - ey - P + R + Y];
  const G = (Y, Z) => [ox + W + ex + P - (R + Y), oy + R + Z];
  const face = [], dessus = [], gauche = [];
  const seg = (arr, f, a, c, s) => { const p = f(...a), q = f(...c); arr.push(L(p[0], p[1], q[0], q[1], s)); };

  ets.forEach((e, i) => {
    const s = e.sec;
    // contours (génératrices extrêmes) et arêtes méplat / cylindre
    for (const Z of etendueZ(s)) seg(face, F, [e.xa, Z], [e.xb, Z], 'v');
    for (const Y of etendueY(s)) seg(dessus, D, [e.xa, Y], [e.xb, Y], 'v');
    for (const [Y, Z] of sommets(s)) {
      const cy = cordeY(s, Z), cz = cordeZ(s, Y);
      seg(face, F, [e.xa, Z], [e.xb, Z], cy && cy[0] < Y - 1e-6 ? 'c' : 'v');
      seg(dessus, D, [e.xa, Y], [e.xb, Y], cz && cz[1] > Z + 1e-6 ? 'c' : 'v');
    }
    // épaulements (à gauche de l'étage, et fin de pièce)
    const A = i > 0 ? ets[i - 1].sec : null;
    for (const [a, b, st] of epaulement(A, s, cordeY, 0, candZ)) seg(face, F, [e.xa, a], [e.xa, b], st);
    for (const [a, b, st] of epaulement(A, s, cordeZ, 1, candY)) seg(dessus, D, [e.xa, a], [e.xa, b], st);
    if (i === ets.length - 1) {
      for (const [a, b, st] of epaulement(s, null, cordeY, 0, candZ)) seg(face, F, [e.xb, a], [e.xb, b], st);
      for (const [a, b, st] of epaulement(s, null, cordeZ, 1, candY)) seg(dessus, D, [e.xb, a], [e.xb, b], st);
    }
  });
  // axes
  seg(face, F, [-DEB, 0], [W + DEB, 0], 'a');
  seg(dessus, D, [-DEB, 0], [W + DEB, 0], 'a');
  seg(gauche, G, [-R - DEB, 0], [R + DEB, 0], 'a');
  seg(gauche, G, [0, -R - DEB], [0, R + DEB], 'a');

  // vue de gauche : cercles (arcs) et cordes des méplats
  const secs = ets.map((e) => e.sec);
  const [gx0, gy0] = G(0, 0);
  for (const r of [...new Set(secs.map((s) => r3(s.r)))]) {
    const f = (t) => [r * Math.cos((t * Math.PI) / 180), r * Math.sin((t * Math.PI) / 180)];
    const ms = morceaux(f, 0, 360, 1440, secs);
    if (ms.length === 1 && ms[0][1] - ms[0][0] > 359.999) { gauche.push({ t: 'c', cx: r3(gx0), cy: r3(gy0), r: r3(r), s: ms[0][2] }); continue; }
    // raccorde le dernier morceau au premier s'ils se touchent en 0° / 360°
    if (ms.length > 1 && ms[0][0] < 1e-6 && ms[ms.length - 1][1] > 360 - 1e-6 && ms[0][2] === ms[ms.length - 1][2]) { const der = ms.pop(); ms[0][0] = der[0] - 360; }
    // repère de la feuille : Y est inversé (G), un angle θ devient 180° − θ
    for (const [a, b, st] of ms) gauche.push({ t: 'a', cx: r3(gx0), cy: r3(gy0), r: r3(r), a0: r3(((180 - b) % 360 + 360) % 360), a1: r3(((180 - b) % 360 + 360) % 360 + (b - a)), s: st });
  }
  const lignes = new Set();
  for (const s of secs) {
    for (const Z of [s.zt, s.zb]) if (Math.abs(Z) < s.r) lignes.add(`z${r3(Z)}`);
    for (const Y of [s.yt, s.yb]) if (Math.abs(Y) < s.r) lignes.add(`y${r3(Y)}`);
  }
  for (const k of lignes) {
    const v = +k.slice(1);
    const f = k[0] === 'z' ? (t) => [t, v] : (t) => [v, t];
    for (const [a, b, st] of morceaux(f, -R, R, 800, secs)) seg(gauche, G, f(a), f(b), st);
  }

  // trous passant par l'axe
  for (const t of pc.trous || []) {
    const e = ets.find((q) => t.x > q.xa && t.x < q.xb); if (!e) continue;
    const s = e.sec, rh = t.d / 2;
    if (t.axe === 'y') {
      const [cx, cz] = F(t.x, 0);
      face.push({ t: 'c', cx: r3(cx), cy: r3(cz), r: r3(rh), s: 'v' });
      face.push(L(cx - rh - DEB, cz, cx + rh + DEB, cz, 'a'), L(cx, cz - rh - DEB, cx, cz + rh + DEB, 'a'));
      const c0 = cordeY(s, 0);
      for (const dx of [-rh, rh]) seg(dessus, D, [t.x + dx, c0[0]], [t.x + dx, c0[1]], 'c');
      seg(dessus, D, [t.x, c0[0] - DEB], [t.x, c0[1] + DEB], 'a');
      for (const dz of [-rh, rh]) { const c = cordeY(s, dz); if (c) seg(gauche, G, [c[0], dz], [c[1], dz], 'c'); }
    } else {
      const [cx, cy] = D(t.x, 0);
      dessus.push({ t: 'c', cx: r3(cx), cy: r3(cy), r: r3(rh), s: 'v' });
      dessus.push(L(cx - rh - DEB, cy, cx + rh + DEB, cy, 'a'), L(cx, cy - rh - DEB, cx, cy + rh + DEB, 'a'));
      const c0 = cordeZ(s, 0);
      for (const dx of [-rh, rh]) seg(face, F, [t.x + dx, c0[0]], [t.x + dx, c0[1]], 'c');
      seg(face, F, [t.x, c0[0] - DEB], [t.x, c0[1] + DEB], 'a');
      for (const dy of [-rh, rh]) { const c = cordeZ(s, dy); if (c) seg(gauche, G, [dy, c[0]], [dy, c[1]], 'c'); }
    }
  }
  const cadres = {
    face: { x: ox, y: oy, w: W, h: P },
    dessus: { x: ox, y: oy - ey - P, w: W, h: P },
    gauche: { x: ox + W + ex, y: oy, w: P, h: P },
  };
  return { face: dedoubler(face), dessus: dedoubler(dessus), gauche: dedoubler(gauche), cadres };
}

/** Doublons : le trait fort l'emporte ; un trait caché recouvert par un trait fort colinéaire disparaît. */
function dedoubler(es) {
  const rang = { v: 0, c: 1, a: 2, n: 3 };
  const cle = (e) => (e.t === 'l' ? [Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.max(e.x1, e.x2), Math.max(e.y1, e.y2)].join(',') : e.t === 'c' ? `c${e.cx},${e.cy},${e.r}` : `a${e.cx},${e.cy},${e.r},${e.a0},${e.a1}`);
  const m = new Map();
  for (const e of es) { if (e.t === 'l' && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) < 1e-6) continue; const k = cle(e); if (!m.has(k) || rang[e.s] < rang[m.get(k).s]) m.set(k, e); }
  const out = [...m.values()];
  // un caché entièrement sur un trait fort (même droite) est retiré
  const sur = (p, e) => { const dx = e.x2 - e.x1, dy = e.y2 - e.y1, l2 = dx * dx + dy * dy; const t = ((p[0] - e.x1) * dx + (p[1] - e.y1) * dy) / l2; if (t < -1e-6 || t > 1 + 1e-6) return false; return Math.abs((p[0] - e.x1) * dy - (p[1] - e.y1) * dx) / Math.sqrt(l2) < 1e-6; };
  return out.filter((e) => !(e.t === 'l' && e.s === 'c' && out.some((f) => f !== e && f.t === 'l' && f.s === 'v' && sur([e.x1, e.y1], f) && sur([e.x2, e.y2], f))));
}

/* =====================================================================
   PERSPECTIVE ISOMÉTRIQUE COTÉE (énoncé)
   Étages peints du plus lointain (droite) au plus proche (gauche).
   ===================================================================== */
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const f2 = (v) => Math.round(v * 100) / 100;
const nb = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

function contourSection(s, n = 96) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    pts.push([Math.min(Math.max(s.r * Math.cos(a), s.yb), s.yt), Math.min(Math.max(s.r * Math.sin(a), s.zb), s.zt)]);
  }
  return pts;
}
function enveloppe(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

export function svgRevolution(pc, { cotes = true, largeur = 420 } = {}) {
  const ets = etagesDe(pc), R = pc.prof / 2, W = ets[ets.length - 1].xb;
  const pr = ([x, Y, Z]) => { const y = R + Y, z = R + Z; return [(x - y) * C30, -((x + y) * S30 + z)]; };
  const trait = 'stroke="#111" stroke-width="1.6" stroke-linejoin="round"';
  const chemin = (pts, ferme = true) => `M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}${ferme ? 'Z' : ''}`;
  let corps = '';
  const tous = [];
  for (const e of [...ets].reverse()) {
    const s = e.sec, cs = contourSection(s);
    const proj = [...cs.map(([Y, Z]) => pr([e.xa, Y, Z])), ...cs.map(([Y, Z]) => pr([e.xb, Y, Z]))];
    tous.push(...proj);
    corps += `<path d="${chemin(enveloppe(proj))}" fill="#fff" ${trait}/>`;
    corps += `<path d="${chemin(cs.map(([Y, Z]) => pr([e.xa, Y, Z])))}" fill="#fff" ${trait}/>`;
    // arêtes méplat / cylindre tournées vers l'observateur
    for (const [Y, Z] of sommets(s)) {
      const nPlat = Math.abs(Z - s.zt) < 1e-9 ? [0, 1] : Math.abs(Z - s.zb) < 1e-9 ? [0, -1] : Math.abs(Y - s.yt) < 1e-9 ? [1, 0] : [-1, 0];
      const vu = (n) => -n[0] + n[1] > 1e-9;
      if (vu(nPlat) || vu([Y / s.r, Z / s.r])) corps += `<path d="${chemin([pr([e.xa, Y, Z]), pr([e.xb, Y, Z])], false)}" fill="none" ${trait}/>`;
    }
    for (const t of pc.trous || []) {
      if (!(t.x > e.xa && t.x < e.xb)) continue;
      const rh = t.d / 2, pts = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * 2 * Math.PI, u = rh * Math.cos(a), w = rh * Math.sin(a);
        if (t.axe === 'z') pts.push(pr([t.x + u, w, Math.min(s.zt, Math.sqrt(Math.max(0, s.r * s.r - w * w)))]));
        else pts.push(pr([t.x + u, Math.max(s.yb, -Math.sqrt(Math.max(0, s.r * s.r - w * w))), w]));
      }
      corps += `<path d="${chemin(pts)}" fill="#e9eef5" ${trait}/>`;
    }
  }
  // axe
  const a0 = pr([-6, 0, 0]), a1 = pr([W + 6, 0, 0]);
  corps += `<path d="M${f2(a0[0])} ${f2(a0[1])}L${f2(a1[0])} ${f2(a1[1])}" stroke="#111" stroke-width="0.6" stroke-dasharray="8 2 1.5 2" fill="none"/>`;

  let cot = '';
  if (cotes) {
    const fin = 'stroke="#1d5fd1" stroke-width="0.9"';
    const txt = (p, t, anc = 'start') => `<text x="${f2(p[0])}" y="${f2(p[1])}" text-anchor="${anc}" font-size="7.5" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${t}</text>`;
    const fl = (t, u) => { const n = [-u[1], u[0]], Lf = 5; return `<path d="M${f2(t[0])} ${f2(t[1])}L${f2(t[0] - u[0] * Lf + n[0] * 1.6)} ${f2(t[1] - u[1] * Lf + n[1] * 1.6)}L${f2(t[0] - u[0] * Lf - n[0] * 1.6)} ${f2(t[1] - u[1] * Lf - n[1] * 1.6)}Z" fill="#1d5fd1"/>`; };
    // longueurs : sous la pièce (génératrice avant-basse de la boîte), décalées vers le bas
    const chaine = (xs, D) => {
      const vs = [...new Set(xs.map(r3))].sort((p, q) => p - q);
      for (let k = 0; k + 1 < vs.length; k++) {
        const A = pr([vs[k], -R, -R]), B = pr([vs[k + 1], -R, -R]), Ao = pr([vs[k], -R, -R - D]), Bo = pr([vs[k + 1], -R, -R - D]);
        cot += `<path d="M${f2(A[0])} ${f2(A[1])}L${f2(Ao[0])} ${f2(Ao[1])}M${f2(B[0])} ${f2(B[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} stroke-dasharray="2 2" fill="none"/>`;
        const Lg = Math.hypot(Bo[0] - Ao[0], Bo[1] - Ao[1]); if (Lg < 1) continue;
        const u = [(Bo[0] - Ao[0]) / Lg, (Bo[1] - Ao[1]) / Lg];
        cot += `<path d="M${f2(Ao[0])} ${f2(Ao[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} fill="none"/>` + fl(Ao, [-u[0], -u[1]]) + fl(Bo, u);
        const ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI, m = [(Ao[0] + Bo[0]) / 2 + u[1] * 3 * -1, (Ao[1] + Bo[1]) / 2 - u[0] * 3];
        cot += `<text x="${f2(m[0])}" y="${f2(m[1])}" transform="rotate(${f2(ang)} ${f2(m[0])} ${f2(m[1])})" text-anchor="middle" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${nb(vs[k + 1] - vs[k])}</text>`;
      }
    };
    chaine([0, ...ets.map((e) => e.xb)], 14);
    if ((pc.trous || []).length) chaine([0, ...pc.trous.map((t) => t.x)], 28);
    // diamètres et méplats : rappel depuis le dessus de chaque étage
    ets.forEach((e, i) => {
      const xm = (e.xa + e.xb) / 2, p = pr([xm, 0, Math.min(e.sec.r, e.sec.zt)]);
      const q = [p[0] + 12, p[1] - 20 - 11 * i];
      const t = `Ø${nb(e.d)}${e.plat != null ? ` · méplat à ${nb(e.plat)}` : ''}${e.plats != null || e.platsY != null ? ` · plats ${nb(e.plats ?? e.platsY)}` : ''}`;
      cot += `<path d="M${f2(p[0])} ${f2(p[1])}L${f2(q[0])} ${f2(q[1])}h${f2(t.length * 3.9)}" ${fin} fill="none"/><circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="1.2" fill="#1d5fd1"/>` + txt([q[0] + 2, q[1] - 2], t);
      tous.push(q, [q[0] + t.length * 3.9, q[1] - 10]);
    });
    for (const t of pc.trous || []) {
      const e = ets.find((q) => t.x > q.xa && t.x < q.xb); if (!e) continue;
      const c = t.axe === 'z' ? pr([t.x, 0, Math.min(e.sec.r, e.sec.zt)]) : pr([t.x, Math.max(-e.sec.r, e.sec.yb), 0]);
      const q = [c[0] - 35, c[1] - 32 - 11 * ets.length];
      cot += `<path d="M${f2(c[0])} ${f2(c[1])}L${f2(q[0])} ${f2(q[1])}h-40" ${fin} fill="none"/><circle cx="${f2(c[0])}" cy="${f2(c[1])}" r="1.2" fill="#1d5fd1"/>` + txt([q[0] - 2, q[1] - 2], `Ø${nb(t.d)} traversant`, 'end');
      tous.push([q[0] - 80, q[1] - 10]);
    }
  }
  const m = cotes ? 40 : 8;
  const us = tous.map((p) => p[0]), vs = tous.map((p) => p[1]);
  const x0 = Math.min(...us) - m, y0 = Math.min(...vs) - m, w = Math.max(...us) - Math.min(...us) + 2 * m, h = Math.max(...vs) - Math.min(...vs) + 2 * m;
  return `<svg viewBox="${f2(x0)} ${f2(y0)} ${f2(w)} ${f2(h)}" width="${largeur}" role="img" aria-label="Perspective isométrique de la pièce ${String(pc.nom || '').replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;background:#fff">${corps}${cot}</svg>`;
}
