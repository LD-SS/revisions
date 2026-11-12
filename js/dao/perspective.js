/* =====================================================================
   DAO — PERSPECTIVE ISOMÉTRIQUE COTÉE d'une pièce (js/dao/pieces.js)
   ---------------------------------------------------------------------
   Vue de l'avant, de la gauche et du dessus (les faces visibles sont la
   face avant, le flanc gauche et le dessus, comme pour les 3 vues).
   Projection : u = (x − y)·cos 30°, v = (x + y)·sin 30° + z.
   Faces peintes de la plus lointaine à la plus proche (fond blanc).
   Cotation en série : abscisses sous la face avant, hauteurs à droite,
   profondeurs le long de l'arête inférieure gauche ; Ø des trous.
   Renvoie une chaîne SVG autonome (styles en attributs).
   ===================================================================== */

import { boite, intervallesZ } from './pieces.js';
import { svgRevolution } from './revolution.js';
import { svgPrisme } from './prisme.js';
import { svgSolide, perspSolide } from './solide.js';

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const f2 = (v) => Math.round(v * 100) / 100;
const nb = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/** Flèche d'observation de la vue de face (de s vers e, coordonnées écran) + étiquette. */
export function flecheFace(s, e) {
  const L = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1, u = [(e[0] - s[0]) / L, (e[1] - s[1]) / L], n = [-u[1], u[0]];
  const b1 = [e[0] - u[0] * 7 + n[0] * 3, e[1] - u[1] * 7 + n[1] * 3], b2 = [e[0] - u[0] * 7 - n[0] * 3, e[1] - u[1] * 7 - n[1] * 3];
  const c = '#c2410c';
  const svg = `<path d="M${f2(s[0])} ${f2(s[1])}L${f2(e[0] - u[0] * 6)} ${f2(e[1] - u[1] * 6)}" stroke="${c}" stroke-width="1.8" fill="none"/><path d="M${f2(e[0])} ${f2(e[1])}L${f2(b1[0])} ${f2(b1[1])}L${f2(b2[0])} ${f2(b2[1])}Z" fill="${c}"/>`
    + `<text x="${f2(s[0] + 2)}" y="${f2(s[1] + 11)}" font-size="9.5" font-weight="700" font-family="Segoe UI,Arial,sans-serif" fill="${c}">Vue de face</text>`;
  return { svg, pts: [s, e, [s[0] + 60, s[1] + 14]] };
}

export function svgPerspective(piece, { cotes = true, largeur = 420 } = {}) {
  if (piece.rev) return svgRevolution(piece, { cotes, largeur });
  if (piece.p3) return svgPrisme(piece, { cotes, largeur, fleche: cotes ? flecheFace : null });
  if (piece.cs) return svgSolide(piece, { cotes, largeur, fleche: cotes ? flecheFace : null });
  const b = boite(piece), P = piece.prof;
  const pr = ([x, y, z]) => [(x - y) * C30, -((x + y) * S30 + z)];   // y écran vers le bas
  const prof = piece.profil;
  const aire = prof.reduce((s, p, i) => { const q = prof[(i + 1) % prof.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sensDirect = aire > 0;
  const faces = [];
  const poly = (pts3) => pts3.map(pr);
  // face arrière (jamais vue) et avant
  faces.push({ pts: poly(prof.map(([x, z]) => [x, P, z])), d: Infinity, vue: false });
  // faces latérales (une par arête du profil), visibles si la normale regarde vers l'observateur
  prof.forEach(([x1, z1], i) => {
    const [x2, z2] = prof[(i + 1) % prof.length];
    let nx = z2 - z1, nz = -(x2 - x1);              // normale extérieure si le profil tourne dans le sens direct
    if (!sensDirect) { nx = -nx; nz = -nz; }
    const vis = (-nx + nz) > 1e-9;                 // visible si n·(−1, −1, 1) > 0
    const pts = [[x1, 0, z1], [x2, 0, z2], [x2, P, z2], [x1, P, z1]];
    const d = pts.reduce((s, p) => s + p[0] + p[1] - p[2], 0) / 4;
    if (vis) faces.push({ pts: poly(pts), d, vue: true });
  });
  faces.sort((a, c) => c.d - a.d);
  const avant = { pts: poly(prof.map(([x, z]) => [x, 0, z])), d: -Infinity, vue: true };
  let corps = '';
  const trait = 'stroke="#111" stroke-width="1.6" stroke-linejoin="round"';
  for (const f of [...faces.filter((x) => x.vue), avant]) corps += `<path d="M${f.pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="#fff" ${trait}/>`;

  // trous : ellipses sur la face d'entrée
  const ellipse = (centre, r, plan) => {
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * 2 * Math.PI;
      const p3 = plan === 'xz' ? [centre[0] + r * Math.cos(a), centre[1], centre[2] + r * Math.sin(a)] : [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), centre[2]];
      pts.push(pr(p3));
    }
    return `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="#e9eef5" ${trait}/>`;
  };
  for (const t of piece.trous || []) {
    if (t.axe === 'y') corps += ellipse([t.x, 0, t.z], t.d / 2, 'xz');
    else { const iv = intervallesZ(prof, t.x); const zt = Math.max(...iv.map((v) => v[1])); corps += ellipse([t.x, t.y, zt], t.d / 2, 'xy'); }
  }

  // ----- cotes
  let cot = '';
  const bornes = [];   // points des cotes et textes : pour que rien ne soit coupé au bord
  const fin = 'stroke="#1d5fd1" stroke-width="0.9"';
  const texteC = (p, ang, txt) => {
    let a = ang; if (a > 90) a -= 180; if (a < -90) a += 180;
    return `<text x="${f2(p[0])}" y="${f2(p[1])}" transform="rotate(${f2(a)} ${f2(p[0])} ${f2(p[1])})" text-anchor="middle" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`;
  };
  const fl = (t, u) => { const n = [-u[1], u[0]]; const L = 5; const b1 = [t[0] - u[0] * L + n[0] * 1.6, t[1] - u[1] * L + n[1] * 1.6], b2 = [t[0] - u[0] * L - n[0] * 1.6, t[1] - u[1] * L - n[1] * 1.6]; return `<path d="M${f2(t[0])} ${f2(t[1])}L${f2(b1[0])} ${f2(b1[1])}L${f2(b2[0])} ${f2(b2[1])}Z" fill="#1d5fd1"/>`; };
  /** Chaîne de cotes entre les valeurs vals le long de l'axe a ('x'|'y'|'z'), décalée selon off (vecteur 3D). */
  const chaine = (vals, pt3, off) => {
    const vs = [...new Set(vals.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
    for (let k = 0; k + 1 < vs.length; k++) {
      const A3 = pt3(vs[k]), B3 = pt3(vs[k + 1]);
      const A = pr(A3), B = pr(B3);
      const Ao = pr([A3[0] + off[0], A3[1] + off[1], A3[2] + off[2]]), Bo = pr([B3[0] + off[0], B3[1] + off[1], B3[2] + off[2]]);
      cot += `<path d="M${f2(A[0])} ${f2(A[1])}L${f2(Ao[0])} ${f2(Ao[1])}M${f2(B[0])} ${f2(B[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} stroke-dasharray="2 2" fill="none"/>`;
      const L = Math.hypot(Bo[0] - Ao[0], Bo[1] - Ao[1]); if (L < 1) continue;
      const u = [(Bo[0] - Ao[0]) / L, (Bo[1] - Ao[1]) / L];
      cot += `<path d="M${f2(Ao[0])} ${f2(Ao[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} fill="none"/>` + fl(Ao, [-u[0], -u[1]]) + fl(Bo, u);
      const txt = nb(vs[k + 1] - vs[k]);
      bornes.push(A, B, Ao, Bo);
      if (Math.abs(u[0]) < 0.15) {   // cote verticale : texte horizontal, à droite de la ligne de cote
        const mm = [Math.max(Ao[0], Bo[0]) + 3, (Ao[1] + Bo[1]) / 2 + 3];
        cot += `<text x="${f2(mm[0])}" y="${f2(mm[1])}" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`;
        bornes.push([mm[0] + txt.length * 5.5 + 2, mm[1]]);
        continue;
      }
      const ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
      const nrm = [u[1], -u[0]];   // côté du texte : vers le haut de l'écran
      const mm = nrm[1] < 0 ? [(Ao[0] + Bo[0]) / 2 + nrm[0] * 3, (Ao[1] + Bo[1]) / 2 + nrm[1] * 3] : [(Ao[0] + Bo[0]) / 2 - nrm[0] * 3, (Ao[1] + Bo[1]) / 2 - nrm[1] * 3];
      bornes.push([mm[0] - 8, mm[1] - 10], [mm[0] + 8, mm[1] + 10]);
      cot += texteC(mm, ang, txt);
    }
  };
  if (cotes) {
    const D = 14;
    const xs = [...prof.map((p) => p[0]), ...(piece.trous || []).map((t) => t.x)];
    chaine(xs, (x) => [x, 0, b.z0], [0, 0, -D]);                                       // abscisses sous la face avant
    const zs = [...prof.map((p) => p[1]), ...(piece.trous || []).filter((t) => t.axe === 'y').map((t) => t.z)];
    chaine(zs, (z) => [b.x1, 0, z], [D, 0, 0]);                                        // hauteurs à droite
    const ys = [0, P, ...(piece.trous || []).filter((t) => t.axe === 'z').map((t) => t.y)];
    chaine(ys, (y) => [b.x0, y, b.z0], [-D * 0.7, 0, -D * 0.7]);                       // profondeurs
    for (const t of piece.trous || []) {
      const c = t.axe === 'y' ? pr([t.x, 0, t.z]) : pr([t.x, t.y, Math.max(...intervallesZ(prof, t.x).map((v) => v[1]))]);
      const q = [c[0] + 22, c[1] - 22];
      cot += `<path d="M${f2(c[0])} ${f2(c[1])}L${f2(q[0])} ${f2(q[1])}h16" ${fin} fill="none"/><text x="${f2(q[0] + 2)}" y="${f2(q[1] - 2)}" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">Ø${nb(t.d)}</text>`;
      bornes.push([q[0] + 20, q[1] - 12]);
    }
  }
  // flèche « Vue de face » : regarde la face avant (y = 0)
  if (cotes) {
    const xm = (b.x0 + b.x1) / 2, zf = b.z0 + (b.z1 - b.z0) * 0.85;
    const r = flecheFace(pr([xm, -30, zf]), pr([xm, -3, zf]));
    cot += r.svg; bornes.push(...r.pts);
  }
  // cadre de la figure
  const tous = [...faces.flatMap((f) => f.pts), ...avant.pts, ...bornes];
  const us = tous.map((p) => p[0]), vs = tous.map((p) => p[1]);
  const m = cotes ? 12 : 8;
  const x0 = Math.min(...us) - m, y0 = Math.min(...vs) - m, w = Math.max(...us) - Math.min(...us) + 2 * m, h = Math.max(...vs) - Math.min(...vs) + 2 * m;
  return `<svg viewBox="${f2(x0)} ${f2(y0)} ${f2(w)} ${f2(h)}" width="${largeur}" role="img" aria-label="Perspective isométrique de la pièce ${String(piece.nom || '').replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;background:#fff">${corps}${cot}</svg>`;
}

/* =====================================================================
   PERSPECTIVE EN ENTITÉS DAO (pour les exercices : la solution à comparer)
   ---------------------------------------------------------------------
   type 'iso'  : isométrique, X = (x − y)·cos30°, Y = (x + y)·sin30° + z
   type 'cav'  : cavalière à 45°, k = 0,5 : X = x + k·y·cos45°, Y = z + k·y·sin45°
   Seules les arêtes vues sont rendues (traits forts), par un test de
   visibilité point par point (tous les 0,5 mm) contre les faces tournées
   vers l'observateur. Trous : bord de l'entrée s'il est vu (ellipse par
   4 centres en isométrique ; en cavalière, cercle des trous de la face avant).
   origine = position sur la feuille (mm réels) du coin avant-bas-gauche.
   ===================================================================== */
const r3 = (v) => Math.round(v * 1000) / 1000;
export function perspectiveEntites(piece, origine, type = 'iso') {
  if (piece.cs) return perspSolide(piece, origine, type);
  const b = boite(piece), P = piece.prof, prof = piece.profil, [Ox, Oy] = origine;
  const k = 0.5, c45 = Math.SQRT1_2;
  const proj = type === 'cav'
    ? ([x, y, z]) => [Ox + (x - b.x0) + k * y * c45, Oy + (z - b.z0) + k * y * c45]
    : ([x, y, z]) => [Ox + (x - b.x0 - y) * C30, Oy + (x - b.x0 + y) * S30 + (z - b.z0)];
  const w = type === 'cav' ? [-k * c45, 1, -k * c45] : [1, 1, -1];        // direction d'observation (vers l'arrière)
  const aire = prof.reduce((s, p, i) => { const q = prof[(i + 1) % prof.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sens = aire > 0 ? 1 : -1;
  // faces : avant (y = 0, normale −y), arrière (y = P), latérales
  const faces = [{ n: [0, -1, 0], c: 0, dedans: (p) => p[1] > -1e-6 && p[1] < 1e-6 && dansProf(p[0], p[2]) }];
  faces.push({ n: [0, 1, 0], c: P, dedans: (p) => Math.abs(p[1] - P) < 1e-6 && dansProf(p[0], p[2]) });
  function dansProf(x, z) {
    let d = false;
    for (let i = 0, j = prof.length - 1; i < prof.length; j = i++) { const [xi, zi] = prof[i], [xj, zj] = prof[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; }
    return d;
  }
  prof.forEach(([x1, z1], i) => {
    const [x2, z2] = prof[(i + 1) % prof.length];
    const L0 = Math.hypot(x2 - x1, z2 - z1);
    const n = [sens * (z2 - z1) / L0, 0, -sens * (x2 - x1) / L0];
    faces.push({ n, c: n[0] * x1 + n[2] * z1, dedans: (p) => { const s = ((p[0] - x1) * (x2 - x1) + (p[2] - z1) * (z2 - z1)) / (L0 * L0); return s > 1e-4 && s < 1 - 1e-4 && p[1] > 1e-4 && p[1] < P - 1e-4; }, lat: i });
  });
  const dot = (a, q) => a[0] * q[0] + a[1] * q[1] + a[2] * q[2];
  const avant = faces.filter((f) => dot(f.n, w) < -1e-9);
  const vue = (p) => !avant.some((f) => {
    const t = (f.c - dot(f.n, p)) / dot(f.n, w);
    if (t > -1e-4) return false;                         // la face n'est pas devant le point
    const q = [p[0] + t * w[0], p[1] + t * w[1], p[2] + t * w[2]];
    return f.dedans(q);
  });
  const avantLat = new Set(avant.filter((f) => f.lat !== undefined).map((f) => f.lat));
  const aretes = [];
  prof.forEach(([x1, z1], i) => {
    const [x2, z2] = prof[(i + 1) % prof.length];
    aretes.push([[x1, 0, z1], [x2, 0, z2]]);                                         // face avant (toujours vue)
    if (avantLat.has(i)) aretes.push([[x1, P, z1], [x2, P, z2]]);                    // arrière, si la face latérale est vue
    if (avantLat.has(i) || avantLat.has((i - 1 + prof.length) % prof.length)) aretes.push([[x1, 0, z1], [x1, P, z1]]);
  });
  const out = [];
  for (const [A, B] of aretes) {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(2, Math.ceil(L / 0.5));
    let debut = null;
    for (let s = 0; s <= n; s++) {
      const t = s / n, p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
      const v = vue(p);
      if (v && debut === null) debut = t;
      if ((!v || s === n) && debut !== null) {
        const fin = v ? t : (s - 1) / n;
        if ((fin - debut) * L > 1) {
          const P1 = proj([A[0] + (B[0] - A[0]) * debut, A[1] + (B[1] - A[1]) * debut, A[2] + (B[2] - A[2]) * debut]);
          const P2 = proj([A[0] + (B[0] - A[0]) * fin, A[1] + (B[1] - A[1]) * fin, A[2] + (B[2] - A[2]) * fin]);
          out.push({ t: 'l', x1: r3(P1[0]), y1: r3(P1[1]), x2: r3(P2[0]), y2: r3(P2[1]), s: 'v' });
        }
        debut = null;
      }
    }
  }
  // trous : bord de l'entrée, s'il est vu (cercle en cavalière sur la face avant, ellipse par 4 arcs en isométrique)
  const vec = type === 'cav'
    ? ([x, y, z]) => [x + k * y * c45, z + k * y * c45]
    : ([x, y, z]) => [(x - y) * C30, (x + y) * S30 + z];
  for (const t of piece.trous || []) {
    const r = t.d / 2;
    let centre, a, bb;
    if (t.axe === 'y') { centre = [t.x, 0, t.z]; a = [1, 0, 0]; bb = [0, 0, 1]; }
    else { const iv = intervallesZ(prof, t.x); centre = [t.x, t.y, Math.max(...iv.map((u) => u[1]))]; a = [1, 0, 0]; bb = [0, 1, 0]; }
    if (!vue(centre)) continue;
    const C = proj(centre);
    if (type === 'cav') {
      if (t.axe === 'y') out.push({ t: 'c', cx: r3(C[0]), cy: r3(C[1]), r: r3(r), s: 'v' });
      continue;                                            // en cavalière, les trous verticaux ne sont pas demandés
    }
    out.push(...ellipse4(C, vec(a.map((q) => q * r)), vec(bb.map((q) => q * r))));
  }
  // cadre de la figure (pour situer la zone de l'élève)
  const pts = [];
  for (const [x, z] of prof) for (const y of [0, P]) pts.push(proj([x, y, z]));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return { traits: out, cadre: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
}

/**
 * Ellipse isométrique par la méthode des 4 centres : cercle inscrit dans le losange C ± u ± v
 * (u, v : images des deux rayons perpendiculaires). Renvoie 4 arcs (traits forts, tolérance 1 mm).
 */
function ellipse4(C, u, v) {
  const add = (p, q, f = 1) => [p[0] + f * q[0], p[1] + f * q[1]];
  const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
  if (cos > 0) v = [-v[0], -v[1]];                      // u et v à 120° : les coins obtus sont C + u + v et C − u − v
  const O1 = add(add(C, u), v), O2 = add(add(C, u, -1), v, -1);
  const Mu = add(C, u), Mmu = add(C, u, -1), Mv = add(C, v), Mmv = add(C, v, -1);
  const inter = (p1, p2, p3, p4) => {                   // intersection des droites p1p2 et p3p4
    const d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [p4[0] - p3[0], p4[1] - p3[1]];
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    const t = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / den;
    return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
  };
  const Q1 = inter(O1, Mmu, O2, Mv), Q2 = inter(O1, Mmv, O2, Mu);
  const arc = (c, p, q) => {
    const ang = (m) => (Math.atan2(m[1] - c[1], m[0] - c[0]) * 180) / Math.PI;
    let a0 = ang(p), a1 = ang(q);
    let span = (((a1 - a0) % 360) + 360) % 360;
    if (span > 180) { [a0, a1] = [a1, a0]; span = 360 - span; }
    return { t: 'a', cx: r3(c[0]), cy: r3(c[1]), r: r3(Math.hypot(p[0] - c[0], p[1] - c[1])), a0: r3(a0), a1: r3(a0 + span), s: 'v', tol: 1 };
  };
  return [arc(O1, Mmu, Mmv), arc(O2, Mu, Mv), arc(Q1, Mmu, Mv), arc(Q2, Mmv, Mu)];
}
